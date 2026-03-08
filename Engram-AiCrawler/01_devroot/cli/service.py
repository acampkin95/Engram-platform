#!/usr/bin/env python3
"""Service management commands: start, stop, status, restart."""

import json
import subprocess
import time
from pathlib import Path
from typing import Optional
from .main import (
    get_project_root,
    print_success,
    print_error,
    print_info,
    print_warning,
    run_cmd,
    HAS_RICH,
)

if HAS_RICH:
    from rich.table import Table


DEFAULT_API_PORT = 11235
DEFAULT_FRONTEND_PORT = 3000


def _get_root() -> Optional[Path]:
    """Return project root, printing an error and returning None if not found."""
    try:
        return get_project_root()
    except FileNotFoundError as exc:
        print_error(str(exc))
        return None


class _FailedResult:
    """Sentinel for subprocess failures that don't produce a CompletedProcess."""

    returncode = 1


def docker_compose_cmd(subcmd: str, extra_args: Optional[list] = None):
    """Run docker compose with the given subcommand."""
    root = _get_root()
    if root is None:
        return _FailedResult()
    cmd = ["docker", "compose", "-f", str(root / "docker-compose.yml"), subcmd]
    if extra_args:
        cmd.extend(extra_args)
    try:
        return subprocess.run(cmd, cwd=root, timeout=120)
    except FileNotFoundError:
        print_error("docker command not found \u2014 is Docker installed and on PATH?")
        return _FailedResult()
    except subprocess.TimeoutExpired:
        print_warning(f"docker compose {subcmd} timed out after 120s")
        return _FailedResult()


def cmd_start(args):
    """Start all services (Docker + optional frontend)."""
    print_info("Starting Crawl4AI services...")

    result = docker_compose_cmd("up", ["-d"])

    if result.returncode == 0:
        print_success("Docker services started")

        time.sleep(3)
        cmd_status(args)

        if getattr(args, "frontend", False):
            print_info("Starting frontend dev server...")
            cmd_frontend(args)
    else:
        print_error("Failed to start Docker services")
        return 1

    return 0


def cmd_stop(args):
    """Stop all services."""
    print_info("Stopping Crawl4AI services...")

    result = docker_compose_cmd("down")

    if result.returncode == 0:
        print_success("Docker services stopped")
    else:
        print_error("Failed to stop Docker services")
        return 1

    return 0


def cmd_restart(args):
    """Restart all services."""
    print_info("Restarting Crawl4AI services...")

    result = docker_compose_cmd("restart")

    if result.returncode == 0:
        print_success("Docker services restarted")
        time.sleep(2)
        cmd_status(args)
    else:
        print_error("Failed to restart Docker services")
        return 1

    return 0


def cmd_status(args):
    """Show status of all services."""
    root = _get_root()
    if root is None:
        return 1

    console = None
    table = None
    if HAS_RICH:
        from rich.console import Console

        console = Console()
        table = Table(title="Crawl4AI Service Status")
        table.add_column("Service", style="cyan")
        table.add_column("Status", justify="center")
        table.add_column("Port", justify="center")
        table.add_column("Health", justify="center")
    else:
        print("\nCrawl4AI Service Status")
        print("=" * 50)

    try:
        docker_result = run_cmd(
            ["docker", "compose", "-f", str(root / "docker-compose.yml"), "ps", "--format", "json"],
            capture=True,
        )
    except FileNotFoundError:
        print_error("docker command not found — is Docker installed?")
        return 1
    except subprocess.TimeoutExpired:
        print_error("docker compose ps timed out")
        return 1

    services_status = {}

    if docker_result.returncode == 0 and docker_result.stdout.strip():
        try:
            for line in docker_result.stdout.strip().split("\n"):
                if line.strip():
                    data = json.loads(line)
                    name = data.get("Name", data.get("Service", "unknown"))
                    status = data.get("State", data.get("Status", "unknown"))
                    ports = data.get("Publishers", [])
                    port_str = (
                        ", ".join(f"{p.get('PublishedPort', '?')}" for p in ports) if ports else "-"
                    )
                    services_status[name] = {"status": status, "ports": port_str}
        except (json.JSONDecodeError, KeyError):
            pass

    if not services_status:
        try:
            run_cmd(["docker", "compose", "-f", str(root / "docker-compose.yml"), "ps"])
        except (FileNotFoundError, subprocess.TimeoutExpired):
            pass
        return 0

    for name, info in services_status.items():
        status = info["status"]
        ports = info["ports"]

        if "running" in status.lower() or "up" in status.lower():
            status_display = "[green]● Running[/green]" if HAS_RICH else "● Running"
        elif "exited" in status.lower():
            status_display = "[yellow]● Stopped[/yellow]" if HAS_RICH else "● Stopped"
        else:
            status_display = f"[red]● {status}[/red]" if HAS_RICH else f"● {status}"

        health = check_health_endpoint()
        health_display = (
            ("[green]healthy[/green]" if health else "[red]unhealthy[/red]")
            if HAS_RICH
            else ("healthy" if health else "unhealthy")
        )

        if HAS_RICH:
            table.add_row(name, status_display, ports, health_display)
        else:
            print(f"{name}: {status} | Ports: {ports} | Health: {health_display}")

    if HAS_RICH:
        console.print(table)

    return 0


