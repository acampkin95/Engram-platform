"""Tests for DeepCrawlOrchestrator and SearchVectorGenerator."""
import pytest
from datetime import datetime, UTC
from unittest.mock import AsyncMock, MagicMock, patch

from app.models.entity import (
    EntityProfile,
    CreateEntityRequest,
    DataSource,
    NameInfo,
    EntityType,
)
from app.orchestrators.deep_crawl_orchestrator import (
    SearchVectorGenerator,
    DeepCrawlOrchestrator,
    DeepCrawlRequest,
    DeepCrawlResult,
    DeepCrawlStage,
    SearchVector,
    CrawlIteration,
    ExtractedData,
)
from app.pipelines.entity_enrichment import EnrichmentResult


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_entity(name: str = "John Doe") -> EntityProfile:
    entity = EntityProfile(entity_type=EntityType.PERSON)
    entity.primary_name = NameInfo(
        value=name,
        first_name="John",
        last_name="Doe",
        sources=[DataSource.USER_INPUT],
    )
    return entity


def _make_mock_bridge() -> MagicMock:
    bridge = MagicMock()
    bridge.chat_completion = AsyncMock(return_value={"content": "[]"})
    return bridge


def _make_orchestrator_patched(on_progress=None) -> "DeepCrawlOrchestrator":
    """Create an orchestrator with ChromaDB patched out."""
    mock_chromadb = MagicMock()
    with patch(
        "app.orchestrators.deep_crawl_orchestrator.get_chromadb_client", return_value=mock_chromadb
    ):
        orch = DeepCrawlOrchestrator(
            lm_bridge=_make_mock_bridge(),
            chromadb_client=mock_chromadb,
            on_progress=on_progress,
        )
    return orch


# ---------------------------------------------------------------------------
# SearchVector model tests
# ---------------------------------------------------------------------------


class TestSearchVector:
    def test_default_priority_is_1(self):
        v = SearchVector(query="test", vector_type="name")
        assert v.priority == 1

    def test_priority_bounds(self):
        v = SearchVector(query="q", vector_type="name", priority=10)
        assert v.priority == 10

    def test_vector_id_auto_generated(self):
        v = SearchVector(query="q", vector_type="name")
        assert v.vector_id
        assert len(v.vector_id) > 0

    def test_platforms_default_empty(self):
        v = SearchVector(query="q", vector_type="name")
        assert v.platforms == []

    def test_source_data_stored(self):
        v = SearchVector(query="q", vector_type="name", source_data={"name": "Alice"})
        assert v.source_data["name"] == "Alice"


# ---------------------------------------------------------------------------
# CrawlIteration model tests
# ---------------------------------------------------------------------------


class TestCrawlIteration:
    def test_defaults(self):
        it = CrawlIteration(iteration_number=1)
        assert it.urls_crawled == 0
        assert it.new_data_points == 0
        assert it.diminishing_returns is False
        assert it.completed_at is None

    def test_iteration_id_auto_generated(self):
        it = CrawlIteration(iteration_number=1)
        assert it.iteration_id
        assert len(it.iteration_id) > 0


# ---------------------------------------------------------------------------
# ExtractedData model tests
# ---------------------------------------------------------------------------


class TestExtractedData:
    def test_defaults(self):
        d = ExtractedData(source_url="https://example.com", source_type="web")
        assert d.names == []
        assert d.emails == []
        assert d.phones == []
        assert d.confidence == 0.5


# ---------------------------------------------------------------------------
# DeepCrawlRequest model tests
# ---------------------------------------------------------------------------


class TestDeepCrawlRequest:
    def test_defaults(self):
        req = DeepCrawlRequest(create_entity=CreateEntityRequest(name="Alice"))
        assert req.max_iterations == 3
        assert req.max_urls_per_iteration == 50
        assert req.include_social_media is True
        assert req.include_dark_web is False

    def test_max_iterations_bounds(self):
        req = DeepCrawlRequest(
            create_entity=CreateEntityRequest(name="Alice"),
            max_iterations=1,
        )
        assert req.max_iterations == 1

    def test_min_new_data_threshold_default(self):
        req = DeepCrawlRequest(create_entity=CreateEntityRequest(name="Alice"))
        assert req.min_new_data_threshold == 0.1


