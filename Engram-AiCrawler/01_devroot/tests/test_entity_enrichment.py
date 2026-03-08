"""Tests for app/pipelines/entity_enrichment.py — PII extraction and entity enrichment."""
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.models.entity import DataSource, EntityProfile
from app.pipelines.entity_enrichment import (
    EntityEnrichmentPipeline,
    EnrichmentResult,
    ExtractedPII,
    _calculate_confidence,
    _classify_source,
    _classify_source_type,
    _extract_social_profiles,
    _merge_social_profiles,
    _normalize_phone,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def pipeline_no_llm():
    return EntityEnrichmentPipeline(lm_bridge=None, use_llm=False)


@pytest.fixture
def mock_lm_bridge():
    bridge = MagicMock()
    bridge.chat_completion = AsyncMock(return_value={"content": "{}"})
    return bridge


@pytest.fixture
def pipeline_with_llm(mock_lm_bridge):
    return EntityEnrichmentPipeline(lm_bridge=mock_lm_bridge, use_llm=True)


@pytest.fixture
def basic_entity():
    return EntityProfile()


# ---------------------------------------------------------------------------
# _normalize_phone
# ---------------------------------------------------------------------------


class TestNormalizePhone:
    def test_strips_formatting(self):
        assert _normalize_phone("+1 (555) 123-4567") == "15551234567"

    def test_plain_digits(self):
        assert _normalize_phone("5551234567") == "5551234567"

    def test_empty(self):
        assert _normalize_phone("") == ""


# ---------------------------------------------------------------------------
# _classify_source
# ---------------------------------------------------------------------------


class TestClassifySource:
    def test_people_search_domain(self):
        result = _classify_source("https://whitepages.com/person/john-doe")
        assert result == DataSource.PEOPLE_SEARCH

    def test_public_records_domain(self):
        result = _classify_source("https://courtlistener.com/case/123")
        assert result == DataSource.PUBLIC_RECORDS

    def test_social_media(self):
        result = _classify_source("https://twitter.com/johndoe")
        assert result == DataSource.SOCIAL_MEDIA

    def test_generic_web(self):
        result = _classify_source("https://somewebsite.com/about")
        assert result == DataSource.WEB_CRAWL

    def test_spokeo_is_people_search(self):
        result = _classify_source("https://spokeo.com/search/john-doe")
        assert result == DataSource.PEOPLE_SEARCH


# ---------------------------------------------------------------------------
# _classify_source_type
# ---------------------------------------------------------------------------


class TestClassifySourceType:
    def test_returns_string(self):
        result = _classify_source_type("https://example.com")
        assert isinstance(result, str)

    def test_people_search_type(self):
        result = _classify_source_type("https://whitepages.com/x")
        assert result == "people_search"

    def test_web_type(self):
        result = _classify_source_type("https://news.ycombinator.com")
        assert result == "web"


# ---------------------------------------------------------------------------
# _extract_social_profiles
# ---------------------------------------------------------------------------


class TestExtractSocialProfiles:
    def test_extracts_twitter(self):
        text = "Follow me at https://twitter.com/johndoe for updates."
        profiles = _extract_social_profiles(text)
        assert any(p["platform"] == "twitter" and p["username"] == "johndoe" for p in profiles)

    def test_extracts_github(self):
        text = "My code: https://github.com/alice"
        profiles = _extract_social_profiles(text)
        assert any(p["platform"] == "github" and p["username"] == "alice" for p in profiles)

    def test_extracts_linkedin(self):
        text = "Connect: https://linkedin.com/in/jane-doe"
        profiles = _extract_social_profiles(text)
        assert any(p["platform"] == "linkedin" for p in profiles)

    def test_skips_nav_pages(self):
        text = "https://twitter.com/home https://twitter.com/login"
        profiles = _extract_social_profiles(text)
        usernames = [p["username"] for p in profiles]
        assert "home" not in usernames
        assert "login" not in usernames

    def test_deduplicates(self):
        text = "https://github.com/alice https://github.com/alice"
        profiles = _extract_social_profiles(text)
        alice_profiles = [p for p in profiles if p["username"] == "alice"]
        assert len(alice_profiles) == 1

    def test_empty_text_returns_empty(self):
        assert _extract_social_profiles("") == []

    def test_no_social_links_returns_empty(self):
        assert _extract_social_profiles("Just some regular text.") == []


# ---------------------------------------------------------------------------
# _merge_social_profiles
# ---------------------------------------------------------------------------


class TestMergeSocialProfiles:
    def test_merges_without_duplicates(self):
        regex = [{"platform": "twitter", "username": "alice", "url": "https://x.com/alice"}]
        llm = [{"platform": "github", "username": "alice", "url": "https://github.com/alice"}]
        merged = _merge_social_profiles(regex, llm)
        assert len(merged) == 2

    def test_deduplicates_same_platform_username(self):
        regex = [{"platform": "twitter", "username": "bob", "url": "https://x.com/bob"}]
        llm = [{"platform": "twitter", "username": "bob", "url": "https://twitter.com/bob"}]
        merged = _merge_social_profiles(regex, llm)
        assert len(merged) == 1

    def test_regex_profiles_take_precedence(self):
        regex = [{"platform": "twitter", "username": "bob", "url": "regex-url"}]
        llm = [{"platform": "twitter", "username": "bob", "url": "llm-url"}]
        merged = _merge_social_profiles(regex, llm)
        assert merged[0]["url"] == "regex-url"


# ---------------------------------------------------------------------------
# _calculate_confidence
# ---------------------------------------------------------------------------


class TestCalculateConfidence:
    def test_base_confidence(self):
        pii = ExtractedPII(source_url="https://example.com")
        score = _calculate_confidence(pii)
        assert score == pytest.approx(0.3)

    def test_email_increases_confidence(self):
        pii = ExtractedPII(source_url="https://example.com", emails=["test@example.com"])
        score = _calculate_confidence(pii)
        assert score > 0.3

    def test_combined_extraction_bonus(self):
        pii = ExtractedPII(
            source_url="https://example.com",
            emails=["test@example.com"],
            phones=["555-1234"],
            extraction_method="combined",
        )
        score = _calculate_confidence(pii)
        assert score > 0.5

    def test_max_confidence_is_1(self):
        pii = ExtractedPII(
            source_url="https://example.com",
            emails=["a@b.com"],
            phones=["555-1234"],
            names=["John Doe"],
            addresses=["123 Main St"],
            social_profiles=[{"platform": "twitter"}],
            extraction_method="combined",
        )
        score = _calculate_confidence(pii)
        assert score <= 1.0


# ---------------------------------------------------------------------------
# EntityEnrichmentPipeline.extract_pii
# ---------------------------------------------------------------------------


class TestExtractPii:
    @pytest.mark.asyncio
    async def test_skips_failed_results(self, pipeline_no_llm):
        results = [{"success": False, "query": "https://example.com", "markdown": "text"}]
        extracted = await pipeline_no_llm.extract_pii(results)
        assert len(extracted) == 0

    @pytest.mark.asyncio
    async def test_skips_empty_markdown(self, pipeline_no_llm):
        results = [{"success": True, "query": "https://example.com", "markdown": ""}]
        extracted = await pipeline_no_llm.extract_pii(results)
        assert len(extracted) == 0

    @pytest.mark.asyncio
    async def test_extracts_from_successful_results(self, pipeline_no_llm):
        results = [
            {"success": True, "query": "https://example.com", "markdown": "Some text content"}
        ]
        extracted = await pipeline_no_llm.extract_pii(results)
        assert len(extracted) == 1
        assert isinstance(extracted[0], ExtractedPII)

    @pytest.mark.asyncio
    async def test_extracts_emails(self, pipeline_no_llm):
        results = [
            {
                "success": True,
                "query": "https://example.com",
                "markdown": "Contact us: test@example.com and admin@test.org",
            }
        ]
        extracted = await pipeline_no_llm.extract_pii(results)
        assert len(extracted) == 1
        emails = extracted[0].emails
        assert "test@example.com" in emails
        assert "admin@test.org" in emails

    @pytest.mark.asyncio
    async def test_extracts_phone_numbers(self, pipeline_no_llm):
        results = [
            {
                "success": True,
                "query": "https://example.com",
                "markdown": "Call us at (555) 123-4567 or 555.987.6543",
            }
        ]
        extracted = await pipeline_no_llm.extract_pii(results)
        phones = extracted[0].phones
        assert len(phones) >= 1

    @pytest.mark.asyncio
    async def test_extracts_image_urls(self, pipeline_no_llm):
        results = [
            {
                "success": True,
                "query": "https://example.com",
                "markdown": "Profile pic: https://cdn.example.com/photo.jpg",
            }
        ]
        extracted = await pipeline_no_llm.extract_pii(results)
        imgs = extracted[0].image_urls
        assert any("photo.jpg" in u for u in imgs)

    @pytest.mark.asyncio
    async def test_multiple_results(self, pipeline_no_llm):
        results = [
            {"success": True, "query": "https://a.com", "markdown": "Content A"},
            {"success": True, "query": "https://b.com", "markdown": "Content B"},
            {"success": False, "query": "https://c.com", "markdown": "Content C"},
        ]
        extracted = await pipeline_no_llm.extract_pii(results)
        assert len(extracted) == 2

    @pytest.mark.asyncio
    async def test_raw_text_stored(self, pipeline_no_llm):
        long_text = "A" * 3000
        results = [{"success": True, "query": "https://example.com", "markdown": long_text}]
        extracted = await pipeline_no_llm.extract_pii(results)
        # raw_text should be truncated at 2000
        assert len(extracted[0].raw_text) == 2000


# ---------------------------------------------------------------------------
# EntityEnrichmentPipeline._llm_extract
# ---------------------------------------------------------------------------


class TestLlmExtract:
    @pytest.mark.asyncio
    async def test_no_bridge_returns_none(self, pipeline_no_llm):
        result = await pipeline_no_llm._llm_extract("some text")
        assert result is None

    @pytest.mark.asyncio
    async def test_valid_json_response(self, pipeline_with_llm, mock_lm_bridge):
        mock_lm_bridge.chat_completion.return_value = {
            "content": '{"names": ["John Doe"], "emails": ["john@example.com"]}'
        }
        result = await pipeline_with_llm._llm_extract("John Doe email: john@example.com")
        assert result is not None
        assert "names" in result
        assert result["names"] == ["John Doe"]

    @pytest.mark.asyncio
    async def test_json_with_code_fences(self, pipeline_with_llm, mock_lm_bridge):
        mock_lm_bridge.chat_completion.return_value = {
            "content": '```json\n{"names": ["Alice"]}\n```'
        }
        result = await pipeline_with_llm._llm_extract("Alice is here")
        assert result is not None
        assert result["names"] == ["Alice"]

    @pytest.mark.asyncio
    async def test_invalid_json_returns_none(self, pipeline_with_llm, mock_lm_bridge):
        mock_lm_bridge.chat_completion.return_value = {"content": "not valid json {{{{"}
        result = await pipeline_with_llm._llm_extract("some text")
        assert result is None

    @pytest.mark.asyncio
    async def test_exception_returns_none(self, pipeline_with_llm, mock_lm_bridge):
        mock_lm_bridge.chat_completion.side_effect = Exception("LLM failed")
        result = await pipeline_with_llm._llm_extract("some text")
        assert result is None


# ---------------------------------------------------------------------------
# EntityEnrichmentPipeline.enrich_entity
# ---------------------------------------------------------------------------


class TestEnrichEntity:
    @pytest.mark.asyncio
    async def test_adds_new_emails(self, pipeline_no_llm, basic_entity):
        pii = ExtractedPII(
            source_url="https://example.com",
            emails=["new@example.com"],
        )
        result = await pipeline_no_llm.enrich_entity(basic_entity, [pii])
        assert isinstance(result, EnrichmentResult)
        assert result.new_data_points >= 1
        assert any(e.value == "new@example.com" for e in basic_entity.emails)

    @pytest.mark.asyncio
    async def test_deduplicates_emails(self, pipeline_no_llm, basic_entity):
        pii1 = ExtractedPII(source_url="https://a.com", emails=["test@example.com"])
        pii2 = ExtractedPII(source_url="https://b.com", emails=["test@example.com"])
        result = await pipeline_no_llm.enrich_entity(basic_entity, [pii1, pii2])
        assert result.new_data_points == 1
        assert result.duplicate_data_points == 1

    @pytest.mark.asyncio
    async def test_adds_phones(self, pipeline_no_llm, basic_entity):
        pii = ExtractedPII(source_url="https://example.com", phones=["555-123-4567"])
        result = await pipeline_no_llm.enrich_entity(basic_entity, [pii])
        assert result.new_data_points >= 1

    @pytest.mark.asyncio
    async def test_adds_images(self, pipeline_no_llm, basic_entity):
        pii = ExtractedPII(
            source_url="https://example.com",
            image_urls=["https://cdn.example.com/photo.jpg"],
        )
        result = await pipeline_no_llm.enrich_entity(basic_entity, [pii])
        assert result.new_images == 1

    @pytest.mark.asyncio
    async def test_adds_social_profiles(self, pipeline_no_llm, basic_entity):
        pii = ExtractedPII(
            source_url="https://example.com",
            social_profiles=[
                {"platform": "twitter", "username": "johndoe", "url": "https://x.com/johndoe"}
            ],
        )
        result = await pipeline_no_llm.enrich_entity(basic_entity, [pii])
        assert result.new_social_profiles == 1

    @pytest.mark.asyncio
    async def test_adds_relationships(self, pipeline_no_llm, basic_entity):
        pii = ExtractedPII(
            source_url="https://example.com",
            relationships=[{"name": "Jane Doe", "relation": "spouse", "confidence": "0.9"}],
        )
        result = await pipeline_no_llm.enrich_entity(basic_entity, [pii])
        assert result.new_relationships == 1

    @pytest.mark.asyncio
    async def test_sources_processed_count(self, pipeline_no_llm, basic_entity):
        pii_list = [
            ExtractedPII(source_url="https://a.com"),
            ExtractedPII(source_url="https://b.com"),
        ]
        result = await pipeline_no_llm.enrich_entity(basic_entity, pii_list)
        assert result.sources_processed == 2

    @pytest.mark.asyncio
    async def test_empty_pii_list(self, pipeline_no_llm, basic_entity):
        result = await pipeline_no_llm.enrich_entity(basic_entity, [])
        assert result.new_data_points == 0
        assert result.sources_processed == 0

    @pytest.mark.asyncio
    async def test_adds_keywords(self, pipeline_no_llm, basic_entity):
        pii = ExtractedPII(source_url="https://example.com", keywords=["OSINT", "security"])
        await pipeline_no_llm.enrich_entity(basic_entity, [pii])
        assert "OSINT" in basic_entity.keywords or "security" in basic_entity.keywords


# ---------------------------------------------------------------------------
# EntityEnrichmentPipeline with LLM enabled
# ---------------------------------------------------------------------------


class TestExtractPiiWithLlm:
    @pytest.mark.asyncio
    async def test_llm_called_for_long_text(self, pipeline_with_llm, mock_lm_bridge):
        long_text = "John Doe works at Acme Corp. " * 20  # > 200 chars
        results = [{"success": True, "query": "https://example.com", "markdown": long_text}]
        mock_lm_bridge.chat_completion.return_value = {
            "content": '{"names": ["John Doe"], "organizations": ["Acme Corp"]}'
        }
        extracted = await pipeline_with_llm.extract_pii(results)
        assert len(extracted) == 1
        assert extracted[0].names == ["John Doe"]

    @pytest.mark.asyncio
    async def test_llm_not_called_for_short_text(self, pipeline_with_llm, mock_lm_bridge):
        results = [{"success": True, "query": "https://example.com", "markdown": "Short text"}]
        extracted = await pipeline_with_llm.extract_pii(results)
        mock_lm_bridge.chat_completion.assert_not_called()

    @pytest.mark.asyncio
    async def test_extraction_method_combined_when_llm_succeeds(
        self, pipeline_with_llm, mock_lm_bridge
    ):
        long_text = "John Doe works at Acme Corp. " * 20
        mock_lm_bridge.chat_completion.return_value = {"content": '{"names": ["John Doe"]}'}
        results = [{"success": True, "query": "https://example.com", "markdown": long_text}]
        extracted = await pipeline_with_llm.extract_pii(results)
        assert extracted[0].extraction_method == "combined"


# ---------------------------------------------------------------------------
# EntityEnrichmentPipeline initialization
# ---------------------------------------------------------------------------


class TestPipelineInit:
    def test_no_llm_when_bridge_is_none(self):
        pipeline = EntityEnrichmentPipeline(lm_bridge=None)
        assert pipeline.use_llm is False

    def test_llm_disabled_when_use_llm_false(self, mock_lm_bridge):
        pipeline = EntityEnrichmentPipeline(lm_bridge=mock_lm_bridge, use_llm=False)
        assert pipeline.use_llm is False

    def test_llm_enabled_with_bridge(self, mock_lm_bridge):
        pipeline = EntityEnrichmentPipeline(lm_bridge=mock_lm_bridge, use_llm=True)
        assert pipeline.use_llm is True
