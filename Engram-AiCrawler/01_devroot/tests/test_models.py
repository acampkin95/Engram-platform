"""Tests for crawl models - CrawlRequest, CrawlResponse, BatchCrawlRequest, DeepCrawlRequest."""

import pytest
from pydantic import ValidationError
from app._compat import UTC
from datetime import datetime
from app.models.crawl import (
    CrawlRequest,
    CrawlResponse,
    BatchCrawlRequest,
    DeepCrawlRequest,
    ChatMessage,
    ChatRequest,
    ChatResponse,
    DataSetMetadata,
    MigrateRequest,
    CrawlStatus,
    ExtractionType,
)


class TestCrawlRequest:
    """Tests for CrawlRequest model."""

    def test_create_crawl_request_minimal(self):
        """Test creating a CrawlRequest with minimal fields."""
        request = CrawlRequest(url="https://example.com")
        assert str(request.url) == "https://example.com/"
        assert request.extraction_type == ExtractionType.CSS
        assert request.word_count_threshold == 10
        assert request.screenshot is False
        assert request.pdf is False

    def test_create_crawl_request_full(self):
        """Test creating a CrawlRequest with all fields."""
        request = CrawlRequest(
            url="https://example.com",
            extraction_type=ExtractionType.LLM,
            wait_for=".content",
            screenshot=True,
            pdf=True,
            word_count_threshold=50,
            llm_instruction="Extract product info",
            llm_provider="anthropic/claude-3-sonnet",
            chunk_token_threshold=2048,
            overlap_rate=0.2,
        )
        assert str(request.url) == "https://example.com/"
        assert request.extraction_type == ExtractionType.LLM
        assert request.wait_for == ".content"
        assert request.screenshot is True
        assert request.pdf is True
        assert request.word_count_threshold == 50
        assert request.llm_instruction == "Extract product info"
        assert request.chunk_token_threshold == 2048
        assert request.overlap_rate == 0.2

    def test_crawl_request_url_validation(self):
        """Test that invalid URLs are rejected."""
        with pytest.raises(ValidationError):
            CrawlRequest(url="not-a-valid-url")

    def test_crawl_request_word_count_min(self):
        """Test that word_count_threshold must be >= 0."""
        with pytest.raises(ValidationError):
            CrawlRequest(url="https://example.com", word_count_threshold=-1)

    def test_crawl_request_chunk_token_min(self):
        """Test that chunk_token_threshold must be >= 512."""
        with pytest.raises(ValidationError):
            CrawlRequest(url="https://example.com", chunk_token_threshold=100)

    def test_crawl_request_overlap_range(self):
        """Test that overlap_rate must be between 0.0 and 1.0."""
        with pytest.raises(ValidationError):
            CrawlRequest(url="https://example.com", overlap_rate=1.5)

        with pytest.raises(ValidationError):
            CrawlRequest(url="https://example.com", overlap_rate=-0.1)

    def test_crawl_request_extraction_types(self):
        """Test all extraction types are valid."""
        for extraction_type in ExtractionType:
            request = CrawlRequest(url="https://example.com", extraction_type=extraction_type)
            assert request.extraction_type == extraction_type


class TestCrawlResponse:
    """Tests for CrawlResponse model."""

    def test_create_crawl_response_minimal(self):
        """Test creating a CrawlResponse with minimal fields."""
        now = datetime.now(UTC)
        response = CrawlResponse(
            crawl_id="test-id",
            url="https://example.com",
            status=CrawlStatus.PENDING,
            created_at=now,
        )
        assert response.crawl_id == "test-id"
        assert response.url == "https://example.com"
        assert response.status == CrawlStatus.PENDING
        assert response.created_at == now
        assert response.markdown is None
        assert response.error_message is None

    def test_create_crawl_response_completed(self):
        """Test creating a CrawlResponse for a completed crawl."""
        now = datetime.now(UTC)
        completed_at = datetime.now(UTC)
        response = CrawlResponse(
            crawl_id="test-id",
            url="https://example.com",
            status=CrawlStatus.COMPLETED,
            created_at=now,
            completed_at=completed_at,
            markdown="# Test Content",
            html="<h1>Test</h1>",
            links=["https://example.com/page1"],
            media={"images": ["img1.jpg"]},
        )
        assert response.status == CrawlStatus.COMPLETED
        assert response.markdown == "# Test Content"
        assert response.html == "<h1>Test</h1>"
        assert response.links == ["https://example.com/page1"]
        assert response.media == {"images": ["img1.jpg"]}

    def test_create_crawl_response_failed(self):
        """Test creating a CrawlResponse for a failed crawl."""
        now = datetime.now(UTC)
        response = CrawlResponse(
            crawl_id="test-id",
            url="https://example.com",
            status=CrawlStatus.FAILED,
            created_at=now,
            error_message="Connection timeout",
        )
        assert response.status == CrawlStatus.FAILED
        assert response.error_message == "Connection timeout"

    def test_crawl_status_values(self):
        """Test all crawl status values."""
        for status in CrawlStatus:
            response = CrawlResponse(
                crawl_id="test-id",
                url="https://example.com",
                status=status,
                created_at=datetime.now(UTC),
            )
            assert response.status == status