# ---------------------------------------------------------------------------
# SearchVectorGenerator tests
# ---------------------------------------------------------------------------


class TestSearchVectorGenerator:
    def setup_method(self):
        self.mock_bridge = _make_mock_bridge()
        self.gen = SearchVectorGenerator(lm_bridge=self.mock_bridge)

    @pytest.mark.asyncio
    async def test_generate_vectors_returns_list(self):
        entity = _make_entity()
        vectors = await self.gen.generate_vectors(entity)
        assert isinstance(vectors, list)

    @pytest.mark.asyncio
    async def test_name_vectors_generated_for_full_name(self):
        entity = _make_entity("John Doe")
        vectors = await self.gen.generate_vectors(entity)
        types = [v.vector_type for v in vectors]
        assert "name" in types

    @pytest.mark.asyncio
    async def test_email_vectors_generated(self):
        entity = _make_entity()
        entity.add_email("john@example.com", DataSource.USER_INPUT)
        vectors = await self.gen.generate_vectors(entity)
        types = [v.vector_type for v in vectors]
        assert "email" in types

    @pytest.mark.asyncio
    async def test_phone_vectors_generated(self):
        entity = _make_entity()
        entity.add_phone("555-123-4567", DataSource.USER_INPUT)
        vectors = await self.gen.generate_vectors(entity)
        types = [v.vector_type for v in vectors]
        assert "phone" in types

    @pytest.mark.asyncio
    async def test_username_vectors_generated(self):
        entity = _make_entity()
        entity.add_username("jdoe99", source=DataSource.USER_INPUT)
        vectors = await self.gen.generate_vectors(entity)
        types = [v.vector_type for v in vectors]
        assert "username" in types

    @pytest.mark.asyncio
    async def test_keyword_vectors_generated(self):
        entity = _make_entity()
        entity.keywords = ["cybersecurity", "python"]
        vectors = await self.gen.generate_vectors(entity)
        types = [v.vector_type for v in vectors]
        assert "keyword" in types

    @pytest.mark.asyncio
    async def test_max_vectors_respected(self):
        entity = _make_entity()
        entity.add_email("a@b.com", DataSource.USER_INPUT)
        entity.add_phone("555-111-2222", DataSource.USER_INPUT)
        vectors = await self.gen.generate_vectors(entity, max_vectors=3)
        assert len(vectors) <= 3

    @pytest.mark.asyncio
    async def test_vectors_sorted_by_priority_descending(self):
        entity = _make_entity()
        entity.add_email("a@b.com", DataSource.USER_INPUT)
        vectors = await self.gen.generate_vectors(entity)
        if len(vectors) > 1:
            for i in range(len(vectors) - 1):
                assert vectors[i].priority >= vectors[i + 1].priority

    @pytest.mark.asyncio
    async def test_platform_filter_applied(self):
        entity = _make_entity()
        platforms = ["twitter", "linkedin"]
        vectors = await self.gen.generate_vectors(entity, platforms=platforms)
        for v in vectors:
            if v.platforms:
                assert all(p in platforms for p in v.platforms)

    @pytest.mark.asyncio
    async def test_llm_vectors_generated_when_enough_terms(self):
        entity = _make_entity()
        entity.add_email("a@b.com", DataSource.USER_INPUT)
        entity.add_phone("555-111-2222", DataSource.USER_INPUT)
        entity.add_username("jdoe", source=DataSource.USER_INPUT)
        self.mock_bridge.chat_completion = AsyncMock(
            return_value={
                "content": '[{"query": "John Doe site:linkedin.com", "platforms": ["linkedin"], "priority": 8, "reason": "professional"}]'
            }
        )
        vectors = await self.gen.generate_vectors(entity)
        llm_types = [v for v in vectors if v.vector_type == "llm_generated"]
        assert len(llm_types) >= 1

    @pytest.mark.asyncio
    async def test_llm_failure_does_not_crash(self):
        entity = _make_entity()
        entity.add_email("a@b.com", DataSource.USER_INPUT)
        entity.add_phone("555-111-2222", DataSource.USER_INPUT)
        entity.add_username("jdoe", source=DataSource.USER_INPUT)
        self.mock_bridge.chat_completion = AsyncMock(side_effect=RuntimeError("LLM down"))
        vectors = await self.gen.generate_vectors(entity)
        assert isinstance(vectors, list)

    @pytest.mark.asyncio
    async def test_llm_invalid_json_does_not_crash(self):
        entity = _make_entity()
        entity.add_email("a@b.com", DataSource.USER_INPUT)
        entity.add_phone("555-111-2222", DataSource.USER_INPUT)
        entity.add_username("jdoe", source=DataSource.USER_INPUT)
        self.mock_bridge.chat_completion = AsyncMock(return_value={"content": "not valid json"})
        vectors = await self.gen.generate_vectors(entity)
        assert isinstance(vectors, list)

    def test_summarize_entity_includes_name(self):
        entity = _make_entity("Alice Smith")
        summary = self.gen._summarize_entity(entity)
        assert "Alice Smith" in summary

    def test_summarize_entity_includes_email(self):
        entity = _make_entity()
        entity.add_email("alice@test.com", DataSource.USER_INPUT)
        summary = self.gen._summarize_entity(entity)
        assert "alice@test.com" in summary

    def test_summarize_entity_includes_phone(self):
        entity = _make_entity()
        entity.add_phone("555-000-1111", DataSource.USER_INPUT)
        summary = self.gen._summarize_entity(entity)
        assert "555-000-1111" in summary

    def test_summarize_entity_includes_keywords(self):
        entity = _make_entity()
        entity.keywords = ["hacker", "osint"]
        summary = self.gen._summarize_entity(entity)
        assert "hacker" in summary

    @pytest.mark.asyncio
    async def test_address_vectors_generated(self):
        entity = _make_entity()
        entity.add_address("123 Main St, Springfield", DataSource.USER_INPUT)
        vectors = await self.gen.generate_vectors(entity)
        types = [v.vector_type for v in vectors]
        assert "address" in types

    @pytest.mark.asyncio
    async def test_name_with_nickname_generates_nickname_vector(self):
        entity = _make_entity()
        entity.primary_name.nickname = "Johnny"
        vectors = await self.gen.generate_vectors(entity)
        queries = [v.query for v in vectors]
        assert "Johnny" in queries

    @pytest.mark.asyncio
    async def test_name_with_maiden_name_generates_vector(self):
        entity = _make_entity()
        entity.primary_name.maiden_name = "Smith"
        vectors = await self.gen.generate_vectors(entity)
        queries = [v.query for v in vectors]
        assert any("Smith" in q for q in queries)

    @pytest.mark.asyncio
    async def test_name_with_aliases_generates_alias_vectors(self):
        entity = _make_entity()
        entity.primary_name.aliases = ["JD", "Johnny D"]
        vectors = await self.gen.generate_vectors(entity)
        types = [v.vector_type for v in vectors]
        assert "alias" in types

    @pytest.mark.asyncio
    async def test_email_local_part_vector_generated(self):
        entity = _make_entity()
        entity.add_email("john.doe@gmail.com", DataSource.USER_INPUT)
        vectors = await self.gen.generate_vectors(entity)
        types = [v.vector_type for v in vectors]
        assert "email_local" in types

    @pytest.mark.asyncio
    async def test_email_domain_vector_for_non_common_domain(self):
        entity = _make_entity()
        entity.add_email("john@company.io", DataSource.USER_INPUT)
        vectors = await self.gen.generate_vectors(entity)
        types = [v.vector_type for v in vectors]
        assert "email_domain" in types

    @pytest.mark.asyncio
    async def test_no_email_domain_vector_for_gmail(self):
        entity = _make_entity()
        entity.add_email("john@gmail.com", DataSource.USER_INPUT)
        vectors = await self.gen.generate_vectors(entity)
        types = [v.vector_type for v in vectors]
        assert "email_domain" not in types

    @pytest.mark.asyncio
    async def test_phone_digits_only_vector_generated(self):
        entity = _make_entity()
        entity.add_phone("(555) 123-4567", DataSource.USER_INPUT)
        vectors = await self.gen.generate_vectors(entity)
        phone_vecs = [v for v in vectors if v.vector_type == "phone"]
        assert len(phone_vecs) >= 1

    @pytest.mark.asyncio
    async def test_username_variations_generated(self):
        entity = _make_entity()
        entity.add_username("john_doe", source=DataSource.USER_INPUT)
        vectors = await self.gen.generate_vectors(entity)
        types = [v.vector_type for v in vectors]
        assert "username_variation" in types