def check_health_endpoint() -> bool:
    """Check if the API health endpoint responds."""
    try:
        import requests

        resp = requests.get(f"http://localhost:{DEFAULT_API_PORT}/health", timeout=5)
        return resp.status_code == 200
    except Exception:
        return False


def cmd_logs(args):
    """Show logs from services."""
    root = _get_root()
    if root is None:
        return 1

    service = getattr(args, "service", None)
    follow = getattr(args, "follow", False)

    cmd = ["docker", "compose", "-f", str(root / "docker-compose.yml"), "logs"]

    if follow:
        cmd.append("-f")

    if service:
        cmd.append(service)

    try:
        subprocess.run(cmd, cwd=root, timeout=None if follow else 30)
    except FileNotFoundError:
        print_error("docker command not found — is Docker installed?")
        return 1
    except subprocess.TimeoutExpired:
        print_warning("docker compose logs timed out")
    return 0


def cmd_frontend(args):
    """Start the frontend development server."""
    root = _get_root()
    if root is None:
        return 1

    frontend_dir = root / "frontend"

    if not frontend_dir.exists():
        print_error(f"Frontend directory not found: {frontend_dir}")
        return 1

    port = getattr(args, "port", DEFAULT_FRONTEND_PORT)

    print_info(f"Starting frontend on port {port}...")

    try:
        subprocess.run(
            ["npm", "run", "dev", "--", "--port", str(port)],
            cwd=frontend_dir,
            timeout=None,  # frontend server runs indefinitely
        )
    except FileNotFoundError:
        print_error("npm not found — is Node.js installed?")
        return 1
    except KeyboardInterrupt:
        print_info("Frontend server stopped.")

    return 0


def cmd_health(args):
    """Run health check against the API."""
    print_info("Running health check...")

    try:
        import requests

        resp = requests.get(f"http://localhost:{DEFAULT_API_PORT}/health", timeout=10)

        if resp.status_code == 200:
            data = resp.json()
            print_success("API is healthy")

            if HAS_RICH:
                from rich.console import Console
                from rich.table import Table

                console = Console()

                table = Table(title="Health Details")
                table.add_column("Component", style="cyan")
                table.add_column("Status")

                for key, value in data.items():
                    if key != "status":
                        if isinstance(value, str) and "connect" in value.lower():
                            status_display = (
                                f"[green]{value}[/green]"
                                if "connect" in value.lower()
                                else f"[red]{value}[/red]"
                            )
                        else:
                            status_display = str(value)
                        table.add_row(key, status_display)

                console.print(table)
            else:
                for key, value in data.items():
                    if key != "status":
                        print(f"  {key}: {value}")

            return 0
        else:
            print_error(f"API returned status {resp.status_code}")
            return 1

    except Exception as e:
        print_error(f"Health check failed: {e}")
        return 1


def add_service_parser(subparsers):
    """Add service management commands to the CLI parser."""
    service_parser = subparsers.add_parser("service", help="Service management", aliases=["svc"])
    service_sub = service_parser.add_subparsers(dest="service_cmd", required=True)

    start_parser = service_sub.add_parser("start", help="Start all services")
    start_parser.add_argument(
        "--frontend", "-f", action="store_true", help="Also start frontend dev server"
    )
    start_parser.set_defaults(func=cmd_start)

    stop_parser = service_sub.add_parser("stop", help="Stop all services")
    stop_parser.set_defaults(func=cmd_stop)

    restart_parser = service_sub.add_parser("restart", help="Restart all services")
    restart_parser.set_defaults(func=cmd_restart)

    status_parser = service_sub.add_parser("status", help="Show service status")
    status_parser.set_defaults(func=cmd_status)

    logs_parser = service_sub.add_parser("logs", help="Show service logs")
    logs_parser.add_argument("--follow", "-f", action="store_true", help="Follow log output")
    logs_parser.add_argument("service", nargs="?", help="Service name (crawl4ai, redis)")
    logs_parser.set_defaults(func=cmd_logs)

    frontend_parser = service_sub.add_parser("frontend", help="Start frontend dev server")
    frontend_parser.add_argument(
        "--port", "-p", type=int, default=DEFAULT_FRONTEND_PORT, help="Port number"
    )
    frontend_parser.set_defaults(func=cmd_frontend)

    health_parser = service_sub.add_parser("health", help="Run health check")
    health_parser.set_defaults(func=cmd_health)
