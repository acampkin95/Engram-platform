#!/usr/bin/env python3
"""
Interactive first-run setup wizard for Crawl4AI OSINT.

Covers:
  1. Core environment validation (.env exists / template copy)
  2. Engram memory integration (optional — Weaviate/DN0_INT_Weaviate)
  3. Docker Compose readiness check
  4. Quick health check after services start

Run with:
    c4ai setup
"""
from __future__ import annotations

import shutil
import socket
import subprocess
import time
from pathlib import Path

from .main import (
    get_project_root,
    print_success,
    print_error,
    print_info,
    print_warning,
    HAS_RICH,
)

if HAS_RICH:
    from rich.console import Console
    from rich.panel import Panel
    from rich.prompt import Confirm, Prompt

    console = Console()
else:
    console = None


# ── helpers ───────────────────────────────────────────────────────────────────


def _print_header(title: str) -> None:
    if console:
        console.print(Panel(f"[bold cyan]{title}[/bold cyan]", expand=False))
    else:
        print(f"\n{'=' * 60}")
        print(f"  {title}")
        print(f"{'=' * 60}")


def _ask_yes_no(question: str, default: bool = True) -> bool:
    """Prompt for a yes/no answer, works with or without Rich."""
    if HAS_RICH:
        try:
            return Confirm.ask(question, default=default)
        except (EOFError, KeyboardInterrupt):
            print()
            return default
    suffix = " [Y/n]" if default else " [y/N]"
    try:
        raw = input(f"{question}{suffix}: ").strip().lower()
    except (EOFError, KeyboardInterrupt):
        print()
        return default
    if not raw:
        return default
    return raw in ("y", "yes")


def _ask_str(prompt: str, default: str = "", password: bool = False) -> str:
    """Prompt for a string value, works with or without Rich."""
    if HAS_RICH:
        try:
            if password:
                return Prompt.ask(prompt, default=default, password=True)
            return Prompt.ask(prompt, default=default)
        except (EOFError, KeyboardInterrupt):
            print()
            return default
    display_default = f" [{default}]" if default else ""
    try:
        raw = input(f"{prompt}{display_default}: ").strip()
    except (EOFError, KeyboardInterrupt):
        print()
        return default
    return raw or default


def _env_path(root: Path) -> Path:
    return root / ".env"


def _env_example_path(root: Path) -> Path:
    return root / ".env.example"


def _read_env(root: Path) -> dict[str, str]:
    """Parse .env file into a dict (ignores comments and blank lines)."""
    env: dict[str, str] = {}
    path = _env_path(root)
    if not path.exists():
        return env
    try:
        text = path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, PermissionError, OSError) as exc:
        print_error(f"Cannot read {path}: {exc}")
        return env
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            k, _, v = line.partition("=")
            env[k.strip()] = v.strip()
    return env


def _write_env_key(root: Path, key: str, value: str) -> None:
    """
    Set a key in the .env file.
    - If the key exists (even commented out), replace/uncomment it.
    - Otherwise append it at the end.
    """
    path = _env_path(root)
    try:
        text = path.read_text(encoding="utf-8") if path.exists() else ""
    except (UnicodeDecodeError, PermissionError, OSError) as exc:
        print_error(f"Cannot read {path}: {exc}")
        return
    lines = text.splitlines()

    new_line = f"{key}={value}"
    replaced = False
    new_lines: list[str] = []

    for line in lines:
        stripped = line.lstrip("#").strip()
        if stripped.startswith(f"{key}=") or stripped == key:
            new_lines.append(new_line)
            replaced = True
        else:
            new_lines.append(line)

    if not replaced:
        # Append with a blank line separator if file doesn't end with one
        if new_lines and new_lines[-1].strip():
            new_lines.append("")
        new_lines.append(new_line)

    try:
        path.write_text("\n".join(new_lines) + "\n", encoding="utf-8")
    except (PermissionError, OSError, IsADirectoryError) as exc:
        print_error(f"Cannot write {path}: {exc}")
        raise


def _write_env_block(root: Path, block: dict[str, str]) -> None:
    """Write multiple env keys at once."""
    for k, v in block.items():
        _write_env_key(root, k, v)


# ── Step 1: .env bootstrap ────────────────────────────────────────────────────


