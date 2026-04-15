import logging
import time
from collections import deque
from typing import Any

from memory_system import MemorySystem
from memory_system.audit import AuditLogger
from memory_system.key_manager import KeyManager
from rich.console import Console

console = Console()
logger = logging.getLogger(__name__)

memory_system: MemorySystem | None = None
scheduler: Any = None
key_manager: KeyManager | None = None
audit_logger: AuditLogger | None = None

search_logs: deque = deque(maxlen=1000)
request_metrics: dict[str, Any] = {
    "total_requests": 0,
    "total_errors": 0,
    "total_latency_ms": 0.0,
    "requests_by_path": {},
    "start_time": time.time(),
}
metrics_lock: Any = None
api_start_time: float = time.time()


class ConnectionManager:
    def __init__(self) -> None:
        self.active: list = []

    async def connect(self, ws: Any) -> None:
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: Any) -> None:
        self.active = [c for c in self.active if c is not ws]

    async def broadcast(self, message: dict) -> None:
        disconnected = []
        for ws in self.active:
            try:
                await ws.send_json(message)
            except Exception:
                disconnected.append(ws)
        for ws in disconnected:
            self.disconnect(ws)


ws_manager = ConnectionManager()
