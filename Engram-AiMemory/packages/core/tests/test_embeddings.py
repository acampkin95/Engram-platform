"""
Unit tests for memory_system.embeddings — NomicEmbedder, BGEReranker, OllamaEmbedder, factory.

Mocks sentence-transformers and httpx at the correct level: mock the ML model/HTTP client,
test the real logic (prefixing, dimension handling, factory routing).
"""

from __future__ import annotations

import sys
from unittest.mock import MagicMock, patch

import pytest

from memory_system.embeddings import (
    BGEReranker,
    NomicEmbedder,
    OllamaEmbedder,
    get_embedding_provider,
)


# ---------------------------------------------------------------------------
# NomicEmbedder
# ---------------------------------------------------------------------------


class TestNomicEmbedder:
    def test_init_default_dimension(self) -> None:
        embedder = NomicEmbedder()
        assert embedder._dimension == 768
        assert embedder._model is None  # lazy init

    def test_init_custom_dimension(self) -> None:
        embedder = NomicEmbedder(dimension=384)
        assert embedder._dimension == 384

    def test_load_imports_sentence_transformer(self) -> None:
        mock_model = MagicMock()
        mock_st_class = MagicMock(return_value=mock_model)

        # Patch the import inside _load
        mock_module = MagicMock()
        mock_module.SentenceTransformer = mock_st_class
        with patch.dict(sys.modules, {"sentence_transformers": mock_module}):
            embedder = NomicEmbedder()
            embedder._load()

        mock_st_class.assert_called_once_with(
            NomicEmbedder.MODEL_NAME, trust_remote_code=True
        )
        assert embedder._model is mock_model

    def test_load_only_once(self) -> None:
        """Lazy loading should only happen on first call."""
        mock_model = MagicMock()
        embedder = NomicEmbedder()
        embedder._model = mock_model  # Pre-set model

        mock_st_class = MagicMock()
        mock_module = MagicMock()
        mock_module.SentenceTransformer = mock_st_class
        with patch.dict(sys.modules, {"sentence_transformers": mock_module}):
            embedder._load()

        mock_st_class.assert_not_called()  # Should not re-load

    def test_embed_prefixes_texts_with_task(self) -> None:
        """Verify embed() prepends task prefix to each text."""
        mock_model = MagicMock()
        # Return a tensor-like object
        import types

        mock_tensor = MagicMock()
        mock_tensor.shape = (2, 768)
        mock_tensor.__getitem__ = MagicMock(return_value=mock_tensor)
        mock_tensor.tolist.return_value = [[0.1] * 768, [0.2] * 768]
        mock_model.encode.return_value = mock_tensor

        mock_functional = MagicMock()
        mock_functional.layer_norm.return_value = mock_tensor
        mock_functional.normalize.return_value = mock_tensor
        mock_torch_module = MagicMock()
        mock_torch_module.nn.functional = mock_functional

        embedder = NomicEmbedder()
        embedder._model = mock_model

        with patch.dict(sys.modules, {"torch": mock_torch_module, "torch.nn": mock_torch_module.nn, "torch.nn.functional": mock_functional}):
            result = embedder.embed(["hello", "world"], task="search_document")

        # Verify model.encode was called with prefixed texts
        call_args = mock_model.encode.call_args
        assert call_args[0][0] == ["search_document: hello", "search_document: world"]

    def test_embed_query_uses_search_query_prefix(self) -> None:
        embedder = NomicEmbedder()
        embedder.embed = MagicMock(return_value=[[0.1] * 768])
        result = embedder.embed_query("test query")
        embedder.embed.assert_called_once_with(["test query"], task="search_query")

    def test_embed_document_uses_search_document_prefix(self) -> None:
        embedder = NomicEmbedder()
        embedder.embed = MagicMock(return_value=[[0.1] * 768])
        result = embedder.embed_document("test doc")
        embedder.embed.assert_called_once_with(["test doc"], task="search_document")

    def test_embed_batch_delegates_to_embed(self) -> None:
        embedder = NomicEmbedder()
        embedder.embed = MagicMock(return_value=[[0.1] * 768, [0.2] * 768])
        result = embedder.embed_batch(["a", "b"], task="clustering")
        embedder.embed.assert_called_once_with(["a", "b"], task="clustering")


# ---------------------------------------------------------------------------
# BGEReranker
# ---------------------------------------------------------------------------


class TestBGEReranker:
    def test_init_lazy(self) -> None:
        reranker = BGEReranker()
        assert reranker._model is None

    def test_load_imports_cross_encoder(self) -> None:
        mock_model = MagicMock()
        mock_ce_class = MagicMock(return_value=mock_model)
        mock_module = MagicMock()
        mock_module.CrossEncoder = mock_ce_class

        with patch.dict(sys.modules, {"sentence_transformers": mock_module}):
            reranker = BGEReranker()
            reranker._load()

        mock_ce_class.assert_called_once_with(BGEReranker.MODEL_NAME, max_length=512)

    def test_rerank_returns_sorted_by_score_descending(self) -> None:
        reranker = BGEReranker()
        mock_model = MagicMock()
        # Scores: doc0=0.1, doc1=0.9, doc2=0.5
        mock_model.predict.return_value = [0.1, 0.9, 0.5]
        reranker._model = mock_model

        result = reranker.rerank("query", ["doc0", "doc1", "doc2"])

        # Should be sorted by score descending: (1, 0.9), (2, 0.5), (0, 0.1)
        assert result[0][0] == 1  # doc1 first
        assert result[1][0] == 2  # doc2 second
        assert result[2][0] == 0  # doc0 last

    def test_rerank_top_k_limits_results(self) -> None:
        reranker = BGEReranker()
        mock_model = MagicMock()
        mock_model.predict.return_value = [0.3, 0.9, 0.5, 0.1]
        reranker._model = mock_model

        result = reranker.rerank("query", ["a", "b", "c", "d"], top_k=2)
        assert len(result) == 2

    def test_rerank_builds_correct_pairs(self) -> None:
        reranker = BGEReranker()
        mock_model = MagicMock()
        mock_model.predict.return_value = [0.5, 0.6]
        reranker._model = mock_model

        reranker.rerank("my query", ["doc A", "doc B"])

        pairs = mock_model.predict.call_args[0][0]
        assert pairs == [("my query", "doc A"), ("my query", "doc B")]