# ---------------------------------------------------------------------------
# DeepCrawlOrchestrator._create_entity_from_request tests
# ---------------------------------------------------------------------------


class TestCreateEntityFromRequest:
    def setup_method(self):
        self.orch = _make_orchestrator_patched()

    def test_creates_entity_with_name(self):
        req = CreateEntityRequest(name="Alice Smith")
        entity = self.orch._create_entity_from_request(req)
        assert entity.primary_name is not None
        assert entity.primary_name.value == "Alice Smith"

    def test_creates_entity_with_first_last_name(self):
        req = CreateEntityRequest(first_name="Alice", last_name="Smith")
        entity = self.orch._create_entity_from_request(req)
        assert entity.primary_name is not None
        assert "Alice" in entity.primary_name.value
        assert "Smith" in entity.primary_name.value

    def test_creates_entity_with_phones(self):
        req = CreateEntityRequest(name="Alice", phones=["555-111-2222"])
        entity = self.orch._create_entity_from_request(req)
        assert len(entity.phones) == 1
        assert entity.phones[0].value == "555-111-2222"

    def test_creates_entity_with_emails(self):
        req = CreateEntityRequest(name="Alice", emails=["alice@test.com"])
        entity = self.orch._create_entity_from_request(req)
        assert len(entity.emails) == 1
        assert entity.emails[0].value == "alice@test.com"

    def test_creates_entity_with_addresses(self):
        req = CreateEntityRequest(name="Alice", addresses=["123 Main St"])
        entity = self.orch._create_entity_from_request(req)
        assert len(entity.addresses) == 1

    def test_creates_entity_with_usernames(self):
        req = CreateEntityRequest(name="Alice", usernames=["alice99"])
        entity = self.orch._create_entity_from_request(req)
        assert len(entity.usernames) == 1
        assert entity.usernames[0].value == "alice99"

    def test_creates_entity_with_keywords(self):
        req = CreateEntityRequest(name="Alice", keywords=["python", "osint"])
        entity = self.orch._create_entity_from_request(req)
        assert "python" in entity.keywords

    def test_creates_entity_with_occupation(self):
        req = CreateEntityRequest(name="Alice", occupation="Engineer")
        entity = self.orch._create_entity_from_request(req)
        assert len(entity.occupations) == 1
        assert entity.occupations[0].value == "Engineer"

    def test_creates_entity_with_notes(self):
        req = CreateEntityRequest(name="Alice", notes="Suspect in case #42")
        entity = self.orch._create_entity_from_request(req)
        assert len(entity.notes) == 1
        assert "Suspect" in entity.notes[0]["content"]

    def test_completeness_calculated(self):
        req = CreateEntityRequest(name="Alice")
        entity = self.orch._create_entity_from_request(req)
        assert isinstance(entity.completeness_score, (int, float))

    def test_investigation_id_set_on_entity(self):
        req = CreateEntityRequest(name="Alice", investigation_id="inv-001")
        entity = self.orch._create_entity_from_request(req)
        assert entity.investigation_id == "inv-001"


