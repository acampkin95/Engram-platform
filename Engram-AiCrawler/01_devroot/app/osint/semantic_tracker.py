"""Semantic tracker — builds knowledge graph relationships from OSINT data via LM Studio."""

from __future__ import annotations
import json
import logging
from datetime import datetime
from app._compat import UTC
from typing import Any

from pydantic import BaseModel, Field

from app.services.lm_studio_bridge import LMStudioBridge
from app.storage.chromadb_client import ChromaDBClient, get_chromadb_client

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------


class Entity(BaseModel):
    """A node in the knowledge graph."""

    id: str
    name: str
    entity_type: str  # person, organisation, platform, url, email, username
    attributes: dict[str, Any] = Field(default_factory=dict)


class Relationship(BaseModel):
    """An edge in the knowledge graph."""

    source_id: str
    target_id: str
    relation_type: str  # alias_of, member_of, owns, associated_with, linked_to
    confidence: float = Field(ge=0.0, le=1.0)
    evidence: str = ""


class KnowledgeGraph(BaseModel):
    """A collection of entities and relationships for a scan."""

    scan_id: str
    entities: list[Entity]
    relationships: list[Relationship]
    created_at: str
    updated_at: str


# ---------------------------------------------------------------------------
# Prompt
# ---------------------------------------------------------------------------

RELATIONSHIP_PROMPT = """You are an OSINT intelligence analyst. Given the following crawl results from a scan, identify entities and relationships.

Scan ID: {scan_id}
Context: {context}

Crawl data:
---
{data_snippet}
---

Extract entities and relationships. Return ONLY valid JSON:
{{
    "entities": [
        {{"id": "<unique_id>", "name": "<name>", "entity_type": "<person|organisation|platform|url|email|username>", "attributes": {{}}}}
    ],
    "relationships": [
        {{"source_id": "<entity_id>", "target_id": "<entity_id>", "relation_type": "<alias_of|member_of|owns|associated_with|linked_to>", "confidence": <0.0-1.0>, "evidence": "<brief reason>"}}
    ]
}}
"""


# ---------------------------------------------------------------------------
# Collection name helpers
# ---------------------------------------------------------------------------


def _rels_collection(scan_id: str) -> str:
    """Return the ChromaDB collection name for relationships of a given scan."""
    return f"kg_rels_{scan_id}"


def _entities_collection(scan_id: str) -> str:
    """Return the ChromaDB collection name for entities of a given scan."""
    return f"kg_{scan_id}"


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------