# ---------------------------------------------------------------------------
# OllamaEmbedder
# ---------------------------------------------------------------------------


class TestOllamaEmbedder:
    def test_init_creates_httpx_client(self) -> None:
        with patch("httpx.Client") as mock_client_cls:
            embedder = OllamaEmbedder(host="http://localhost:11434")
        mock_client_cls.assert_called_once()
        call_kwargs = mock_client_cls.call_args
        assert call_kwargs[1]["base_url"] == "http://localhost:11434"
    def test_init_strips_trailing_slash(self) -> None:
        with patch("httpx.Client") as mock_client_cls:
            embedder = OllamaEmbedder(host="http://localhost:11434/")
        call_args = mock_client_cls.call_args
        assert call_args[1]["base_url"] == "http://localhost:11434"
    def test_embed_one_calls_api(self) -> None:
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.json.return_value = {"embedding": [0.1, 0.2, 0.3]}
        mock_client.post.return_value = mock_response

        with patch("httpx.Client", return_value=mock_client):
            embedder = OllamaEmbedder(host="http://localhost:11434")

        result = embedder._embed_one("test text")

        mock_client.post.assert_called_once_with(
            "/api/embeddings",
            json={"model": "nomic-embed-text:v1.5", "prompt": "test text"},
        )
        mock_response.raise_for_status.assert_called_once()
        assert result == [0.1, 0.2, 0.3]
    def test_embed_processes_multiple_texts_sequentially(self) -> None:
        mock_client = MagicMock()
        responses = [
            MagicMock(json=MagicMock(return_value={"embedding": [0.1]})),
            MagicMock(json=MagicMock(return_value={"embedding": [0.2]})),
        ]
        mock_client.post.side_effect = responses

        with patch("httpx.Client", return_value=mock_client):
            embedder = OllamaEmbedder(host="http://localhost:11434")

        result = embedder.embed(["text1", "text2"])
        assert result == [[0.1], [0.2]]
        assert mock_client.post.call_count == 2
    def test_embed_query_delegates(self) -> None:
        with patch("httpx.Client"):
            embedder = OllamaEmbedder(host="http://localhost:11434")
        embedder._embed_one = MagicMock(return_value=[0.5])
        result = embedder.embed_query("query text")
        embedder._embed_one.assert_called_once_with("query text")
        assert result == [0.5]
    def test_embed_document_delegates(self) -> None:
        with patch("httpx.Client"):
            embedder = OllamaEmbedder(host="http://localhost:11434")
        embedder._embed_one = MagicMock(return_value=[0.5])
        result = embedder.embed_document("doc text")
        embedder._embed_one.assert_called_once_with("doc text")
    def test_embed_batch_delegates_to_embed(self) -> None:
        with patch("httpx.Client"):
            embedder = OllamaEmbedder(host="http://localhost:11434")
        embedder.embed = MagicMock(return_value=[[0.1], [0.2]])
        result = embedder.embed_batch(["a", "b"])
        embedder.embed.assert_called_once_with(["a", "b"], task="search_document")
    def test_close_closes_client(self) -> None:
        mock_client = MagicMock()
        with patch("httpx.Client", return_value=mock_client):
            embedder = OllamaEmbedder(host="http://localhost:11434")
        embedder.close()
        mock_client.close.assert_called_once()
    def test_custom_model_and_dimension(self) -> None:
        with patch("httpx.Client"):
            embedder = OllamaEmbedder(
                host="http://localhost:11434",
                model="custom-model",
                dimension=512,
            )
        assert embedder._model == "custom-model"
        assert embedder._dimension == 512
        assert embedder.DIMENSION == 512


# ---------------------------------------------------------------------------
# get_embedding_provider factory
# ---------------------------------------------------------------------------


class TestGetEmbeddingProvider:
    def test_nomic_returns_nomic_embedder(self) -> None:
        provider = get_embedding_provider("nomic", dimension=384)
        assert isinstance(provider, NomicEmbedder)
        assert provider._dimension == 384

    def test_ollama_returns_ollama_embedder(self) -> None:
        with patch("httpx.Client"):
            provider = get_embedding_provider(
                "ollama",
                ollama_host="http://localhost:11434",
                ollama_model="custom-model",
                dimension=512,
            )
        assert isinstance(provider, OllamaEmbedder)

    def test_ollama_without_host_raises_value_error(self) -> None:
        with pytest.raises(ValueError, match="OLLAMA_HOST must be set"):
            get_embedding_provider("ollama")

    def test_unsupported_provider_raises_value_error(self) -> None:
        with pytest.raises(ValueError, match="Unsupported embedding provider"):
            get_embedding_provider("unknown-provider")

    def test_openai_is_unsupported_in_local(self) -> None:
        with pytest.raises(ValueError, match="Unsupported"):
            get_embedding_provider("openai")