# ---------------------------------------------------------------------------
# DeepCrawlOrchestrator._build_summary tests
# ---------------------------------------------------------------------------


class TestBuildSummary:
    def setup_method(self):
        self.orch = _make_orchestrator_patched()

    def test_summary_contains_expected_keys(self):
        entity = _make_entity()
        result = DeepCrawlResult(
            entity=entity,
            stage=DeepCrawlStage.COMPLETED,
            total_iterations=2,
            total_urls_crawled=10,
            total_data_points_added=5,
            total_images_added=1,
            total_duplicates_skipped=3,
        )
        result.completed_at = datetime.now(UTC)
        summary = self.orch._build_summary(result)
        assert "crawl_id" in summary
        assert "entity_id" in summary
        assert "total_iterations" in summary
        assert "total_urls_crawled" in summary
        assert "total_data_points_added" in summary
        assert "duration_seconds" in summary

    def test_summary_duration_is_positive(self):
        entity = _make_entity()
        result = DeepCrawlResult(entity=entity, stage=DeepCrawlStage.COMPLETED)
        result.completed_at = datetime.now(UTC)
        summary = self.orch._build_summary(result)
        assert summary["duration_seconds"] >= 0


# ---------------------------------------------------------------------------
# DeepCrawlOrchestrator._emit tests
# ---------------------------------------------------------------------------


