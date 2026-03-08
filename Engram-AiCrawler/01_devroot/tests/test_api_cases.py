"""Tests for app/api/cases.py — targets 70%+ coverage.

Patches app.api.cases.get_case_service so no real filesystem I/O happens.
All endpoints tested with happy paths, 404 paths, and edge cases.
"""
from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock, MagicMock

from app.api.cases import router
from app.middleware import rate_limit as _rl_module
from app.models.case import (
    Case,
    CasePriority,
    CaseSummary,
    CaseStatus,
    TimelineEvent,
    TimelineEventType,
)


# ---------------------------------------------------------------------------
# App / client setup
# ---------------------------------------------------------------------------

app = FastAPI()
app.include_router(router)
client = TestClient(app)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def disable_rate_limit():
    _rl_module._config.rate_limit_enabled = False
    yield
    _rl_module._config.rate_limit_enabled = False


@pytest.fixture(autouse=True)
def mock_get_redis():
    with patch("app.services.job_store._get_redis", new=AsyncMock(return_value=None)):
        yield


@pytest.fixture
def sample_case():
    """A minimal Case object for use in tests."""
    return Case(
        case_id="abc123",
        case_number="CASE-2026-0001",
        title="Test Case",
        description="A test investigation",
        case_type="general",
        status=CaseStatus.ACTIVE,
        priority=CasePriority.MEDIUM,
        investigator="agent_x",
    )


@pytest.fixture
def sample_summary(sample_case):
    return CaseSummary(
        case_id=sample_case.case_id,
        case_number=sample_case.case_number,
        title=sample_case.title,
        case_type=sample_case.case_type,
        status=sample_case.status,
        priority=sample_case.priority,
        investigator=sample_case.investigator,
        subject_count=0,
        evidence_count=0,
        risk_level=None,
        risk_score=None,
        created_at=sample_case.created_at,
        updated_at=sample_case.updated_at,
    )


@pytest.fixture
def mock_svc():
    return MagicMock()


# ---------------------------------------------------------------------------
# POST /api/cases/ — create_case
# ---------------------------------------------------------------------------


class TestCreateCase:
    def test_create_case_success(self, mock_svc, sample_case):
        mock_svc.create.return_value = sample_case
        with patch("app.api.cases.get_case_service", return_value=mock_svc):
            resp = client.post("/api/cases/", json={"title": "Test Case"})
        assert resp.status_code == 201
        assert resp.json()["title"] == "Test Case"
        mock_svc.create.assert_called_once()

    def test_create_case_with_actor_query_param(self, mock_svc, sample_case):
        mock_svc.create.return_value = sample_case
        with patch("app.api.cases.get_case_service", return_value=mock_svc):
            resp = client.post("/api/cases/?actor=investigator1", json={"title": "Test"})
        assert resp.status_code == 201

    def test_create_case_missing_title(self):
        resp = client.post("/api/cases/", json={})
        assert resp.status_code == 422

    def test_create_case_title_too_long(self):
        resp = client.post("/api/cases/", json={"title": "x" * 301})
        assert resp.status_code == 422

    def test_create_case_full_payload(self, mock_svc, sample_case):
        mock_svc.create.return_value = sample_case
        payload = {
            "title": "Full Case",
            "description": "Detailed desc",
            "case_type": "fraud",
            "priority": "high",
            "investigator": "agent_j",
            "client_reference": "REF-001",
            "jurisdiction": "AU",
            "tags": ["fraud", "osint"],
        }
        with patch("app.api.cases.get_case_service", return_value=mock_svc):
            resp = client.post("/api/cases/", json=payload)
        assert resp.status_code == 201


# ---------------------------------------------------------------------------
# GET /api/cases/ — list_cases
# ---------------------------------------------------------------------------


