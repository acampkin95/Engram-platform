"""Tests for CaseService, TimelineQuery, and CaseExporter.

Uses tmp_path to avoid writing to /app/data/cases.
No mocks needed — all behavior is testable with real file I/O in a temp dir.
"""

import json
import csv
import io
import pytest

from app.services.case_service import CaseService, TimelineQuery, CaseExporter
from app.models.case import (
    CaseStatus,
    CasePriority,
    CaseSubject,
    CreateCaseRequest,
    UpdateCaseRequest,
    EvidenceItem,
    EvidenceType,
    TimelineEventType,
)


@pytest.fixture
def service(tmp_path):
    """Fresh CaseService backed by a temp directory."""
    return CaseService(root=tmp_path / "cases")


@pytest.fixture
def basic_request():
    return CreateCaseRequest(title="Test Case")


@pytest.fixture
def full_request():
    return CreateCaseRequest(
        title="Full Case",
        description="A detailed description",
        case_type="fraud",
        priority=CasePriority.HIGH,
        investigator="agent_smith",
        client_reference="CLIENT-001",
        jurisdiction="AU",
        tags=["fraud", "osint"],
    )


@pytest.fixture
def created_case(service, basic_request):
    return service.create(basic_request)


# ─── create ────────────────────────────────────────────────────────────────


class TestCreate:
    def test_returns_case_with_id(self, service, basic_request):
        case = service.create(basic_request)
        assert case.case_id
        assert len(case.case_id) == 32  # uuid4().hex

    def test_stores_title(self, service, basic_request):
        case = service.create(basic_request)
        assert case.title == "Test Case"

    def test_stores_all_fields(self, service, full_request):
        case = service.create(full_request)
        assert case.description == "A detailed description"
        assert case.case_type == "fraud"
        assert case.priority == CasePriority.HIGH
        assert case.investigator == "agent_smith"
        assert case.client_reference == "CLIENT-001"
        assert case.jurisdiction == "AU"
        assert case.tags == ["fraud", "osint"]

    def test_default_status_is_draft(self, service, basic_request):
        case = service.create(basic_request)
        assert case.status == CaseStatus.DRAFT

    def test_assigns_case_number(self, service, basic_request):
        case = service.create(basic_request)
        assert case.case_number is not None
        assert "CASE-" in case.case_number

    def test_case_numbers_increment(self, service, basic_request):
        case1 = service.create(basic_request)
        case2 = service.create(basic_request)
        # Both have case numbers, and they differ
        assert case1.case_number != case2.case_number

    def test_creates_case_created_timeline_event(self, service, basic_request):
        case = service.create(basic_request)
        assert len(case.timeline) >= 1
        event_types = [e.event_type for e in case.timeline]
        assert TimelineEventType.CASE_CREATED in event_types

    def test_persists_to_disk(self, service, basic_request, tmp_path):
        case = service.create(basic_request)
        case_file = tmp_path / "cases" / case.case_id / "case.json"
        assert case_file.exists()

    def test_updates_index(self, service, basic_request, tmp_path):
        case = service.create(basic_request)
        index_file = tmp_path / "cases" / "index.json"
        assert index_file.exists()
        index = json.loads(index_file.read_text())
        assert case.case_id in index

    def test_actor_sets_investigator(self, service):
        req = CreateCaseRequest(title="Actor Test")
        case = service.create(req, actor="detective")
        assert case.investigator == "detective"

    def test_request_investigator_takes_precedence_over_actor(self, service):
        req = CreateCaseRequest(title="Priority Test", investigator="req_inv")
        case = service.create(req, actor="actor_inv")
        assert case.investigator == "req_inv"


# ─── get ───────────────────────────────────────────────────────────────────


class TestGet:
    def test_returns_created_case(self, service, created_case):
        fetched = service.get(created_case.case_id)
        assert fetched is not None
        assert fetched.case_id == created_case.case_id

    def test_returns_none_for_unknown_id(self, service):
        assert service.get("nonexistent-id") is None

    def test_round_trips_all_fields(self, service, full_request):
        case = service.create(full_request)
        fetched = service.get(case.case_id)
        assert fetched.title == "Full Case"
        assert fetched.description == "A detailed description"
        assert fetched.tags == ["fraud", "osint"]
        assert fetched.priority == CasePriority.HIGH


