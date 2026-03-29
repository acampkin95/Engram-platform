"""Docker service entrypoint for investigation AI workers."""

from __future__ import annotations

import asyncio
import contextlib
import os
import signal
from datetime import UTC, datetime

from rich.console import Console

console = Console()

# ─── Config from environment ───────────────────────────────────────────────
WEAVIATE_URL = os.environ.get("WEAVIATE_URL", "http://weaviate:8080")
WORKERS_INTERVAL = int(os.environ.get("INVESTIGATION_WORKERS_INTERVAL_MINUTES", "5"))


async def run_workers_service() -> None:
    """Main workers service loop.

    Runs all investigation workers at a configured interval:
    1. EntityExtractionWorker — NER on unprocessed evidence chunks
    2. TimelineExtractionWorker — extract date-anchored events
    3. ContradictionFlaggingWorker — flag contradictions between events
    4. IntelligenceReportWorker — generate summary reports
    """
    console.print("[cyan]Investigation Workers Service starting...[/cyan]")
    console.print(f"[cyan]  WEAVIATE_URL: {WEAVIATE_URL}[/cyan]")
    console.print(f"[cyan]  WORKERS_INTERVAL: {WORKERS_INTERVAL} minutes[/cyan]")

    shutdown_event = asyncio.Event()

    def handle_shutdown(signum, frame):
        console.print(f"[yellow]Received signal {signum}, shutting down...[/yellow]")
        shutdown_event.set()

    signal.signal(signal.SIGTERM, handle_shutdown)
    signal.signal(signal.SIGINT, handle_shutdown)

    # Connect to Weaviate
    weaviate_client = None
    matter_client = None
    registry_client = None

    async def connect_weaviate():
        nonlocal weaviate_client, matter_client, registry_client
        try:
            from memory_system.client import WeaviateMemoryClient
            from memory_system.investigation.matter_client import MatterClient
            from memory_system.investigation.registry_client import GlobalRegistryClient

            wc = WeaviateMemoryClient()
            await wc.connect()
            weaviate_client = wc._client
            matter_client = MatterClient(weaviate_client)
            registry_client = GlobalRegistryClient(weaviate_client)
            console.print("[green]Weaviate connected[/green]")
            return True
        except Exception as exc:
            console.print(f"[red]Weaviate connection failed: {exc}[/red]")
            return False

    # Initial connection attempt
    await connect_weaviate()

    console.print("[green]Investigation Workers Service ready[/green]")

    while not shutdown_event.is_set():
        if matter_client is not None and weaviate_client is not None:
            await run_worker_cycle(weaviate_client, matter_client, registry_client)
        else:
            console.print("[yellow]Workers: Weaviate not connected, retrying...[/yellow]")
            await connect_weaviate()

        # Wait for next interval or shutdown
        with contextlib.suppress(TimeoutError):
            await asyncio.wait_for(shutdown_event.wait(), timeout=WORKERS_INTERVAL * 60)

    console.print("[cyan]Investigation Workers Service stopped[/cyan]")


async def run_worker_cycle(weaviate_client, matter_client, registry_client) -> None:
    """Run one full cycle of all workers across all active matters."""
    from memory_system.investigation.workers import (
        ContradictionFlaggingWorker,
        EntityExtractionWorker,
        IntelligenceReportWorker,
        TimelineExtractionWorker,
    )

    console.print(f"[dim]Workers: starting cycle at {datetime.now(UTC).isoformat()}[/dim]")

    # Get all active matters
    try:
        matters = await matter_client.list_matters()
        if not matters:
            console.print("[dim]Workers: no active matters[/dim]")
            return
    except Exception as exc:
        console.print(f"[red]Workers: failed to list matters: {exc}[/red]")
        return

    entity_worker = EntityExtractionWorker(weaviate_client, matter_client, registry_client)
    timeline_worker = TimelineExtractionWorker(weaviate_client, matter_client)
    contradiction_worker = ContradictionFlaggingWorker(weaviate_client, matter_client)
    report_worker = IntelligenceReportWorker(weaviate_client, matter_client, registry_client)

    for matter in matters:
        matter_id = matter.matter_id
        console.print(f"[dim]Workers: processing matter {matter_id}[/dim]")
        try:
            ner_result = await entity_worker.process_matter(matter_id)
            console.print(f"[dim]  NER: {ner_result}[/dim]")
        except Exception as exc:
            console.print(f"[yellow]  NER failed for {matter_id}: {exc}[/yellow]")

        try:
            tl_result = await timeline_worker.process_matter(matter_id)
            console.print(f"[dim]  Timeline: {tl_result}[/dim]")
        except Exception as exc:
            console.print(f"[yellow]  Timeline failed for {matter_id}: {exc}[/yellow]")

        try:
            contra_result = await contradiction_worker.process_matter(matter_id)
            console.print(f"[dim]  Contradictions: {contra_result}[/dim]")
        except Exception as exc:
            console.print(f"[yellow]  Contradiction check failed for {matter_id}: {exc}[/yellow]")

        try:
            report = await report_worker.generate_report(matter_id)
            console.print(f"[dim]  Report generated: {report.get('summary', {})}[/dim]")
        except Exception as exc:
            console.print(f"[yellow]  Report generation failed for {matter_id}: {exc}[/yellow]")

    console.print(f"[green]Workers: cycle complete for {len(matters)} matters[/green]")


if __name__ == "__main__":
    asyncio.run(run_workers_service())