class TestBatchCrawlRequest:
    """Tests for BatchCrawlRequest model."""

    def test_create_batch_crawl_request_minimal(self):
        """Test creating a BatchCrawlRequest with minimal fields."""
        request = BatchCrawlRequest(urls=["https://example.com", "https://example.org"])
        assert len(request.urls) == 2
        assert request.max_concurrent == 5
        assert request.config is None

    def test_create_batch_crawl_request_with_config(self):
        """Test creating a BatchCrawlRequest with custom config."""
        config = CrawlRequest(
            url="https://example.com",
            extraction_type=ExtractionType.LLM,
        )
        request = BatchCrawlRequest(
            urls=["https://example.com"],
            config=config,
            max_concurrent=10,
        )
        assert request.config.extraction_type == ExtractionType.LLM
        assert request.max_concurrent == 10

    def test_batch_crawl_request_min_urls(self):
        """Test that batch request requires at least 1 URL."""
        with pytest.raises(ValidationError):
            BatchCrawlRequest(urls=[])

    def test_batch_crawl_request_max_urls(self):
        """Test that batch request limits to 50 URLs."""
        with pytest.raises(ValidationError):
            urls = ["https://example.com"] * 51
            BatchCrawlRequest(urls=urls)

    def test_batch_crawl_request_concurrent_limits(self):
        """Test concurrent limits validation."""
        with pytest.raises(ValidationError):
            BatchCrawlRequest(
                urls=["https://example.com"],
                max_concurrent=0,
            )

        with pytest.raises(ValidationError):
            BatchCrawlRequest(
                urls=["https://example.com"],
                max_concurrent=25,
            )


class TestDeepCrawlRequest:
    """Tests for DeepCrawlRequest model."""

    def test_create_deep_crawl_request_minimal(self):
        """Test creating a DeepCrawlRequest with minimal fields."""
        request = DeepCrawlRequest(start_url="https://example.com")
        assert str(request.start_url) == "https://example.com/"
        assert request.max_depth == 3
        assert request.max_pages == 100
        assert request.strategy == "bfs"

    def test_create_deep_crawl_request_full(self):
        """Test creating a DeepCrawlRequest with all fields."""
        request = DeepCrawlRequest(
            start_url="https://example.com",
            max_depth=5,
            max_pages=500,
            strategy="dfs",
            allowed_domains=["example.com"],
            exclude_patterns=["/admin/*"],
            include_patterns=["/blog/*"],
            keyword_focus=["python", "tutorial"],
        )
        assert request.max_depth == 5
        assert request.max_pages == 500
        assert request.strategy == "dfs"
        assert request.allowed_domains == ["example.com"]
        assert request.exclude_patterns == ["/admin/*"]
        assert request.include_patterns == ["/blog/*"]
        assert request.keyword_focus == ["python", "tutorial"]

    def test_deep_crawl_request_depth_limits(self):
        """Test depth limit validation."""
        with pytest.raises(ValidationError):
            DeepCrawlRequest(start_url="https://example.com", max_depth=0)

        with pytest.raises(ValidationError):
            DeepCrawlRequest(start_url="https://example.com", max_depth=11)

    def test_deep_crawl_request_pages_limits(self):
        """Test pages limit validation."""
        with pytest.raises(ValidationError):
            DeepCrawlRequest(start_url="https://example.com", max_pages=0)

        with pytest.raises(ValidationError):
            DeepCrawlRequest(start_url="https://example.com", max_pages=1001)

    def test_deep_crawl_request_strategy_pattern(self):
        """Test strategy pattern validation."""
        for strategy in ["bfs", "dfs", "best_first"]:
            request = DeepCrawlRequest(
                start_url="https://example.com",
                strategy=strategy,
            )
            assert request.strategy == strategy

        with pytest.raises(ValidationError):
            DeepCrawlRequest(start_url="https://example.com", strategy="invalid")