# ─── list_all ──────────────────────────────────────────────────────────────


class TestListAll:
    def test_empty_returns_empty_list(self, service):
        assert service.list_all() == []

    def test_returns_all_cases(self, service, basic_request):
        service.create(basic_request)
        service.create(basic_request)
        assert len(service.list_all()) == 2

    def test_filter_by_status(self, service):
        case1 = service.create(CreateCaseRequest(title="C1"))
        service.create(CreateCaseRequest(title="C2"))
        service.update(case1.case_id, UpdateCaseRequest(status=CaseStatus.ACTIVE))

        results = service.list_all(status=CaseStatus.ACTIVE)
        assert len(results) == 1
        assert results[0].case_id == case1.case_id

    def test_filter_by_priority(self, service):
        service.create(CreateCaseRequest(title="Low", priority=CasePriority.LOW))
        high_case = service.create(CreateCaseRequest(title="High", priority=CasePriority.HIGH))

        results = service.list_all(priority=CasePriority.HIGH)
        assert len(results) == 1
        assert results[0].case_id == high_case.case_id

    def test_filter_by_case_type(self, service):
        service.create(CreateCaseRequest(title="General", case_type="general"))
        fraud_case = service.create(CreateCaseRequest(title="Fraud", case_type="fraud"))

        results = service.list_all(case_type="fraud")
        assert len(results) == 1
        assert results[0].case_id == fraud_case.case_id

    def test_filter_by_investigator(self, service):
        service.create(CreateCaseRequest(title="A", investigator="alice"))
        bob_case = service.create(CreateCaseRequest(title="B", investigator="bob"))

        results = service.list_all(investigator="bob")
        assert len(results) == 1
        assert results[0].case_id == bob_case.case_id

    def test_filter_by_tag(self, service):
        service.create(CreateCaseRequest(title="No Tag"))
        tagged = service.create(CreateCaseRequest(title="Tagged", tags=["special"]))

        results = service.list_all(tag="special")
        assert len(results) == 1
        assert results[0].case_id == tagged.case_id

    def test_pagination_limit(self, service, basic_request):
        for _ in range(5):
            service.create(basic_request)
        assert len(service.list_all(limit=3)) == 3

    def test_pagination_offset(self, service, basic_request):
        for _ in range(5):
            service.create(basic_request)
        all_results = service.list_all()
        paged = service.list_all(offset=2)
        assert len(paged) == 3
        assert paged[0].case_id == all_results[2].case_id


# ─── update ────────────────────────────────────────────────────────────────


class TestUpdate:
    def test_updates_title(self, service, created_case):
        updated = service.update(created_case.case_id, UpdateCaseRequest(title="New Title"))
        assert updated.title == "New Title"

    def test_updates_status(self, service, created_case):
        updated = service.update(created_case.case_id, UpdateCaseRequest(status=CaseStatus.ACTIVE))
        assert updated.status == CaseStatus.ACTIVE

    def test_status_change_adds_timeline_event(self, service, created_case):
        updated = service.update(created_case.case_id, UpdateCaseRequest(status=CaseStatus.ACTIVE))
        event_types = [e.event_type for e in updated.timeline]
        assert TimelineEventType.STATUS_CHANGED in event_types

    def test_non_status_update_adds_case_updated_event(self, service, created_case):
        updated = service.update(created_case.case_id, UpdateCaseRequest(title="Changed"))
        event_types = [e.event_type for e in updated.timeline]
        assert TimelineEventType.CASE_UPDATED in event_types

    def test_closed_status_sets_closed_at(self, service, created_case):
        updated = service.update(created_case.case_id, UpdateCaseRequest(status=CaseStatus.CLOSED))
        assert updated.closed_at is not None

    def test_returns_none_for_unknown_id(self, service):
        result = service.update("nonexistent", UpdateCaseRequest(title="X"))
        assert result is None

    def test_persists_changes(self, service, created_case):
        service.update(created_case.case_id, UpdateCaseRequest(title="Persisted Title"))
        reloaded = service.get(created_case.case_id)
        assert reloaded.title == "Persisted Title"

    def test_partial_update_preserves_other_fields(self, service, full_request):
        case = service.create(full_request)
        service.update(case.case_id, UpdateCaseRequest(title="Changed"))
        reloaded = service.get(case.case_id)
        assert reloaded.description == "A detailed description"
        assert reloaded.tags == ["fraud", "osint"]


