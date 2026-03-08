"""In-memory investigation storage service."""

from __future__ import annotations
from datetime import datetime, UTC

from app.models.investigation import (
    Investigation,
    InvestigationStatus,
    InvestigationPriority,
    CreateInvestigationRequest,
    UpdateInvestigationRequest,
    InvestigationSummary,
)


class InvestigationService:
    """Manages investigation lifecycle. In-memory storage for V1."""

    def __init__(self) -> None:
        self._store: dict[str, Investigation] = {}

    def create(self, request: CreateInvestigationRequest) -> Investigation:
        investigation = Investigation(
            name=request.name,
            description=request.description,
            tags=request.tags,
            priority=request.priority,
        )
        self._store[investigation.investigation_id] = investigation
        return investigation

    def get(self, investigation_id: str) -> Investigation | None:
        return self._store.get(investigation_id)

    def list_all(
        self,
        status: InvestigationStatus | None = None,
        priority: InvestigationPriority | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[Investigation]:
        results = list(self._store.values())
        if status:
            results = [inv for inv in results if inv.status == status]
        if priority:
            results = [inv for inv in results if inv.priority == priority]
        results.sort(key=lambda x: x.updated_at, reverse=True)
        return results[offset : offset + limit]

    def update(
        self, investigation_id: str, request: UpdateInvestigationRequest
    ) -> Investigation | None:
        inv = self._store.get(investigation_id)
        if not inv:
            return None

        update_data = request.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(inv, field, value)
        inv.updated_at = datetime.now(UTC)

        if request.status == InvestigationStatus.CLOSED:
            inv.closed_at = datetime.now(UTC)

        return inv

    def delete(self, investigation_id: str) -> bool:
        if investigation_id in self._store:
            del self._store[investigation_id]
            return True
        return False

    def add_crawl(self, investigation_id: str, crawl_id: str) -> Investigation | None:
        inv = self._store.get(investigation_id)
        if not inv:
            return None
        if crawl_id not in inv.crawl_ids:
            inv.crawl_ids.append(crawl_id)
            inv.updated_at = datetime.now(UTC)
        return inv

    def add_scan(self, investigation_id: str, scan_id: str) -> Investigation | None:
        inv = self._store.get(investigation_id)
        if not inv:
            return None
        if scan_id not in inv.scan_ids:
            inv.scan_ids.append(scan_id)
            inv.updated_at = datetime.now(UTC)
        return inv

    def get_summary(self, investigation_id: str) -> InvestigationSummary | None:
        inv = self._store.get(investigation_id)
        if not inv:
            return None
        return InvestigationSummary(
            investigation_id=inv.investigation_id,
            name=inv.name,
            status=inv.status,
            priority=inv.priority,
            tags=inv.tags,
            crawl_count=len(inv.crawl_ids),
            scan_count=len(inv.scan_ids),
            created_at=inv.created_at,
            updated_at=inv.updated_at,
        )

    def count(self) -> int:
        return len(self._store)


_investigation_service: InvestigationService | None = None


def get_investigation_service() -> InvestigationService:
    global _investigation_service
    if _investigation_service is None:
        _investigation_service = InvestigationService()
    return _investigation_service