def step_env_bootstrap(root: Path) -> bool:
    """Ensure a .env file exists. Copy from .env.example if needed."""
    _print_header("Step 1 — Environment configuration")

    env_path = _env_path(root)
    example_path = _env_example_path(root)

    if env_path.exists():
        print_success(".env file already exists")
        return True

    if not example_path.exists():
        print_error(f".env.example not found at {example_path}")
        print_info("Create a .env file manually before continuing.")
        return False

    try:
        shutil.copy(example_path, env_path)
        print_success(f"Created .env from .env.example at {env_path}")
        print_info("Review and update .env with your credentials before starting services.")
        return True
    except (PermissionError, OSError, FileNotFoundError) as exc:
        print_error(f"Failed to create .env: {exc}")
        return False


# ── Step 2: Engram opt-in ─────────────────────────────────────────────────────


def step_engram(root: Path) -> bool:
    """
    Interactive Engram integration setup.

    Returns True if Engram was configured (enabled or skipped cleanly).
    """
    _print_header("Step 2 — Engram Memory Integration (optional)")

    if console:
        console.print(
            "[dim]Engram is the Weaviate-based long-term memory system (DN0_INT_Weaviate).\n"
            "When enabled, Crawl4AI stores crawl results and OSINT findings in Engram\n"
            "for persistent, semantic memory across sessions.[/dim]\n"
        )
    else:
        print(
            "\nEngram is the Weaviate-based long-term memory system (DN0_INT_Weaviate).\n"
            "When enabled, Crawl4AI stores crawl results and OSINT findings in Engram\n"
            "for persistent, semantic memory across sessions.\n"
        )

    # Check if already configured
    current_env = _read_env(root)
    already_enabled = current_env.get("ENGRAM_ENABLED", "false").lower() == "true"

    if already_enabled:
        current_url = current_env.get("ENGRAM_API_URL", "")
        print_success(f"Engram is already enabled (API: {current_url})")
        if not _ask_yes_no("Reconfigure Engram?", default=False):
            return True

    # Ask whether to enable
    enable = _ask_yes_no(
        "\nEnable Engram memory integration?",
        default=False,
    )

    if not enable:
        _write_env_key(root, "ENGRAM_ENABLED", "false")
        print_info("Engram skipped. You can enable it later by running `c4ai setup` again.")
        return True

    # Collect connection details
    print_info("\nEngram API connection settings:")

    api_url = _ask_str(
        "  Engram API URL",
        default=current_env.get("ENGRAM_API_URL", "http://localhost:8000"),
    )

    api_key = _ask_str(
        "  API key (leave blank if auth is disabled)",
        default=current_env.get("ENGRAM_API_KEY", ""),
        password=True,
    )

    auto_store = _ask_yes_no(
        "  Automatically store every crawl result in Engram?",
        default=True,
    )

    # Test connectivity
    print_info(f"\nTesting connection to {api_url} ...")
    reachable = _test_engram_connection(api_url, api_key)

    if reachable:
        print_success("Engram API is reachable")
    else:
        print_warning(
            "Could not reach the Engram API. "
            "Make sure DN0_INT_Weaviate is running and the URL is correct."
        )
        if not _ask_yes_no("Save configuration anyway and continue?", default=True):
            _write_env_key(root, "ENGRAM_ENABLED", "false")
            print_info("Engram configuration cancelled.")
            return True

    # Persist to .env
    _write_env_block(
        root,
        {
            "ENGRAM_ENABLED": "true",
            "ENGRAM_API_URL": api_url,
            "ENGRAM_API_KEY": api_key,
            "ENGRAM_AUTO_STORE": "true" if auto_store else "false",
        },
    )

    print_success("Engram configuration saved to .env")
    if console:
        console.print(
            f"\n[green]Engram enabled[/green]\n"
            f"  API URL:    [cyan]{api_url}[/cyan]\n"
            f"  Auto-store: {'[green]yes[/green]' if auto_store else '[yellow]no[/yellow]'}\n"
        )
    return True


def _test_engram_connection(api_url: str, api_key: str = "") -> bool:
    """Try a quick HTTP GET to /health on the Engram API. No deps beyond stdlib."""
    # Validate URL before attempting connection
    if not api_url or not api_url.strip().startswith(("http://", "https://")):
        return False
    try:
        import urllib.request
        import urllib.error

        url = api_url.rstrip("/") + "/health"
        req = urllib.request.Request(url)
        if api_key:
            req.add_header("Authorization", f"Bearer {api_key}")
        with urllib.request.urlopen(req, timeout=5) as resp:
            return resp.status == 200
    except urllib.error.HTTPError as exc:
        # Server responded but with an error status — still reachable
        return exc.code < 500
    except urllib.error.URLError:
        return False
    except (socket.timeout, OSError, ValueError):
        return False
    except Exception:
        return False


