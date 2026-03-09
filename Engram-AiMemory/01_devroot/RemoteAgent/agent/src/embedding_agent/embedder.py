"""MLX-native embedding model wrapper with LM Studio fallback."""

import asyncio
from abc import ABC, abstractmethod
from typing import List, Optional

import numpy as np
from rich.console import Console

console = Console()


class BaseEmbedder(ABC):
    """Abstract base class for embedding providers."""

    @abstractmethod
    async def embed(self, texts: List[str]) -> np.ndarray:
        """Generate embeddings for a list of texts."""
        pass

    @abstractmethod
    def get_dimensions(self) -> int:
        """Return the embedding dimensions."""
        pass


class MLXEmbedder(BaseEmbedder):
    """MLX-native embedding model using mlx-embedding-models."""

    # Model dimensions mapping
    MODEL_DIMENSIONS = {
        "bge-small": 384,
        "bge-base": 768,
        "all-MiniLM-L6-v2": 384,
    }

    def __init__(self, model_name: str = "bge-small"):
        self.model_name = model_name
        self._model = None
        self._dimensions = self.MODEL_DIMENSIONS.get(model_name, 384)

    def _load_model(self):
        """Lazy load the model."""
        if self._model is None:
            try:
                from mlx_embedding_models.embedding import EmbeddingModel

                console.print(f"[cyan]Loading MLX embedding model: {self.model_name}[/cyan]")
                self._model = EmbeddingModel.from_registry(self.model_name)
                console.print(f"[green]✓ Model loaded successfully[/green]")
            except ImportError as e:
                raise RuntimeError(
                    "mlx-embedding-models not installed. "
                    "Install with: pip install mlx-embedding-models"
                ) from e
        return self._model

    async def embed(self, texts: List[str]) -> np.ndarray:
        """Generate embeddings using MLX model."""
        model = self._load_model()

        # Run in thread pool since MLX operations are CPU-bound
        loop = asyncio.get_event_loop()
        embeddings = await loop.run_in_executor(None, model.encode, texts)

        # Convert MLX array to numpy
        if hasattr(embeddings, "tolist"):
            embeddings = np.array(embeddings.tolist())
        elif not isinstance(embeddings, np.ndarray):
            embeddings = np.array(embeddings)

        return embeddings

    def get_dimensions(self) -> int:
        return self._dimensions


class LMStudioEmbedder(BaseEmbedder):
    """LM Studio API-based embedder for fallback or alternative models."""

    def __init__(
        self,
        base_url: str = "http://localhost:1234",
        model: Optional[str] = None
    ):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self._dimensions: Optional[int] = None

    async def embed(self, texts: List[str]) -> np.ndarray:
        """Generate embeddings using LM Studio API."""
        try:
            from lmstudio import LMStudioClient

            client = LMStudioClient(base_url=self.base_url)

            # Use the embeddings endpoint
            embeddings = []
            for text in texts:
                response = await asyncio.to_thread(
                    client.embeddings.create,
                    input=text,
                    model=self.model
                )
                embeddings.append(response.data[0].embedding)

            result = np.array(embeddings)
            if self._dimensions is None:
                self._dimensions = result.shape[1]

            return result

        except ImportError:
            raise RuntimeError(
                "lmstudio package not installed. "
                "Install with: pip install lmstudio"
            )

    def get_dimensions(self) -> int:
        if self._dimensions is None:
            raise RuntimeError("Dimensions unknown until first embedding call")
        return self._dimensions


class EmbeddingService:
    """Unified embedding service with batching and error handling."""

    def __init__(
        self,
        embedder: BaseEmbedder,
        batch_size: int = 32
    ):
        self.embedder = embedder
        self.batch_size = batch_size

    async def embed_texts(self, texts: List[str]) -> np.ndarray:
        """Embed a list of texts with automatic batching."""
        if not texts:
            return np.array([])

        all_embeddings = []

        for i in range(0, len(texts), self.batch_size):
            batch = texts[i:i + self.batch_size]
            embeddings = await self.embedder.embed(batch)
            all_embeddings.append(embeddings)

        return np.vstack(all_embeddings)

    def get_dimensions(self) -> int:
        return self.embedder.get_dimensions()


def create_embedder(
    model_name: str = "bge-small",
    lmstudio_url: Optional[str] = None,
    lmstudio_model: Optional[str] = None,
    use_lmstudio: bool = False
) -> BaseEmbedder:
    """Factory function to create the appropriate embedder."""
    if use_lmstudio and lmstudio_url:
        console.print(f"[cyan]Using LM Studio embedder at {lmstudio_url}[/cyan]")
        return LMStudioEmbedder(base_url=lmstudio_url, model=lmstudio_model)

    console.print(f"[cyan]Using MLX embedder: {model_name}[/cyan]")
    return MLXEmbedder(model_name=model_name)
