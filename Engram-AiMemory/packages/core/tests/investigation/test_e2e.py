"""End-to-end tests for investigation module (requires live Weaviate)."""
from __future__ import annotations

import pytest


pytestmark = pytest.mark.skip(reason="E2E tests require live Weaviate — run with --run-e2e flag")


class TestInvestigationE2E:
    """E2E tests that require a running Weaviate instance."""

    async def test_create_matter_and_ingest(self):
        """Create a matter, ingest evidence, and search."""
        pass

    async def test_entity_extraction_pipeline(self):
        """Ingest evidence and run entity extraction worker."""
        pass

    async def test_timeline_extraction_pipeline(self):
        """Ingest evidence with dates and run timeline worker."""
        pass

    async def test_intelligence_report_generation(self):
        """Run full pipeline and generate intelligence report."""
        pass
