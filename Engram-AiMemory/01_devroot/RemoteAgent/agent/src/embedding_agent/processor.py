"""Main document processor orchestrating the embedding pipeline."""

import asyncio
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TaskProgressColumn

from .chunker import TextChunker
from .config import Settings, get_settings
from .embedder import EmbeddingService, create_embedder
from .parsers import get_parser_registry
from .state import StateDB, FileState, compute_file_hash, file_needs_processing
from .watcher import FileWatcher
from .weaviate_client import DocumentChunk, WeaviateClient

console = Console()


class DocumentProcessor:
    """Orchestrates document processing: parse -> chunk -> embed -> upload."""

    def __init__(
        self,
        settings: Optional[Settings] = None,
        weaviate_client: Optional[WeaviateClient] = None,
        embedding_service: Optional[EmbeddingService] = None,
        state_db: Optional[StateDB] = None
    ):
        self.settings = settings or get_settings()
        self.weaviate = weaviate_client
        self.embedding_service = embedding_service
        self.state_db = state_db

        self.parser_registry = get_parser_registry()
        self.chunker = TextChunker(
            chunk_size=self.settings.processing.chunk_size,
            chunk_overlap=self.settings.processing.chunk_overlap
        )

        self._initialized = False

    async def initialize(self):
        """Initialize all components."""
        if self._initialized:
            return

        console.print("[bold cyan]Initializing Embedding Agent...[/bold cyan]")

        # Initialize state DB
        if self.state_db is None:
            self.state_db = StateDB(self.settings.processing.state_db_path)
            console.print("[green]✓ State database initialized[/green]")

        # Initialize embedder
        if self.embedding_service is None:
            embedder = create_embedder(
                model_name=self.settings.embedding.model,
                lmstudio_url=self.settings.lmstudio.url,
                lmstudio_model=self.settings.lmstudio.embedding_model,
                use_lmstudio=self.settings.lmstudio.enabled
            )
            self.embedding_service = EmbeddingService(
                embedder=embedder,
                batch_size=self.settings.embedding.batch_size
            )

        # Initialize Weaviate
        if self.weaviate is None:
            self.weaviate = WeaviateClient(
                url=self.settings.weaviate.url,
                api_key=self.settings.weaviate.api_key,
                timeout=self.settings.weaviate.timeout
            )
            await self.weaviate.connect()

        self._initialized = True
        console.print("[bold green]✓ Agent initialized[/bold green]\n")

    async def process_file(self, file_path: Path) -> int:
        """Process a single file and return the number of chunks created."""
        if not file_path.exists():
            console.print(f"[yellow]File not found: {file_path}[/yellow]")
            return 0

        # Check if processing is needed
        needs_processing, file_hash = file_needs_processing(file_path, self.state_db)

        if not needs_processing:
            return 0

        try:
            # Parse document
            content = self.parser_registry.parse(file_path)
            if not content.strip():
                console.print(f"[yellow]Empty content: {file_path.name}[/yellow]")
                return 0

            # Chunk content
            chunks = self.chunker.chunk_text(content)
            if not chunks:
                return 0

            # Generate embeddings
            chunk_texts = [c.text for c in chunks]
            embeddings = await self.embedding_service.embed_texts(chunk_texts)

            # Prepare document chunks for Weaviate
            stat = file_path.stat()
            doc_chunks: List[DocumentChunk] = []

            for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
                doc_chunk = DocumentChunk(
                    file_path=str(file_path.absolute()),
                    file_name=file_path.name,
                    chunk_text=chunk.text,
                    chunk_index=chunk.chunk_index,
                    total_chunks=chunk.total_chunks,
                    token_count=chunk.token_count,
                    file_hash=file_hash or "",
                    file_extension=file_path.suffix.lower(),
                    last_modified=datetime.fromtimestamp(stat.st_mtime),
                    embedding=embedding.tolist()
                )
                doc_chunks.append(doc_chunk)

            # Upload to Weaviate
            uploaded = await self.weaviate.upsert_chunks(doc_chunks)

            # Update state
            self.state_db.update_file_state(FileState(
                path=str(file_path),
                hash=file_hash or "",
                last_modified=datetime.fromtimestamp(stat.st_mtime),
                last_processed=datetime.now(),
                chunk_count=uploaded,
                status="processed"
            ))

            return uploaded

        except Exception as e:
            console.print(f"[red]Error processing {file_path.name}: {e}[/red]")
            self.state_db.mark_error(str(file_path), str(e))
            return 0

    async def process_files(self, file_paths: List[Path]) -> dict:
        """Process multiple files with progress reporting."""
        total_chunks = 0
        processed_files = 0
        skipped_files = 0
        error_files = 0

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TaskProgressColumn(),
            console=console
        ) as progress:
            task = progress.add_task(
                "[cyan]Processing files...",
                total=len(file_paths)
            )

            for file_path in file_paths:
                try:
                    chunks = await self.process_file(file_path)
                    if chunks > 0:
                        total_chunks += chunks
                        processed_files += 1
                        progress.update(
                            task,
                            description=f"[green]Processed: {file_path.name} ({chunks} chunks)"
                        )
                    else:
                        skipped_files += 1
                except Exception as e:
                    error_files += 1
                    console.print(f"[red]Error: {file_path.name} - {e}[/red]")

                progress.advance(task)

        return {
            "total_files": len(file_paths),
            "processed": processed_files,
            "skipped": skipped_files,
            "errors": error_files,
            "total_chunks": total_chunks
        }

    async def handle_deletion(self, file_path: str):
        """Handle file deletion by removing from Weaviate and state."""
        # Get existing state to find the hash
        state = self.state_db.get_file_state(file_path)
        if state:
            await self.weaviate.delete_by_file_hash(state.hash)
            self.state_db.delete_file_state(file_path)
            console.print(f"[yellow]Removed: {Path(file_path).name}[/yellow]")

    async def run_watcher(self):
        """Run the file watcher for continuous sync."""
        watcher = FileWatcher(
            watch_paths=self.settings.watcher.paths,
            include_patterns=self.settings.processing.include_patterns,
            exclude_patterns=self.settings.processing.exclude_patterns,
            recursive=self.settings.watcher.recursive,
            max_file_size_mb=self.settings.processing.max_file_size_mb
        )

        # Initial scan
        console.print("[bold cyan]Scanning existing files...[/bold cyan]")
        existing_files = watcher.scan_existing()

        if existing_files:
            results = await self.process_files(existing_files)
            console.print(f"\n[bold green]Initial sync complete:[/bold green]")
            console.print(f"  Files processed: {results['processed']}")
            console.print(f"  Files skipped: {results['skipped']}")
            console.print(f"  Total chunks: {results['total_chunks']}\n")

        # Start watching for changes
        console.print("[bold cyan]Watching for file changes... (Ctrl+C to stop)[/bold cyan]")
        event_queue = await watcher.start()

        try:
            while watcher.is_running:
                try:
                    event_type, file_path = await asyncio.wait_for(
                        event_queue.get(),
                        timeout=1.0
                    )

                    if event_type == "deleted":
                        await self.handle_deletion(file_path)
                    else:
                        chunks = await self.process_file(Path(file_path))
                        if chunks > 0:
                            console.print(
                                f"[green]Updated: {Path(file_path).name} "
                                f"({chunks} chunks)[/green]"
                            )

                except asyncio.TimeoutError:
                    continue

        except asyncio.CancelledError:
            pass
        finally:
            await watcher.stop()

    async def get_stats(self) -> dict:
        """Get combined statistics from state DB and Weaviate."""
        local_stats = self.state_db.get_stats()
        weaviate_stats = await self.weaviate.get_stats()

        return {
            "local": local_stats,
            "weaviate": weaviate_stats
        }

    async def close(self):
        """Clean up resources."""
        if self.weaviate:
            await self.weaviate.close()