class TestEmit:
    @pytest.mark.asyncio
    async def test_emit_calls_progress_callback(self):
        callback = AsyncMock()
        orch = _make_orchestrator_patched(on_progress=callback)
        await orch._emit("crawl-123", DeepCrawlStage.CRAWLING, {"iteration": 1})
        callback.assert_called_once_with("crawl-123", DeepCrawlStage.CRAWLING, {"iteration": 1})

    @pytest.mark.asyncio
    async def test_emit_no_callback_does_not_crash(self):
        orch = _make_orchestrator_patched()
        await orch._emit("crawl-123", DeepCrawlStage.CRAWLING, {})

    @pytest.mark.asyncio
    async def test_emit_swallows_callback_exception(self):
        callback = AsyncMock(side_effect=RuntimeError("callback error"))
        orch = _make_orchestrator_patched(on_progress=callback)
        # Should not raise
        await orch._emit("crawl-123", DeepCrawlStage.CRAWLING, {})


# ---------------------------------------------------------------------------
# DeepCrawlOrchestrator._enrich_entity tests
# ---------------------------------------------------------------------------


class TestEnrichEntity:
    def setup_method(self):
        self.orch = _make_orchestrator_patched()

    def test_new_email_added_to_entity(self):
        entity = _make_entity()
        extracted = [
            ExtractedData(
                source_url="https://example.com",
                source_type="web",
                emails=["new@example.com"],
            )
        ]
        stats = self.orch._enrich_entity(entity, extracted)
        assert stats["new"] >= 1
        emails = [e.value for e in entity.emails]
        assert "new@example.com" in emails

    def test_duplicate_email_counted_as_duplicate(self):
        entity = _make_entity()
        entity.add_email("existing@example.com", DataSource.USER_INPUT)
        extracted = [
            ExtractedData(
                source_url="https://example.com",
                source_type="web",
                emails=["existing@example.com"],
            )
        ]
        stats = self.orch._enrich_entity(entity, extracted)
        assert stats["duplicates"] >= 1

    def test_new_phone_added_to_entity(self):
        entity = _make_entity()
        extracted = [
            ExtractedData(
                source_url="https://example.com",
                source_type="web",
                phones=["555-999-8888"],
            )
        ]
        stats = self.orch._enrich_entity(entity, extracted)
        assert stats["new"] >= 1
        phones = [p.value for p in entity.phones]
        assert "555-999-8888" in phones

    def test_duplicate_phone_counted_as_duplicate(self):
        entity = _make_entity()
        entity.add_phone("555-111-2222", DataSource.USER_INPUT)
        extracted = [
            ExtractedData(
                source_url="https://example.com",
                source_type="web",
                phones=["555-111-2222"],
            )
        ]
        stats = self.orch._enrich_entity(entity, extracted)
        assert stats["duplicates"] >= 1

    def test_image_urls_added_to_entity(self):
        entity = _make_entity()
        extracted = [
            ExtractedData(
                source_url="https://example.com",
                source_type="web",
                image_urls=["https://example.com/photo.jpg"],
            )
        ]
        stats = self.orch._enrich_entity(entity, extracted)
        assert stats["images"] >= 1

    def test_keywords_added_to_entity(self):
        entity = _make_entity()
        extracted = [
            ExtractedData(
                source_url="https://example.com",
                source_type="web",
                keywords=["hacker", "security"],
            )
        ]
        self.orch._enrich_entity(entity, extracted)
        assert "hacker" in entity.keywords or "security" in entity.keywords

    def test_empty_extracted_data_returns_zero_stats(self):
        entity = _make_entity()
        stats = self.orch._enrich_entity(entity, [])
        assert stats["new"] == 0
        assert stats["duplicates"] == 0
        assert stats["images"] == 0


# ---------------------------------------------------------------------------
# DeepCrawlOrchestrator._extract_from_results tests
# ---------------------------------------------------------------------------