class TestChatModels:
    """Tests for Chat message models."""

    def test_chat_message_user(self):
        """Test creating a user ChatMessage."""
        message = ChatMessage(role="user", content="Hello")
        assert message.role == "user"
        assert message.content == "Hello"

    def test_chat_message_assistant(self):
        """Test creating an assistant ChatMessage."""
        message = ChatMessage(role="assistant", content="Hi there!")
        assert message.role == "assistant"
        assert message.content == "Hi there!"

    def test_chat_message_system(self):
        """Test creating a system ChatMessage."""
        message = ChatMessage(role="system", content="You are a helpful assistant.")
        assert message.role == "system"
        assert message.content == "You are a helpful assistant."

    def test_chat_message_role_pattern(self):
        """Test chat message role pattern validation."""
        with pytest.raises(ValidationError):
            ChatMessage(role="invalid", content="test")

    def test_chat_request_minimal(self):
        """Test creating a ChatRequest with minimal fields."""
        request = ChatRequest(messages=[ChatMessage(role="user", content="Hello")])
        assert len(request.messages) == 1
        assert request.model == "default"
        assert request.temperature == 0.7
        assert request.stream is False

    def test_chat_request_full(self):
        """Test creating a ChatRequest with all fields."""
        request = ChatRequest(
            messages=[
                ChatMessage(role="user", content="Hello"),
                ChatMessage(role="assistant", content="Hi!"),
            ],
            model="gpt-4",
            temperature=0.5,
            max_tokens=1000,
            stream=True,
        )
        assert len(request.messages) == 2
        assert request.model == "gpt-4"
        assert request.temperature == 0.5
        assert request.max_tokens == 1000
        assert request.stream is True

    def test_chat_request_min_messages(self):
        """Test that chat request requires at least 1 message."""
        with pytest.raises(ValidationError):
            ChatRequest(messages=[])

    def test_chat_request_temperature_range(self):
        """Test temperature validation."""
        with pytest.raises(ValidationError):
            ChatRequest(
                messages=[ChatMessage(role="user", content="test")],
                temperature=-0.1,
            )

        with pytest.raises(ValidationError):
            ChatRequest(
                messages=[ChatMessage(role="user", content="test")],
                temperature=2.1,
            )

    def test_chat_request_max_tokens(self):
        """Test max_tokens validation."""
        with pytest.raises(ValidationError):
            ChatRequest(
                messages=[ChatMessage(role="user", content="test")],
                max_tokens=0,
            )

    def test_chat_response(self):
        """Test creating a ChatResponse."""
        now = datetime.now(UTC)
        response = ChatResponse(
            message_id="msg-123",
            role="assistant",
            content="Hello!",
            model="gpt-4",
            finish_reason="stop",
            usage={"prompt_tokens": 10, "completion_tokens": 20},
            created_at=now,
        )
        assert response.message_id == "msg-123"
        assert response.role == "assistant"
        assert response.content == "Hello!"
        assert response.finish_reason == "stop"
        assert response.usage == {"prompt_tokens": 10, "completion_tokens": 20}


class TestDataSetModels:
    """Tests for data set models."""

    def test_data_set_metadata(self):
        """Test creating a DataSetMetadata."""
        now = datetime.now(UTC)
        metadata = DataSetMetadata(
            data_set_id="ds-123",
            name="test-dataset",
            description="A test dataset",
            tier="hot",
            created_at=now,
            updated_at=now,
            size_bytes=1024,
            file_count=5,
            tags=["test", "sample"],
        )
        assert metadata.data_set_id == "ds-123"
        assert metadata.name == "test-dataset"
        assert metadata.tier == "hot"
        assert metadata.size_bytes == 1024
        assert metadata.tags == ["test", "sample"]

    def test_data_set_metadata_tier_pattern(self):
        """Test data set tier pattern validation."""
        for tier in ["hot", "warm", "cold", "archive"]:
            metadata = DataSetMetadata(
                data_set_id="ds-123",
                name="test",
                tier=tier,
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
            )
            assert metadata.tier == tier

        with pytest.raises(ValidationError):
            DataSetMetadata(
                data_set_id="ds-123",
                name="test",
                tier="invalid",
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
            )

    def test_migrate_request(self):
        """Test creating a MigrateRequest."""
        request = MigrateRequest(target_tier="warm")
        assert request.target_tier == "warm"

    def test_migrate_request_tier_pattern(self):
        """Test migrate request tier pattern validation."""
        with pytest.raises(ValidationError):
            MigrateRequest(target_tier="invalid")
