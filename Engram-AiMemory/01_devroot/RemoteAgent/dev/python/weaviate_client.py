"""
Weaviate Client - Handles connection and operations to remote Weaviate instance
"""
import os
from typing import Optional
from dataclasses import dataclass
from datetime import datetime
import weaviate
from weaviate.classes.init import Auth
from weaviate.classes.config import Configure, Property, DataType
from dotenv import load_dotenv
from rich.console import Console

load_dotenv()
console = Console()


# Collection schema for document chunks
DOCUMENT_CHUNKS_SCHEMA = {
    "name": "DocumentChunk",
    "description": "Chunks of documents with embeddings for semantic search",
    "properties": [
        Property(name="content", data_type=DataType.TEXT, description="The text content of the chunk"),
        Property(name="file_path", data_type=DataType.TEXT, description="Full path to the source file"),
        Property(name="file_name", data_type=DataType.TEXT, description="Name of the source file"),
        Property(name="file_type", data_type=DataType.TEXT, description="Type of file (code, markdown, document, etc)"),
        Property(name="file_hash", data_type=DataType.TEXT, description="Hash of the source file content"),
        Property(name="chunk_index", data_type=DataType.INT, description="Index of this chunk within the document"),
        Property(name="total_chunks", data_type=DataType.INT, description="Total number of chunks in the document"),
        Property(name="indexed_at", data_type=DataType.DATE, description="When this chunk was indexed"),
        Property(name="source_machine", data_type=DataType.TEXT, description="Hostname of the machine that indexed this"),
    ]
}


@dataclass
class WeaviateConfig:
    """Configuration for Weaviate connection"""
    host: str
    http_port: int = 8080
    grpc_port: int = 50051
    api_key: Optional[str] = None
    
    @property
    def http_url(self) -> str:
        return f"http://{self.host}:{self.http_port}"
    
    @classmethod
    def from_env(cls) -> "WeaviateConfig":
        return cls(
            host=os.getenv("WEAVIATE_HOST", "localhost"),
            http_port=int(os.getenv("WEAVIATE_PORT", "8080")),
            grpc_port=int(os.getenv("WEAVIATE_GRPC_PORT", "50051")),
            api_key=os.getenv("WEAVIATE_API_KEY"),
        )


