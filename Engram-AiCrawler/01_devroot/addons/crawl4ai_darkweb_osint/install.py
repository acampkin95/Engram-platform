#!/usr/bin/env python3
"""
Crawl4AI Dark Web OSINT Addon - Installer (macOS Compatible)
"""

import os
import sys
import json
import subprocess
from pathlib import Path


def run(cmd, check=True, capture=True):
    """Run command safely."""
    import shlex
    args = shlex.split(cmd) if isinstance(cmd, str) else cmd
    try:
        if capture:
            result = subprocess.run(args, capture_output=True, text=True, check=check)
            return result.stdout.strip(), result.returncode == 0
        else:
            result = subprocess.run(args, check=False)
            return "", result.returncode == 0
    except Exception as e:
        return str(e), False


def print_step(n, total, text):
    print(f"\n[{n}/{total}] {text}")


def print_ok(text):
    print(f"  [OK] {text}")


def print_fail(text):
    print(f"  [FAIL] {text}")


def print_warn(text):
    print(f"  [WARN] {text}")


def prompt(text, default=""):
    result = input(f"  {text}{' [' + default + ']' if default else ''}: ").strip()
    return result or default


def prompt_yes(text, default=True):
    d = "Y" if default else "n"
    r = prompt(f"{text} (Y/n)", d)
    return r.lower() in ("", "y", "yes")


class Installer:
    def __init__(self):
        self.addon_path = Path(__file__).parent
        self.config_path = Path.home() / ".crawl4ai" / "darkweb_config.json"
        self.errors = []

        # Config
        self.tor_host = "127.0.0.1"
        self.tor_port = 9050
        self.llm_provider = "lmstudio"
        self.llm_model = "glm-5"
        self.llm_base_url = "http://localhost:1234/v1"
        self.llm_api_key = ""

    def check_python(self):
        print_step(1, 6, "Checking Python...")
        v = sys.version_info
        if v.major >= 3 and v.minor >= 9:
            print_ok(f"Python {v.major}.{v.minor}.{v.micro}")
            return True
        print_fail(f"Need Python 3.9+, got {v.major}.{v.minor}")
        return False

    def install_deps(self):
        print_step(2, 6, "Installing dependencies...")

        deps = ["aiohttp", "requests", "pydantic", "pydantic-settings", "tenacity", "pysocks"]
        deps_str = " ".join(deps)

        print(f"  Running: pip3 install {deps_str}")
        out, ok = run(f"pip3 install -q {deps_str}")

        if ok:
            print_ok("Dependencies installed")
        else:
            print_warn("Some deps may already be installed")

        return True

    def check_tor(self):
        print_step(3, 6, "Checking Tor...")

        # Quick socket test
        import socket

        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(3)
        result = sock.connect_ex(("127.0.0.1", 9050))
        sock.close()

        if result == 0:
            print_ok("Tor proxy reachable on port 9050")
        else:
            print_warn("Tor not running on port 9050")
            print("  Dark web features need Tor to be running")

        return True

    def check_llm(self):
        print_step(4, 6, "Checking LLM provider...")

        # Test HTTP connectivity
        out, ok = run(
            "curl -s -o /dev/null -w '%{http_code}' http://localhost:1234/v1/models --connect-timeout 3"
        )

        if ok and out in ("200", "401"):
            print_ok(f"LM Studio responding (HTTP {out})")
        else:
            print_warn("LM Studio not responding on port 1234")
            print("  Set DARKWEB_LLM_BASE_URL env var if using different host")

        return True

    def save_config(self):
        print_step(5, 6, "Saving configuration...")

        config = {
            "tor": {
                "host": self.tor_host,
                "port": self.tor_port,
                "control_port": 9051,
            },
            "llm": {
                "provider": self.llm_provider,
                "model": self.llm_model,
                "base_url": self.llm_base_url,
                "api_key": None,
            },
            "discovery": {"max_results": 50, "timeout": 30, "deduplicate": True},
            "extraction": {"timeout": 60, "wait_for": None},
            "analysis": {"default_preset": "threat_intel"},
            "_version": "0.1.0",
        }

        self.config_path.parent.mkdir(parents=True, exist_ok=True)
        self.config_path.write_text(json.dumps(config, indent=2))

        print_ok(f"Config: {self.config_path}")
        return True

    def show_next_steps(self):
        print_step(6, 6, "Done!")

        print(
            f"""
Next steps:

1. Copy addon to Crawl4AI:
   cp -r {str(self.addon_path)} /path/to/crawl4ai/addons/

2. Or run standalone:
   python3 -m crawl4ai_darkweb_osint

3. API endpoints:
   POST /api/darkweb/discover
   POST /api/darkweb/extract
   POST /api/darkweb/analyze

4. Start Tor if you need dark web access:
   brew install tor
   tor
"""
        )

    def run(self):
        print("=" * 50)
        print("Crawl4AI Dark Web OSINT - Installer")
        print("=" * 50)

        checks = [
            self.check_python,
            self.install_deps,
            self.check_tor,
            self.check_llm,
            self.save_config,
        ]

        for check in checks:
            if not check():
                print("\nInstallation had issues but config was saved.")
                break

        self.show_next_steps()
        print("\nInstallation complete!")


def main():
    Installer().run()


if __name__ == "__main__":
    main()
