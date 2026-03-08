"""Tests for InvestigationService — pure in-memory CRUD, no mocks needed."""

import pytest

from app.services.investigation_service import InvestigationService
from app.models.investigation import (
    CreateInvestigationRequest,
    UpdateInvestigationRequest,
    InvestigationStatus,
    InvestigationPriority,
)


@pytest.fixture
def service():
    """Fresh service per test — no shared state."""
    return InvestigationService()


@pytest.fixture
def basic_request():
    return CreateInvestigationRequest(name="Test Investigation")


@pytest.fixture
def full_request():
    return CreateInvestigationRequest(
        name="Full Investigation",
        description="A detailed description",
        tags=["osint", "threat"],
        priority=InvestigationPriority.HIGH,
    )


# ─── create ────────────────────────────────────────────────────────────────


class TestCreate:
    def test_returns_investigation_with_unique_id(self, service, basic_request):
        inv = service.create(basic_request)
        assert inv.investigation_id
        assert len(inv.investigation_id) == 36  # UUID format

    def test_each_create_produces_unique_id(self, service, basic_request):
        inv1 = service.create(basic_request)
        inv2 = service.create(basic_request)
        assert inv1.investigation_id != inv2.investigation_id

    def test_stores_name(self, service, basic_request):
        inv = service.create(basic_request)
        assert inv.name == "Test Investigation"

    def test_stores_all_fields(self, service, full_request):
        inv = service.create(full_request)
        assert inv.name == "Full Investigation"
        assert inv.description == "A detailed description"
        assert inv.tags == ["osint", "threat"]
        assert inv.priority == InvestigationPriority.HIGH

    def test_default_status_is_active(self, service, basic_request):
        inv = service.create(basic_request)
        assert inv.status == InvestigationStatus.ACTIVE

    def test_default_priority_is_medium(self, service):
        req = CreateInvestigationRequest(name="No Priority")
        inv = service.create(req)
        assert inv.priority == InvestigationPriority.MEDIUM

    def test_default_tags_empty(self, service, basic_request):
        inv = service.create(basic_request)
        assert inv.tags == []

    def test_crawl_ids_empty_on_create(self, service, basic_request):
        inv = service.create(basic_request)
        assert inv.crawl_ids == []

    def test_scan_ids_empty_on_create(self, service, basic_request):
        inv = service.create(basic_request)
        assert inv.scan_ids == []

    def test_closed_at_is_none_on_create(self, service, basic_request):
        inv = service.create(basic_request)
        assert inv.closed_at is None

    def test_increments_count(self, service, basic_request):
        assert service.count() == 0
        service.create(basic_request)
        assert service.count() == 1
        service.create(basic_request)
        assert service.count() == 2


# ─── get ───────────────────────────────────────────────────────────────────


class TestGet:
    def test_returns_created_investigation(self, service, basic_request):
        inv = service.create(basic_request)
        fetched = service.get(inv.investigation_id)
        assert fetched is not None
        assert fetched.investigation_id == inv.investigation_id

    def test_returns_none_for_unknown_id(self, service):
        result = service.get("nonexistent-id")
        assert result is None

    def test_returns_none_for_empty_string(self, service):
        result = service.get("")
        assert result is None


# ─── list_all ──────────────────────────────────────────────────────────────