class TestListCases:
    def test_list_cases_empty(self, mock_svc):
        mock_svc.list_all.return_value = []
        with patch("app.api.cases.get_case_service", return_value=mock_svc):
            resp = client.get("/api/cases/")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_list_cases_returns_summaries(self, mock_svc, sample_summary):
        mock_svc.list_all.return_value = [sample_summary]
        with patch("app.api.cases.get_case_service", return_value=mock_svc):
            resp = client.get("/api/cases/")
        assert resp.status_code == 200
        assert len(resp.json()) == 1
        assert resp.json()[0]["title"] == "Test Case"

    def test_list_cases_filter_by_status(self, mock_svc):
        mock_svc.list_all.return_value = []
        with patch("app.api.cases.get_case_service", return_value=mock_svc):
            resp = client.get("/api/cases/?status=active")
        assert resp.status_code == 200
        call_kwargs = mock_svc.list_all.call_args.kwargs
        assert call_kwargs["status"] == CaseStatus.ACTIVE

    def test_list_cases_filter_by_priority(self, mock_svc):
        mock_svc.list_all.return_value = []
        with patch("app.api.cases.get_case_service", return_value=mock_svc):
            resp = client.get("/api/cases/?priority=high")
        assert resp.status_code == 200

    def test_list_cases_with_pagination(self, mock_svc):
        mock_svc.list_all.return_value = []
        with patch("app.api.cases.get_case_service", return_value=mock_svc):
            resp = client.get("/api/cases/?limit=10&offset=20")
        assert resp.status_code == 200
        call_kwargs = mock_svc.list_all.call_args.kwargs
        assert call_kwargs["limit"] == 10
        assert call_kwargs["offset"] == 20

    def test_list_cases_all_filters(self, mock_svc):
        mock_svc.list_all.return_value = []
        with patch("app.api.cases.get_case_service", return_value=mock_svc):
            resp = client.get(
                "/api/cases/?status=active&priority=medium&case_type=fraud&investigator=agent1&tag=fraud"
            )
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# GET /api/cases/{case_id} — get_case
# ---------------------------------------------------------------------------


class TestGetCase:
    def test_get_case_found(self, mock_svc, sample_case):
        mock_svc.get.return_value = sample_case
        with patch("app.api.cases.get_case_service", return_value=mock_svc):
            resp = client.get(f"/api/cases/{sample_case.case_id}")
        assert resp.status_code == 200
        assert resp.json()["case_id"] == sample_case.case_id

    def test_get_case_not_found(self, mock_svc):
        mock_svc.get.return_value = None
        with patch("app.api.cases.get_case_service", return_value=mock_svc):
            resp = client.get("/api/cases/nonexistent")
        assert resp.status_code == 404
        assert "nonexistent" in resp.json()["detail"]


# ---------------------------------------------------------------------------
# PUT /api/cases/{case_id} — update_case
# ---------------------------------------------------------------------------


class TestUpdateCase:
    def test_update_case_success(self, mock_svc, sample_case):
        updated = sample_case.model_copy()
        updated.title = "Updated Title"
        mock_svc.update.return_value = updated
        with patch("app.api.cases.get_case_service", return_value=mock_svc):
            resp = client.put(f"/api/cases/{sample_case.case_id}", json={"title": "Updated Title"})
        assert resp.status_code == 200
        mock_svc.update.assert_called_once()

    def test_update_case_not_found(self, mock_svc):
        mock_svc.update.return_value = None
        with patch("app.api.cases.get_case_service", return_value=mock_svc):
            resp = client.put("/api/cases/missing", json={"title": "New"})
        assert resp.status_code == 404

    def test_update_case_with_actor(self, mock_svc, sample_case):
        mock_svc.update.return_value = sample_case
        with patch("app.api.cases.get_case_service", return_value=mock_svc):
            resp = client.put(
                f"/api/cases/{sample_case.case_id}?actor=agent2", json={"status": "closed"}
            )
        assert resp.status_code == 200

    def test_update_case_status_change(self, mock_svc, sample_case):
        closed = sample_case.model_copy()
        closed.status = CaseStatus.CLOSED
        mock_svc.update.return_value = closed
        with patch("app.api.cases.get_case_service", return_value=mock_svc):
            resp = client.put(f"/api/cases/{sample_case.case_id}", json={"status": "closed"})
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# DELETE /api/cases/{case_id} — delete_case
# ---------------------------------------------------------------------------


