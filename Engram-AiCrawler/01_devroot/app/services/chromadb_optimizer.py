"""ChromaDB Optimizer — Phase 6.4.

Extends the existing ChromaDB client with:
  - Batch embedding ingestion with configurable batch size
  - Collection pruning (remove stale/orphaned documents)
  - Index health check (document count, embedding dimensions)
  - Deduplication within collections (by content hash)
  - OSINT-specific collection naming conventions
  - Collection stats aggregation
"""

from __future__ import annotations

import hashlib
import logging
import os
from typing import Any

logger = logging.getLogger(__name__)

# Default batch sizes from env (mirrors CHROMADB_EMBEDDING_BATCH_SIZE)
DEFAULT_BATCH_SIZE = int(os.getenv("CHROMADB_EMBEDDING_BATCH_SIZE", "32"))
SIMILARITY_THRESHOLD = float(os.getenv("CHROMADB_SIMILARITY_THRESHOLD", "0.75"))
COLLECTION_PREFIX = os.getenv("CHROMADB_COLLECTION_PREFIX", "scan_")


# ---------------------------------------------------------------------------
# OSINT collection naming
# ---------------------------------------------------------------------------


class OsintCollectionNames:
    """Canonical ChromaDB collection names for OSINT data."""

    @staticmethod
    def entity(entity_id: str) -> str:
        return f"entity_{entity_id}"

    @staticmethod
    def scan(scan_id: str) -> str:
        return f"scan_{scan_id}"

    @staticmethod
    def case(case_id: str) -> str:
        return f"case_{case_id}"

    @staticmethod
    def platform(platform_name: str) -> str:
        return f"platform_{platform_name.lower()}"

    GLOBAL_ENTITIES = "osint_entities"
    GLOBAL_EVIDENCE = "osint_evidence"
    GLOBAL_FRAUD = "osint_fraud_signals"


# ---------------------------------------------------------------------------
# Batch ingestion helper
# ---------------------------------------------------------------------------


def _chunk_list(lst: list[Any], size: int) -> list[list[Any]]:
    return [lst[i : i + size] for i in range(0, len(lst), size)]