class SemanticTracker:
    """Builds and queries knowledge graphs backed by ChromaDB and LM Studio.

    Storage layout
    --------------
    Entities      → collection ``kg_{scan_id}``
                    Each document is the JSON-serialised Entity.
                    Metadata: ``entity_type``, ``name``, ``scan_id``.

    Relationships → collection ``kg_rels_{scan_id}``
                    Each document is the JSON-serialised Relationship.
                    Metadata: ``source_id``, ``target_id``, ``relation_type``,
                    ``scan_id``.
                    IDs are deterministic: ``{source_id}__{target_id}__{relation_type}``
                    so that re-running a build is idempotent.
    """

    def __init__(
        self,
        lm_bridge: LMStudioBridge,
        chromadb_client: ChromaDBClient | None = None,
    ) -> None:
        self.lm_bridge = lm_bridge
        self.chromadb = chromadb_client or get_chromadb_client()

    # -- Graph construction ------------------------------------------------

    async def build_graph(
        self,
        scan_id: str,
        crawl_results: list[dict[str, Any]],
        context: str = "",
    ) -> KnowledgeGraph:
        """Analyse crawl results with LM Studio and build a knowledge graph.

        Args:
            scan_id: Unique scan identifier.
            crawl_results: List of dicts with at least "url" and "markdown" keys.
            context: Search context / intent.

        Returns:
            KnowledgeGraph with entities and relationships.
        """
        # Prepare data snippet (truncated for token limits)
        snippets = []
        for cr in crawl_results[:10]:  # Cap at 10 results
            url = cr.get("url", "unknown")
            md = (cr.get("markdown") or "")[:500]
            snippets.append(f"URL: {url}\n{md}")
        data_snippet = "\n---\n".join(snippets)[:4000]

        prompt = RELATIONSHIP_PROMPT.format(
            scan_id=scan_id,
            context=context or "(general investigation)",
            data_snippet=data_snippet,
        )

        try:
            response = await self.lm_bridge._make_request_with_retry(
                "/chat/completions",
                messages=[
                    {
                        "role": "system",
                        "content": "You are an OSINT intelligence analyst. Respond with valid JSON only.",
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=0.3,
            )

            content = response.get("choices", [{}])[0].get("message", {}).get("content", "{}")
            parsed = json.loads(content)

            entities = [Entity(**e) for e in parsed.get("entities", [])]
            relationships = [Relationship(**r) for r in parsed.get("relationships", [])]

        except Exception as e:
            logger.error(f"Failed to build graph for scan {scan_id}: {e}")
            entities = []
            relationships = []

        now = datetime.now(UTC).isoformat()
        graph = KnowledgeGraph(
            scan_id=scan_id,
            entities=entities,
            relationships=relationships,
            created_at=now,
            updated_at=now,
        )

        # Persist both entities and relationships in ChromaDB
        await self._store_graph(graph)

        return graph

    async def _store_graph(self, graph: KnowledgeGraph) -> None:
        """Store graph entities and relationships in ChromaDB."""
        await self._store_entities(graph)
        await self._store_relationships(graph.scan_id, graph.relationships)

    async def _store_entities(self, graph: KnowledgeGraph) -> None:
        """Store entity documents in ChromaDB."""
        if not graph.entities:
            return

        collection_name = _entities_collection(graph.scan_id)
        documents = [json.dumps(e.model_dump(), default=str) for e in graph.entities]
        metadatas = [
            {
                "entity_type": e.entity_type,
                "name": e.name,
                "scan_id": graph.scan_id,
            }
            for e in graph.entities
        ]
        ids = [e.id for e in graph.entities]

        try:
            self.chromadb.add_documents(
                collection_name=collection_name,
                documents=documents,
                metadatas=metadatas,
                ids=ids,
            )
            logger.info(f"Stored {len(documents)} entities for scan {graph.scan_id}")
        except Exception as e:
            logger.error(f"Failed to store entities in ChromaDB: {e}")

    async def _store_relationships(
        self,
        scan_id: str,
        relationships: list[Relationship],
    ) -> None:
        """Store relationship documents in a dedicated ChromaDB collection.

        Collection: ``kg_rels_{scan_id}``

        Each relationship is stored as a JSON document with deterministic ID
        ``{source_id}__{target_id}__{relation_type}`` so that re-running a
        build does not create duplicate edges.
        """
        if not relationships:
            return

        collection_name = _rels_collection(scan_id)
        documents = [json.dumps(r.model_dump(), default=str) for r in relationships]
        metadatas = [
            {
                "source_id": r.source_id,
                "target_id": r.target_id,
                "relation_type": r.relation_type,
                "scan_id": scan_id,
            }
            for r in relationships
        ]
        # Deterministic IDs prevent duplicates across rebuilds
        ids = [f"{r.source_id}__{r.target_id}__{r.relation_type}" for r in relationships]

        try:
            self.chromadb.add_documents(
                collection_name=collection_name,
                documents=documents,
                metadatas=metadatas,
                ids=ids,
            )
            logger.info(f"Stored {len(documents)} relationships for scan {scan_id}")
        except Exception as e:
            logger.error(f"Failed to store relationships in ChromaDB: {e}")

    # -- Graph retrieval ---------------------------------------------------

    async def get_graph(self, scan_id: str) -> KnowledgeGraph | None:
        """Retrieve a stored knowledge graph by scan ID.

        Both entities and relationships are fetched from their respective
        ChromaDB collections (``kg_{scan_id}`` and ``kg_rels_{scan_id}``).
        """
        entities = await self._get_entities(scan_id)
        if entities is None:
            return None

        relationships = await self._get_relationships(scan_id)

        now = datetime.now(UTC).isoformat()
        return KnowledgeGraph(
            scan_id=scan_id,
            entities=entities,
            relationships=relationships,
            created_at=now,
            updated_at=now,
        )

    async def _get_entities(self, scan_id: str) -> list[Entity] | None:
        """Fetch all entity documents for *scan_id*. Returns None when absent."""
        collection_name = _entities_collection(scan_id)
        try:
            docs = self.chromadb.get_documents(collection_name=collection_name)
            if not docs or not docs.get("documents"):
                return None

            entities: list[Entity] = []
            for doc_str in docs["documents"]:
                try:
                    entities.append(Entity(**json.loads(doc_str)))
                except Exception:
                    continue
            return entities
        except Exception as e:
            logger.error(f"Failed to retrieve entities for {scan_id}: {e}")
            return None

    async def _get_relationships(self, scan_id: str) -> list[Relationship]:
        """Fetch all relationship documents for *scan_id*.

        Returns an empty list when the relationship collection does not exist
        or contains no documents (safe for older scans built before this fix).
        """
        collection_name = _rels_collection(scan_id)
        try:
            docs = self.chromadb.get_documents(collection_name=collection_name)
            if not docs or not docs.get("documents"):
                return []

            relationships: list[Relationship] = []
            for doc_str in docs["documents"]:
                try:
                    relationships.append(Relationship(**json.loads(doc_str)))
                except Exception:
                    continue
            return relationships
        except Exception as e:
            logger.error(f"Failed to retrieve relationships for {scan_id}: {e}")
            return []

    async def get_entity(self, scan_id: str, entity_id: str) -> Entity | None:
        """Fetch a single entity by ID."""
        collection_name = _entities_collection(scan_id)
        try:
            docs = self.chromadb.get_documents(
                collection_name=collection_name,
                ids=[entity_id],
            )
            raw_docs: list[str | None] = docs.get("documents") or []
            if not raw_docs or raw_docs[0] is None:
                return None
            return Entity(**json.loads(raw_docs[0]))
        except Exception as e:
            logger.error(f"Failed to fetch entity {entity_id} for {scan_id}: {e}")
            return None

    async def get_entity_relationships(
        self,
        scan_id: str,
        entity_id: str,
    ) -> list[Relationship]:
        """Return all relationships where *entity_id* is source OR target."""
        all_rels = await self._get_relationships(scan_id)
        return [r for r in all_rels if r.source_id == entity_id or r.target_id == entity_id]

    async def get_connected_entities(
        self,
        scan_id: str,
        entity_id: str,
        depth: int = 1,
    ) -> tuple[list[Entity], list[Relationship]]:
        """BFS expansion from *entity_id* up to *depth* hops.

        Returns:
            A tuple of (entities_reachable, relationships_traversed).
            The seed entity itself is included in the entities list.
        """
        all_rels = await self._get_relationships(scan_id)
        all_entities = await self._get_entities(scan_id) or []
        entity_map: dict[str, Entity] = {e.id: e for e in all_entities}

        visited_ids: set[str] = {entity_id}
        frontier: set[str] = {entity_id}
        collected_rels: list[Relationship] = []

        for _ in range(depth):
            next_frontier: set[str] = set()
            for rel in all_rels:
                if rel.source_id in frontier and rel.target_id not in visited_ids:
                    next_frontier.add(rel.target_id)
                    visited_ids.add(rel.target_id)
                    collected_rels.append(rel)
                elif rel.target_id in frontier and rel.source_id not in visited_ids:
                    next_frontier.add(rel.source_id)
                    visited_ids.add(rel.source_id)
                    collected_rels.append(rel)
                elif (
                    rel.source_id in visited_ids
                    and rel.target_id in visited_ids
                    and rel not in collected_rels
                ):
                    # Edge between two already-visited nodes also belongs in output
                    collected_rels.append(rel)
            frontier = next_frontier
            if not frontier:
                break

        reachable = [entity_map[eid] for eid in visited_ids if eid in entity_map]
        return reachable, collected_rels

    async def merge_entities(
        self,
        scan_id: str,
        source_id: str,
        target_id: str,
    ) -> bool:
        """Merge *source_id* into *target_id*.

        All relationships that reference *source_id* are rewritten to reference
        *target_id* instead, then the source entity document is deleted.

        Returns:
            True if the merge succeeded, False if either entity was not found.
        """
        source = await self.get_entity(scan_id, source_id)
        target = await self.get_entity(scan_id, target_id)
        if source is None or target is None:
            return False

        all_rels = await self._get_relationships(scan_id)
        rewritten: list[Relationship] = []
        unchanged: list[Relationship] = []
        for rel in all_rels:
            if rel.source_id == source_id or rel.target_id == source_id:
                rewritten.append(
                    Relationship(
                        source_id=(target_id if rel.source_id == source_id else rel.source_id),
                        target_id=(target_id if rel.target_id == source_id else rel.target_id),
                        relation_type=rel.relation_type,
                        confidence=rel.confidence,
                        evidence=rel.evidence,
                    )
                )
            else:
                unchanged.append(rel)

        # Rebuild relationship collection with merged edges
        try:
            rels_col = _rels_collection(scan_id)
            try:
                self.chromadb.delete_collection(rels_col)
            except Exception:
                pass  # Collection may not exist yet; that's fine
            merged_rels = unchanged + rewritten
            await self._store_relationships(scan_id, merged_rels)
        except Exception as e:
            logger.error(f"Failed to rewrite relationships during merge: {e}")
            return False

        # Delete the source entity document
        try:
            self.chromadb.delete_documents(
                collection_name=_entities_collection(scan_id),
                ids=[source_id],
            )
        except Exception as e:
            logger.error(f"Failed to delete source entity during merge: {e}")
            return False

        logger.info(f"Merged entity {source_id} → {target_id} in scan {scan_id}")
        return True

    # -- Semantic search ---------------------------------------------------

    async def search_entities(
        self,
        scan_id: str,
        query: str,
        n_results: int = 10,
        entity_type: str | None = None,
    ) -> list[Entity]:
        """Search entities in a knowledge graph by semantic similarity.

        Args:
            scan_id: Scan to search within.
            query: Free-text search query.
            n_results: Maximum number of results.
            entity_type: Optional filter by entity type.

        Returns:
            List of matching Entity objects.
        """
        collection_name = _entities_collection(scan_id)
        try:
            kwargs: dict[str, Any] = {
                "collection_name": collection_name,
                "query_texts": [query],
                "n_results": n_results,
            }
            if entity_type is not None:
                kwargs["where"] = {"entity_type": entity_type}
            results = self.chromadb.search(**kwargs)
            entities: list[Entity] = []
            for doc_str in (results.get("documents") or [[]])[0]:
                try:
                    entities.append(Entity(**json.loads(doc_str)))
                except Exception:
                    continue
            return entities
        except Exception as e:
            logger.error(f"Entity search failed for {scan_id}: {e}")
            return []

    async def list_entity_types(self, scan_id: str) -> dict[str, int]:
        """Return a mapping of entity_type → count for the given scan."""
        entities = await self._get_entities(scan_id) or []
        counts: dict[str, int] = {}
        for e in entities:
            counts[e.entity_type] = counts.get(e.entity_type, 0) + 1
        return counts