class TestExtractFromResults:
    def setup_method(self):
        self.orch = _make_orchestrator_patched()

    @pytest.mark.asyncio
    async def test_skips_failed_results(self):
        results = [{"success": False, "markdown": None, "query": "test"}]
        extracted = await self.orch._extract_from_results(results)
        assert extracted == []

    @pytest.mark.asyncio
    async def test_extracts_emails_from_markdown(self):
        results = [
            {
                "success": True,
                "markdown": "Contact us at john@example.com for more info",
                "query": "https://example.com",
            }
        ]
        extracted = await self.orch._extract_from_results(results)
        assert len(extracted) == 1
        assert "john@example.com" in extracted[0].emails

    @pytest.mark.asyncio
    async def test_extracts_phones_from_markdown(self):
        results = [
            {
                "success": True,
                "markdown": "Call us at 555-123-4567 today",
                "query": "https://example.com",
            }
        ]
        extracted = await self.orch._extract_from_results(results)
        assert len(extracted) == 1
        assert len(extracted[0].phones) >= 1

    @pytest.mark.asyncio
    async def test_extracts_urls_from_markdown(self):
        results = [
            {
                "success": True,
                "markdown": "Visit https://profile.example.com for details",
                "query": "https://example.com",
            }
        ]
        extracted = await self.orch._extract_from_results(results)
        assert len(extracted) == 1
        assert any("profile.example.com" in u for u in extracted[0].urls)

    @pytest.mark.asyncio
    async def test_extracts_image_urls_from_markdown(self):
        results = [
            {
                "success": True,
                "markdown": "See photo at https://cdn.example.com/photo.jpg",
                "query": "https://example.com",
            }
        ]
        extracted = await self.orch._extract_from_results(results)
        assert len(extracted) == 1
        assert any("photo.jpg" in u for u in extracted[0].image_urls)

    @pytest.mark.asyncio
    async def test_raw_text_truncated_to_5000(self):
        long_text = "x" * 10000
        results = [
            {
                "success": True,
                "markdown": long_text,
                "query": "https://example.com",
            }
        ]
        extracted = await self.orch._extract_from_results(results)
        assert len(extracted[0].raw_text) <= 5000


# ---------------------------------------------------------------------------
# DeepCrawlOrchestrator._load_or_create_entity tests
# ---------------------------------------------------------------------------


class TestLoadOrCreateEntity:
    @pytest.mark.asyncio
    async def test_creates_from_request_when_create_entity_provided(self):
        orch = _make_orchestrator_patched()
        req = DeepCrawlRequest(
            entity_id="some-id",
            create_entity=CreateEntityRequest(name="Bob Jones"),
        )
        entity = await orch._load_or_create_entity(req)
        assert entity.primary_name.value == "Bob Jones"

    @pytest.mark.asyncio
    async def test_raises_when_no_create_entity_and_no_store(self):
        orch = _make_orchestrator_patched()
        req = DeepCrawlRequest(entity_id="nonexistent-id")
        with pytest.raises(ValueError, match="not found"):
            await orch._load_or_create_entity(req)


# ---------------------------------------------------------------------------
# DeepCrawlOrchestrator.run_deep_crawl integration tests
# ---------------------------------------------------------------------------