class TestListAll:
    def test_empty_store_returns_empty_list(self, service):
        assert service.list_all() == []

    def test_returns_all_investigations(self, service, basic_request):
        service.create(basic_request)
        service.create(basic_request)
        service.create(basic_request)
        assert len(service.list_all()) == 3

    def test_filter_by_status(self, service):
        req_active = CreateInvestigationRequest(name="Active")
        req_paused = CreateInvestigationRequest(name="Paused")
        inv_active = service.create(req_active)
        inv_paused = service.create(req_paused)
        # Pause one
        service.update(
            inv_paused.investigation_id,
            UpdateInvestigationRequest(status=InvestigationStatus.PAUSED),
        )

        active_list = service.list_all(status=InvestigationStatus.ACTIVE)
        assert len(active_list) == 1
        assert active_list[0].investigation_id == inv_active.investigation_id

    def test_filter_by_priority(self, service):
        low_req = CreateInvestigationRequest(name="Low", priority=InvestigationPriority.LOW)
        high_req = CreateInvestigationRequest(name="High", priority=InvestigationPriority.HIGH)
        service.create(low_req)
        inv_high = service.create(high_req)

        high_list = service.list_all(priority=InvestigationPriority.HIGH)
        assert len(high_list) == 1
        assert high_list[0].investigation_id == inv_high.investigation_id

    def test_filter_by_status_and_priority(self, service):
        req1 = CreateInvestigationRequest(name="A", priority=InvestigationPriority.HIGH)
        req2 = CreateInvestigationRequest(name="B", priority=InvestigationPriority.LOW)
        inv1 = service.create(req1)
        service.create(req2)
        # Close inv1
        service.update(
            inv1.investigation_id, UpdateInvestigationRequest(status=InvestigationStatus.CLOSED)
        )

        results = service.list_all(
            status=InvestigationStatus.ACTIVE, priority=InvestigationPriority.LOW
        )
        assert len(results) == 1
        assert results[0].name == "B"

    def test_pagination_limit(self, service, basic_request):
        for _ in range(5):
            service.create(basic_request)
        results = service.list_all(limit=3)
        assert len(results) == 3

    def test_pagination_offset(self, service, basic_request):
        for _ in range(5):
            service.create(basic_request)
        all_results = service.list_all()
        offset_results = service.list_all(offset=2)
        assert len(offset_results) == 3
        assert offset_results[0].investigation_id == all_results[2].investigation_id

    def test_pagination_limit_and_offset(self, service, basic_request):
        for _ in range(10):
            service.create(basic_request)
        results = service.list_all(limit=3, offset=5)
        assert len(results) == 3


# ─── update ────────────────────────────────────────────────────────────────


class TestUpdate:
    def test_updates_name(self, service, basic_request):
        inv = service.create(basic_request)
        updated = service.update(inv.investigation_id, UpdateInvestigationRequest(name="New Name"))
        assert updated.name == "New Name"

    def test_updates_description(self, service, basic_request):
        inv = service.create(basic_request)
        updated = service.update(
            inv.investigation_id, UpdateInvestigationRequest(description="New desc")
        )
        assert updated.description == "New desc"

    def test_updates_status(self, service, basic_request):
        inv = service.create(basic_request)
        updated = service.update(
            inv.investigation_id, UpdateInvestigationRequest(status=InvestigationStatus.PAUSED)
        )
        assert updated.status == InvestigationStatus.PAUSED

    def test_updates_priority(self, service, basic_request):
        inv = service.create(basic_request)
        updated = service.update(
            inv.investigation_id,
            UpdateInvestigationRequest(priority=InvestigationPriority.CRITICAL),
        )
        assert updated.priority == InvestigationPriority.CRITICAL

    def test_updates_tags(self, service, basic_request):
        inv = service.create(basic_request)
        updated = service.update(
            inv.investigation_id, UpdateInvestigationRequest(tags=["new", "tags"])
        )
        assert updated.tags == ["new", "tags"]

    def test_partial_update_preserves_other_fields(self, service, full_request):
        inv = service.create(full_request)
        updated = service.update(
            inv.investigation_id, UpdateInvestigationRequest(name="Changed Name")
        )
        assert updated.description == "A detailed description"
        assert updated.tags == ["osint", "threat"]
        assert updated.priority == InvestigationPriority.HIGH

    def test_closed_at_set_when_status_closed(self, service, basic_request):
        inv = service.create(basic_request)
        assert inv.closed_at is None
        updated = service.update(
            inv.investigation_id, UpdateInvestigationRequest(status=InvestigationStatus.CLOSED)
        )
        assert updated.closed_at is not None

    def test_returns_none_for_unknown_id(self, service):
        result = service.update("nonexistent", UpdateInvestigationRequest(name="X"))
        assert result is None

    def test_updates_updated_at_timestamp(self, service, basic_request):
        inv = service.create(basic_request)
        original_updated_at = inv.updated_at
        updated = service.update(inv.investigation_id, UpdateInvestigationRequest(name="Changed"))
        assert updated.updated_at >= original_updated_at


# ─── delete ────────────────────────────────────────────────────────────────


class TestDelete:
    def test_deletes_existing_investigation(self, service, basic_request):
        inv = service.create(basic_request)
        result = service.delete(inv.investigation_id)
        assert result is True
        assert service.get(inv.investigation_id) is None

    def test_returns_false_for_unknown_id(self, service):
        result = service.delete("nonexistent")
        assert result is False

    def test_decrements_count(self, service, basic_request):
        inv = service.create(basic_request)
        assert service.count() == 1
        service.delete(inv.investigation_id)
        assert service.count() == 0

    def test_double_delete_returns_false(self, service, basic_request):
        inv = service.create(basic_request)
        service.delete(inv.investigation_id)
        result = service.delete(inv.investigation_id)
        assert result is False