class TestDeleteCase:
    def test_delete_case_success(self, mock_svc):
        mock_svc.delete.return_value = True
        with patch("app.api.cases.get_case_service", return_value=mock_svc):
            resp = client.delete("/api/cases/abc123")
        assert resp.status_code == 200
        data = resp.json()
        assert data["case_id"] == "abc123"
        assert data["deleted"] is True

    def test_delete_case_not_found(self, mock_svc):
        mock_svc.delete.return_value = False
        with patch("app.api.cases.get_case_service", return_value=mock_svc):
            resp = client.delete("/api/cases/nope")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# POST /api/cases/{case_id}/subjects — add_subject
# ---------------------------------------------------------------------------


class TestAddSubject:
    def test_add_subject_success(self, mock_svc, sample_case):
        mock_svc.add_subject.return_value = sample_case
        payload = {"display_name": "John Doe"}
        with patch("app.api.cases.get_case_service", return_value=mock_svc):
            resp = client.post(f"/api/cases/{sample_case.case_id}/subjects", json=payload)
        assert resp.status_code == 200
        mock_svc.add_subject.assert_called_once()

    def test_add_subject_with_all_fields(self, mock_svc, sample_case):
        mock_svc.add_subject.return_value = sample_case
        payload = {
            "display_name": "Jane Smith",
            "entity_id": "entity_xyz",
            "role": "suspect",
            "notes": "Key suspect in the case",
        }
        with patch("app.api.cases.get_case_service", return_value=mock_svc):
            resp = client.post(f"/api/cases/{sample_case.case_id}/subjects", json=payload)
        assert resp.status_code == 200

    def test_add_subject_case_not_found(self, mock_svc):
        mock_svc.add_subject.return_value = None
        with patch("app.api.cases.get_case_service", return_value=mock_svc):
            resp = client.post("/api/cases/missing/subjects", json={"display_name": "X"})
        assert resp.status_code == 404

    def test_add_subject_missing_display_name(self, mock_svc, sample_case):
        resp = client.post(f"/api/cases/{sample_case.case_id}/subjects", json={})
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# POST /api/cases/{case_id}/evidence — add_evidence
# ---------------------------------------------------------------------------


class TestAddEvidence:
    def test_add_evidence_success(self, mock_svc, sample_case):
        mock_svc.add_evidence.return_value = sample_case
        payload = {
            "evidence_type": "url",
            "title": "Evidence URL",
            "url": "https://example.com",
        }
        with patch("app.api.cases.get_case_service", return_value=mock_svc):
            resp = client.post(f"/api/cases/{sample_case.case_id}/evidence", json=payload)
        assert resp.status_code == 200
        mock_svc.add_evidence.assert_called_once()

    def test_add_evidence_full_payload(self, mock_svc, sample_case):
        mock_svc.add_evidence.return_value = sample_case
        payload = {
            "evidence_type": "text_note",
            "title": "My Note",
            "description": "Detailed description",
            "text_content": "Content here",
            "source": "manual",
            "tags": ["important"],
            "is_key_evidence": True,
            "added_by": "agent_x",
        }
        with patch("app.api.cases.get_case_service", return_value=mock_svc):
            resp = client.post(f"/api/cases/{sample_case.case_id}/evidence", json=payload)
        assert resp.status_code == 200

    def test_add_evidence_case_not_found(self, mock_svc):
        mock_svc.add_evidence.return_value = None
        payload = {"evidence_type": "url", "title": "Test"}
        with patch("app.api.cases.get_case_service", return_value=mock_svc):
            resp = client.post("/api/cases/missing/evidence", json=payload)
        assert resp.status_code == 404

    def test_add_evidence_with_actor_in_payload(self, mock_svc, sample_case):
        """Tests that added_by falls back to actor query param."""
        mock_svc.add_evidence.return_value = sample_case
        payload = {"evidence_type": "document", "title": "Doc"}
        with patch("app.api.cases.get_case_service", return_value=mock_svc):
            resp = client.post(
                f"/api/cases/{sample_case.case_id}/evidence?actor=agent_z", json=payload
            )
        assert resp.status_code == 200
        # Check that the EvidenceItem was constructed with added_by=actor
        call_args = mock_svc.add_evidence.call_args
        evidence_item = call_args.args[1]  # second positional arg is the EvidenceItem
        assert evidence_item.added_by == "agent_z"


