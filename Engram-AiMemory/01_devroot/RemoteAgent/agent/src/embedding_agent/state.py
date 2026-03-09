"""File state tracking using SQLite for incremental sync."""

import sqlite3
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Generator, List, Optional

import xxhash


@dataclass
class FileState:
    """Tracked state of a file."""

    path: str
    hash: str
    last_modified: datetime
    last_processed: datetime
    chunk_count: int
    status: str  # "processed", "pending", "error"


class StateDB:
    """SQLite-based file state tracking for incremental sync."""

    def __init__(self, db_path: Path):
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        """Initialize the database schema."""
        with self._get_connection() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS file_states (
                    path TEXT PRIMARY KEY,
                    hash TEXT NOT NULL,
                    last_modified TEXT NOT NULL,
                    last_processed TEXT NOT NULL,
                    chunk_count INTEGER DEFAULT 0,
                    status TEXT DEFAULT 'pending'
                )
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_hash ON file_states(hash)
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_status ON file_states(status)
            """)

    @contextmanager
    def _get_connection(self) -> Generator[sqlite3.Connection, None, None]:
        """Get a database connection with automatic cleanup."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    def get_file_state(self, path: str) -> Optional[FileState]:
        """Get the stored state for a file."""
        with self._get_connection() as conn:
            row = conn.execute(
                "SELECT * FROM file_states WHERE path = ?",
                (path,)
            ).fetchone()

            if row:
                return FileState(
                    path=row["path"],
                    hash=row["hash"],
                    last_modified=datetime.fromisoformat(row["last_modified"]),
                    last_processed=datetime.fromisoformat(row["last_processed"]),
                    chunk_count=row["chunk_count"],
                    status=row["status"]
                )
            return None

    def update_file_state(self, state: FileState):
        """Update or insert a file state."""
        with self._get_connection() as conn:
            conn.execute("""
                INSERT OR REPLACE INTO file_states
                (path, hash, last_modified, last_processed, chunk_count, status)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                state.path,
                state.hash,
                state.last_modified.isoformat(),
                state.last_processed.isoformat(),
                state.chunk_count,
                state.status
            ))

    def mark_processed(self, path: str, chunk_count: int):
        """Mark a file as successfully processed."""
        with self._get_connection() as conn:
            conn.execute("""
                UPDATE file_states
                SET status = 'processed', chunk_count = ?, last_processed = ?
                WHERE path = ?
            """, (chunk_count, datetime.now().isoformat(), path))

    def mark_error(self, path: str, error: str):
        """Mark a file as having an error."""
        with self._get_connection() as conn:
            conn.execute("""
                UPDATE file_states
                SET status = 'error'
                WHERE path = ?
            """, (path,))

    def delete_file_state(self, path: str):
        """Remove a file from tracking."""
        with self._get_connection() as conn:
            conn.execute(
                "DELETE FROM file_states WHERE path = ?",
                (path,)
            )

    def get_pending_files(self) -> List[FileState]:
        """Get all files pending processing."""
        with self._get_connection() as conn:
            rows = conn.execute(
                "SELECT * FROM file_states WHERE status = 'pending'"
            ).fetchall()

            return [
                FileState(
                    path=row["path"],
                    hash=row["hash"],
                    last_modified=datetime.fromisoformat(row["last_modified"]),
                    last_processed=datetime.fromisoformat(row["last_processed"]),
                    chunk_count=row["chunk_count"],
                    status=row["status"]
                )
                for row in rows
            ]

    def get_stats(self) -> dict:
        """Get statistics about tracked files."""
        with self._get_connection() as conn:
            total = conn.execute(
                "SELECT COUNT(*) FROM file_states"
            ).fetchone()[0]

            processed = conn.execute(
                "SELECT COUNT(*) FROM file_states WHERE status = 'processed'"
            ).fetchone()[0]

            pending = conn.execute(
                "SELECT COUNT(*) FROM file_states WHERE status = 'pending'"
            ).fetchone()[0]

            errors = conn.execute(
                "SELECT COUNT(*) FROM file_states WHERE status = 'error'"
            ).fetchone()[0]

            total_chunks = conn.execute(
                "SELECT COALESCE(SUM(chunk_count), 0) FROM file_states"
            ).fetchone()[0]

            return {
                "total_files": total,
                "processed": processed,
                "pending": pending,
                "errors": errors,
                "total_chunks": total_chunks
            }


def compute_file_hash(file_path: Path) -> str:
    """Compute a fast hash of file contents."""
    hasher = xxhash.xxh64()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def file_needs_processing(
    file_path: Path,
    state_db: StateDB
) -> tuple[bool, Optional[str]]:
    """Check if a file needs (re)processing based on hash comparison."""
    try:
        current_hash = compute_file_hash(file_path)
        existing_state = state_db.get_file_state(str(file_path))

        if existing_state is None:
            return True, current_hash

        if existing_state.hash != current_hash:
            return True, current_hash

        if existing_state.status == "error":
            return True, current_hash

        return False, current_hash

    except Exception:
        return True, None