def _content_hash(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()[:32]


class BatchIngestor:
    """Batch-aware document ingestion for ChromaDB.

    Splits large document sets into batches to avoid memory spikes
    and ChromaDB's internal limits.
    """

    def __init__(
        self,
        chroma_client=None,
        batch_size: int = DEFAULT_BATCH_SIZE,
    ) -> None:
        self._client = chroma_client
        self.batch_size = batch_size

    def _get_client(self):
        if self._client is not None:
            return self._client
        try:
            from app.storage.chromadb_client import get_chromadb_client

            self._client = get_chromadb_client()
            return self._client
        except Exception as exc:
            logger.warning("ChromaDB unavailable: %s", exc)
            return None

    def ingest_batch(
        self,
        collection_name: str,
        documents: list[str],
        metadatas: list[dict[str, Any]] | None = None,
        ids: list[str] | None = None,
        deduplicate: bool = True,
    ) -> dict[str, Any]:
        """Ingest documents in batches. Returns ingestion stats."""
        client = self._get_client()
        if client is None:
            return {"error": "ChromaDB unavailable", "added": 0, "skipped": 0}

        if deduplicate:
            documents, metadatas, ids = self._deduplicate(
                collection_name, documents, metadatas, ids, client
            )

        if not documents:
            return {"added": 0, "skipped": 0, "batches": 0}

        # Auto-generate IDs if not provided
        if ids is None:
            ids = [_content_hash(doc) for doc in documents]

        # Align metadatas length
        if metadatas is None:
            metadatas = [{}] * len(documents)

        doc_batches = _chunk_list(documents, self.batch_size)
        meta_batches = _chunk_list(metadatas, self.batch_size)
        id_batches = _chunk_list(ids, self.batch_size)

        total_added = 0
        total_batches = len(doc_batches)

        for i, (docs, metas, batch_ids) in enumerate(zip(doc_batches, meta_batches, id_batches)):
            try:
                added_ids = client.add_documents(
                    collection_name=collection_name,
                    documents=docs,
                    metadatas=metas,
                    ids=batch_ids,
                )
                total_added += len(added_ids)
                logger.debug(
                    "Batch %d/%d: added %d docs to %s",
                    i + 1,
                    total_batches,
                    len(added_ids),
                    collection_name,
                )
            except Exception as exc:
                logger.warning("Batch %d failed for %s: %s", i + 1, collection_name, exc)

        return {
            "added": total_added,
            "skipped": len(documents) - total_added,
            "batches": total_batches,
            "collection": collection_name,
        }

    def _deduplicate(
        self,
        collection_name: str,
        documents: list[str],
        metadatas: list[dict[str, Any]] | None,
        ids: list[str] | None,
        client,
    ) -> tuple[list[str], list[dict[str, Any]] | None, list[str] | None]:
        """Remove documents already present in the collection (by content hash)."""
        try:
            collection = client.get_or_create_collection(collection_name)
            existing_ids = set(collection.get(include=[])["ids"])
        except Exception:
            existing_ids = set()

        filtered_docs = []
        filtered_metas = []
        filtered_ids = []

        for i, doc in enumerate(documents):
            doc_id = ids[i] if ids else _content_hash(doc)
            if doc_id not in existing_ids:
                filtered_docs.append(doc)
                filtered_metas.append(metadatas[i] if metadatas else {})
                filtered_ids.append(doc_id)

        skipped = len(documents) - len(filtered_docs)
        if skipped > 0:
            logger.debug("Dedup: skipped %d already-present documents", skipped)

        return (
            filtered_docs,
            filtered_metas if filtered_metas else None,
            filtered_ids if filtered_ids else None,
        )


# ---------------------------------------------------------------------------
# Collection optimizer
# ---------------------------------------------------------------------------


class CollectionOptimizer:
    """Utilities for pruning, health checking, and maintaining ChromaDB collections."""

    def __init__(self, chroma_client=None) -> None:
        self._client = chroma_client

    def _get_client(self):
        if self._client is not None:
            return self._client
        try:
            from app.storage.chromadb_client import get_chromadb_client

            self._client = get_chromadb_client()
            return self._client
        except Exception as exc:
            logger.warning("ChromaDB unavailable: %s", exc)
            return None

    def collection_stats(self, collection_name: str | None = None) -> dict[str, Any]:
        """Return stats for one or all collections."""
        client = self._get_client()
        if client is None:
            return {"error": "ChromaDB unavailable"}

        try:
            if collection_name:
                names = [collection_name]
            else:
                names = client.list_collections()

            stats = {}
            total_docs = 0
            for name in names:
                try:
                    collection = client.get_or_create_collection(name)
                    count = collection.count()
                    total_docs += count
                    stats[name] = {
                        "document_count": count,
                        "name": name,
                    }
                except Exception as exc:
                    stats[name] = {"error": str(exc)}

            return {
                "collections": stats,
                "total_collections": len(names),
                "total_documents": total_docs,
            }
        except Exception as exc:
            return {"error": str(exc)}

    def prune_collection(
        self,
        collection_name: str,
        max_documents: int = 10000,
        keep_recent: bool = True,
    ) -> dict[str, Any]:
        """Remove oldest documents when collection exceeds max_documents.

        Uses metadata 'added_at' field if present, otherwise removes
        documents from the beginning of the collection.
        """
        client = self._get_client()
        if client is None:
            return {"error": "ChromaDB unavailable", "pruned": 0}

        try:
            collection = client.get_or_create_collection(collection_name)
            count = collection.count()

            if count <= max_documents:
                return {"pruned": 0, "remaining": count, "collection": collection_name}

            excess = count - max_documents
            # Get all IDs with metadata
            all_data = collection.get(include=["metadatas"])
            ids = all_data["ids"]
            metas = all_data.get("metadatas") or [{}] * len(ids)

            # Sort by added_at if available
            id_meta_pairs = list(zip(ids, metas))
            if keep_recent:
                id_meta_pairs.sort(key=lambda x: x[1].get("added_at", "") if x[1] else "")

            ids_to_delete = [pair[0] for pair in id_meta_pairs[:excess]]
            collection.delete(ids=ids_to_delete)

            logger.info(
                "Pruned %d documents from %s (was %d, now %d)",
                len(ids_to_delete),
                collection_name,
                count,
                count - len(ids_to_delete),
            )
            return {
                "pruned": len(ids_to_delete),
                "remaining": count - len(ids_to_delete),
                "collection": collection_name,
            }
        except Exception as exc:
            logger.error("Prune failed for %s: %s", collection_name, exc)
            return {"error": str(exc), "pruned": 0}

    def delete_orphaned_collections(self, active_ids: set) -> list[str]:
        """Delete collections whose scan/entity ID is not in active_ids.

        Matches collections named like 'scan_{id}' or 'entity_{id}'.
        """
        client = self._get_client()
        if client is None:
            return []

        deleted = []
        try:
            for name in client.list_collections():
                # Extract ID from name
                for prefix in ("scan_", "entity_", "case_"):
                    if name.startswith(prefix):
                        artifact_id = name[len(prefix) :]
                        if artifact_id not in active_ids:
                            try:
                                client.delete_collection(name)
                                deleted.append(name)
                                logger.info("Deleted orphaned collection: %s", name)
                            except Exception as exc:
                                logger.warning("Failed to delete collection %s: %s", name, exc)
                        break
        except Exception as exc:
            logger.error("Error listing collections: %s", exc)

        return deleted

    def health_check(self) -> dict[str, Any]:
        """Return ChromaDB health status."""
        client = self._get_client()
        if client is None:
            return {"status": "unavailable", "error": "ChromaDB client not initialized"}

        try:
            collections = client.list_collections()
            total_docs = 0
            for name in collections:
                try:
                    col = client.get_or_create_collection(name)
                    total_docs += col.count()
                except Exception:
                    pass

            return {
                "status": "healthy",
                "collection_count": len(collections),
                "total_documents": total_docs,
                "chroma_path": os.getenv("CHROMADB_PATH", "/app/data/chroma"),
                "batch_size": DEFAULT_BATCH_SIZE,
                "similarity_threshold": SIMILARITY_THRESHOLD,
            }
        except Exception as exc:
            return {"status": "error", "error": str(exc)}


# ---------------------------------------------------------------------------
# Singletons
# ---------------------------------------------------------------------------

_ingestor: BatchIngestor | None = None
_optimizer: CollectionOptimizer | None = None


def get_batch_ingestor() -> BatchIngestor:
    global _ingestor
    if _ingestor is None:
        _ingestor = BatchIngestor()
    return _ingestor


def get_collection_optimizer() -> CollectionOptimizer:
    global _optimizer
    if _optimizer is None:
        _optimizer = CollectionOptimizer()
    return _optimizer