# ── Step 3: Docker readiness ──────────────────────────────────────────────────


def step_docker(root: Path) -> bool:
    """Verify Docker and Docker Compose are available."""
    _print_header("Step 3 — Docker readiness")

    docker_ok = shutil.which("docker") is not None
    if docker_ok:
        print_success("Docker is installed")
    else:
        print_error("Docker not found. Install Docker Desktop before starting services.")
        return False

    try:
        result = subprocess.run(
            ["docker", "compose", "version"], capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0:
            version = result.stdout.strip().split("\n")[0]
            print_success(f"Docker Compose available ({version})")
        else:
            print_warning("docker compose may not be available — try `docker-compose` (v1)")
    except FileNotFoundError:
        print_warning("docker command not found — is Docker installed?")
    except subprocess.TimeoutExpired:
        print_warning("docker compose version timed out")
    except Exception as exc:
        print_warning(f"Could not verify Docker Compose: {exc}")

    return True


# ── Step 4: Summary + optional start ─────────────────────────────────────────


def step_summary(root: Path) -> None:
    """Show a final summary and optionally start services."""
    _print_header("Setup complete")

    env = _read_env(root)
    engram_enabled = env.get("ENGRAM_ENABLED", "false").lower() == "true"

    if console:
        console.print("[bold green]✓ Crawl4AI OSINT is configured.[/bold green]\n")
        console.print("  Services:  [cyan]c4ai service start[/cyan]")
        console.print("  Status:    [cyan]c4ai service status[/cyan]")
        console.print("  Logs:      [cyan]c4ai service logs -f[/cyan]")
        if engram_enabled:
            console.print(
                f"\n  [green]Engram memory:[/green] enabled → {env.get('ENGRAM_API_URL', '')}"
            )
        else:
            console.print("\n  [dim]Engram memory: disabled (run `c4ai setup` to enable)[/dim]")
    else:
        print("\n✓ Crawl4AI OSINT is configured.")
        print("  Start services:  c4ai service start")
        print("  Check status:    c4ai service status")
        if engram_enabled:
            print(f"  Engram memory:   enabled → {env.get('ENGRAM_API_URL', '')}")
        else:
            print("  Engram memory:   disabled (run `c4ai setup` to enable)")

    print()
    if _ask_yes_no("Start services now?", default=False):
        print_info("Starting Docker services...")
        try:
            subprocess.run(
                ["docker", "compose", "-f", str(root / "docker-compose.yml"), "up", "-d"],
                cwd=root,
                timeout=120,
            )
        except FileNotFoundError:
            print_error("docker command not found — cannot start services")
        except subprocess.TimeoutExpired:
            print_warning("docker compose up timed out — services may still be starting")
        except Exception as exc:
            print_error(f"Failed to start services: {exc}")
        time.sleep(3)
        # Quick health check after starting
        try:
            from .service import check_health_endpoint

            if check_health_endpoint():
                print_success("API health check passed — services are up!")
            else:
                print_warning("API not yet responding — services may still be starting.")
        except Exception:
            pass
        print_info("Run `c4ai service status` to check service health.")


# ── main entry point ──────────────────────────────────────────────────────────


def cmd_setup(args) -> int:
    """Run the interactive setup wizard."""
    root = get_project_root()

    if console:
        console.print(
            Panel(
                "[bold cyan]Crawl4AI OSINT — First-run Setup Wizard[/bold cyan]\n"
                "[dim]This wizard configures your environment and optional integrations.[/dim]",
                expand=False,
            )
        )
    else:
        print("\nCrawl4AI OSINT — First-run Setup Wizard")
        print("This wizard configures your environment and optional integrations.\n")

    # Step 1 — .env bootstrap
    if not step_env_bootstrap(root):
        return 1

    print()

    # Step 2 — Engram (optional)
    step_engram(root)

    print()

    # Step 3 — Docker check
    step_docker(root)

    print()

    # Step 4 — Summary
    step_summary(root)

    return 0


def add_setup_parser(subparsers) -> None:
    """Register the `setup` subcommand on the CLI argument parser."""
    setup_parser = subparsers.add_parser(
        "setup",
        help="Interactive first-run setup wizard",
        description=(
            "Guides you through initial configuration: .env bootstrap, "
            "optional Engram memory integration, and Docker readiness check."
        ),
    )
    setup_parser.set_defaults(func=cmd_setup)
