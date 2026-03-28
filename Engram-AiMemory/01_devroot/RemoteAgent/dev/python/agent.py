"""
Embedding Agent - Main orchestrator for file watching, processing, and syncing
"""
import os
import asyncio
import signal
from pathlib import Path
from typing import Optional
from dataclasses import dataclass
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler, FileSystemEvent
from dotenv import load_dotenv
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn

from embedding_worker import EmbeddingWorker
from document_processor import DocumentProcessor
from weaviate_client import WeaviateClient
from state_manager import StateManager

load_dotenv()
console = Console()


@dataclass
class ProcessingResult:
    """Result of processing a single file"""
    file_path: str
    success: bool
    chunks_processed: int
    chunks_synced: int
    error: Optional[str] = None


class FileChangeHandler(FileSystemEventHandler):
    """Handles file system events for the watcher"""
    
    def __init__(self, agent: "EmbeddingAgent"):
        self.agent = agent
        self._debounce_tasks: dict[str, asyncio.Task] = {}
    
    def _should_process(self, path: str) -> bool:
        """Check if file should be processed"""
        return self.agent.processor.is_supported(path)
    
    def _queue_file(self, path: str):
        """Queue file for processing with debounce"""
        if not self._should_process(path):
            return
        
        # Cancel existing task for this file
        if path in self._debounce_tasks:
            self._debounce_tasks[path].cancel()
        
        # Create new debounced task
        async def debounced_process():
            await asyncio.sleep(1.0)  # Debounce delay
            await self.agent.process_file(path)
        
        loop = asyncio.get_event_loop()
        self._debounce_tasks[path] = loop.create_task(debounced_process())
    
    def on_created(self, event: FileSystemEvent):
        if not event.is_directory:
            console.print(f"[dim]File created: {event.src_path}[/dim]")
            self._queue_file(event.src_path)
    
    def on_modified(self, event: FileSystemEvent):
        if not event.is_directory:
            console.print(f"[dim]File modified: {event.src_path}[/dim]")
            self._queue_file(event.src_path)
    
    def on_deleted(self, event: FileSystemEvent):
        if not event.is_directory:
            console.print(f"[dim]File deleted: {event.src_path}[/dim]")
            # Queue for state cleanup (async)
            asyncio.create_task(self.agent.handle_deleted(event.src_path))


