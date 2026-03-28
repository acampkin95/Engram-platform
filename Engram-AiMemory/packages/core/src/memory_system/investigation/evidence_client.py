"""Evidence document client — chunking, ingestion, and semantic search."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime
from uuid import uuid4

from rich.console import Console

from memory_system.compat import UTC
from memory_system.config import EVIDENCE_DOCUMENT
from memory_system.investigation.models import (
    EvidenceIngest,
    EvidenceResponse,
    SearchRequest,
    SearchResponse,
    SourceType,
)

console = Console()


class EvidenceClient:
    """EvidenceDocument ingest, chunk, embed, and search."""

    CHUNK_SIZE = 1000  # approximate tokens (chars / 4)
    CHUNK_OVERLAP = 100  # approximate tokens overlap

    def __init__(self, weaviate_client, matter_client):
        """
        Args:
            weaviate_client: Connected Weaviate client instance
            matter_client: MatterClient instance for ensure_tenant_active calls
        """
        self._client = weaviate_client
        self._matter_client = matter_client

    async def ingest_document(self, ingest: EvidenceIngest) -> list[EvidenceResponse]:
        """Chunk content, batch-insert into EvidenceDocument for matter tenant.

        Returns list of EvidenceResponse for each chunk inserted.
        Skips if document_hash already exists in this matter.
        """
        self._matter_client.ensure_tenant_active(ingest.matter_id, EVIDENCE_DOCUMENT)

        # Compute document hash for deduplication
        document_hash = hashlib.sha256(ingest.content.encode()).hexdigest()

        # Check for duplicate
        if await self._document_exists(ingest.matter_id, document_hash):
            console.print(
                f"[yellow]Skipping duplicate document {document_hash[:8]} in matter {ingest.matter_id}[/yellow]"
            )
            return []

        # Split content into chunks
        chunks = self._split_content(ingest.content)
        total_chunks = len(chunks)

        # Batch insert
        collection = self._client.collections.get(EVIDENCE_DOCUMENT)
        now = datetime.now(UTC)
        responses = []

        for chunk_index, chunk_text in enumerate(chunks):
            weaviate_id = str(uuid4())
            props = {
                "matter_id": ingest.matter_id,
                "source_url": ingest.source_url,
                "source_type": ingest.source_type.value
                if hasattr(ingest.source_type, "value")
                else ingest.source_type,
                "content": chunk_text,
                "chunk_index": chunk_index,
                "total_chunks": total_chunks,
                "document_hash": document_hash,
                "ingested_at": now.isoformat(),
                "metadata": json.dumps(ingest.metadata),
                "page_number": ingest.page_number,
                "message_id": ingest.message_id,
            }
            try:
                collection.with_tenant(ingest.matter_id).data.insert(
                    uuid=weaviate_id,
                    properties=props,
                )
                responses.append(
                    EvidenceResponse(
                        id=weaviate_id,
                        matter_id=ingest.matter_id,
                        source_url=ingest.source_url,
                        source_type=ingest.source_type,
                        chunk_index=chunk_index,
                        ingested_at=now,
                    )
                )
            except Exception as exc:
                console.print(f"[red]Failed to insert chunk {chunk_index}: {exc}[/red]")

        console.print(
            f"[green]Ingested {len(responses)}/{total_chunks} chunks for matter {ingest.matter_id}[/green]"
        )
        return responses

    async def search_evidence(self, search: SearchRequest) -> SearchResponse:
        """Semantic search within a matter's EvidenceDocument tenant."""
        self._matter_client.ensure_tenant_active(search.matter_id, EVIDENCE_DOCUMENT)

        collection = self._client.collections.get(EVIDENCE_DOCUMENT)

        try:
            from weaviate.classes.query import Filter

            filters = None
            if search.source_types:
                source_values = [
                    st.value if hasattr(st, "value") else st for st in search.source_types
                ]
                # Filter for any of the source types
                if len(source_values) == 1:
                    filters = Filter.by_property("source_type").equal(source_values[0])
                else:
                    filters = Filter.any_of(
                        [Filter.by_property("source_type").equal(v) for v in source_values]
                    )

            results = collection.with_tenant(search.matter_id).query.near_text(
                query=search.query,
                limit=search.limit + search.offset,
                filters=filters,
            )

            result_dicts = []
            for obj in results.objects:
                props = obj.properties
                result_dicts.append(
                    {
                        "id": str(obj.uuid),
                        "matter_id": props.get("matter_id", ""),
                        "source_url": props.get("source_url", ""),
                        "source_type": props.get("source_type", ""),
                        "content": props.get("content", ""),
                        "chunk_index": props.get("chunk_index", 0),
                        "document_hash": props.get("document_hash", ""),
                        "ingested_at": str(props.get("ingested_at", "")),
                    }
                )

            paged_results = result_dicts[search.offset : search.offset + search.limit]

            return SearchResponse(
                results=paged_results,
                total=len(result_dicts),
                query=search.query,
                matter_id=search.matter_id,
                limit=search.limit,
                offset=search.offset,
            )
        except Exception as exc:
            console.print(f"[red]search_evidence failed: {exc}[/red]")
            return SearchResponse(
                results=[],
                total=0,
                query=search.query,
                matter_id=search.matter_id,
                limit=search.limit,
                offset=search.offset,
            )

    async def get_document_chunks(
        self, matter_id: str, document_hash: str
    ) -> list[EvidenceResponse]:
        """Get all chunks for a document by hash."""
        from weaviate.classes.query import Filter

        self._matter_client.ensure_tenant_active(matter_id, EVIDENCE_DOCUMENT)
        collection = self._client.collections.get(EVIDENCE_DOCUMENT)
        try:
            results = collection.with_tenant(matter_id).query.fetch_objects(
                filters=Filter.by_property("document_hash").equal(document_hash),
                limit=10000,
            )
            responses = []
            for obj in results.objects:
                props = obj.properties
                responses.append(
                    EvidenceResponse(
                        id=str(obj.uuid),
                        matter_id=matter_id,
                        source_url=props.get("source_url", ""),
                        source_type=SourceType(props.get("source_type", "MANUAL")),
                        chunk_index=props.get("chunk_index", 0),
                        ingested_at=props.get("ingested_at") or datetime.now(UTC),
                    )
                )
            return responses
        except Exception as exc:
            console.print(f"[red]get_document_chunks failed: {exc}[/red]")
            return []

    async def delete_document(self, matter_id: str, document_hash: str) -> int:
        """Delete all chunks for a document. Returns count deleted."""
        from weaviate.classes.query import Filter

        self._matter_client.ensure_tenant_active(matter_id, EVIDENCE_DOCUMENT)
        collection = self._client.collections.get(EVIDENCE_DOCUMENT)
        try:
            results = collection.with_tenant(matter_id).query.fetch_objects(
                filters=Filter.by_property("document_hash").equal(document_hash),
                limit=10000,
            )
            count = 0
            for obj in results.objects:
                try:
                    collection.with_tenant(matter_id).data.delete_by_id(str(obj.uuid))
                    count += 1
                except Exception as exc:
                    console.print(f"[red]Failed to delete chunk {obj.uuid}: {exc}[/red]")
            return count
        except Exception as exc:
            console.print(f"[red]delete_document failed: {exc}[/red]")
            return 0

    def _split_content(self, content: str) -> list[str]:
        """Split content into overlapping chunks using sliding window on whitespace.

        Uses RecursiveCharacterTextSplitter if langchain available, else manual split.
        Chunk size: CHUNK_SIZE * 4 chars (approx tokens). Overlap: CHUNK_OVERLAP * 4 chars.
        """
        char_size = self.CHUNK_SIZE * 4
        char_overlap = self.CHUNK_OVERLAP * 4

        try:
            from langchain_text_splitters import RecursiveCharacterTextSplitter

            splitter = RecursiveCharacterTextSplitter(
                chunk_size=char_size,
                chunk_overlap=char_overlap,
                length_function=len,
            )
            return splitter.split_text(content)
        except ImportError:
            pass

        # Manual sliding window split
        if len(content) <= char_size:
            return [content]

        chunks = []
        start = 0
        while start < len(content):
            end = start + char_size
            chunk = content[start:end]
            # Try to break on whitespace
            if end < len(content):
                last_space = chunk.rfind(" ")
                if last_space > char_size // 2:
                    chunk = chunk[:last_space]
                    end = start + last_space
            chunks.append(chunk)
            start = end - char_overlap
            if start >= len(content):
                break
        return chunks

    async def _document_exists(self, matter_id: str, document_hash: str) -> bool:
        """Check if document with this hash already exists in the matter."""
        from weaviate.classes.query import Filter

        try:
            collection = self._client.collections.get(EVIDENCE_DOCUMENT)
            results = collection.with_tenant(matter_id).query.fetch_objects(
                filters=Filter.by_property("document_hash").equal(document_hash),
                limit=1,
            )
            return len(results.objects) > 0
        except Exception as exc:
            console.print(f"[red]_document_exists check failed: {exc}[/red]")
            return False