# ─── delete ────────────────────────────────────────────────────────────────


class TestDelete:
    def test_deletes_existing_case(self, service, created_case, tmp_path):
        result = service.delete(created_case.case_id)
        assert result is True
        assert service.get(created_case.case_id) is None

    def test_removes_from_index(self, service, created_case, tmp_path):
        service.delete(created_case.case_id)
        index_file = tmp_path / "cases" / "index.json"
        index = json.loads(index_file.read_text())
        assert created_case.case_id not in index

    def test_returns_false_for_unknown_id(self, service):
        assert service.delete("nonexistent") is False

    def test_double_delete_returns_false(self, service, created_case):
        service.delete(created_case.case_id)
        assert service.delete(created_case.case_id) is False


# ─── add_subject ───────────────────────────────────────────────────────────


class TestAddSubject:
    def test_adds_subject(self, service, created_case):
        subject = CaseSubject(display_name="John Doe")
        updated = service.add_subject(created_case.case_id, subject)
        assert len(updated.subjects) == 1
        assert updated.subjects[0].display_name == "John Doe"

    def test_adds_entity_id_to_list(self, service, created_case):
        subject = CaseSubject(display_name="Jane", entity_id="ent-123")
        updated = service.add_subject(created_case.case_id, subject)
        assert "ent-123" in updated.entity_ids

    def test_does_not_duplicate_same_entity_id(self, service, created_case):
        subject1 = CaseSubject(display_name="Jane", entity_id="ent-123")
        subject2 = CaseSubject(display_name="Jane Duplicate", entity_id="ent-123")
        service.add_subject(created_case.case_id, subject1)
        updated = service.add_subject(created_case.case_id, subject2)
        # Same entity_id — second add should be skipped
        assert len(updated.subjects) == 1

    def test_adds_entity_added_timeline_event(self, service, created_case):
        subject = CaseSubject(display_name="Target")
        updated = service.add_subject(created_case.case_id, subject)
        event_types = [e.event_type for e in updated.timeline]
        assert TimelineEventType.ENTITY_ADDED in event_types

    def test_returns_none_for_unknown_case(self, service):
        subject = CaseSubject(display_name="Ghost")
        assert service.add_subject("nonexistent", subject) is None


# ─── add_evidence ──────────────────────────────────────────────────────────


class TestAddEvidence:
    def test_adds_evidence_item(self, service, created_case):
        item = EvidenceItem(
            evidence_type=EvidenceType.URL, title="Profile URL", url="https://example.com"
        )
        updated = service.add_evidence(created_case.case_id, item)
        assert len(updated.evidence) == 1
        assert updated.evidence[0].title == "Profile URL"

    def test_adds_evidence_added_timeline_event(self, service, created_case):
        item = EvidenceItem(evidence_type=EvidenceType.TEXT_NOTE, title="Note")
        updated = service.add_evidence(created_case.case_id, item)
        event_types = [e.event_type for e in updated.timeline]
        assert TimelineEventType.EVIDENCE_ADDED in event_types

    def test_sets_added_by_from_actor(self, service, created_case):
        item = EvidenceItem(evidence_type=EvidenceType.URL, title="URL")
        updated = service.add_evidence(created_case.case_id, item, actor="detective")
        assert updated.evidence[0].added_by == "detective"

    def test_returns_none_for_unknown_case(self, service):
        item = EvidenceItem(evidence_type=EvidenceType.URL, title="X")
        assert service.add_evidence("nonexistent", item) is None


# ─── remove_evidence ───────────────────────────────────────────────────────


