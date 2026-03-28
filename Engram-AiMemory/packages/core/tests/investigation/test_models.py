"""Unit tests for investigation models."""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from memory_system.investigation.models import (
    MatterCreate,
    MatterStatus,
    EvidenceIngest,
    SearchRequest,
    SubjectPersonCreate,
    SubjectOrgCreate,
    SourceType,
)


class TestMatterCreate:
    def test_valid_matter_create(self):
        m = MatterCreate(matter_id="CASE-001", title="Test Case")
        assert m.matter_id == "CASE-001"
        assert m.title == "Test Case"
        assert m.tags == []

    def test_matter_create_with_all_fields(self):
        m = MatterCreate(
            matter_id="CASE-002",
            title="Full Case",
            description="A detailed case",
            lead_investigator="Agent Smith",
            tags=["fraud", "financial"],
        )
        assert m.lead_investigator == "Agent Smith"
        assert len(m.tags) == 2

    def test_matter_create_requires_matter_id(self):
        with pytest.raises(ValidationError):
            MatterCreate(title="No ID")  # type: ignore

    def test_matter_create_requires_title(self):
        with pytest.raises(ValidationError):
            MatterCreate(matter_id="CASE-003")  # type: ignore


class TestMatterStatus:
    def test_status_values(self):
        assert MatterStatus.ACTIVE.value == "ACTIVE"
        assert MatterStatus.CLOSED.value == "CLOSED"
        assert MatterStatus.ARCHIVED.value == "ARCHIVED"


class TestEvidenceIngest:
    def test_valid_evidence_ingest(self):
        e = EvidenceIngest(
            matter_id="CASE-001",
            content="Some evidence content",
            source_url="https://example.com",
            source_type=SourceType.WEB,
        )
        assert e.matter_id == "CASE-001"
        assert e.source_type == SourceType.WEB

    def test_evidence_ingest_defaults(self):
        e = EvidenceIngest(
            matter_id="CASE-001",
            content="Content",
            source_url="file.pdf",
            source_type=SourceType.PDF,
        )
        assert e.metadata == {}
        # page_number defaults to 0 (not None) per model definition
        assert e.page_number == 0


class TestSearchRequest:
    def test_valid_search_request(self):
        s = SearchRequest(matter_id="CASE-001", query="fraud evidence")
        assert s.query == "fraud evidence"
        assert s.limit == 10  # default

    def test_search_request_custom_limit(self):
        s = SearchRequest(matter_id="CASE-001", query="test", limit=25)
        assert s.limit == 25


class TestSubjectPersonCreate:
    def test_valid_person_create(self):
        p = SubjectPersonCreate(canonical_name="John Smith", matter_ids=["CASE-001"])
        assert p.canonical_name == "John Smith"
        assert p.aliases == []

    def test_person_create_with_aliases(self):
        p = SubjectPersonCreate(
            canonical_name="John Smith",
            matter_ids=["CASE-001"],
            aliases=["Johnny", "J. Smith"],
        )
        assert len(p.aliases) == 2


class TestSubjectOrgCreate:
    def test_valid_org_create(self):
        o = SubjectOrgCreate(canonical_name="Acme Corp", matter_ids=["CASE-001"])
        assert o.canonical_name == "Acme Corp"
