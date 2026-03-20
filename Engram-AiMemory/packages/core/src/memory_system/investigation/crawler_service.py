"""Docker service entrypoint for investigation OSINT crawler."""
from __future__ import annotations

import asyncio
import contextlib
import os
import signal

from rich.console import Console

console = Console()

# ─── Config from environment ───────────────────────────────────────────────
WEAVIATE_URL = os.environ.get("WEAVIATE_URL", "http://weaviate:8080")
REDIS_URL = os.environ.get("REDIS_URL", "redis://redis:6379/0")
API_URL = os.environ.get("MEMORY_API_URL", "http://memory-api:8000")
CRAWLER_POLL_INTERVAL = int(os.environ.get("CRAWLER_POLL_INTERVAL_SECONDS", "30"))


async def run_crawler_service() -> None:
    """Main crawler service loop.

    Polls for pending crawl jobs from the API and executes them.
    Uses Redis for URL deduplication per matter.
    """
    console.print("[cyan]Investigation Crawler Service starting...[/cyan]")
    console.print(f"[cyan]  WEAVIATE_URL: {WEAVIATE_URL}[/cyan]")
    console.print(f"[cyan]  REDIS_URL: {REDIS_URL}[/cyan]")
    console.print(f"[cyan]  API_URL: {API_URL}[/cyan]")
    console.print(f"[cyan]  POLL_INTERVAL: {CRAWLER_POLL_INTERVAL}s[/cyan]")

    # Setup Redis client for deduplication
    redis_client = None
    try:
        import redis
        redis_client = redis.from_url(REDIS_URL, decode_responses=True)
        redis_client.ping()
        console.print("[green]Redis connected for URL deduplication[/green]")
    except Exception as exc:
        console.print(f"[yellow]Redis unavailable, using in-memory dedup: {exc}[/yellow]")

    # Setup Weaviate client
    weaviate_client = None
    matter_client = None

    try:
        from memory_system.client import WeaviateMemoryClient
        from memory_system.investigation.evidence_client import EvidenceClient
        from memory_system.investigation.matter_client import MatterClient

        wc = WeaviateMemoryClient()
        await wc.connect()
        weaviate_client = wc._client
        matter_client = MatterClient(weaviate_client)
        EvidenceClient(weaviate_client, matter_client)
        console.print("[green]Weaviate connected[/green]")
    except Exception as exc:
        console.print(f"[red]Weaviate connection failed: {exc}[/red]")
        console.print("[yellow]Crawler service will retry on next iteration[/yellow]")

    from memory_system.investigation.crawler import InvestigationCrawler
    InvestigationCrawler(redis_client=redis_client)

    shutdown_event = asyncio.Event()

    def handle_shutdown(signum, frame):
        console.print(f"[yellow]Received signal {signum}, shutting down...[/yellow]")
        shutdown_event.set()

    signal.signal(signal.SIGTERM, handle_shutdown)
    signal.signal(signal.SIGINT, handle_shutdown)

    console.print("[green]Investigation Crawler Service ready. Waiting for jobs...[/green]")

    iteration = 0
    while not shutdown_event.is_set():
        iteration += 1
        try:
            # Poll API for pending crawl jobs
            import httpx
            async with httpx.AsyncClient(timeout=10.0) as http:
                response = await http.get(f"{API_URL}/matters/")
                if response.status_code == 200:
                    matters = response.json()
                    if matters and iteration % 10 == 1:  # Log every 10 iterations
                        console.print(f"[dim]Crawler: {len(matters)} active matters[/dim]")
        except Exception as exc:
            if iteration % 10 == 1:
                console.print(f"[yellow]Crawler: API poll failed: {exc}[/yellow]")

        # Wait for next poll interval or shutdown
        with contextlib.suppress(TimeoutError):
            await asyncio.wait_for(
                shutdown_event.wait(),
                timeout=CRAWLER_POLL_INTERVAL
            )

    console.print("[cyan]Investigation Crawler Service stopped[/cyan]")


if __name__ == "__main__":
    asyncio.run(run_crawler_service())
