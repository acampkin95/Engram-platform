"""CLI interface for the embedding agent."""

import asyncio
import signal
from pathlib import Path
from typing import List, Optional

import typer
from dotenv import load_dotenv
from rich.console import Console
from rich.table import Table

from .config import get_settings, Settings
from .processor import DocumentProcessor

# Load environment variables
load_dotenv()

app = typer.Typer(
    name="embedding-agent",
    help="Local embedding agent that streams to remote Weaviate"
)
console = Console()


def handle_shutdown(processor: DocumentProcessor, loop: asyncio.AbstractEventLoop):
    """Handle graceful shutdown."""
    async def cleanup():
        console.print("\n[yellow]Shutting down...[/yellow]")
        await processor.close()

    loop.run_until_complete(cleanup())


@app.command()
def watch(
    paths: Optional[List[Path]] = typer.Option(
        None,
        "--path", "-p",
        help="Paths to watch (can be specified multiple times)"
    ),
    model: str = typer.Option(
        "bge-small",
        "--model", "-m",
        help="Embedding model (bge-small, bge-base, all-MiniLM-L6-v2)"
    ),
    weaviate_url: Optional[str] = typer.Option(
        None,
        "--weaviate-url",
        help="Weaviate URL (overrides env)"
    ),
):
    """
    Watch directories and stream embeddings to Weaviate.
    
    This is the main daemon mode - it will:
    1. Scan existing files and process any new/changed ones
    2. Watch for file changes and process them in real-time
    3. Remove embeddings when files are deleted
    """
    settings = get_settings()

    # Override settings from CLI
    if paths:
        settings.watcher.paths = list(paths)
    if weaviate_url:
        settings.weaviate.url = weaviate_url
    settings.embedding.model = model

    async def run():
        processor = DocumentProcessor(settings=settings)

        # Handle Ctrl+C gracefully
        loop = asyncio.get_event_loop()
        for sig in (signal.SIGINT, signal.SIGTERM):
            loop.add_signal_handler(
                sig,
                lambda: asyncio.create_task(processor.close())
            )

        try:
            await processor.initialize()
            await processor.run_watcher()
        except KeyboardInterrupt:
            pass
        finally:
            await processor.close()

    asyncio.run(run())


@app.command()
def sync(
    paths: List[Path] = typer.Argument(
        ...,
        help="Paths to scan and sync"
    ),
    model: str = typer.Option(
        "bge-small",
        "--model", "-m",
        help="Embedding model"
    ),
    weaviate_url: Optional[str] = typer.Option(
        None,
        "--weaviate-url",
        help="Weaviate URL"
    ),
):
    """
    One-time sync of directories to Weaviate.
    
    Scans the specified paths, processes new/changed files,
    and uploads embeddings to Weaviate. Does not watch for changes.
    """
    settings = get_settings()
    settings.watcher.paths = list(paths)
    if weaviate_url:
        settings.weaviate.url = weaviate_url
    settings.embedding.model = model

    async def run():
        processor = DocumentProcessor(settings=settings)

        try:
            await processor.initialize()

            # Collect all matching files
            from .watcher import FileWatcher
            watcher = FileWatcher(
                watch_paths=settings.watcher.paths,
                include_patterns=settings.processing.include_patterns,
                exclude_patterns=settings.processing.exclude_patterns,
                recursive=settings.watcher.recursive,
                max_file_size_mb=settings.processing.max_file_size_mb
            )

            files = watcher.scan_existing()
            if not files:
                console.print("[yellow]No matching files found[/yellow]")
                return

            results = await processor.process_files(files)

            # Print summary
            table = Table(title="Sync Results")
            table.add_column("Metric", style="cyan")
            table.add_column("Value", style="green")

            table.add_row("Total Files", str(results["total_files"]))
            table.add_row("Processed", str(results["processed"]))
            table.add_row("Skipped (unchanged)", str(results["skipped"]))
            table.add_row("Errors", str(results["errors"]))
            table.add_row("Total Chunks", str(results["total_chunks"]))

            console.print(table)

        finally:
            await processor.close()

    asyncio.run(run())


@app.command()
def stats():
    """Show statistics about indexed documents."""
    settings = get_settings()

    async def run():
        processor = DocumentProcessor(settings=settings)

        try:
            await processor.initialize()
            stats = await processor.get_stats()

            # Local stats
            local_table = Table(title="Local State")
            local_table.add_column("Metric", style="cyan")
            local_table.add_column("Value", style="green")

            local = stats["local"]
            local_table.add_row("Total Files", str(local["total_files"]))
            local_table.add_row("Processed", str(local["processed"]))
            local_table.add_row("Pending", str(local["pending"]))
            local_table.add_row("Errors", str(local["errors"]))
            local_table.add_row("Total Chunks", str(local["total_chunks"]))

            console.print(local_table)
            console.print()

            # Weaviate stats
            weaviate_table = Table(title="Weaviate State")
            weaviate_table.add_column("Metric", style="cyan")
            weaviate_table.add_column("Value", style="green")

            weaviate = stats["weaviate"]
            if "error" in weaviate:
                weaviate_table.add_row("Error", weaviate["error"])
            else:
                weaviate_table.add_row("Collection", weaviate["collection"])
                weaviate_table.add_row("Total Chunks", str(weaviate["total_chunks"]))

            console.print(weaviate_table)

        finally:
            await processor.close()

    asyncio.run(run())


@app.command()
def search(
    query: str = typer.Argument(..., help="Search query"),
    limit: int = typer.Option(5, "--limit", "-n", help="Number of results"),
    extension: Optional[str] = typer.Option(
        None, "--ext", "-e",
        help="Filter by file extension (e.g., .py, .ts)"
    ),
):
    """Search for similar content in indexed documents."""
    settings = get_settings()

    async def run():
        processor = DocumentProcessor(settings=settings)

        try:
            await processor.initialize()

            # Generate query embedding
            query_embedding = await processor.embedding_service.embed_texts([query])
            query_vector = query_embedding[0].tolist()

            # Search
            results = await processor.weaviate.search(
                query_vector=query_vector,
                limit=limit,
                file_extension=extension
            )

            if not results:
                console.print("[yellow]No results found[/yellow]")
                return

            # Display results
            for i, result in enumerate(results, 1):
                console.print(f"\n[bold cyan]{i}. {result['file_name']}[/bold cyan]")
                console.print(f"   [dim]Path: {result['file_path']}[/dim]")
                console.print(f"   [dim]Chunk: {result['chunk_index'] + 1}[/dim]")
                console.print(f"   [dim]Distance: {result['distance']:.4f}[/dim]")
                console.print()

                # Truncate text for display
                text = result['chunk_text'][:300]
                if len(result['chunk_text']) > 300:
                    text += "..."
                console.print(f"   {text}")

        finally:
            await processor.close()

    asyncio.run(run())


@app.command()
def test_embed(
    text: str = typer.Argument(..., help="Text to embed"),
    model: str = typer.Option(
        "bge-small",
        "--model", "-m",
        help="Embedding model"
    ),
):
    """Test embedding generation (useful for debugging)."""
    from .embedder import create_embedder, EmbeddingService

    async def run():
        embedder = create_embedder(model_name=model)
        service = EmbeddingService(embedder=embedder)

        console.print(f"[cyan]Generating embedding for: \"{text}\"[/cyan]")
        embeddings = await service.embed_texts([text])

        console.print(f"\n[green]Embedding dimensions: {embeddings.shape[1]}[/green]")
        console.print(f"[green]First 10 values: {embeddings[0][:10].tolist()}[/green]")

    asyncio.run(run())


if __name__ == "__main__":
    app()
