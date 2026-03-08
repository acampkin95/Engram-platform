#!/usr/bin/env python3
"""Crawl4AI OSINT CLI entry point."""

import argparse
import sys

from .main import HAS_RICH, print_error
from .service import add_service_parser
from .setup import add_setup_parser


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="c4ai",
        description="Crawl4AI OSINT Container management CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  c4ai setup                    First-run setup wizard (configure Engram, Docker)
  c4ai service status           Show status of all services
  c4ai service start            Start Docker services
  c4ai service start --frontend Start Docker services + frontend dev server
  c4ai service stop             Stop all services
  c4ai service restart          Restart all services
  c4ai service logs -f          Follow logs from all services
  c4ai service logs crawl4ai    Show logs for crawl4ai service
  c4ai service frontend         Start frontend dev server only
  c4ai service health           Run health check against API
""",
    )

    parser.add_argument(
        "--version",
        action="version",
        version="c4ai 0.2.0",
    )

    subparsers = parser.add_subparsers(dest="command", metavar="<command>")
    subparsers.required = True

    add_service_parser(subparsers)
    add_setup_parser(subparsers)

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    if not hasattr(args, "func"):
        parser.print_help()
        return 1

    if HAS_RICH:
        from rich.console import Console

        Console().print("[bold cyan]Crawl4AI OSINT CLI[/bold cyan]", end="  ")

    try:
        return args.func(args) or 0
    except KeyboardInterrupt:
        print("\nAborted.")
        return 130
    except Exception as e:
        print_error(f"Unexpected error: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
