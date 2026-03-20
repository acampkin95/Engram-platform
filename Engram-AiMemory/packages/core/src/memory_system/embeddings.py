"""
Local embedding and reranking models.
- NomicEmbedder: nomic-embed-text-v1.5 via sentence-transformers
- BGEReranker: BAAI/bge-reranker-base via sentence-transformers cross-encoder
- OllamaEmbedder: Ollama /api/embeddings (nomic-embed-text:v1.5 or any local model)
- get_embedding_provider: factory to select provider from Settings
"""

import logging

import httpx

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

    # Class-level connection pool
    _client_pool: dict[str, httpx.AsyncClient] = {}
    DIMENSION = 768

    def __init__(
        self, host: str, model: str = "nomic-embed-text:v1.5", dimension: int = 768
    ) -> None:
        self._host = host
        self._model = model
        self._dimension = dimension
        self.DIMENSION = dimension

    def _get_client(self) -> httpx.AsyncClient:
        """Get or create a pooled client for this host."""
        if self._host not in self._client_pool:
            self._client_pool[self._host] = httpx.AsyncClient(
                base_url=self._host.rstrip("/"),
                timeout=60.0,
                limits=httpx.Limits(max_connections=10, max_keepalive_connections=30),
            )
        return self._client_pool[self._host]

    async def _embed_one(self, text: str) -> list[float]:
        """Embed a single text via Ollama /api/embeddings."""
        client = self._get_client()
        response = await client.post(
            "/api/embeddings",
            json={"model": self._model, "prompt": text},
        )
        response.raise_for_status()
        return response.json()["embedding"]

    async def embed(self, texts: list[str], task: str = "search_document") -> list[list[float]]:
        """Embed multiple texts (sequential — Ollama is single-text)."""
        return [await self._embed_one(t) for t in texts]

    async def embed_query(self, text: str) -> list[float]:
        """Embed a single search query."""
        return await self._embed_one(text)

    async def embed_document(self, text: str) -> list[float]:
        """Embed a single document for storage."""
        return await self._embed_one(text)

    async def embed_batch(
        self, texts: list[str], task: str = "search_document"
    ) -> list[list[float]]:
        """Embed multiple texts efficiently (sequential for Ollama)."""
        return await self.embed(texts, task=task)


# Singleton provider cache with memory limit
_PROVIDER_CACHE_MAX_SIZE = 100
_provider_cache: dict[str, "NomicEmbedder | OllamaEmbedder"] = {}
_provider_cache_order: list[str] = []  # Track insertion order for LRU eviction


def clear_embedding_provider_cache() -> None:
    """Clear the singleton provider cache and close all connections."""
    global _provider_cache, _provider_cache_order

    # Close any Ollama clients
    for provider in _provider_cache.values():
        if isinstance(provider, OllamaEmbedder):
            # Clean up all clients in the pool
            for client in OllamaEmbedder._client_pool.values():
                client.close()
            OllamaEmbedder._client_pool.clear()

    _provider_cache.clear()
    _provider_cache_order.clear()
    logger.info("Cleared embedding provider cache")


def get_embedding_provider(
    provider: str,
    *,
    dimension: int = 768,
    ollama_host: str | None = None,
    ollama_model: str = "nomic-embed-text:v1.5",
) -> "NomicEmbedder | OllamaEmbedder":
    """
    Return a configured embedding provider instance (singleton per configuration).

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
    global _provider_cache, _provider_cache_order

    cache_key = f"{provider}:{dimension}:{ollama_host}:{ollama_model}"

    if cache_key in _provider_cache:
        # Move to end of LRU list
        _provider_cache_order.remove(cache_key)
        _provider_cache_order.append(cache_key)
        return _provider_cache[cache_key]

    # Enforce max cache size with LRU eviction
    if len(_provider_cache) >= _PROVIDER_CACHE_MAX_SIZE:
        # Remove least recently used
        lru_key = _provider_cache_order.pop(0)
        old_provider = _provider_cache.pop(lru_key)
        # Clean up the specific client for this provider
        if (
            isinstance(old_provider, OllamaEmbedder)
            and old_provider._host in OllamaEmbedder._client_pool
        ):
            OllamaEmbedder._client_pool[old_provider._host].close()
            del OllamaEmbedder._client_pool[old_provider._host]
        logger.warning(f"Evicted LRU embedding provider: {lru_key}")

    if provider == "nomic":
        instance = NomicEmbedder(dimension=dimension)
    elif provider == "ollama":
        if not ollama_host:
            raise ValueError("OLLAMA_HOST must be set when EMBEDDING_PROVIDER=ollama")
        instance = OllamaEmbedder(host=ollama_host, model=ollama_model, dimension=dimension)
    else:
        raise ValueError(
            f"Unsupported embedding provider for local use: {provider!r}. "
            f"Supported: 'nomic', 'ollama'. For 'openai', use system.py's AsyncOpenAI path.",
        )

    _provider_cache[cache_key] = instance
    _provider_cache_order.append(cache_key)
    return instance
