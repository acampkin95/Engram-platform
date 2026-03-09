"""
Embedding Worker - Core module for generating embeddings via LM Studio
"""
import os
import asyncio
from typing import Optional
from dataclasses import dataclass
from lmstudio import AsyncLMStudio
from dotenv import load_dotenv
from rich.console import Console

load_dotenv()
console = Console()


@dataclass
class EmbeddingResult:
    """Result from embedding generation"""
    text: str
    embedding: list[float]
    model: str
    dimensions: int
    token_count: int


class EmbeddingWorker:
    """Handles embedding generation via LM Studio SDK"""
    
    def __init__(
        self,
        host: str = None,
        port: int = None,
        model: str = None
    ):
        self.host = host or os.getenv("LMSTUDIO_HOST", "localhost")
        self.port = port or int(os.getenv("LMSTUDIO_PORT", "1234"))
        self.model = model or os.getenv("EMBEDDING_MODEL", "nomic-embed-text-v1.5")
        self._client: Optional[AsyncLMStudio] = None
        self._embedding_model = None
        
    async def connect(self) -> bool:
        """Establish connection to LM Studio"""
        try:
            self._client = AsyncLMStudio(
                host=self.host,
                port=self.port
            )
            
            # Load the embedding model
            self._embedding_model = await self._client.embedding.model(self.model)
            
            console.print(f"[green]✓[/green] Connected to LM Studio ({self.host}:{self.port})")
            console.print(f"[green]✓[/green] Loaded model: {self.model}")
            return True
            
        except Exception as e:
            console.print(f"[red]✗[/red] Failed to connect to LM Studio: {e}")
            return False
    
    async def disconnect(self):
        """Clean up connection"""
        if self._client:
            # LM Studio SDK cleanup if needed
            self._client = None
            self._embedding_model = None
    
    async def embed_text(self, text: str) -> Optional[EmbeddingResult]:
        """Generate embedding for a single text"""
        if not self._embedding_model:
            console.print("[red]✗[/red] Not connected to LM Studio")
            return None
        
        try:
            result = await self._embedding_model.embed(text)
            
            return EmbeddingResult(
                text=text,
                embedding=result.embedding,
                model=self.model,
                dimensions=len(result.embedding),
                token_count=result.token_count if hasattr(result, 'token_count') else -1
            )
            
        except Exception as e:
            console.print(f"[red]✗[/red] Embedding failed: {e}")
            return None
    
    async def embed_batch(self, texts: list[str]) -> list[Optional[EmbeddingResult]]:
        """Generate embeddings for multiple texts"""
        if not self._embedding_model:
            console.print("[red]✗[/red] Not connected to LM Studio")
            return [None] * len(texts)
        
        try:
            # LM Studio SDK batch embedding
            results = await self._embedding_model.embed_many(texts)
            
            return [
                EmbeddingResult(
                    text=text,
                    embedding=result.embedding,
                    model=self.model,
                    dimensions=len(result.embedding),
                    token_count=result.token_count if hasattr(result, 'token_count') else -1
                )
                for text, result in zip(texts, results)
            ]
            
        except Exception as e:
            console.print(f"[red]✗[/red] Batch embedding failed: {e}")
            return [None] * len(texts)


# Quick test
async def test_worker():
    worker = EmbeddingWorker()
    
    if await worker.connect():
        result = await worker.embed_text("Hello, this is a test of the embedding system.")
        if result:
            console.print(f"[blue]Dimensions:[/blue] {result.dimensions}")
            console.print(f"[blue]First 5 values:[/blue] {result.embedding[:5]}")
        
        await worker.disconnect()


if __name__ == "__main__":
    asyncio.run(test_worker())