class WeaviateClient:
    """Client for interacting with remote Weaviate instance"""
    
    def __init__(self, config: WeaviateConfig = None):
        self.config = config or WeaviateConfig.from_env()
        self._client: Optional[weaviate.WeaviateClient] = None
        self._hostname = os.uname().nodename
        
    def connect(self) -> bool:
        """Establish connection to Weaviate"""
        try:
            # Connect with custom host/ports (for Tailscale)
            self._client = weaviate.connect_to_custom(
                http_host=self.config.host,
                http_port=self.config.http_port,
                http_secure=False,
                grpc_host=self.config.host,
                grpc_port=self.config.grpc_port,
                grpc_secure=False,
                auth_credentials=Auth.api_key(self.config.api_key) if self.config.api_key else None,
            )
            
            # Verify connection
            if self._client.is_ready():
                console.print(f"[green]✓[/green] Connected to Weaviate at {self.config.host}")
                return True
            else:
                console.print(f"[red]✗[/red] Weaviate not ready at {self.config.host}")
                return False
                
        except Exception as e:
            console.print(f"[red]✗[/red] Failed to connect to Weaviate: {e}")
            return False
    
    def disconnect(self):
        """Close connection"""
        if self._client:
            self._client.close()
            self._client = None
    
    def ensure_collection(self, collection_name: str = "DocumentChunk") -> bool:
        """Ensure the collection exists with proper schema"""
        if not self._client:
            console.print("[red]✗[/red] Not connected to Weaviate")
            return False
        
        try:
            collections = self._client.collections
            
            if collections.exists(collection_name):
                console.print(f"[blue]ℹ[/blue] Collection '{collection_name}' already exists")
                return True
            
            # Create collection with schema
            # Using 'none' vectorizer since we provide our own embeddings
            collections.create(
                name=collection_name,
                description=DOCUMENT_CHUNKS_SCHEMA["description"],
                properties=DOCUMENT_CHUNKS_SCHEMA["properties"],
                vectorizer_config=Configure.Vectorizer.none(),  # We provide vectors
            )
            
            console.print(f"[green]✓[/green] Created collection '{collection_name}'")
            return True
            
        except Exception as e:
            console.print(f"[red]✗[/red] Failed to ensure collection: {e}")
            return False
    
    def insert_chunk(
        self,
        content: str,
        embedding: list[float],
        file_path: str,
        file_name: str,
        file_type: str,
        file_hash: str,
        chunk_index: int,
        total_chunks: int,
        collection_name: str = "DocumentChunk"
    ) -> Optional[str]:
        """Insert a single document chunk with its embedding"""
        if not self._client:
            console.print("[red]✗[/red] Not connected to Weaviate")
            return None
        
        try:
            collection = self._client.collections.get(collection_name)
            
            uuid = collection.data.insert(
                properties={
                    "content": content,
                    "file_path": file_path,
                    "file_name": file_name,
                    "file_type": file_type,
                    "file_hash": file_hash,
                    "chunk_index": chunk_index,
                    "total_chunks": total_chunks,
                    "indexed_at": datetime.utcnow().isoformat(),
                    "source_machine": self._hostname,
                },
                vector=embedding
            )
            
            return str(uuid)
            
        except Exception as e:
            console.print(f"[red]✗[/red] Failed to insert chunk: {e}")
            return None
    
    def insert_batch(
        self,
        chunks: list[dict],
        collection_name: str = "DocumentChunk"
    ) -> tuple[int, int]:
        """
        Insert multiple chunks in batch.
        Each chunk dict should have: content, embedding, file_path, file_name, 
        file_type, file_hash, chunk_index, total_chunks
        
        Returns (success_count, error_count)
        """
        if not self._client:
            console.print("[red]✗[/red] Not connected to Weaviate")
            return 0, len(chunks)
        
        try:
            collection = self._client.collections.get(collection_name)
            
            with collection.batch.dynamic() as batch:
                for chunk in chunks:
                    batch.add_object(
                        properties={
                            "content": chunk["content"],
                            "file_path": chunk["file_path"],
                            "file_name": chunk["file_name"],
                            "file_type": chunk["file_type"],
                            "file_hash": chunk["file_hash"],
                            "chunk_index": chunk["chunk_index"],
                            "total_chunks": chunk["total_chunks"],
                            "indexed_at": datetime.utcnow().isoformat(),
                            "source_machine": self._hostname,
                        },
                        vector=chunk["embedding"]
                    )
            
            # Get batch results
            success = batch.number_errors == 0
            if success:
                console.print(f"[green]✓[/green] Inserted {len(chunks)} chunks")
                return len(chunks), 0
            else:
                console.print(f"[yellow]![/yellow] Batch had {batch.number_errors} errors")
                return len(chunks) - batch.number_errors, batch.number_errors
                
        except Exception as e:
            console.print(f"[red]✗[/red] Batch insert failed: {e}")
            return 0, len(chunks)
    
    def delete_by_file_hash(
        self,
        file_hash: str,
        collection_name: str = "DocumentChunk"
    ) -> int:
        """Delete all chunks for a given file hash (before re-indexing)"""
        if not self._client:
            return 0
        
        try:
            collection = self._client.collections.get(collection_name)
            
            result = collection.data.delete_many(
                where=weaviate.classes.query.Filter.by_property("file_hash").equal(file_hash)
            )
            
            return result.successful if hasattr(result, 'successful') else 0
            
        except Exception as e:
            console.print(f"[red]✗[/red] Delete failed: {e}")
            return 0
    
    def search(
        self,
        query_embedding: list[float],
        limit: int = 10,
        collection_name: str = "DocumentChunk"
    ) -> list[dict]:
        """Search for similar chunks by embedding"""
        if not self._client:
            return []
        
        try:
            collection = self._client.collections.get(collection_name)
            
            results = collection.query.near_vector(
                near_vector=query_embedding,
                limit=limit,
                return_metadata=["distance"]
            )
            
            return [
                {
                    "content": obj.properties.get("content"),
                    "file_path": obj.properties.get("file_path"),
                    "file_name": obj.properties.get("file_name"),
                    "file_type": obj.properties.get("file_type"),
                    "chunk_index": obj.properties.get("chunk_index"),
                    "distance": obj.metadata.distance if obj.metadata else None,
                }
                for obj in results.objects
            ]
            
        except Exception as e:
            console.print(f"[red]✗[/red] Search failed: {e}")
            return []
    
    def get_stats(self, collection_name: str = "DocumentChunk") -> dict:
        """Get collection statistics"""
        if not self._client:
            return {}
        
        try:
            collection = self._client.collections.get(collection_name)
            aggregate = collection.aggregate.over_all(total_count=True)
            
            return {
                "total_chunks": aggregate.total_count,
                "collection": collection_name,
            }
            
        except Exception as e:
            console.print(f"[red]✗[/red] Failed to get stats: {e}")
            return {}


# Quick test
def test_client():
    client = WeaviateClient()
    
    if client.connect():
        client.ensure_collection()
        stats = client.get_stats()
        console.print(f"[blue]Stats:[/blue] {stats}")
        client.disconnect()


if __name__ == "__main__":
    test_client()
