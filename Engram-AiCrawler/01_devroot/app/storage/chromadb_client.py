"""ChromaDB vector store client for document storage and semantic search."""

from __future__ import annotations
import logging
import os
import uuid as _uuid
from typing import Any

import chromadb

from app.core.exceptions import StorageError

logger = logging.getLogger(__name__)

_client: ChromaDBClient | None = None


class ChromaDBClient:
    """Persistent ChromaDB client for OSINT document storage."""

    def __init__(
        self,
        path: str = "/app/data/chroma",
        collection_prefix: str = "scan_",
    ) -> None:
        self.path = path
        self.collection_prefix = collection_prefix
        try:
            self._client = chromadb.PersistentClient(path=path)
            logger.info(f"ChromaDB client initialized at {path}")
        except Exception as e:
            raise StorageError(f"Failed to initialize ChromaDB: {e}")

    def _prefixed(self, name: str) -> str:
        if name.startswith(self.collection_prefix):
            return name
        return f"{self.collection_prefix}{name}"

    def get_or_create_collection(self, name: str) -> chromadb.Collection:
        try:
            return self._client.get_or_create_collection(name=self._prefixed(name))
        except Exception as e:
            raise StorageError(f"Failed to get/create collection '{name}': {e}")

    def delete_collection(self, name: str) -> bool:
        try:
            self._client.delete_collection(name=self._prefixed(name))
            logger.info(f"Deleted collection: {self._prefixed(name)}")
            return True
        except Exception as e:
            raise StorageError(f"Failed to delete collection '{name}': {e}")

    def list_collections(self) -> list[str]:
        try:
            collections = self._client.list_collections()
            return [c.name for c in collections]
        except Exception as e:
            raise StorageError(f"Failed to list collections: {e}")

    def add_documents(
        self,
        collection_name: str,
        documents: list[str],
        metadatas: list[dict] | None = None,
        ids: list[str] | None = None,
    ) -> list[str]:
        try:
            collection = self.get_or_create_collection(collection_name)
            if ids is None:
                ids = [str(_uuid.uuid4()) for _ in documents]
            kwargs: dict[str, Any] = {
                "documents": documents,
                "ids": ids,
            }
            if metadatas is not None:
                kwargs["metadatas"] = metadatas
            collection.add(**kwargs)
            logger.info(f"Added {len(documents)} documents to {self._prefixed(collection_name)}")
            return ids
        except StorageError:
            raise
        except Exception as e:
            raise StorageError(f"Failed to add documents: {e}")

    def search(
        self,
        collection_name: str,
        query_texts: list[str],
        n_results: int = 10,
        where: dict | None = None,
    ) -> Any:
        try:
            collection = self.get_or_create_collection(collection_name)
            kwargs: dict[str, Any] = {
                "query_texts": query_texts,
                "n_results": n_results,
            }
            if where is not None:
                kwargs["where"] = where
            results = collection.query(**kwargs)
            return results
        except StorageError:
            raise
        except Exception as e:
            raise StorageError(f"Failed to search collection: {e}")

    def get_documents(
        self,
        collection_name: str,
        ids: list[str] | None = None,
        where: dict | None = None,
    ) -> Any:
        try:
            collection = self.get_or_create_collection(collection_name)
            kwargs: dict[str, Any] = {}
            if ids is not None:
                kwargs["ids"] = ids
            if where is not None:
                kwargs["where"] = where
            return collection.get(**kwargs)
        except StorageError:
            raise
        except Exception as e:
            raise StorageError(f"Failed to get documents: {e}")

    def delete_documents(
        self,
        collection_name: str,
        ids: list[str],
    ) -> None:
        try:
            collection = self.get_or_create_collection(collection_name)
            collection.delete(ids=ids)
            logger.info(f"Deleted {len(ids)} documents from {self._prefixed(collection_name)}")
        except StorageError:
            raise
        except Exception as e:
            raise StorageError(f"Failed to delete documents: {e}")

    def count(self, collection_name: str) -> int:
        try:
            collection = self.get_or_create_collection(collection_name)
            return collection.count()
        except StorageError:
            raise
        except Exception as e:
            raise StorageError(f"Failed to count documents: {e}")


def get_chromadb_client() -> ChromaDBClient:
    """Get or create the singleton ChromaDB client."""
    global _client
    if _client is None:
        path = os.getenv("CHROMADB_PATH", "/app/data/chroma")
        prefix = os.getenv("CHROMADB_COLLECTION_PREFIX", "scan_")
        _client = ChromaDBClient(path=path, collection_prefix=prefix)
    return _client


def close_chromadb() -> None:
    """Release the singleton client."""
    global _client
    _client = None
    logger.info("ChromaDB client released")