# ---------------------------------------------------------------------------
# DELETE /api/cases/{case_id}/evidence/{evidence_id} — remove_evidence
# ---------------------------------------------------------------------------


class TestRemoveEvidence:
    def test_remove_evidence_success(self, mock_svc, sample_case):
        mock_svc.remove_evidence.return_value = sample_case
        with patch("app.api.cases.get_case_service", return_value=mock_svc):
            resp = client.delete(f"/api/cases/{sample_case.case_id}/evidence/ev123")
        assert resp.status_code == 200
        mock_svc.remove_evidence.assert_called_once_with(sample_case.case_id, "ev123", actor=None)

    def test_remove_evidence_case_not_found(self, mock_svc):
        mock_svc.remove_evidence.return_value = None
        with patch("app.api.cases.get_case_service", return_value=mock_svc):
            resp = client.delete("/api/cases/missing/evidence/ev123")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# POST /api/cases/{case_id}/notes — add_note
# ---------------------------------------------------------------------------


class TestAddNote:
    def test_add_note_success(self, mock_svc, sample_case):
        # add_note reads the case directly via svc.get and calls svc._write
        mock_svc.get.return_value = sample_case
        mock_svc._write = MagicMock()
        payload = {"content": "This is a note"}
        with patch("app.api.cases.get_case_service", return_value=mock_svc):
            resp = client.post(f"/api/cases/{sample_case.case_id}/notes", json=payload)
        assert resp.status_code == 200
        mock_svc._write.assert_called_once()

    def test_add_note_flagged(self, mock_svc, sample_case):
        mock_svc.get.return_value = sample_case
        mock_svc._write = MagicMock()
        payload = {"content": "Flagged note", "author": "agent_y", "is_flagged": True}
        with patch("app.api.cases.get_case_service", return_value=mock_svc):
            resp = client.post(f"/api/cases/{sample_case.case_id}/notes", json=payload)
        assert resp.status_code == 200

    def test_add_note_case_not_found(self, mock_svc):
        mock_svc.get.return_value = None
        with patch("app.api.cases.get_case_service", return_value=mock_svc):
            resp = client.post("/api/cases/missing/notes", json={"content": "Note"})
        assert resp.status_code == 404

    def test_add_note_missing_content(self, mock_svc, sample_case):
        resp = client.post(f"/api/cases/{sample_case.case_id}/notes", json={})
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# POST /api/cases/{case_id}/link/scan — link_scan
# ---------------------------------------------------------------------------


class TestLinkScan:
    def test_link_scan_success(self, mock_svc, sample_case):
        mock_svc.link_scan.return_value = sample_case
        with patch("app.api.cases.get_case_service", return_value=mock_svc):
            resp = client.post(
                f"/api/cases/{sample_case.case_id}/link/scan", json={"id": "scan_001"}
            )
        assert resp.status_code == 200
        mock_svc.link_scan.assert_called_once_with(sample_case.case_id, "scan_001", actor=None)

    def test_link_scan_with_actor(self, mock_svc, sample_case):
        mock_svc.link_scan.return_value = sample_case
        with patch("app.api.cases.get_case_service", return_value=mock_svc):
            resp = client.post(
                f"/api/cases/{sample_case.case_id}/link/scan",
                json={"id": "scan_002", "actor": "agent_1"},
            )
        assert resp.status_code == 200
        mock_svc.link_scan.assert_called_once_with(sample_case.case_id, "scan_002", actor="agent_1")

    def test_link_scan_case_not_found(self, mock_svc):
        mock_svc.link_scan.return_value = None
        with patch("app.api.cases.get_case_service", return_value=mock_svc):
            resp = client.post("/api/cases/missing/link/scan", json={"id": "scan_x"})
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# POST /api/cases/{case_id}/link/crawl — link_crawl
# ---------------------------------------------------------------------------


class TestLinkCrawl:
    def test_link_crawl_success(self, mock_svc, sample_case):
        mock_svc.link_deep_crawl.return_value = sample_case
        with patch("app.api.cases.get_case_service", return_value=mock_svc):
            resp = client.post(
                f"/api/cases/{sample_case.case_id}/link/crawl", json={"id": "crawl_001"}
            )
        assert resp.status_code == 200

    def test_link_crawl_not_found(self, mock_svc):
        mock_svc.link_deep_crawl.return_value = None
        with patch("app.api.cases.get_case_service", return_value=mock_svc):
            resp = client.post("/api/cases/missing/link/crawl", json={"id": "crawl_x"})
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# POST /api/cases/{case_id}/link/fraud-graph — link_fraud_graph
# ---------------------------------------------------------------------------


