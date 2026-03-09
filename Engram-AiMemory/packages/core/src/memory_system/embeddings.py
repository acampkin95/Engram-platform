"""
Local embedding and reranking models.
- NomicEmbedder: nomic-embed-text-v1.5 via sentence-transformers
- BGEReranker: BAAI/bge-reranker-base via sentence-transformers cross-encoder
- OllamaEmbedder: Ollama /api/embeddings (nomic-embed-text:v1.5 or any local model)
- get_embedding_provider: factory to select provider from Settings
"""

import logging

logger = logging.getLogger(__name__)


class NomicEmbedder:
    """
    Embedding using nomic-embed-text-v1.5.
    Requires: pip install sentence-transformers
    Model: ~275MB, 768-dim, 8192 token context, Matryoshka support.
    Task prefixes: search_document:, search_query:, clustering:, classification:
    """

    MODEL_NAME = "nomic-ai/nomic-embed-text-v1.5"
    DIMENSION = 768

    def __init__(self, dimension: int = 768):
        self._model = None
        self._dimension = dimension

    def _load(self) -> None:
        if self._model is None:
            from sentence_transformers import SentenceTransformer

            logger.info(f"Loading {self.MODEL_NAME}...")
            self._model = SentenceTransformer(self.MODEL_NAME, trust_remote_code=True)
            logger.info(f"Loaded {self.MODEL_NAME} ({self.DIMENSION}-dim)")

    def embed(self, texts: list[str], task: str = "search_document") -> list[list[float]]:
        """Embed texts with task prefix. Returns list of vectors."""
        import torch.nn.functional as functional

        self._load()
        prefixed = [f"{task}: {t}" for t in texts]
        embeddings = self._model.encode(prefixed, convert_to_tensor=True)
        # Matryoshka: normalize and truncate to requested dimension
        embeddings = functional.layer_norm(embeddings, normalized_shape=(embeddings.shape[1],))
        embeddings = embeddings[:, : self._dimension]
        embeddings = functional.normalize(embeddings, p=2, dim=1)
        return embeddings.tolist()

    def embed_query(self, text: str) -> list[float]:
        """Embed a single search query."""
        return self.embed([text], task="search_query")[0]

    def embed_document(self, text: str) -> list[float]:
        """Embed a single document for storage."""
        return self.embed([text], task="search_document")[0]

    def embed_batch(self, texts: list[str], task: str = "search_document") -> list[list[float]]:
        """Embed multiple texts efficiently."""
        return self.embed(texts, task=task)


class BGEReranker:
    """
    Cross-encoder reranker using BAAI/bge-reranker-base.
    Requires: pip install sentence-transformers
    Model: ~280MB, 278M params.
    """

    MODEL_NAME = "BAAI/bge-reranker-base"

    def __init__(self) -> None:
        self._model = None

    def _load(self) -> None:
        if self._model is None:
            from sentence_transformers import CrossEncoder

            logger.info(f"Loading {self.MODEL_NAME}...")
            self._model = CrossEncoder(self.MODEL_NAME, max_length=512)
            logger.info(f"Loaded {self.MODEL_NAME}")

    def rerank(
        self, query: str, documents: list[str], top_k: int | None = None
    ) -> list[tuple[int, float]]:
        """
        Rerank documents by relevance to query.
        Returns list of (original_index, score) sorted by score descending.
        """
        self._load()
        pairs = [(query, doc) for doc in documents]
        scores = self._model.predict(pairs)
        indexed = sorted(enumerate(scores), key=lambda x: x[1], reverse=True)
        if top_k:
            indexed = indexed[:top_k]
        return indexed


class OllamaEmbedder:
    """
    Ollama local embeddings provider.
    Uses /api/embeddings endpoint (single-text; batch sequentially).
    Default model: nomic-embed-text:v1.5 (768-dim).
    Requires: Ollama running at ollama_host.
    """

    DIMENSION = 768  # nomic-embed-text:v1.5 default

    def __init__(self, host: str, model: str = "nomic-embed-text:v1.5", dimension: int = 768) -> None:
        import httpx

        self._client = httpx.Client(
            base_url=host.rstrip("/"),
            timeout=60.0,  # local inference can be slow
        )
        self._model = model
        self._dimension = dimension
        self.DIMENSION = dimension

    def _embed_one(self, text: str) -> list[float]:
        """Embed a single text via Ollama /api/embeddings."""
        response = self._client.post(
            "/api/embeddings",
            json={"model": self._model, "prompt": text},
        )
        response.raise_for_status()
        return response.json()["embedding"]

    def embed(self, texts: list[str], task: str = "search_document") -> list[list[float]]:
        """Embed multiple texts (sequential — Ollama is single-text)."""
        return [self._embed_one(t) for t in texts]

    def embed_query(self, text: str) -> list[float]:
        """Embed a single search query."""
        return self._embed_one(text)

    def embed_document(self, text: str) -> list[float]:
        """Embed a single document for storage."""
        return self._embed_one(text)

    def embed_batch(self, texts: list[str], task: str = "search_document") -> list[list[float]]:
        """Embed multiple texts efficiently (sequential for Ollama)."""
        return self.embed(texts, task=task)

    def close(self) -> None:
        """Close the HTTP client."""
        self._client.close()


def get_embedding_provider(
    provider: str,
    *,
    dimension: int = 768,
    ollama_host: str | None = None,
    ollama_model: str = "nomic-embed-text:v1.5",
) -> "NomicEmbedder | OllamaEmbedder":
    """
    Return the configured embedding provider instance.

    Args:
        provider: One of 'nomic', 'ollama'. ('openai' is handled in system.py via AsyncOpenAI.)
        dimension: Embedding vector dimension.
        ollama_host: Ollama base URL (required when provider='ollama').
        ollama_model: Ollama model name (default: nomic-embed-text:v1.5).

    Returns:
        NomicEmbedder or OllamaEmbedder instance.

    Raises:
        ValueError: If provider is unsupported or required config is missing.
    """
    if provider == "nomic":
        return NomicEmbedder(dimension=dimension)
    if provider == "ollama":
        if not ollama_host:
            raise ValueError(
                "OLLAMA_HOST must be set when EMBEDDING_PROVIDER=ollama"
            )
        return OllamaEmbedder(host=ollama_host, model=ollama_model, dimension=dimension)
    raise ValueError(
        f"Unsupported embedding provider for local use: {provider!r}. ",
        "Supported: 'nomic', 'ollama'. For 'openai', use system.py's AsyncOpenAI path.",
    )