class TestRemoveEvidence:
    def test_removes_evidence_by_id(self, service, created_case):
        item = EvidenceItem(evidence_type=EvidenceType.URL, title="To Remove")
        service.add_evidence(created_case.case_id, item)
        updated = service.remove_evidence(created_case.case_id, item.evidence_id)
        assert len(updated.evidence) == 0

    def test_adds_evidence_removed_timeline_event(self, service, created_case):
        item = EvidenceItem(evidence_type=EvidenceType.URL, title="Removable")
        service.add_evidence(created_case.case_id, item)
        updated = service.remove_evidence(created_case.case_id, item.evidence_id)
        event_types = [e.event_type for e in updated.timeline]
        assert TimelineEventType.EVIDENCE_REMOVED in event_types

    def test_noop_for_unknown_evidence_id(self, service, created_case):
        item = EvidenceItem(evidence_type=EvidenceType.URL, title="Keep")
        service.add_evidence(created_case.case_id, item)
        updated = service.remove_evidence(created_case.case_id, "nonexistent-evidence")
        # Evidence still there, no removal event added
        assert len(updated.evidence) == 1


# ─── add_note ──────────────────────────────────────────────────────────────


class TestAddNote:
    def test_adds_note(self, service, created_case):
        updated = service.add_note(created_case.case_id, "Important observation")
        assert len(updated.notes) == 1
        assert updated.notes[0].content == "Important observation"

    def test_sets_author(self, service, created_case):
        updated = service.add_note(created_case.case_id, "Note", author="detective")
        assert updated.notes[0].author == "detective"

    def test_adds_note_added_timeline_event(self, service, created_case):
        updated = service.add_note(created_case.case_id, "Note")
        event_types = [e.event_type for e in updated.timeline]
        assert TimelineEventType.NOTE_ADDED in event_types

    def test_returns_none_for_unknown_case(self, service):
        assert service.add_note("nonexistent", "Note") is None


# ─── link_scan / link_deep_crawl ───────────────────────────────────────────


class TestLinkHelpers:
    def test_link_scan_adds_scan_id(self, service, created_case):
        updated = service.link_scan(created_case.case_id, "scan-001")
        assert "scan-001" in updated.scan_ids

    def test_link_scan_no_duplicate(self, service, created_case):
        service.link_scan(created_case.case_id, "scan-001")
        updated = service.link_scan(created_case.case_id, "scan-001")
        assert updated.scan_ids.count("scan-001") == 1

    def test_link_deep_crawl_adds_crawl_id(self, service, created_case):
        updated = service.link_deep_crawl(created_case.case_id, "crawl-001")
        assert "crawl-001" in updated.deep_crawl_ids

    def test_link_fraud_graph_updates_risk(self, service, created_case):
        updated = service.link_fraud_graph(
            created_case.case_id, "graph-001", risk_level="HIGH", risk_score=0.85
        )
        assert "graph-001" in updated.fraud_graph_ids
        assert updated.risk_level == "HIGH"
        assert updated.risk_score == 0.85

    def test_link_image_intel(self, service, created_case):
        updated = service.link_image_intel(created_case.case_id, "entity-001")
        assert "entity-001" in updated.image_intel_entity_ids

    def test_link_helpers_return_none_for_unknown_case(self, service):
        assert service.link_scan("nonexistent", "s1") is None
        assert service.link_deep_crawl("nonexistent", "c1") is None
        assert service.link_fraud_graph("nonexistent", "g1") is None
        assert service.link_image_intel("nonexistent", "e1") is None


# ─── TimelineQuery ─────────────────────────────────────────────────────────


