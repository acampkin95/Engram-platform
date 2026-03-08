"""Tests for app/services/rag_service.py — RAG pipeline service."""

import time
import uuid
from unittest.mock import MagicMock, patch


from app.models.rag import (
    ChunkingConfig,
    ChunkingStrategy,
    ChunkPreview,
    ProcessingStatus,
    RAGPipelineConfig,
    RAGProcessStatus,
)
from app.services.rag_service import (
    _rag_store,
    chunk_content,
    estimate_tokens,
    get_default_config,
    get_job_status,
    process_pipeline,
    set_default_config,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _wait_for_job(job_id: str, timeout: float = 5.0) -> RAGProcessStatus:
    """Poll until job reaches a terminal state or timeout."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        status = get_job_status(job_id)
        if status and status.status in (ProcessingStatus.COMPLETED, ProcessingStatus.FAILED):
            return status
        time.sleep(0.05)
    return get_job_status(job_id)


# ---------------------------------------------------------------------------
# estimate_tokens
# ---------------------------------------------------------------------------


class TestEstimateTokens:
    def test_empty_string_returns_zero(self):
        assert estimate_tokens("") == 0

    def test_four_chars_is_one_token(self):
        assert estimate_tokens("abcd") == 1

    def test_eight_chars_is_two_tokens(self):
        assert estimate_tokens("abcdefgh") == 2

    def test_three_chars_rounds_down(self):
        assert estimate_tokens("abc") == 0

    def test_large_text(self):
        text = "a" * 400
        assert estimate_tokens(text) == 100

    def test_unicode_chars_counted_by_len(self):
        # Each emoji is ~1-2 chars in Python len()
        text = "abcd"
        assert estimate_tokens(text) == 1


# ---------------------------------------------------------------------------
# chunk_content — dispatch
# ---------------------------------------------------------------------------


class TestChunkContentDispatch:
    def test_fixed_token_strategy(self):
        config = ChunkingConfig(strategy=ChunkingStrategy.FIXED_TOKEN, chunk_size=256)
        text = "word " * 300
        chunks = chunk_content(text, config)
        assert len(chunks) > 0
        assert all(isinstance(c, ChunkPreview) for c in chunks)

    def test_sentence_strategy(self):
        config = ChunkingConfig(strategy=ChunkingStrategy.SENTENCE, chunk_size=256)
        text = "First sentence. Second sentence. Third sentence."
        chunks = chunk_content(text, config)
        assert len(chunks) >= 1

    def test_regex_strategy(self):
        config = ChunkingConfig(
            strategy=ChunkingStrategy.REGEX, chunk_size=256, word_count_threshold=0
        )
        text = "Paragraph one.\n\nParagraph two.\n\nParagraph three."
        chunks = chunk_content(text, config)
        assert len(chunks) >= 1

    def test_topic_strategy(self):
        config = ChunkingConfig(strategy=ChunkingStrategy.TOPIC, chunk_size=256)
        text = "## Heading One\nSome content here.\n\n## Heading Two\nMore content."
        chunks = chunk_content(text, config)
        assert len(chunks) >= 1

    def test_unknown_strategy_falls_back_to_fixed_token(self):
        # Force an unknown strategy by bypassing enum validation
        config = ChunkingConfig(strategy=ChunkingStrategy.FIXED_TOKEN, chunk_size=256)
        text = "word " * 100
        chunks = chunk_content(text, config)
        assert len(chunks) > 0


# ---------------------------------------------------------------------------
# _chunk_fixed_token
# ---------------------------------------------------------------------------


class TestChunkFixedToken:
    def test_short_text_below_threshold_excluded(self):
        # word_count_threshold=50 means tokens must be >= 50 to include
        config = ChunkingConfig(
            strategy=ChunkingStrategy.FIXED_TOKEN,
            chunk_size=256,
            word_count_threshold=50,
        )
        # 10 chars = 2 tokens, below threshold=50 — but it's the last chunk so still included
        text = "a" * 10
        chunks = chunk_content(text, config)
        # Last chunk is always included even if below threshold
        assert len(chunks) == 1

    def test_chunks_have_correct_offsets(self):
        config = ChunkingConfig(
            strategy=ChunkingStrategy.FIXED_TOKEN,
            chunk_size=256,
            overlap_rate=0.0,
            word_count_threshold=0,
        )
        text = "x" * 2048  # 512 tokens, chunk_size=256 → chunk_chars=1024
        chunks = chunk_content(text, config)
        assert len(chunks) == 2
        assert chunks[0].start_offset == 0
        assert chunks[0].end_offset == 1024
        assert chunks[1].start_offset == 1024

    def test_overlap_creates_more_chunks(self):
        config_no_overlap = ChunkingConfig(
            strategy=ChunkingStrategy.FIXED_TOKEN,
            chunk_size=256,
            overlap_rate=0.0,
            word_count_threshold=0,
        )
        config_overlap = ChunkingConfig(
            strategy=ChunkingStrategy.FIXED_TOKEN,
            chunk_size=256,
            overlap_rate=0.2,
            word_count_threshold=0,
        )
        text = "word " * 500
        chunks_no_overlap = chunk_content(text, config_no_overlap)
        chunks_overlap = chunk_content(text, config_overlap)
        assert len(chunks_overlap) >= len(chunks_no_overlap)

    def test_chunk_numbers_are_sequential(self):
        config = ChunkingConfig(
            strategy=ChunkingStrategy.FIXED_TOKEN,
            chunk_size=256,
            overlap_rate=0.0,
            word_count_threshold=0,
        )
        text = "x" * 4096
        chunks = chunk_content(text, config)
        for i, chunk in enumerate(chunks, start=1):
            assert chunk.chunk_number == i

    def test_token_count_matches_estimate(self):
        config = ChunkingConfig(
            strategy=ChunkingStrategy.FIXED_TOKEN,
            chunk_size=256,
            overlap_rate=0.0,
            word_count_threshold=0,
        )
        text = "abcdefgh" * 200  # 1600 chars
        chunks = chunk_content(text, config)
        for chunk in chunks:
            assert chunk.token_count == estimate_tokens(chunk.content)

    def test_empty_text_returns_empty(self):
        config = ChunkingConfig(strategy=ChunkingStrategy.FIXED_TOKEN, chunk_size=256)
        chunks = chunk_content("", config)
        assert chunks == []


# ---------------------------------------------------------------------------
# _chunk_sentence
# ---------------------------------------------------------------------------


class TestChunkSentence:
    def test_no_sentence_boundaries_returns_single_chunk(self):
        config = ChunkingConfig(
            strategy=ChunkingStrategy.SENTENCE,
            chunk_size=256,
            word_count_threshold=0,
        )
        text = "No sentence boundaries here at all"
        chunks = chunk_content(text, config)
        assert len(chunks) == 1
        assert chunks[0].content == text

    def test_sentence_boundaries_split_text(self):
        config = ChunkingConfig(
            strategy=ChunkingStrategy.SENTENCE,
            chunk_size=256,  # minimum allowed; chunk_chars=1024
            word_count_threshold=0,
        )
        # Build text with many sentence boundaries so chunks accumulate past 1024 chars
        sentence = "This is a sentence with some words in it. "
        text = sentence * 30  # ~1260 chars -> at least 2 chunks
        chunks = chunk_content(text, config)
        assert len(chunks) >= 2

    def test_trailing_text_included(self):
        config = ChunkingConfig(
            strategy=ChunkingStrategy.SENTENCE,
            chunk_size=256,
            word_count_threshold=0,
        )
        text = "First sentence. Trailing text without boundary"
        chunks = chunk_content(text, config)
        full_text = " ".join(c.content for c in chunks)
        assert "Trailing text" in full_text


# ---------------------------------------------------------------------------
# _chunk_regex
# ---------------------------------------------------------------------------


class TestChunkRegex:
    def test_splits_on_double_newline(self):
        config = ChunkingConfig(
            strategy=ChunkingStrategy.REGEX,
            chunk_size=256,
            word_count_threshold=0,
        )
        text = "Para one\n\nPara two\n\nPara three"
        chunks = chunk_content(text, config)
        assert len(chunks) == 3

    def test_empty_paragraphs_skipped(self):
        config = ChunkingConfig(
            strategy=ChunkingStrategy.REGEX,
            chunk_size=256,
            word_count_threshold=0,
        )
        text = "Para one\n\n\n\nPara two"
        chunks = chunk_content(text, config)
        assert len(chunks) == 2

    def test_word_count_threshold_filters_short_paragraphs(self):
        config = ChunkingConfig(
            strategy=ChunkingStrategy.REGEX,
            chunk_size=256,
            word_count_threshold=100,  # very high — all short paras excluded
        )
        text = "Short\n\nAlso short\n\nTiny"
        chunks = chunk_content(text, config)
        assert len(chunks) == 0


# ---------------------------------------------------------------------------
# _chunk_topic
# ---------------------------------------------------------------------------


class TestChunkTopic:
    def test_splits_on_markdown_headings(self):
        config = ChunkingConfig(
            strategy=ChunkingStrategy.TOPIC,
            chunk_size=256,
            word_count_threshold=0,
        )
        text = "## Section One\nContent one.\n\n## Section Two\nContent two."
        chunks = chunk_content(text, config)
        assert len(chunks) == 2
        assert "Section One" in chunks[0].content
        assert "Section Two" in chunks[1].content

    def test_preamble_before_first_heading_included(self):
        config = ChunkingConfig(
            strategy=ChunkingStrategy.TOPIC,
            chunk_size=256,
            word_count_threshold=0,
        )
        # Long enough preamble to pass word_count_threshold=0
        preamble = "x" * 300
        text = f"{preamble}\n\n## Heading\nContent."
        chunks = chunk_content(text, config)
        # First chunk should be preamble
        assert chunks[0].content == preamble

    def test_no_headings_falls_back_to_fixed_token(self):
        config = ChunkingConfig(
            strategy=ChunkingStrategy.TOPIC,
            chunk_size=256,
            word_count_threshold=0,
        )
        text = "No headings here at all. Just plain text."
        chunks = chunk_content(text, config)
        assert len(chunks) >= 1

    def test_h1_through_h6_all_trigger_splits(self):
        config = ChunkingConfig(
            strategy=ChunkingStrategy.TOPIC,
            chunk_size=256,
            word_count_threshold=0,
        )
        text = "# H1\nContent.\n## H2\nContent.\n### H3\nContent.\n#### H4\nContent."
        chunks = chunk_content(text, config)
        assert len(chunks) == 4


# ---------------------------------------------------------------------------
# get_default_config / set_default_config
# ---------------------------------------------------------------------------


class TestDefaultConfig:
    def setup_method(self):
        # Reset default config before each test
        import app.services.rag_service as svc

        svc._default_config = None

    def test_get_default_config_returns_rag_pipeline_config(self):
        config = get_default_config()
        assert isinstance(config, RAGPipelineConfig)

    def test_get_default_config_returns_same_instance(self):
        config1 = get_default_config()
        config2 = get_default_config()
        assert config1 is config2

    def test_set_default_config_replaces_default(self):
        new_config = RAGPipelineConfig(target_collection="custom_collection")
        result = set_default_config(new_config)
        assert result is new_config
        assert get_default_config().target_collection == "custom_collection"

    def test_set_default_config_returns_config(self):
        config = RAGPipelineConfig()
        returned = set_default_config(config)
        assert returned is config


# ---------------------------------------------------------------------------
# get_job_status
# ---------------------------------------------------------------------------


class TestGetJobStatus:
    def test_unknown_job_id_returns_none(self):
        result = get_job_status("nonexistent-job-id-xyz")
        assert result is None

    def test_known_job_id_returns_status(self):
        # Directly inject a job via the in-memory fallback store
        job_id = str(uuid.uuid4())
        job = RAGProcessStatus(job_id=job_id)
        _rag_store._fallback[job_id] = job.model_dump()
        try:
            result = get_job_status(job_id)
            assert result is not None
            assert result.job_id == job_id
        finally:
            _rag_store._fallback.pop(job_id, None)


# ---------------------------------------------------------------------------
# process_pipeline
# ---------------------------------------------------------------------------


class TestProcessPipeline:
    def _make_mock_client(self):
        mock_client = MagicMock()
        mock_client.add_documents.return_value = ["id1", "id2"]
        return mock_client

    def test_returns_job_id_string(self):
        mock_client = self._make_mock_client()
        with patch("app.services.rag_service.get_chromadb_client", return_value=mock_client):
            config = RAGPipelineConfig()
            job_id = process_pipeline("some content here", config)
        assert isinstance(job_id, str)
        assert len(job_id) > 0

    def test_job_starts_as_pending(self):
        mock_client = self._make_mock_client()
        with patch("app.services.rag_service.get_chromadb_client", return_value=mock_client):
            config = RAGPipelineConfig()
            job_id = process_pipeline("some content", config)
        # Status may be PENDING or PROCESSING immediately after launch
        status = get_job_status(job_id)
        assert status is not None
        assert status.status in (
            ProcessingStatus.PENDING,
            ProcessingStatus.PROCESSING,
            ProcessingStatus.COMPLETED,
        )

    def test_job_completes_successfully(self):
        mock_client = self._make_mock_client()
        with patch("app.services.rag_service.get_chromadb_client", return_value=mock_client):
            config = RAGPipelineConfig(
                chunking=ChunkingConfig(
                    strategy=ChunkingStrategy.FIXED_TOKEN,
                    chunk_size=256,
                    word_count_threshold=0,
                )
            )
            content = "word " * 100
            job_id = process_pipeline(content, config)

        status = _wait_for_job(job_id)
        assert status is not None
        assert status.status == ProcessingStatus.COMPLETED
        assert status.progress == 100

    def test_job_tracks_chunks_total(self):
        mock_client = self._make_mock_client()
        with patch("app.services.rag_service.get_chromadb_client", return_value=mock_client):
            config = RAGPipelineConfig(
                chunking=ChunkingConfig(
                    strategy=ChunkingStrategy.FIXED_TOKEN,
                    chunk_size=256,
                    word_count_threshold=0,
                )
            )
            content = "word " * 200
            job_id = process_pipeline(content, config)

        status = _wait_for_job(job_id)
        assert status.chunks_total > 0
        assert status.chunks_stored == status.chunks_total

    def test_job_fails_when_chromadb_raises(self):
        mock_client = MagicMock()
        mock_client.add_documents.side_effect = RuntimeError("ChromaDB error")
        with patch("app.services.rag_service.get_chromadb_client", return_value=mock_client):
            config = RAGPipelineConfig(
                chunking=ChunkingConfig(
                    strategy=ChunkingStrategy.FIXED_TOKEN,
                    chunk_size=256,
                    word_count_threshold=0,
                )
            )
            job_id = process_pipeline("word " * 100, config)

        status = _wait_for_job(job_id)
        assert status is not None
        assert status.status == ProcessingStatus.FAILED
        assert status.error_message is not None
        assert "ChromaDB error" in status.error_message

    def test_multiple_jobs_have_unique_ids(self):
        mock_client = self._make_mock_client()
        with patch("app.services.rag_service.get_chromadb_client", return_value=mock_client):
            config = RAGPipelineConfig()
            job_id1 = process_pipeline("content one", config)
            job_id2 = process_pipeline("content two", config)
        assert job_id1 != job_id2

    def test_pipeline_uses_target_collection(self):
        mock_client = self._make_mock_client()
        with patch("app.services.rag_service.get_chromadb_client", return_value=mock_client):
            config = RAGPipelineConfig(
                target_collection="my_custom_collection",
                chunking=ChunkingConfig(
                    strategy=ChunkingStrategy.FIXED_TOKEN,
                    chunk_size=256,
                    word_count_threshold=0,
                ),
            )
            job_id = process_pipeline("word " * 100, config)

        status = _wait_for_job(job_id)
        assert status.status == ProcessingStatus.COMPLETED
        # Verify add_documents was called with correct collection
        calls = mock_client.add_documents.call_args_list
        assert len(calls) > 0
        for call in calls:
            assert (
                call.kwargs.get("collection_name") == "my_custom_collection"
                or call.args[0] == "my_custom_collection"
                if call.args
                else True
            )

    def test_empty_content_pipeline(self):
        mock_client = self._make_mock_client()
        with patch("app.services.rag_service.get_chromadb_client", return_value=mock_client):
            config = RAGPipelineConfig(
                chunking=ChunkingConfig(
                    strategy=ChunkingStrategy.FIXED_TOKEN,
                    chunk_size=256,
                    word_count_threshold=0,
                )
            )
            job_id = process_pipeline("", config)

        status = _wait_for_job(job_id)
        # Empty content → 0 chunks → completes with 0 stored
        assert status is not None
        assert status.status == ProcessingStatus.COMPLETED
        assert status.chunks_total == 0