class TestLinkFraudGraph:
    def test_link_fraud_graph_success(self, mock_svc, sample_case):
        mock_svc.link_fraud_graph.return_value = sample_case
        payload = {
            "graph_id": "graph_001",
            "risk_level": "HIGH",
            "risk_score": 0.85,
        }
        with patch("app.api.cases.get_case_service", return_value=mock_svc):
            resp = client.post(f"/api/cases/{sample_case.case_id}/link/fraud-graph", json=payload)
        assert resp.status_code == 200
        mock_svc.link_fraud_graph.assert_called_once_with(
            sample_case.case_id,
            "graph_001",
            risk_level="HIGH",
            risk_score=0.85,
            actor=None,
        )

    def test_link_fraud_graph_minimal(self, mock_svc, sample_case):
        mock_svc.link_fraud_graph.return_value = sample_case
        with patch("app.api.cases.get_case_service", return_value=mock_svc):
            resp = client.post(
                f"/api/cases/{sample_case.case_id}/link/fraud-graph", json={"graph_id": "g1"}
            )
        assert resp.status_code == 200

    def test_link_fraud_graph_not_found(self, mock_svc):
        mock_svc.link_fraud_graph.return_value = None
        with patch("app.api.cases.get_case_service", return_value=mock_svc):
            resp = client.post("/api/cases/missing/link/fraud-graph", json={"graph_id": "g1"})
        assert resp.status_code == 404

    def test_link_fraud_graph_risk_score_out_of_range(self, mock_svc, sample_case):
        resp = client.post(
            f"/api/cases/{sample_case.case_id}/link/fraud-graph",
            json={"graph_id": "g1", "risk_score": 1.5},
        )
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# POST /api/cases/{case_id}/link/image-intel — link_image_intel
# ---------------------------------------------------------------------------


class TestLinkImageIntel:
    def test_link_image_intel_success(self, mock_svc, sample_case):
        mock_svc.link_image_intel.return_value = sample_case
        with patch("app.api.cases.get_case_service", return_value=mock_svc):
            resp = client.post(
                f"/api/cases/{sample_case.case_id}/link/image-intel", json={"id": "img_001"}
            )
        assert resp.status_code == 200

    def test_link_image_intel_not_found(self, mock_svc):
        mock_svc.link_image_intel.return_value = None
        with patch("app.api.cases.get_case_service", return_value=mock_svc):
            resp = client.post("/api/cases/missing/link/image-intel", json={"id": "img_x"})
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# GET /api/cases/{case_id}/timeline — get_timeline
# ---------------------------------------------------------------------------


class TestGetTimeline:
    def test_get_timeline_success(self, mock_svc, sample_case):
        evt = TimelineEvent(
            event_type=TimelineEventType.CASE_CREATED,
            title="Case created",
        )
        sample_case.timeline.append(evt)
        mock_svc.get.return_value = sample_case
        with patch("app.api.cases.get_case_service", return_value=mock_svc):
            resp = client.get(f"/api/cases/{sample_case.case_id}/timeline")
        assert resp.status_code == 200
        assert len(resp.json()) >= 1

    def test_get_timeline_empty(self, mock_svc, sample_case):
        sample_case.timeline = []
        mock_svc.get.return_value = sample_case
        with patch("app.api.cases.get_case_service", return_value=mock_svc):
            resp = client.get(f"/api/cases/{sample_case.case_id}/timeline")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_get_timeline_with_search(self, mock_svc, sample_case):
        mock_svc.get.return_value = sample_case
        with patch("app.api.cases.get_case_service", return_value=mock_svc):
            resp = client.get(f"/api/cases/{sample_case.case_id}/timeline?search=created")
        assert resp.status_code == 200

    def test_get_timeline_with_actor_filter(self, mock_svc, sample_case):
        mock_svc.get.return_value = sample_case
        with patch("app.api.cases.get_case_service", return_value=mock_svc):
            resp = client.get(f"/api/cases/{sample_case.case_id}/timeline?actor=agent_x")
        assert resp.status_code == 200

    def test_get_timeline_case_not_found(self, mock_svc):
        mock_svc.get.return_value = None
        with patch("app.api.cases.get_case_service", return_value=mock_svc):
            resp = client.get("/api/cases/missing/timeline")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# GET /api/cases/{case_id}/export/json — export_json