# ─── add_crawl ─────────────────────────────────────────────────────────────


class TestAddCrawl:
    def test_adds_crawl_id(self, service, basic_request):
        inv = service.create(basic_request)
        updated = service.add_crawl(inv.investigation_id, "crawl-001")
        assert "crawl-001" in updated.crawl_ids

    def test_does_not_duplicate_crawl_id(self, service, basic_request):
        inv = service.create(basic_request)
        service.add_crawl(inv.investigation_id, "crawl-001")
        service.add_crawl(inv.investigation_id, "crawl-001")
        result = service.get(inv.investigation_id)
        assert result.crawl_ids.count("crawl-001") == 1

    def test_can_add_multiple_crawl_ids(self, service, basic_request):
        inv = service.create(basic_request)
        service.add_crawl(inv.investigation_id, "crawl-001")
        service.add_crawl(inv.investigation_id, "crawl-002")
        result = service.get(inv.investigation_id)
        assert len(result.crawl_ids) == 2

    def test_returns_none_for_unknown_investigation(self, service):
        result = service.add_crawl("nonexistent", "crawl-001")
        assert result is None


# ─── add_scan ──────────────────────────────────────────────────────────────


class TestAddScan:
    def test_adds_scan_id(self, service, basic_request):
        inv = service.create(basic_request)
        updated = service.add_scan(inv.investigation_id, "scan-001")
        assert "scan-001" in updated.scan_ids

    def test_does_not_duplicate_scan_id(self, service, basic_request):
        inv = service.create(basic_request)
        service.add_scan(inv.investigation_id, "scan-001")
        service.add_scan(inv.investigation_id, "scan-001")
        result = service.get(inv.investigation_id)
        assert result.scan_ids.count("scan-001") == 1

    def test_can_add_multiple_scan_ids(self, service, basic_request):
        inv = service.create(basic_request)
        service.add_scan(inv.investigation_id, "scan-001")
        service.add_scan(inv.investigation_id, "scan-002")
        result = service.get(inv.investigation_id)
        assert len(result.scan_ids) == 2

    def test_returns_none_for_unknown_investigation(self, service):
        result = service.add_scan("nonexistent", "scan-001")
        assert result is None


# ─── get_summary ───────────────────────────────────────────────────────────


class TestGetSummary:
    def test_returns_summary_with_correct_fields(self, service, full_request):
        inv = service.create(full_request)
        summary = service.get_summary(inv.investigation_id)
        assert summary is not None
        assert summary.investigation_id == inv.investigation_id
        assert summary.name == "Full Investigation"
        assert summary.status == InvestigationStatus.ACTIVE
        assert summary.priority == InvestigationPriority.HIGH
        assert summary.tags == ["osint", "threat"]

    def test_crawl_count_reflects_added_crawls(self, service, basic_request):
        inv = service.create(basic_request)
        service.add_crawl(inv.investigation_id, "c1")
        service.add_crawl(inv.investigation_id, "c2")
        summary = service.get_summary(inv.investigation_id)
        assert summary.crawl_count == 2

    def test_scan_count_reflects_added_scans(self, service, basic_request):
        inv = service.create(basic_request)
        service.add_scan(inv.investigation_id, "s1")
        summary = service.get_summary(inv.investigation_id)
        assert summary.scan_count == 1

    def test_initial_counts_are_zero(self, service, basic_request):
        inv = service.create(basic_request)
        summary = service.get_summary(inv.investigation_id)
        assert summary.crawl_count == 0
        assert summary.scan_count == 0

    def test_returns_none_for_unknown_id(self, service):
        result = service.get_summary("nonexistent")
        assert result is None


# ─── count ─────────────────────────────────────────────────────────────────


class TestCount:
    def test_zero_initially(self, service):
        assert service.count() == 0

    def test_reflects_creates_and_deletes(self, service, basic_request):
        inv1 = service.create(basic_request)
        inv2 = service.create(basic_request)
        assert service.count() == 2
        service.delete(inv1.investigation_id)
        assert service.count() == 1
        service.delete(inv2.investigation_id)
        assert service.count() == 0
