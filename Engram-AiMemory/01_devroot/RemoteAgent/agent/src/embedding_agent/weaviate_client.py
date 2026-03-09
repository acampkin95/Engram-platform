"""Weaviate client wrapper for streaming embeddings."""

import asyncio
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional

from rich.console import Console

console = Console()


@dataclass
class DocumentChunk:
    """A document chunk ready for Weaviate insertion."""

    file_path: str
    file_name: str
    chunk_text: str
    chunk_index: int
    total_chunks: int
    token_count: int
    file_hash: str
    file_extension: str
    last_modified: datetime
    embedding: Optional[List[float]] = None


class WeaviateClient:
    """Async Weaviate client for streaming embeddings."""

    COLLECTION_NAME = "DocumentChunk"

    def __init__(self, url: str, api_key: Optional[str] = None, timeout: int = 30):
        self.url = url
        self.api_key = api_key
        self.timeout = timeout
        self._client = None

    async def connect(self):
        """Establish connection to Weaviate."""
        try:
            import weaviate
            from weaviate.classes.init import Auth

            console.print(f"[cyan]Connecting to Weaviate at {self.url}...[/cyan]")

            auth = Auth.api_key(self.api_key) if self.api_key else None

            # Use async-compatible connection
            self._client = weaviate.connect_to_custom(
                http_host=self.url.replace("http://", "").replace("https://", "").split(":")[0],
                http_port=int(self.url.split(":")[-1]) if ":" in self.url.split("/")[-1] else 8080,
                http_secure=self.url.startswith("https"),
                auth_credentials=auth,
            )

            console.print("[green]✓ Connected to Weaviate[/green]")
            await self._ensure_collection()

        except Exception as e:
            console.print(f"[red]Failed to connect to Weaviate: {e}[/red]")
            raise

    async def _ensure_collection(self):
        """Create the collection schema if it doesn't exist."""
        try:
            from weaviate.classes.config import Configure, DataType, Property

            collections = self._client.collections.list_all()

            if self.COLLECTION_NAME not in [c for c in collections]:
                console.print(f"[cyan]Creating collection: {self.COLLECTION_NAME}[/cyan]")

                self._client.collections.create(
                    name=self.COLLECTION_NAME,
                    properties=[
                        Property(name="file_path", data_type=DataType.TEXT),
                        Property(name="file_name", data_type=DataType.TEXT),
                        Property(name="chunk_text", data_type=DataType.TEXT),
                        Property(name="chunk_index", data_type=DataType.INT),
                        Property(name="total_chunks", data_type=DataType.INT),
                        Property(name="token_count", data_type=DataType.INT),
                        Property(name="file_hash", data_type=DataType.TEXT),
                        Property(name="file_extension", data_type=DataType.TEXT),
                        Property(name="last_modified", data_type=DataType.DATE),
                    ],
                    vectorizer_config=Configure.Vectorizer.none(),  # We provide our own vectors
                )
                console.print(f"[green]✓ Collection created[/green]")
            else:
                console.print(f"[green]✓ Collection exists[/green]")

        except Exception as e:
            console.print(f"[yellow]Warning: Could not verify collection: {e}[/yellow]")

    async def upsert_chunks(self, chunks: List[DocumentChunk]) -> int:
        """Insert or update document chunks with embeddings."""
        if not chunks:
            return 0

        collection = self._client.collections.get(self.COLLECTION_NAME)
        inserted = 0

        # First, delete existing chunks for these files
        file_paths = list(set(c.file_path for c in chunks))
        for file_path in file_paths:
            await self._delete_by_file_path(file_path)

        # Batch insert new chunks
        with collection.batch.dynamic() as batch:
            for chunk in chunks:
                if chunk.embedding is None:
                    continue

                properties = {
                    "file_path": chunk.file_path,
                    "file_name": chunk.file_name,
                    "chunk_text": chunk.chunk_text,
                    "chunk_index": chunk.chunk_index,
                    "total_chunks": chunk.total_chunks,
                    "token_count": chunk.token_count,
                    "file_hash": chunk.file_hash,
                    "file_extension": chunk.file_extension,
                    "last_modified": chunk.last_modified.isoformat(),
                }

                batch.add_object(
                    properties=properties,
                    vector=chunk.embedding
                )
                inserted += 1

        return inserted

    async def _delete_by_file_path(self, file_path: str):
        """Delete all chunks for a specific file."""
        try:
            from weaviate.classes.query import Filter

            collection = self._client.collections.get(self.COLLECTION_NAME)
            collection.data.delete_many(
                where=Filter.by_property("file_path").equal(file_path)
            )
        except Exception as e:
            console.print(f"[yellow]Warning: Could not delete existing chunks: {e}[/yellow]")

    async def delete_by_file_hash(self, file_hash: str):
        """Delete all chunks with a specific file hash."""
        try:
            from weaviate.classes.query import Filter

            collection = self._client.collections.get(self.COLLECTION_NAME)
            collection.data.delete_many(
                where=Filter.by_property("file_hash").equal(file_hash)
            )
        except Exception as e:
            console.print(f"[yellow]Warning: Could not delete by hash: {e}[/yellow]")

    async def search(
        self,
        query_vector: List[float],
        limit: int = 10,
        file_extension: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Search for similar chunks."""
        from weaviate.classes.query import Filter, MetadataQuery

        collection = self._client.collections.get(self.COLLECTION_NAME)

        filters = None
        if file_extension:
            filters = Filter.by_property("file_extension").equal(file_extension)

        results = collection.query.near_vector(
            near_vector=query_vector,
            limit=limit,
            filters=filters,
            return_metadata=MetadataQuery(distance=True)
        )

        return [
            {
                "file_path": obj.properties["file_path"],
                "file_name": obj.properties["file_name"],
                "chunk_text": obj.properties["chunk_text"],
                "chunk_index": obj.properties["chunk_index"],
                "distance": obj.metadata.distance,
            }
            for obj in results.objects
        ]

    async def get_stats(self) -> Dict[str, Any]:
        """Get collection statistics."""
        try:
            collection = self._client.collections.get(self.COLLECTION_NAME)
            aggregate = collection.aggregate.over_all(total_count=True)

            return {
                "total_chunks": aggregate.total_count,
                "collection": self.COLLECTION_NAME,
            }
        except Exception as e:
            return {"error": str(e)}

    async def close(self):
        """Close the Weaviate connection."""
        if self._client:
            self._client.close()
            console.print("[cyan]Weaviate connection closed[/cyan]")