class EmbeddingAgent:
    """Main agent that orchestrates the embedding pipeline"""
    
    def __init__(self):
        self.embedding_worker = EmbeddingWorker()
        self.processor = DocumentProcessor()
        self.weaviate = WeaviateClient()
        self.state = StateManager()
        
        self._observer: Optional[Observer] = None
        self._running = False
        
        # Parse watch directories from env
        watch_dirs_str = os.getenv("WATCH_DIRS", "")
        self.watch_dirs = [d.strip() for d in watch_dirs_str.split(",") if d.strip()]
        
        self.batch_size = int(os.getenv("BATCH_SIZE", "100"))
    
    async def initialize(self) -> bool:
        """Initialize all components"""
        console.print("\n[bold blue]═══ Embedding Agent Initializing ═══[/bold blue]\n")
        
        # Connect to LM Studio
        if not await self.embedding_worker.connect():
            return False
        
        # Connect to Weaviate
        if not self.weaviate.connect():
            return False
        
        # Ensure collection exists
        if not self.weaviate.ensure_collection():
            return False
        
        console.print("\n[green]✓ All components initialized[/green]\n")
        return True
    
    async def shutdown(self):
        """Cleanup on shutdown"""
        console.print("\n[yellow]Shutting down...[/yellow]")
        
        self._running = False
        
        if self._observer:
            self._observer.stop()
            self._observer.join()
        
        await self.embedding_worker.disconnect()
        self.weaviate.disconnect()
        
        console.print("[green]✓ Shutdown complete[/green]")
    
    async def process_file(self, file_path: str) -> ProcessingResult:
        """Process a single file through the pipeline"""
        path = Path(file_path)
        
        if not path.exists():
            return ProcessingResult(
                file_path=file_path,
                success=False,
                chunks_processed=0,
                chunks_synced=0,
                error="File not found"
            )
        
        # Process document
        doc = self.processor.process(file_path)
        
        if doc.error:
            return ProcessingResult(
                file_path=file_path,
                success=False,
                chunks_processed=0,
                chunks_synced=0,
                error=doc.error
            )
        
        # Check if file has changed
        if not self.state.has_changed(file_path, doc.file_hash):
            console.print(f"[dim]Skipping unchanged: {path.name}[/dim]")
            return ProcessingResult(
                file_path=file_path,
                success=True,
                chunks_processed=0,
                chunks_synced=0
            )
        
        console.print(f"[blue]Processing:[/blue] {path.name} ({len(doc.chunks)} chunks)")
        
        # Delete old chunks if re-indexing
        old_state = self.state.get_state(file_path)
        if old_state:
            self.weaviate.delete_by_file_hash(old_state.file_hash)
        
        # Generate embeddings for all chunks
        chunk_texts = [chunk.content for chunk in doc.chunks]
        embeddings = await self.embedding_worker.embed_batch(chunk_texts)
        
        # Prepare batch for Weaviate
        weaviate_chunks = []
        for chunk, embedding_result in zip(doc.chunks, embeddings):
            if embedding_result:
                weaviate_chunks.append({
                    "content": chunk.content,
                    "embedding": embedding_result.embedding,
                    "file_path": doc.file_path,
                    "file_name": path.name,
                    "file_type": doc.file_type.value,
                    "file_hash": doc.file_hash,
                    "chunk_index": chunk.chunk_index,
                    "total_chunks": chunk.total_chunks,
                })
        
        # Insert into Weaviate
        success_count, error_count = self.weaviate.insert_batch(weaviate_chunks)
        
        # Update state
        self.state.update_state(
            file_path=file_path,
            file_hash=doc.file_hash,
            chunk_count=len(doc.chunks),
            weaviate_synced=(error_count == 0)
        )
        
        console.print(
            f"[green]✓[/green] {path.name}: "
            f"{success_count} synced, {error_count} errors"
        )
        
        return ProcessingResult(
            file_path=file_path,
            success=error_count == 0,
            chunks_processed=len(doc.chunks),
            chunks_synced=success_count,
            error=f"{error_count} chunks failed" if error_count > 0 else None
        )
    
    async def handle_deleted(self, file_path: str):
        """Handle a deleted file"""
        state = self.state.get_state(file_path)
        if state:
            # Delete from Weaviate
            self.weaviate.delete_by_file_hash(state.file_hash)
            # Delete from state
            self.state.delete_state(file_path)
            console.print(f"[yellow]Removed:[/yellow] {Path(file_path).name}")
    
    async def scan_directory(self, directory: str) -> list[ProcessingResult]:
        """Scan and process all files in a directory"""
        results = []
        
        console.print(f"\n[bold]Scanning: {directory}[/bold]")
        
        docs = list(self.processor.process_directory(directory))
        
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
            console=console,
        ) as progress:
            task = progress.add_task("Processing files...", total=len(docs))
            
            for doc in docs:
                result = await self.process_file(doc.file_path)
                results.append(result)
                progress.advance(task)
        
        # Summary
        success = sum(1 for r in results if r.success)
        chunks = sum(r.chunks_synced for r in results)
        console.print(f"\n[green]✓ Processed {success}/{len(results)} files ({chunks} chunks)[/green]")
        
        return results
    
    def start_watching(self):
        """Start watching directories for changes"""
        if not self.watch_dirs:
            console.print("[yellow]No watch directories configured[/yellow]")
            return
        
        self._observer = Observer()
        handler = FileChangeHandler(self)
        
        for watch_dir in self.watch_dirs:
            if Path(watch_dir).exists():
                self._observer.schedule(handler, watch_dir, recursive=True)
                console.print(f"[blue]Watching:[/blue] {watch_dir}")
            else:
                console.print(f"[yellow]Directory not found:[/yellow] {watch_dir}")
        
        self._observer.start()
    
    async def run(self, initial_scan: bool = True):
        """Main run loop"""
        if not await self.initialize():
            console.print("[red]Failed to initialize agent[/red]")
            return
        
        # Initial scan
        if initial_scan and self.watch_dirs:
            for watch_dir in self.watch_dirs:
                if Path(watch_dir).exists():
                    await self.scan_directory(watch_dir)
        
        # Start file watcher
        self.start_watching()
        
        # Run until stopped
        self._running = True
        console.print("\n[bold green]Agent running. Press Ctrl+C to stop.[/bold green]\n")
        
        try:
            while self._running:
                await asyncio.sleep(1)
        except asyncio.CancelledError:
            pass
        
        await self.shutdown()
    
    def get_stats(self) -> dict:
        """Get combined stats"""
        state_stats = self.state.get_stats()
        weaviate_stats = self.weaviate.get_stats()
        
        return {
            **state_stats,
            "weaviate_chunks": weaviate_stats.get("total_chunks", 0),
        }


async def main():
    agent = EmbeddingAgent()
    
    # Handle shutdown signals
    loop = asyncio.get_event_loop()
    
    def signal_handler():
        asyncio.create_task(agent.shutdown())
    
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, signal_handler)
    
    await agent.run()


if __name__ == "__main__":
    asyncio.run(main())
