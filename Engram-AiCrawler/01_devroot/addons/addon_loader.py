"""
Addon auto-detection and loading system.

Scans addons/ directory for valid addon packages and loads them.
"""

import json
import logging
import importlib
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)


@dataclass
class AddonInfo:
    """Information about a detected addon."""

    name: str
    version: str
    description: str
    path: Path
    manifest: dict[str, Any]
    entry_point: Optional[str] = None
    api_prefix: Optional[str] = None
    requires: list[str] = field(default_factory=list)
    features: list[str] = field(default_factory=list)
    is_loaded: bool = False
    load_error: Optional[str] = None


class AddonLoader:
    """
    Addon detection and loading system.

    Scans for addons in a specified directory and loads them.
    """

    MANIFEST_FILE = "manifest.json"
    REQUIRED_MANIFEST_FIELDS = ["name", "version", "description"]

    def __init__(self, addons_dir: Path):
        self.addons_dir = addons_dir
        self.addons_dir.mkdir(parents=True, exist_ok=True)
        self._detected: dict[str, AddonInfo] = {}

    def scan(self) -> dict[str, AddonInfo]:
        """
        Scan addons directory for valid addon packages.

        Returns:
            Dict mapping addon name to AddonInfo
        """
        self._detected.clear()

        if not self.addons_dir.exists():
            logger.warning(f"Addons directory does not exist: {self.addons_dir}")
            return self._detected

        for item in self.addons_dir.iterdir():
            if not item.is_dir():
                continue

            # Skip directories starting with _ or .
            if item.name.startswith(("_", ".")):
                continue

            # Check for manifest
            manifest_path = item / self.MANIFEST_FILE
            if not manifest_path.exists():
                logger.debug(f"No manifest.json in {item}")
                continue

            # Load manifest
            try:
                with open(manifest_path) as f:
                    manifest = json.load(f)
            except FileNotFoundError:
                logger.debug(f"Manifest disappeared during scan: {manifest_path}")
                continue
            except json.JSONDecodeError as e:
                logger.warning(f"Invalid manifest in {item}: {e}")
                continue

            # Validate required fields
            missing = [f for f in self.REQUIRED_MANIFEST_FIELDS if f not in manifest]
            if missing:
                logger.warning(f"Missing fields in {item} manifest: {missing}")
                continue

            # Create addon info
            addon_info = AddonInfo(
                name=manifest["name"],
                version=manifest.get("version", "0.0.0"),
                description=manifest.get("description", ""),
                path=item,
                manifest=manifest,
                entry_point=manifest.get("entry_point"),
                api_prefix=manifest.get("api_prefix"),
                requires=manifest.get("requires", []),
                features=manifest.get("features", []),
            )

            self._detected[addon_info.name] = addon_info
            logger.info(f"Detected addon: {addon_info.name} v{addon_info.version}")

        return self._detected

    def load(self, addon_name: str) -> bool:
        """
        Load a specific addon.

        Args:
            addon_name: Name of the addon to load

        Returns:
            True if loaded successfully
        """
        if addon_name not in self._detected:
            logger.error(f"Addon not found: {addon_name}")
            return False

        addon = self._detected[addon_name]

        if addon.is_loaded:
            return True

        try:
            # Add addon path to sys.path if needed
            addon_path_str = str(addon.path)
            if addon_path_str not in sys.path:
                sys.path.insert(0, addon_path_str)

            # Import the addon module
            if addon.entry_point:
                module = importlib.import_module(addon.entry_point)
            else:
                # Try to import by directory name
                module = importlib.import_module(addon.path.name)

            # Check for register function
            if hasattr(module, "register_addon"):
                addon.is_loaded = True
                logger.info(f"Loaded addon: {addon_name}")
                return True

            # Check for get_addon_info
            if hasattr(module, "get_addon_info"):
                addon.is_loaded = True
                logger.info(f"Loaded addon: {addon_name}")
                return True

            logger.warning(f"Addon {addon_name} has no register_addon or get_addon_info function")
            return False

        except ImportError as e:
            addon.load_error = str(e)
            logger.error(f"Failed to import addon {addon_name}: {e}")
            return False

        except Exception as e:
            addon.load_error = str(e)
            logger.error(f"Failed to load addon {addon_name}: {e}")
            return False

    def load_all(self) -> dict[str, bool]:
        """
        Load all detected addons.

        Returns:
            Dict mapping addon name to load success
        """
        results = {}

        for addon_name in self._detected:
            results[addon_name] = self.load(addon_name)

        return results

    def register(self, addon_name: str, app) -> bool:
        """
        Register an addon with the FastAPI app.

        Args:
            addon_name: Name of the addon
            app: FastAPI application instance

        Returns:
            True if registered successfully
        """
        if addon_name not in self._detected:
            return False

        addon = self._detected[addon_name]

        if not addon.is_loaded:
            if not self.load(addon_name):
                return False

        try:
            # Import module
            if addon.entry_point:
                module = importlib.import_module(addon.entry_point)
            else:
                module = importlib.import_module(addon.path.name)

            # Call register function
            if hasattr(module, "register_addon"):
                result = module.register_addon(app)
                logger.info(f"Registered addon: {addon_name}")
                return True

            return False

        except Exception as e:
            logger.error(f"Failed to register addon {addon_name}: {e}")
            return False

    def register_all(self, app) -> dict[str, bool]:
        """
        Register all loaded addons with the FastAPI app.

        Args:
            app: FastAPI application instance

        Returns:
            Dict mapping addon name to registration success
        """
        results = {}

        for addon_name in self._detected:
            results[addon_name] = self.register(addon_name, app)

        return results

    def get_addon(self, addon_name: str) -> Optional[AddonInfo]:
        """Get info for a specific addon."""
        return self._detected.get(addon_name)

    def list_addons(self) -> list[AddonInfo]:
        """List all detected addons."""
        return list(self._detected.values())

    def get_loaded_addons(self) -> list[AddonInfo]:
        """List all successfully loaded addons."""
        return [a for a in self._detected.values() if a.is_loaded]


def create_addon_loader(addons_dir: Optional[Path] = None) -> AddonLoader:
    """
    Factory function to create an AddonLoader.

    Args:
        addons_dir: Path to addons directory (default: ./addons)

    Returns:
        AddonLoader instance
    """
    if addons_dir is None:
        # Default to ./addons relative to current working directory
        addons_dir = Path.cwd() / "addons"

    return AddonLoader(addons_dir)


# CLI entry point
if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Addon management")
    parser.add_argument("--scan", action="store_true", help="Scan for addons")
    parser.add_argument("--list", action="store_true", help="List detected addons")
    parser.add_argument("--dir", default="./addons", help="Addons directory")

    args = parser.parse_args()

    loader = AddonLoader(Path(args.dir))

    if args.scan or args.list:
        addons = loader.scan()

        print(f"\nDetected {len(addons)} addon(s):\n")

        for addon in addons.values():
            status = "✓ loaded" if addon.is_loaded else "○ detected"
            print(f"  {status} {addon.name} v{addon.version}")
            print(f"         {addon.description}")
            if addon.features:
                print(f"         Features: {', '.join(addon.features)}")
            print()

    else:
        parser.print_help()
