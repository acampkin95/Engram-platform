#!/usr/bin/env python3
"""Crawl4AI OSINT CLI - Service management, frontend launcher, and health checks."""

import subprocess
from pathlib import Path
from typing import Optional

try:
    import requests

    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False

try:
    import rich
    from rich.console import Console
    from rich.table import Table
    from rich.panel import Panel

    HAS_RICH = True
except ImportError:
    HAS_RICH = False


if HAS_RICH:
    console = Console()
else:
    console = None


def get_project_root() -> Path:
    """Find project root by looking for docker-compose.yml.

    Raises FileNotFoundError if no docker-compose.yml is found in any parent.
    """
    current = Path.cwd()
    while current != current.parent:
        if (current / "docker-compose.yml").exists():
            return current
        current = current.parent
    raise FileNotFoundError(
        "Could not find docker-compose.yml in any parent directory. "
        "Run this command from within the Crawl4AI project directory."
    )


def run_cmd(
    cmd: list[str], cwd: Optional[Path] = None, capture: bool = False
) -> subprocess.CompletedProcess:
    """Run a command and return the result."""
    return subprocess.run(
        cmd,
        cwd=cwd or get_project_root(),
        capture_output=capture,
        text=True,
        timeout=30,
    )


def print_success(msg: str):
    if console:
        console.print(f"[green]✓[/green] {msg}")
    else:
        print(f"✓ {msg}")


def print_error(msg: str):
    if console:
        console.print(f"[red]✗[/red] {msg}")
    else:
        print(f"✗ {msg}")


def print_info(msg: str):
    if console:
        console.print(f"[cyan]→[/cyan] {msg}")
    else:
        print(f"→ {msg}")


def print_warning(msg: str):
    if console:
        console.print(f"[yellow]⚠[/yellow] {msg}")
    else:
        print(f"⚠ {msg}")
