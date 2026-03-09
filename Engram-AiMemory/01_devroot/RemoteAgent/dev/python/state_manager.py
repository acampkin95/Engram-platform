"""
State Manager - Tracks file hashes to enable incremental processing
Uses SQLite for persistence
"""
import os
import sqlite3
from pathlib import Path
from typing import Optional
from datetime import datetime
from dataclasses import dataclass
from contextlib import contextmanager
from dotenv import load_dotenv
from rich.console import Console

load_dotenv()
console = Console()


@dataclass
class FileState:
    """State record for a tracked file"""
    file_path: str
    file_hash: str
    chunk_count: int
    indexed_at: datetime
    weaviate_synced: bool


class StateManager:
    """Manages file state for incremental processing"""
    
    def __init__(self, db_path: str = None):
        self.db_path = db_path or os.getenv("STATE_DB_PATH", "./state/file_hashes.db")
        self._ensure_db()
    
    def _ensure_db(self):
        """Create database and tables if they don't exist"""
        db_dir = Path(self.db_path).parent
        db_dir.mkdir(parents=True, exist_ok=True)
        
        with self._get_connection() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS file_states (
                    file_path TEXT PRIMARY KEY,
                    file_hash TEXT NOT NULL,
                    chunk_count INTEGER DEFAULT 0,
                    indexed_at TEXT NOT NULL,
                    weaviate_synced INTEGER DEFAULT 0
                )
            """)
            
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_file_hash 
                ON file_states(file_hash)
            """)
            
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_synced 
                ON file_states(weaviate_synced)
            """)
            
            conn.commit()
    
    @contextmanager
    def _get_connection(self):
        """Context manager for database connections"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()
    
    def get_state(self, file_path: str) -> Optional[FileState]:
        """Get state for a specific file"""
        with self._get_connection() as conn:
            row = conn.execute(
                "SELECT * FROM file_states WHERE file_path = ?",
                (file_path,)
            ).fetchone()
            
            if row:
                return FileState(
                    file_path=row["file_path"],
                    file_hash=row["file_hash"],
                    chunk_count=row["chunk_count"],
                    indexed_at=datetime.fromisoformat(row["indexed_at"]),
                    weaviate_synced=bool(row["weaviate_synced"])
                )
            return None
    
    def has_changed(self, file_path: str, current_hash: str) -> bool:
        """Check if file has changed since last processing"""
        state = self.get_state(file_path)
        if not state:
            return True  # New file
        return state.file_hash != current_hash
    
    def update_state(
        self,
        file_path: str,
        file_hash: str,
        chunk_count: int,
        weaviate_synced: bool = False
    ):
        """Update or insert file state"""
        with self._get_connection() as conn:
            conn.execute("""
                INSERT OR REPLACE INTO file_states 
                (file_path, file_hash, chunk_count, indexed_at, weaviate_synced)
                VALUES (?, ?, ?, ?, ?)
            """, (
                file_path,
                file_hash,
                chunk_count,
                datetime.utcnow().isoformat(),
                1 if weaviate_synced else 0
            ))
            conn.commit()
    
    def mark_synced(self, file_path: str):
        """Mark a file as synced to Weaviate"""
        with self._get_connection() as conn:
            conn.execute("""
                UPDATE file_states SET weaviate_synced = 1 
                WHERE file_path = ?
            """, (file_path,))
            conn.commit()
    
    def get_unsynced(self) -> list[FileState]:
        """Get all files that haven't been synced to Weaviate"""
        with self._get_connection() as conn:
            rows = conn.execute(
                "SELECT * FROM file_states WHERE weaviate_synced = 0"
            ).fetchall()
            
            return [
                FileState(
                    file_path=row["file_path"],
                    file_hash=row["file_hash"],
                    chunk_count=row["chunk_count"],
                    indexed_at=datetime.fromisoformat(row["indexed_at"]),
                    weaviate_synced=False
                )
                for row in rows
            ]
    
    def delete_state(self, file_path: str):
        """Remove state for a deleted file"""
        with self._get_connection() as conn:
            conn.execute(
                "DELETE FROM file_states WHERE file_path = ?",
                (file_path,)
            )
            conn.commit()
    
    def get_stats(self) -> dict:
        """Get overall statistics"""
        with self._get_connection() as conn:
            total = conn.execute("SELECT COUNT(*) FROM file_states").fetchone()[0]
            synced = conn.execute(
                "SELECT COUNT(*) FROM file_states WHERE weaviate_synced = 1"
            ).fetchone()[0]
            chunks = conn.execute(
                "SELECT SUM(chunk_count) FROM file_states"
            ).fetchone()[0] or 0
            
            return {
                "total_files": total,
                "synced_files": synced,
                "unsynced_files": total - synced,
                "total_chunks": chunks,
            }
    
    def clear_all(self):
        """Clear all state (use with caution)"""
        with self._get_connection() as conn:
            conn.execute("DELETE FROM file_states")
            conn.commit()
            console.print("[yellow]![/yellow] Cleared all file states")


# Quick test
def test_state_manager():
    manager = StateManager(db_path="./test_state.db")
    
    # Test operations
    manager.update_state("/test/file.py", "abc123", 5, False)
    
    state = manager.get_state("/test/file.py")
    console.print(f"[blue]State:[/blue] {state}")
    
    console.print(f"[blue]Has changed (same):[/blue] {manager.has_changed('/test/file.py', 'abc123')}")
    console.print(f"[blue]Has changed (diff):[/blue] {manager.has_changed('/test/file.py', 'xyz789')}")
    
    stats = manager.get_stats()
    console.print(f"[blue]Stats:[/blue] {stats}")
    
    # Cleanup
    Path("./test_state.db").unlink(missing_ok=True)


if __name__ == "__main__":
    test_state_manager()
