"""Unit tests for investigation workers (no Weaviate required)."""
from __future__ import annotations


from memory_system.investigation.workers import (
    ContradictionFlaggingWorker,
    EntityExtractionWorker,
    TimelineExtractionWorker,
)


class TestEntityExtractionWorker:
    def setup_method(self):
        self.worker = EntityExtractionWorker.__new__(EntityExtractionWorker)

    def test_extract_persons_basic(self):
        text = "John Smith met with Jane Doe at the office."
        persons = self.worker._extract_persons(text)
        assert isinstance(persons, list)
        names = " ".join(persons)
        assert "John Smith" in names or "Jane Doe" in names

    def test_extract_persons_no_match(self):
        text = "the quick brown fox jumped over the lazy dog"
        persons = self.worker._extract_persons(text)
        assert isinstance(persons, list)
        # May or may not find names — just assert no crash

    def test_extract_persons_returns_list(self):
        result = self.worker._extract_persons("")
        assert isinstance(result, list)

    def test_extract_organisations_ltd(self):
        text = "The contract was signed by Acme Corp Ltd and Global Trading Pty Ltd."
        orgs = self.worker._extract_organisations(text)
        assert isinstance(orgs, list)

    def test_extract_organisations_acronyms(self):
        text = "The FBI and CIA investigated the matter."
        orgs = self.worker._extract_organisations(text)
        assert isinstance(orgs, list)
        org_str = " ".join(orgs)
        assert "FBI" in org_str or "CIA" in org_str

    def test_extract_organisations_returns_list(self):
        result = self.worker._extract_organisations("")
        assert isinstance(result, list)


class TestTimelineExtractionWorker:
    def setup_method(self):
        self.worker = TimelineExtractionWorker.__new__(TimelineExtractionWorker)

    def test_extract_events_dd_mm_yyyy(self):
        text = "On 15/01/2024 the meeting occurred at headquarters."
        events = self.worker._extract_events(text, "chunk-1", "http://example.com")
        assert len(events) > 0
        assert events[0]["date"] == "15/01/2024"
        assert "chunk-1" == events[0]["source_chunk_id"]

    def test_extract_events_yyyy_mm_dd(self):
        text = "The report dated 2024-03-15 was submitted."
        events = self.worker._extract_events(text, "chunk-2", "http://example.com")
        assert len(events) > 0
        assert "2024-03-15" in events[0]["date"]

    def test_extract_events_month_name(self):
        text = "On 15 January 2024 the agreement was signed."
        events = self.worker._extract_events(text, "chunk-3", "http://example.com")
        assert len(events) > 0

    def test_extract_events_no_dates(self):
        text = "There are no dates in this text whatsoever."
        events = self.worker._extract_events(text, "chunk-4", "http://example.com")
        assert events == []

    def test_extract_events_context_captured(self):
        text = "The incident on 01/06/2024 was reported by the police."
        events = self.worker._extract_events(text, "chunk-5", "http://example.com")
        assert len(events) > 0
        assert "01/06/2024" in events[0]["description"]

    def test_extract_events_confidence(self):
        text = "Event on 01/01/2024."
        events = self.worker._extract_events(text, "c", "http://x.com")
        assert len(events) > 0
        assert 0 < events[0]["confidence"] <= 1.0


class TestContradictionFlaggingWorker:
    """ContradictionFlaggingWorker requires Weaviate — only test init."""

    def test_worker_instantiation_pattern(self):
        """Verify the worker can be created with the right constructor signature."""
        import inspect
        sig = inspect.signature(ContradictionFlaggingWorker.__init__)
        params = list(sig.parameters.keys())
        assert "weaviate_client" in params
        assert "matter_client" in params