class TestTimelineQuery:
    @pytest.fixture
    def case_with_events(self, service):
        case = service.create(CreateCaseRequest(title="Timeline Test"))
        service.add_note(case.case_id, "Note by alice", author="alice")
        service.add_evidence(
            case.case_id, EvidenceItem(evidence_type=EvidenceType.URL, title="URL"), actor="bob"
        )
        return service.get(case.case_id)

    def test_filter_by_event_type(self, case_with_events):
        result = TimelineQuery.filter(
            case_with_events.timeline,
            event_types=[TimelineEventType.NOTE_ADDED],
        )
        assert all(e.event_type == TimelineEventType.NOTE_ADDED for e in result)
        assert len(result) >= 1

    def test_filter_by_actor(self, case_with_events):
        result = TimelineQuery.filter(case_with_events.timeline, actor="alice")
        assert all(e.actor == "alice" for e in result)
        assert len(result) >= 1

    def test_filter_by_search(self, case_with_events):
        result = TimelineQuery.filter(case_with_events.timeline, search="note")
        assert len(result) >= 1

    def test_filter_returns_sorted_by_occurred_at(self, case_with_events):
        result = TimelineQuery.filter(case_with_events.timeline)
        timestamps = [e.occurred_at for e in result]
        assert timestamps == sorted(timestamps)

    def test_no_filters_returns_all(self, case_with_events):
        result = TimelineQuery.filter(case_with_events.timeline)
        assert len(result) == len(case_with_events.timeline)

    def test_filter_by_since(self, case_with_events):
        # All events after epoch should include all
        result = TimelineQuery.filter(case_with_events.timeline, since="2000-01-01T00:00:00")
        assert len(result) == len(case_with_events.timeline)

    def test_filter_by_until(self, case_with_events):
        # No events after far future
        result = TimelineQuery.filter(case_with_events.timeline, until="2000-01-01T00:00:00")
        assert len(result) == 0


# ─── CaseExporter ──────────────────────────────────────────────────────────


class TestCaseExporter:
    @pytest.fixture
    def exporter(self):
        return CaseExporter()

    @pytest.fixture
    def rich_case(self, service):
        req = CreateCaseRequest(
            title="Export Test Case",
            description="For export testing",
            case_type="fraud",
            priority=CasePriority.HIGH,
            investigator="agent",
            tags=["export"],
        )
        case = service.create(req)
        service.add_subject(case.case_id, CaseSubject(display_name="John Doe"))
        service.add_evidence(
            case.case_id,
            EvidenceItem(
                evidence_type=EvidenceType.URL, title="Evidence URL", url="https://example.com"
            ),
        )
        service.add_note(case.case_id, "Important note", author="agent")
        return service.get(case.case_id)

    def test_export_json_is_valid_json(self, exporter, rich_case):
        data = exporter.export_json(rich_case)
        parsed = json.loads(data)
        assert parsed["case_id"] == rich_case.case_id
        assert parsed["title"] == "Export Test Case"

    def test_export_json_includes_evidence(self, exporter, rich_case):
        data = exporter.export_json(rich_case)
        parsed = json.loads(data)
        assert len(parsed["evidence"]) == 1

    def test_export_csv_timeline_is_valid_csv(self, exporter, rich_case):
        data = exporter.export_csv_timeline(rich_case)
        # Strip BOM
        text = data.decode("utf-8-sig")
        reader = csv.reader(io.StringIO(text))
        rows = list(reader)
        assert rows[0] == [
            "Timestamp (UTC)",
            "Event Type",
            "Title",
            "Detail",
            "Actor",
            "Reference ID",
        ]
        assert len(rows) > 1  # Header + at least one event

    def test_export_csv_evidence_is_valid_csv(self, exporter, rich_case):
        data = exporter.export_csv_evidence(rich_case)
        text = data.decode("utf-8-sig")
        reader = csv.reader(io.StringIO(text))
        rows = list(reader)
        assert rows[0][0] == "Evidence ID"
        assert len(rows) == 2  # Header + 1 evidence item

    def test_export_html_contains_title(self, exporter, rich_case):
        data = exporter.export_html(rich_case)
        html = data.decode("utf-8")
        assert "Export Test Case" in html
        assert "<!DOCTYPE html>" in html

    def test_export_html_contains_subject(self, exporter, rich_case):
        data = exporter.export_html(rich_case)
        html = data.decode("utf-8")
        assert "John Doe" in html

    def test_export_summary_text_contains_title(self, exporter, rich_case):
        data = exporter.export_summary_text(rich_case)
        text = data.decode("utf-8")
        assert "Export Test Case" in text
        assert "CONFIDENTIAL" in text

    def test_export_summary_text_contains_evidence(self, exporter, rich_case):
        data = exporter.export_summary_text(rich_case)
        text = data.decode("utf-8")
        assert "Evidence URL" in text
