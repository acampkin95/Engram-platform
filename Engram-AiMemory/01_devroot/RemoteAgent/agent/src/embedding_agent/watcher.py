"""File system watcher with pattern matching."""

import asyncio
import fnmatch
from pathlib import Path
from typing import List, Optional

from rich.console import Console
from watchdog.events import FileSystemEvent, FileSystemEventHandler
from watchdog.observers import Observer

console = Console()


class FileFilter:
    """Filter files based on include/exclude patterns."""

    def __init__(
        self,
        include_patterns: List[str],
        exclude_patterns: List[str],
        max_file_size_bytes: int = 10 * 1024 * 1024
    ):
        self.include_patterns = include_patterns
        self.exclude_patterns = exclude_patterns
        self.max_file_size_bytes = max_file_size_bytes

    def should_process(self, file_path: Path) -> bool:
        """Check if a file should be processed."""
        # Check if file exists and is a file
        if not file_path.is_file():
            return False

        # Check file size
        try:
            if file_path.stat().st_size > self.max_file_size_bytes:
                return False
        except OSError:
            return False

        # Check exclude patterns first (higher priority)
        path_str = str(file_path)
        for pattern in self.exclude_patterns:
            if pattern in path_str or fnmatch.fnmatch(file_path.name, pattern):
                return False

        # Check include patterns
        for pattern in self.include_patterns:
            if fnmatch.fnmatch(file_path.name, pattern):
                return True

        return False


class AsyncEventHandler(FileSystemEventHandler):
    """Watchdog event handler that queues events for async processing."""

    def __init__(
        self,
        queue: asyncio.Queue,
        file_filter: FileFilter,
        loop: asyncio.AbstractEventLoop
    ):
        super().__init__()
        self.queue = queue
        self.file_filter = file_filter
        self.loop = loop
        self._debounce_tasks: dict[str, asyncio.TimerHandle] = {}
        self._debounce_delay = 1.0  # seconds

    def _schedule_event(self, event_type: str, src_path: str):
        """Schedule an event with debouncing."""
        path = Path(src_path)

        if not self.file_filter.should_process(path):
            return

        # Cancel any pending event for this path
        if src_path in self._debounce_tasks:
            self._debounce_tasks[src_path].cancel()

        # Schedule new event
        def put_event():
            asyncio.run_coroutine_threadsafe(
                self.queue.put((event_type, src_path)),
                self.loop
            )
            self._debounce_tasks.pop(src_path, None)

        handle = self.loop.call_later(self._debounce_delay, put_event)
        self._debounce_tasks[src_path] = handle

    def on_created(self, event: FileSystemEvent):
        if not event.is_directory:
            self._schedule_event("created", event.src_path)

    def on_modified(self, event: FileSystemEvent):
        if not event.is_directory:
            self._schedule_event("modified", event.src_path)

    def on_deleted(self, event: FileSystemEvent):
        if not event.is_directory:
            # Don't filter deleted files - we need to clean them up
            path = event.src_path

            # Cancel any pending events for this path
            if path in self._debounce_tasks:
                self._debounce_tasks[path].cancel()
                self._debounce_tasks.pop(path, None)

            asyncio.run_coroutine_threadsafe(
                self.queue.put(("deleted", path)),
                self.loop
            )


class FileWatcher:
    """Async file system watcher with pattern filtering."""

    def __init__(
        self,
        watch_paths: List[Path],
        include_patterns: List[str],
        exclude_patterns: List[str],
        recursive: bool = True,
        max_file_size_mb: float = 10.0
    ):
        self.watch_paths = watch_paths
        self.recursive = recursive
        self.file_filter = FileFilter(
            include_patterns=include_patterns,
            exclude_patterns=exclude_patterns,
            max_file_size_bytes=int(max_file_size_mb * 1024 * 1024)
        )
        self._observer: Optional[Observer] = None
        self._event_queue: Optional[asyncio.Queue] = None
        self._running = False

    async def start(self) -> asyncio.Queue:
        """Start watching and return the event queue."""
        self._event_queue = asyncio.Queue()
        loop = asyncio.get_event_loop()

        handler = AsyncEventHandler(
            queue=self._event_queue,
            file_filter=self.file_filter,
            loop=loop
        )

        self._observer = Observer()

        for path in self.watch_paths:
            if path.exists():
                console.print(f"[cyan]Watching: {path}[/cyan]")
                self._observer.schedule(
                    handler,
                    str(path),
                    recursive=self.recursive
                )
            else:
                console.print(f"[yellow]Warning: Path does not exist: {path}[/yellow]")

        self._observer.start()
        self._running = True

        return self._event_queue

    async def stop(self):
        """Stop watching."""
        self._running = False
        if self._observer:
            self._observer.stop()
            self._observer.join(timeout=5)
            console.print("[cyan]File watcher stopped[/cyan]")

    def scan_existing(self) -> List[Path]:
        """Scan for existing files matching patterns."""
        matching_files: List[Path] = []

        for watch_path in self.watch_paths:
            if not watch_path.exists():
                continue

            if self.recursive:
                files = watch_path.rglob("*")
            else:
                files = watch_path.glob("*")

            for file_path in files:
                if self.file_filter.should_process(file_path):
                    matching_files.append(file_path)

        console.print(f"[green]Found {len(matching_files)} matching files[/green]")
        return matching_files

    @property
    def is_running(self) -> bool:
        return self._running