class TestRunDeepCrawl:
    def _make_orchestrator(self, on_progress=None):
        return _make_orchestrator_patched(on_progress=on_progress)

    def _patch_orch(self, orch):
        crawl_patch = patch.object(
            orch.crawl_router,
            "crawl_vectors",
            new_callable=AsyncMock,
            return_value=[],
        )
        extract_patch = patch.object(
            orch.enrichment_pipeline,
            "extract_pii",
            new_callable=AsyncMock,
            return_value=[],
        )
        enrich_patch = patch.object(
            orch.enrichment_pipeline,
            "enrich_entity",
            new_callable=AsyncMock,
            return_value=EnrichmentResult(entity_id="test", new_data_points=0),
        )
        return crawl_patch, extract_patch, enrich_patch

    @pytest.mark.asyncio
    async def test_run_returns_deep_crawl_result(self):
        orch = self._make_orchestrator()
        crawl_p, extract_p, enrich_p = self._patch_orch(orch)
        req = DeepCrawlRequest(
            create_entity=CreateEntityRequest(name="Alice"),
            max_iterations=1,
        )
        with crawl_p, extract_p, enrich_p:
            result = await orch.run_deep_crawl(req)
        assert isinstance(result, DeepCrawlResult)

    @pytest.mark.asyncio
    async def test_run_stage_completed_on_success(self):
        orch = self._make_orchestrator()
        crawl_p, extract_p, enrich_p = self._patch_orch(orch)
        req = DeepCrawlRequest(
            create_entity=CreateEntityRequest(name="Alice"),
            max_iterations=1,
        )
        with crawl_p, extract_p, enrich_p:
            result = await orch.run_deep_crawl(req)
        assert result.stage == DeepCrawlStage.COMPLETED

    @pytest.mark.asyncio
    async def test_run_entity_set_in_result(self):
        orch = self._make_orchestrator()
        crawl_p, extract_p, enrich_p = self._patch_orch(orch)
        req = DeepCrawlRequest(
            create_entity=CreateEntityRequest(name="Alice"),
            max_iterations=1,
        )
        with crawl_p, extract_p, enrich_p:
            result = await orch.run_deep_crawl(req)
        assert result.entity is not None
        assert result.entity.primary_name.value == "Alice"

    @pytest.mark.asyncio
    async def test_run_raises_when_no_entity_info(self):
        orch = self._make_orchestrator()
        req = DeepCrawlRequest()  # no entity_id, no create_entity
        result = await orch.run_deep_crawl(req)
        assert result.stage == DeepCrawlStage.FAILED
        assert result.error is not None

    @pytest.mark.asyncio
    async def test_run_investigation_id_set_on_entity(self):
        orch = self._make_orchestrator()
        crawl_p, extract_p, enrich_p = self._patch_orch(orch)
        req = DeepCrawlRequest(
            create_entity=CreateEntityRequest(name="Alice"),
            investigation_id="inv-999",
            max_iterations=1,
        )
        with crawl_p, extract_p, enrich_p:
            result = await orch.run_deep_crawl(req)
        assert result.entity.investigation_id == "inv-999"

    @pytest.mark.asyncio
    async def test_run_completed_at_set(self):
        orch = self._make_orchestrator()
        crawl_p, extract_p, enrich_p = self._patch_orch(orch)
        req = DeepCrawlRequest(
            create_entity=CreateEntityRequest(name="Alice"),
            max_iterations=1,
        )
        with crawl_p, extract_p, enrich_p:
            result = await orch.run_deep_crawl(req)
        assert result.completed_at is not None

    @pytest.mark.asyncio
    async def test_run_summary_populated(self):
        orch = self._make_orchestrator()
        crawl_p, extract_p, enrich_p = self._patch_orch(orch)
        req = DeepCrawlRequest(
            create_entity=CreateEntityRequest(name="Alice"),
            max_iterations=1,
        )
        with crawl_p, extract_p, enrich_p:
            result = await orch.run_deep_crawl(req)
        assert isinstance(result.summary, dict)
        assert "crawl_id" in result.summary

    @pytest.mark.asyncio
    async def test_run_stops_on_no_vectors(self):
        orch = self._make_orchestrator()
        with patch.object(
            orch.vector_generator, "generate_vectors", new_callable=AsyncMock, return_value=[]
        ):
            req = DeepCrawlRequest(
                create_entity=CreateEntityRequest(name="Alice"),
                max_iterations=3,
            )
            result = await orch.run_deep_crawl(req)
        assert result.stopped_reason == "no_vectors"

    @pytest.mark.asyncio
    async def test_run_stops_on_diminishing_returns(self):
        orch = self._make_orchestrator()
        crawl_p = patch.object(
            orch.crawl_router,
            "crawl_vectors",
            new_callable=AsyncMock,
            return_value=[{"success": True, "markdown": "text", "query": "q"}],
        )
        extract_p = patch.object(
            orch.enrichment_pipeline,
            "extract_pii",
            new_callable=AsyncMock,
            return_value=[],
        )
        enrich_p = patch.object(
            orch.enrichment_pipeline,
            "enrich_entity",
            new_callable=AsyncMock,
            return_value=EnrichmentResult(entity_id="test", new_data_points=0),
        )
        req = DeepCrawlRequest(
            create_entity=CreateEntityRequest(name="Alice"),
            max_iterations=5,
            min_new_data_threshold=0.5,
        )
        with crawl_p, extract_p, enrich_p:
            result = await orch.run_deep_crawl(req)
        assert result.stopped_reason == "diminishing_returns"

    @pytest.mark.asyncio
    async def test_run_with_progress_callback(self):
        progress_events = []

        async def capture_progress(crawl_id, stage, data):
            progress_events.append(stage)

        orch = self._make_orchestrator(on_progress=capture_progress)
        crawl_p, extract_p, enrich_p = self._patch_orch(orch)
        req = DeepCrawlRequest(
            create_entity=CreateEntityRequest(name="Alice"),
            max_iterations=1,
        )
        with crawl_p, extract_p, enrich_p:
            await orch.run_deep_crawl(req)
        assert DeepCrawlStage.INITIALIZING in progress_events
        assert DeepCrawlStage.COMPLETED in progress_events

    @pytest.mark.asyncio
    async def test_run_total_urls_crawled_tracked(self):
        orch = self._make_orchestrator()
        crawl_p = patch.object(
            orch.crawl_router,
            "crawl_vectors",
            new_callable=AsyncMock,
            return_value=[{"success": True}, {"success": True}, {"success": True}],
        )
        extract_p = patch.object(
            orch.enrichment_pipeline,
            "extract_pii",
            new_callable=AsyncMock,
            return_value=[],
        )
        enrich_p = patch.object(
            orch.enrichment_pipeline,
            "enrich_entity",
            new_callable=AsyncMock,
            return_value=EnrichmentResult(entity_id="test", new_data_points=5),
        )
        req = DeepCrawlRequest(
            create_entity=CreateEntityRequest(name="Alice"),
            max_iterations=1,
        )
        with crawl_p, extract_p, enrich_p:
            result = await orch.run_deep_crawl(req)
        assert result.total_urls_crawled == 3

    @pytest.mark.asyncio
    async def test_run_data_points_tracked(self):
        orch = self._make_orchestrator()
        crawl_p = patch.object(
            orch.crawl_router,
            "crawl_vectors",
            new_callable=AsyncMock,
            return_value=[{"success": True}],
        )
        extract_p = patch.object(
            orch.enrichment_pipeline,
            "extract_pii",
            new_callable=AsyncMock,
            return_value=[],
        )
        enrich_p = patch.object(
            orch.enrichment_pipeline,
            "enrich_entity",
            new_callable=AsyncMock,
            return_value=EnrichmentResult(entity_id="test", new_data_points=7, new_images=2),
        )
        req = DeepCrawlRequest(
            create_entity=CreateEntityRequest(name="Alice"),
            max_iterations=1,
        )
        with crawl_p, extract_p, enrich_p:
            result = await orch.run_deep_crawl(req)
        assert result.total_data_points_added == 7
        assert result.total_images_added == 2

    @pytest.mark.asyncio
    async def test_run_failed_stage_on_exception(self):
        orch = self._make_orchestrator()
        with patch.object(
            orch.vector_generator,
            "generate_vectors",
            new_callable=AsyncMock,
            side_effect=RuntimeError("boom"),
        ):
            req = DeepCrawlRequest(
                create_entity=CreateEntityRequest(name="Alice"),
                max_iterations=1,
            )
            result = await orch.run_deep_crawl(req)
        assert result.stage == DeepCrawlStage.FAILED
        assert "boom" in result.error

    @pytest.mark.asyncio
    async def test_run_iterations_appended(self):
        orch = self._make_orchestrator()
        crawl_p = patch.object(
            orch.crawl_router,
            "crawl_vectors",
            new_callable=AsyncMock,
            return_value=[{"success": True}],
        )
        extract_p = patch.object(
            orch.enrichment_pipeline,
            "extract_pii",
            new_callable=AsyncMock,
            return_value=[],
        )
        enrich_p = patch.object(
            orch.enrichment_pipeline,
            "enrich_entity",
            new_callable=AsyncMock,
            return_value=EnrichmentResult(entity_id="test", new_data_points=100),
        )
        req = DeepCrawlRequest(
            create_entity=CreateEntityRequest(name="Alice"),
            max_iterations=2,
        )
        with crawl_p, extract_p, enrich_p:
            result = await orch.run_deep_crawl(req)
        assert len(result.iterations) == 2
