from __future__ import annotations

from fastapi import WebSocket
from datetime import datetime
from app._compat import UTC
import fnmatch


def utc_now():
    return datetime.now(UTC)


class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}
        self.subscriptions: dict[str, list[str]] = {}

    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        self.subscriptions[client_id] = []

        await self.send_personal_message(
            {
                "type": "connected",
                "client_id": client_id,
                "timestamp": utc_now().isoformat(),
            },
            client_id,
        )

    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
        if client_id in self.subscriptions:
            del self.subscriptions[client_id]

    async def send_personal_message(self, message: dict, client_id: str):
        if client_id in self.active_connections:
            websocket = self.active_connections[client_id]
            try:
                await websocket.send_json(message)
            except Exception:
                self.disconnect(client_id)

    async def broadcast(self, message: dict, topic: str | None = None):
        if topic:
            clients_to_notify = [
                client_id
                for client_id, subs in self.subscriptions.items()
                if any(fnmatch.fnmatch(topic, pattern) for pattern in subs)
            ]
        else:
            clients_to_notify = list(self.active_connections.keys())

        disconnected_clients = []
        for client_id in clients_to_notify:
            if client_id in self.active_connections:
                websocket = self.active_connections[client_id]
                try:
                    await websocket.send_json(message)
                except Exception:
                    disconnected_clients.append(client_id)

        for client_id in disconnected_clients:
            self.disconnect(client_id)

    def subscribe(self, client_id: str, topic: str):
        if client_id not in self.subscriptions:
            self.subscriptions[client_id] = []
        if topic not in self.subscriptions[client_id]:
            self.subscriptions[client_id].append(topic)

    def unsubscribe(self, client_id: str, topic: str):
        if client_id in self.subscriptions and topic in self.subscriptions[client_id]:
            self.subscriptions[client_id].remove(topic)

    async def send_crawl_update(self, crawl_id: str, status: str, data: dict | None = None):
        message = {
            "type": "crawl_update",
            "crawl_id": crawl_id,
            "status": status,
            "data": data or {},
            "timestamp": utc_now().isoformat(),
        }
        await self.broadcast(message, topic=f"crawl:{crawl_id}")

    async def send_chat_update(self, chat_id: str, status: str, data: dict | None = None):
        message = {
            "type": "chat_update",
            "chat_id": chat_id,
            "status": status,
            "data": data or {},
            "timestamp": utc_now().isoformat(),
        }
        await self.broadcast(message, topic=f"chat:{chat_id}")

    async def send_data_notification(self, data_set_id: str, event: str, data: dict | None = None):
        message = {
            "type": "data_notification",
            "data_set_id": data_set_id,
            "event": event,
            "data": data or {},
            "timestamp": utc_now().isoformat(),
        }
        await self.broadcast(message, topic="data_changes")

    async def send_osint_scan_update(self, scan_id: str, stage: str, data: dict | None = None):
        message = {
            "type": "osint_scan_update",
            "scan_id": scan_id,
            "stage": stage,
            "data": data or {},
            "timestamp": utc_now().isoformat(),
        }
        await self.broadcast(message, topic=f"osint_scan:{scan_id}")

    async def send_knowledge_graph_update(self, scan_id: str, event: str, data: dict | None = None):
        message = {
            "type": "knowledge_graph_update",
            "scan_id": scan_id,
            "event": event,
            "data": data or {},
            "timestamp": utc_now().isoformat(),
        }
        await self.broadcast(message, topic=f"knowledge_graph:{scan_id}")

    async def send_review_update(self, scan_id: str, status: str, data: dict | None = None):
        message = {
            "type": "review_update",
            "scan_id": scan_id,
            "status": status,
            "data": data or {},
            "timestamp": utc_now().isoformat(),
        }
        await self.broadcast(message, topic=f"review:{scan_id}")

    def get_connection_count(self) -> int:
        return len(self.active_connections)

    def get_subscribers_count(self, topic: str) -> int:
        return sum(
            1
            for subs in self.subscriptions.values()
            if any(fnmatch.fnmatch(topic, pattern) for pattern in subs)
        )


manager = ConnectionManager()