# ---------------------------------------------------------------------------


class TestExportJson:
    def test_export_json_success(self, mock_svc, sample_case):
        mock_svc.get.return_value = sample_case
        with patch("app.api.cases.get_case_service", return_value=mock_svc):
            resp = client.get(f"/api/cases/{sample_case.case_id}/export/json")
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "application/json"
        assert "attachment" in resp.headers["content-disposition"]

    def test_export_json_case_not_found(self, mock_svc):
        mock_svc.get.return_value = None
        with patch("app.api.cases.get_case_service", return_value=mock_svc):
            resp = client.get("/api/cases/missing/export/json")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# GET /api/cases/{case_id}/export/csv/timeline — export_csv_timeline
# ---------------------------------------------------------------------------


class TestExportCsvTimeline:
    def test_export_csv_timeline_success(self, mock_svc, sample_case):
        mock_svc.get.return_value = sample_case
        with patch("app.api.cases.get_case_service", return_value=mock_svc):
            resp = client.get(f"/api/cases/{sample_case.case_id}/export/csv/timeline")
        assert resp.status_code == 200
        assert "text/csv" in resp.headers["content-type"]
        assert "attachment" in resp.headers["content-disposition"]

    def test_export_csv_timeline_not_found(self, mock_svc):
        mock_svc.get.return_value = None
        with patch("app.api.cases.get_case_service", return_value=mock_svc):
            resp = client.get("/api/cases/missing/export/csv/timeline")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# GET /api/cases/{case_id}/export/csv/evidence — export_csv_evidence
# ---------------------------------------------------------------------------


class TestExportCsvEvidence:
    def test_export_csv_evidence_success(self, mock_svc, sample_case):
        mock_svc.get.return_value = sample_case
        with patch("app.api.cases.get_case_service", return_value=mock_svc):
            resp = client.get(f"/api/cases/{sample_case.case_id}/export/csv/evidence")
        assert resp.status_code == 200
        assert "text/csv" in resp.headers["content-type"]

    def test_export_csv_evidence_not_found(self, mock_svc):
        mock_svc.get.return_value = None
        with patch("app.api.cases.get_case_service", return_value=mock_svc):
            resp = client.get("/api/cases/missing/export/csv/evidence")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# GET /api/cases/{case_id}/export/html — export_html
# ---------------------------------------------------------------------------


class TestExportHtml:
    def test_export_html_success(self, mock_svc, sample_case):
        mock_svc.get.return_value = sample_case
        with patch("app.api.cases.get_case_service", return_value=mock_svc):
            resp = client.get(f"/api/cases/{sample_case.case_id}/export/html")
        assert resp.status_code == 200
        assert "text/html" in resp.headers["content-type"]
        assert "inline" in resp.headers["content-disposition"]

    def test_export_html_not_found(self, mock_svc):
        mock_svc.get.return_value = None
        with patch("app.api.cases.get_case_service", return_value=mock_svc):
            resp = client.get("/api/cases/missing/export/html")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# GET /api/cases/{case_id}/export/text — export_text
# ---------------------------------------------------------------------------


class TestExportText:
    def test_export_text_success(self, mock_svc, sample_case):
        mock_svc.get.return_value = sample_case
        with patch("app.api.cases.get_case_service", return_value=mock_svc):
            resp = client.get(f"/api/cases/{sample_case.case_id}/export/text")
        assert resp.status_code == 200
        assert "text/plain" in resp.headers["content-type"]
        assert "attachment" in resp.headers["content-disposition"]

    def test_export_text_not_found(self, mock_svc):
        mock_svc.get.return_value = None
        with patch("app.api.cases.get_case_service", return_value=mock_svc):
            resp = client.get("/api/cases/missing/export/text")
        assert resp.status_code == 404
