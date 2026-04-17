"""
Weaviate client with 3-tier memory schema management.
"""

from __future__ import annotations

import json
import os
from datetime import UTC, datetime
from typing import TYPE_CHECKING
from uuid import UUID

from rich.console import Console
from tenacity import retry, stop_after_attempt, wait_exponential

if TYPE_CHECKING:
    from weaviate import WeaviateClient

from memory_system.config import (
    ENTITY_COLLECTION,
    RELATION_COLLECTION,
    TIER1_COLLECTION,
    TIER2_COLLECTION,
    TIER3_COLLECTION,
    Settings,
    get_settings,
)
from memory_system.memory import (
    GraphQueryResult,
    KnowledgeEntity,
    KnowledgeRelation,
    Memory,
    MemoryQuery,
    MemorySearchResult,
    MemoryStats,
    MemoryTier,
)

console = Console()


class WeaviateMemoryClient:
    """
    Async Weaviate client for the 3-tier memory system.
    Handles schema creation, CRUD operations, and search across all tiers.
    """

    # Map tiers to collection names
    TIER_COLLECTIONS = {
        MemoryTier.PROJECT: TIER1_COLLECTION,
        MemoryTier.GENERAL: TIER2_COLLECTION,
        MemoryTier.GLOBAL: TIER3_COLLECTION,
    }

    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()
        self._client: WeaviateClient | None = None

    @property
    def client(self) -> WeaviateClient:
        """Get the Weaviate client, ensuring it is connected."""
        if self._client is None:
            raise RuntimeError("Weaviate client not connected")
        return self._client

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    async def connect(self) -> None:
        """Connect to Weaviate with retry logic."""
        from urllib.parse import urlparse

        import weaviate
        from weaviate.classes.init import Auth

        console.print(f"[cyan]Connecting to Weaviate at {self.settings.weaviate_url}...[/cyan]")
        auth = None
        if self.settings.weaviate_api_key:
            auth = Auth.api_key(self.settings.weaviate_api_key)
        # Parse HTTP URL properly
        http_parsed = urlparse(self.settings.weaviate_url)
        http_host = http_parsed.hostname or "localhost"
        http_port = http_parsed.port or 8080
        http_secure = http_parsed.scheme == "https"
        # Parse gRPC URL properly
        grpc_parsed = urlparse(self.settings.weaviate_grpc_url)
        grpc_host = grpc_parsed.hostname or http_host
        grpc_port = grpc_parsed.port or 50051
        grpc_secure = grpc_parsed.scheme == "https"
        try:
            self._client = weaviate.connect_to_custom(
                http_host=http_host,
                http_port=http_port,
                http_secure=http_secure,
                grpc_host=grpc_host,
                grpc_port=grpc_port,
                grpc_secure=grpc_secure,
                auth_credentials=auth,
                skip_init_checks=False,
            )
            console.print("[green]✓ Connected to Weaviate[/green]")
        except Exception as e:
            console.print(f"[red]✗ Failed to connect to Weaviate: {e}[/red]")
            raise
        # Clean migration: drop all collections if requested
        if (
            self.settings.clean_schema_migration
            or os.getenv("CLEAN_SCHEMA_MIGRATION", "").lower() == "true"
        ):
            console.print(
                "[yellow]⚠ CLEAN_SCHEMA_MIGRATION=true — dropping all collections...[/yellow]"
            )
            await self._drop_all_collections()
        await self._ensure_schemas()

    async def _drop_all_collections(self) -> None:
        """Drop all managed collections (destructive — use only for schema migration)."""
        all_names = [
            TIER1_COLLECTION,
            TIER2_COLLECTION,
            TIER3_COLLECTION,
            ENTITY_COLLECTION,
            RELATION_COLLECTION,
        ]
        existing = self.client.collections.list_all()
        for name in all_names:
            if name in existing:
                self.client.collections.delete(name)
                console.print(f"[yellow]Dropped collection: {name}[/yellow]")

    async def _ensure_schemas(self) -> None:
        """Create all required collections if they don't exist."""
        from weaviate.classes.config import Configure, DataType, Property, VectorDistances

        existing = self.client.collections.list_all()
        memory_properties = self._build_memory_properties()

        # Create tier collections
        for tier, collection_name in self.TIER_COLLECTIONS.items():
            if collection_name not in existing:
                console.print(f"[cyan]Creating collection: {collection_name}[/cyan]")
                self.client.collections.create(
                    name=collection_name,
                    description=f"Memory tier {tier.value}: {tier.name}",
                    properties=memory_properties,
                    vectorizer_config=Configure.Vectorizer.none(),
                    vector_index_config=Configure.VectorIndex.hnsw(
                        ef=256,
                        ef_construction=128,
                        max_connections=64,
                        dynamic_ef_factor=8,
                        distance_metric=VectorDistances.COSINE,
                    ),
                    multi_tenancy_config=(
                        Configure.multi_tenancy(enabled=True)
                        if self.settings.multi_tenancy_enabled
                        else None
                    ),
                )

                console.print(f"[green]✓ {collection_name} created[/green]")
            else:
                console.print(f"[green]✓ {collection_name} exists[/green]")
                await self._migrate_memory_collection(collection_name)
        # Create entity collection for knowledge graph
        if ENTITY_COLLECTION not in existing:
            console.print(f"[cyan]Creating collection: {ENTITY_COLLECTION}[/cyan]")
            self.client.collections.create(
                name=ENTITY_COLLECTION,
                description="Entities in the knowledge graph",
                properties=[
                    Property(name="name", data_type=DataType.TEXT, index_filterable=True),
                    Property(name="entity_type", data_type=DataType.TEXT, index_filterable=True),
                    Property(name="description", data_type=DataType.TEXT),
                    Property(name="project_id", data_type=DataType.TEXT, index_filterable=True),
                    Property(name="tenant_id", data_type=DataType.TEXT, index_filterable=True),
                    Property(name="aliases", data_type=DataType.TEXT_ARRAY, index_filterable=True),
                    Property(name="metadata", data_type=DataType.TEXT),
                    Property(name="created_at", data_type=DataType.DATE, index_filterable=True),
                    Property(name="updated_at", data_type=DataType.DATE, index_filterable=True),
                    # Phase B: new entity properties
                    Property(name="last_seen_at", data_type=DataType.DATE, index_filterable=True),
                    Property(name="mention_count", data_type=DataType.INT, index_filterable=True),
                    Property(name="confidence", data_type=DataType.NUMBER, index_filterable=True),
                ],
                vectorizer_config=Configure.Vectorizer.none(),
                vector_index_config=Configure.VectorIndex.hnsw(
                    ef=256,
                    ef_construction=128,
                    max_connections=64,
                    dynamic_ef_factor=8,
                    distance_metric=VectorDistances.COSINE,
                ),
                multi_tenancy_config=(
                    Configure.multi_tenancy(enabled=True)
                    if self.settings.multi_tenancy_enabled
                    else None
                ),
            )
            console.print(f"[green]✓ {ENTITY_COLLECTION} created[/green]")
        else:
            console.print(f"[green]✓ {ENTITY_COLLECTION} exists[/green]")
            # Migration: add missing properties if they don't exist
            await self._migrate_entity_collection()
        # Create relation collection
        if RELATION_COLLECTION not in existing:
            console.print(f"[cyan]Creating collection: {RELATION_COLLECTION}[/cyan]")
            self.client.collections.create(
                name=RELATION_COLLECTION,
                description="Relationships between entities",
                properties=[
                    Property(
                        name="source_entity_id", data_type=DataType.TEXT, index_filterable=True
                    ),
                    Property(
                        name="target_entity_id", data_type=DataType.TEXT, index_filterable=True
                    ),
                    Property(name="relation_type", data_type=DataType.TEXT, index_filterable=True),
                    Property(name="weight", data_type=DataType.NUMBER, index_filterable=True),
                    Property(name="project_id", data_type=DataType.TEXT, index_filterable=True),
                    Property(name="tenant_id", data_type=DataType.TEXT, index_filterable=True),
                    Property(name="context", data_type=DataType.TEXT),
                    Property(name="created_at", data_type=DataType.DATE, index_filterable=True),
                    # Phase B: new relation properties
                    Property(name="confidence", data_type=DataType.NUMBER, index_filterable=True),
                    Property(name="evidence_memory_ids", data_type=DataType.TEXT_ARRAY),
                    Property(
                        name="last_updated_at", data_type=DataType.DATE, index_filterable=True
                    ),
                ],
                vectorizer_config=Configure.Vectorizer.none(),
                vector_index_config=Configure.VectorIndex.hnsw(
                    ef=256,
                    ef_construction=128,
                    max_connections=64,
                    dynamic_ef_factor=8,
                    distance_metric=VectorDistances.COSINE,
                ),
                multi_tenancy_config=(
                    Configure.multi_tenancy(enabled=True)
                    if self.settings.multi_tenancy_enabled
                    else None
                ),
            )

            console.print(f"[green]✓ {RELATION_COLLECTION} created[/green]")
        else:
            console.print(f"[green]✓ {RELATION_COLLECTION} exists[/green]")
            # Migration: add missing properties if they don't exist
            await self._migrate_relation_collection()

    def _build_memory_properties(self) -> list:
        """Return the canonical Weaviate property list for memory collections."""
        from weaviate.classes.config import DataType, Property

        return [
            Property(name="content", data_type=DataType.TEXT),
            Property(name="summary", data_type=DataType.TEXT),
            Property(name="memory_type", data_type=DataType.TEXT),
            Property(name="source", data_type=DataType.TEXT),
            Property(name="project_id", data_type=DataType.TEXT, index_filterable=True),
            Property(name="user_id", data_type=DataType.TEXT, index_filterable=True),
            Property(name="tenant_id", data_type=DataType.TEXT, index_filterable=True),
            Property(name="session_id", data_type=DataType.TEXT),
            Property(name="importance", data_type=DataType.NUMBER, index_filterable=True),
            Property(name="confidence", data_type=DataType.NUMBER, index_filterable=True),
            Property(name="tags", data_type=DataType.TEXT_ARRAY, index_filterable=True),
            Property(name="metadata", data_type=DataType.TEXT),
            Property(name="created_at", data_type=DataType.DATE, index_filterable=True),
            Property(name="updated_at", data_type=DataType.DATE, index_filterable=True),
            Property(name="expires_at", data_type=DataType.DATE, index_filterable=True),
            Property(name="related_memory_ids", data_type=DataType.TEXT_ARRAY),
            Property(name="parent_memory_id", data_type=DataType.TEXT, index_filterable=True),
            # Phase B: new properties
            Property(name="embedding_model", data_type=DataType.TEXT),
            Property(name="embedding_dimension", data_type=DataType.INT),
            Property(name="embedding_updated_at", data_type=DataType.DATE),
            Property(name="access_count", data_type=DataType.INT, index_filterable=True),
            Property(name="last_accessed_at", data_type=DataType.DATE, index_filterable=True),
            Property(name="decay_factor", data_type=DataType.NUMBER),
            Property(name="canonical_id", data_type=DataType.TEXT, index_filterable=True),
            Property(name="is_canonical", data_type=DataType.BOOL, index_filterable=True),
            # Advanced integrity, provenance, and lifecycle properties
            Property(name="overall_confidence", data_type=DataType.NUMBER, index_filterable=True),
            Property(name="confidence_factors", data_type=DataType.TEXT),
            Property(name="provenance", data_type=DataType.TEXT),
            Property(name="modification_history", data_type=DataType.TEXT),
            Property(name="contradictions", data_type=DataType.TEXT_ARRAY, index_filterable=True),
            Property(
                name="contradictions_resolved",
                data_type=DataType.BOOL,
                index_filterable=True,
            ),
            Property(name="is_deprecated", data_type=DataType.BOOL, index_filterable=True),
            Property(name="deprecated_by", data_type=DataType.TEXT, index_filterable=True),
            Property(name="supporting_evidence_ids", data_type=DataType.TEXT_ARRAY),
            Property(name="contradicting_evidence_ids", data_type=DataType.TEXT_ARRAY),
            Property(
                name="last_contradiction_check",
                data_type=DataType.DATE,
                index_filterable=True,
            ),
            Property(
                name="last_confidence_update",
                data_type=DataType.DATE,
                index_filterable=True,
            ),
            # Temporal and event modeling
            Property(name="temporal_bounds", data_type=DataType.TEXT),
            Property(name="is_event", data_type=DataType.BOOL, index_filterable=True),
            Property(name="cause_ids", data_type=DataType.TEXT_ARRAY),
            Property(name="effect_ids", data_type=DataType.TEXT_ARRAY),
        ]

    # -----------------------------------------------------------------------
    # Memory object helpers
    # -----------------------------------------------------------------------
    def _memory_to_properties(self, memory: Memory) -> dict:
        """Convert a Memory object to a Weaviate properties dict."""
        return {
            "content": memory.content,
            "summary": memory.summary or "",
            "memory_type": memory.memory_type.value
            if isinstance(memory.memory_type, str) is False
            else memory.memory_type,
            "source": memory.source.value
            if isinstance(memory.source, str) is False
            else memory.source,
            "project_id": memory.project_id or "",
            "user_id": memory.user_id or "",
            "tenant_id": memory.tenant_id,
            "session_id": memory.session_id or "",
            "importance": memory.importance,
            "confidence": memory.confidence,
            "tags": memory.tags,
            "metadata": json.dumps(memory.metadata),
            "created_at": memory.created_at.isoformat(),
            "updated_at": memory.updated_at.isoformat(),
            "expires_at": memory.expires_at.isoformat() if memory.expires_at else "",
            "related_memory_ids": [str(m) for m in memory.related_memory_ids],
            "parent_memory_id": str(memory.parent_memory_id) if memory.parent_memory_id else "",
            # Phase B: new fields
            "embedding_model": memory.embedding_model or "",
            "embedding_dimension": memory.embedding_dimension or self.settings.embedding_dimensions,
            "embedding_updated_at": datetime.now(UTC).isoformat(),
            "access_count": memory.access_count,
            "last_accessed_at": memory.last_accessed_at.isoformat()
            if memory.last_accessed_at
            else None,
            "decay_factor": memory.decay_factor,
            "canonical_id": memory.canonical_id or "",
            "is_canonical": memory.is_canonical,
            "overall_confidence": memory.overall_confidence,
            "confidence_factors": json.dumps(
                memory.confidence_factors.model_dump(mode="json")
                if hasattr(memory.confidence_factors, "model_dump")
                else memory.confidence_factors
            ),
            "provenance": json.dumps(
                memory.provenance.model_dump(mode="json")
                if hasattr(memory.provenance, "model_dump")
                else memory.provenance
            ),
            "modification_history": json.dumps(
                [
                    m.model_dump(mode="json") if hasattr(m, "model_dump") else m
                    for m in memory.modification_history
                ]
            ),
            "contradictions": memory.contradictions,
            "contradictions_resolved": memory.contradictions_resolved,
            "is_deprecated": memory.is_deprecated,
            "deprecated_by": memory.deprecated_by or "",
            "supporting_evidence_ids": memory.supporting_evidence_ids,
            "contradicting_evidence_ids": memory.contradicting_evidence_ids,
            "last_contradiction_check": memory.last_contradiction_check.isoformat()
            if memory.last_contradiction_check
            else None,
            "last_confidence_update": memory.last_confidence_update.isoformat()
            if memory.last_confidence_update
            else None,
            "temporal_bounds": json.dumps(
                memory.temporal_bounds.model_dump(mode="json")
                if hasattr(memory.temporal_bounds, "model_dump")
                else memory.temporal_bounds
            )
            if memory.temporal_bounds
            else None,
            "is_event": memory.is_event,
            "cause_ids": memory.cause_ids,
            "effect_ids": memory.effect_ids,
        }

    def _parse_json_field(
        self, props: dict, key: str, default: dict | list | None = None
    ) -> dict | list | None:
        val = props.get(key)
        if not val:
            return default
        if isinstance(val, str):
            import json

            try:
                return json.loads(val)
            except Exception:
                return default
        return val

    def _obj_to_memory(self, obj, tier: MemoryTier) -> Memory:
        """Convert a Weaviate object to a Memory instance (single canonical helper)."""
        props = obj.properties
        raw_meta = props.get("metadata", "{}")
        try:
            metadata = json.loads(raw_meta) if isinstance(raw_meta, str) else (raw_meta or {})
        except (ValueError, TypeError):
            metadata = {}
        return Memory(
            id=UUID(str(obj.uuid)),
            content=props.get("content", ""),
            summary=props.get("summary") or None,
            tier=tier,
            memory_type=props.get("memory_type", "fact"),
            source=props.get("source", "agent"),
            project_id=props.get("project_id") or None,
            user_id=props.get("user_id") or None,
            tenant_id=props.get("tenant_id", "default"),
            session_id=props.get("session_id") or None,
            importance=props.get("importance", 0.5),
            confidence=props.get("confidence", 1.0),
            tags=props.get("tags", []),
            metadata=metadata,
            created_at=props.get("created_at"),
            updated_at=props.get("updated_at"),
            # Phase B: new fields
            access_count=props.get("access_count", 0),
            embedding_model=props.get("embedding_model") or None,
            embedding_dimension=props.get("embedding_dimension") or None,
            decay_factor=props.get("decay_factor", 1.0),
            canonical_id=props.get("canonical_id") or None,
            is_canonical=props.get("is_canonical", True),
            overall_confidence=props.get("overall_confidence", 0.5),
            confidence_factors=self._parse_json_field(props, "confidence_factors", {}),
            provenance=self._parse_json_field(props, "provenance", {}),
            modification_history=self._parse_json_field(props, "modification_history", []),
            contradictions=props.get("contradictions", []),
            contradictions_resolved=props.get("contradictions_resolved", False),
            is_deprecated=props.get("is_deprecated", False),
            deprecated_by=props.get("deprecated_by") or None,
            supporting_evidence_ids=props.get("supporting_evidence_ids", []),
            contradicting_evidence_ids=props.get("contradicting_evidence_ids", []),
            last_contradiction_check=None,
            last_confidence_update=None,
            temporal_bounds=self._parse_json_field(props, "temporal_bounds", None),
            is_event=props.get("is_event", False),
            cause_ids=props.get("cause_ids", []),
            effect_ids=props.get("effect_ids", []),
        )

    async def _ensure_memory_tenant(self, tenant_id: str, collection_name: str) -> None:
        """Create tenant in a memory collection if it doesn't already exist."""
        if not self.settings.multi_tenancy_enabled or not tenant_id:
            return
        from weaviate.classes.tenants import Tenant

        collection = self.client.collections.get(collection_name)
        existing_tenants = {t.name for t in collection.tenants.get().values()}
        if tenant_id not in existing_tenants:
            collection.tenants.create([Tenant(name=tenant_id)])
            console.print(f"[cyan]Created tenant '{tenant_id}' in {collection_name}[/cyan]")

    async def add_memory(self, memory: Memory) -> UUID:
        """Add a memory to the appropriate tier collection."""
        collection_name = self.TIER_COLLECTIONS[memory.tier]
        tenant = memory.tenant_id or self.settings.default_tenant_id
        await self._ensure_memory_tenant(tenant, collection_name)
        collection = self.client.collections.get(collection_name)
        properties = self._memory_to_properties(memory)
        if self.settings.multi_tenancy_enabled:
            # Use tenant-specific operations
            tenant = memory.tenant_id or self.settings.default_tenant_id
            collection.with_tenant(tenant).data.insert(
                uuid=str(memory.id),
                properties=properties,
                vector=memory.vector,
            )
        else:
            collection.data.insert(
                uuid=str(memory.id),
                properties=properties,
                vector=memory.vector,
            )
        return memory.id

    async def search(
        self, query: MemoryQuery, query_vector: list[float]
    ) -> list[MemorySearchResult]:
        """Search memories across specified tiers using the configured retrieval mode."""
        from weaviate.classes.query import Filter, MetadataQuery

        results = []
        # Determine which collections to search
        if query.tier:
            collections_to_search = {query.tier: self.TIER_COLLECTIONS[query.tier]}
        else:
            collections_to_search = self.TIER_COLLECTIONS
        for tier, collection_name in collections_to_search.items():
            collection = self.client.collections.get(collection_name)
            # Build filters
            filters = []
            if query.tenant_id:
                filters.append(Filter.by_property("tenant_id").equal(query.tenant_id))
            if query.project_id and tier == MemoryTier.PROJECT:
                filters.append(Filter.by_property("project_id").equal(query.project_id))
            if query.user_id and tier in (MemoryTier.PROJECT, MemoryTier.GENERAL):
                filters.append(Filter.by_property("user_id").equal(query.user_id))
            if query.min_importance:
                filters.append(
                    Filter.by_property("importance").greater_or_equal(query.min_importance)
                )
            if query.tags:
                for tag in query.tags:
                    filters.append(Filter.by_property("tags").contains_any([tag]))

            if query.event_only:
                filters.append(Filter.by_property("is_event").equal(True))

            if query.start_date:
                # Weaviate date filters need RFC3339 string format usually, but Python date objects work in v4 client
                filters.append(Filter.by_property("created_at").greater_or_equal(query.start_date))

            if query.end_date:
                filters.append(Filter.by_property("created_at").less_or_equal(query.end_date))
            # Combine filters
            combined_filter = None
            if filters:
                combined_filter = Filter.all_of(filters)
            # Execute search — when multi-tenancy is enabled, always scope to a tenant
            if self.settings.multi_tenancy_enabled:
                effective_tenant = query.tenant_id or self.settings.default_tenant_id
                await self._ensure_memory_tenant(effective_tenant, collection_name)
                collection = collection.with_tenant(effective_tenant)
            if self.settings.search_retrieval_mode == "hybrid" and query.query.strip():
                search_results = collection.query.hybrid(
                    query=query.query,
                    vector=query_vector,
                    alpha=self.settings.hybrid_alpha,
                    limit=query.limit,
                    filters=combined_filter,
                    return_metadata=MetadataQuery(score=True),
                )
            else:
                search_results = collection.query.near_vector(
                    near_vector=query_vector,
                    limit=query.limit,
                    filters=combined_filter,
                    return_metadata=MetadataQuery(distance=True, certainty=True),
                )
            for obj in search_results.objects:
                memory = self._obj_to_memory(obj, tier)
                metadata = getattr(obj, "metadata", None)
                score = 0.0
                if metadata is not None:
                    raw_score = getattr(metadata, "score", None)
                    raw_certainty = getattr(metadata, "certainty", None)
                    if isinstance(raw_score, (int, float)):
                        score = float(raw_score)
                    elif isinstance(raw_certainty, (int, float)):
                        score = float(raw_certainty)
                results.append(
                    MemorySearchResult(
                        memory=memory,
                        score=score,
                        distance=getattr(metadata, "distance", None),
                    )
                )
        # Sort by score and limit
        results.sort(key=lambda x: x.score or 0.0, reverse=True)
        return results[: query.limit]

    async def get_memory(
        self, memory_id: UUID, tier: MemoryTier, tenant_id: str | None = None
    ) -> Memory | None:
        """Retrieve a specific memory by ID."""
        collection_name = self.TIER_COLLECTIONS[tier]
        collection = self.client.collections.get(collection_name)
        try:
            if self.settings.multi_tenancy_enabled:
                effective_tenant = tenant_id or self.settings.default_tenant_id
                await self._ensure_memory_tenant(effective_tenant, collection_name)
                obj = collection.with_tenant(effective_tenant).query.fetch_object_by_id(
                    str(memory_id)
                )
            else:
                obj = collection.query.fetch_object_by_id(str(memory_id))
            if obj is None:
                return None
            return self._obj_to_memory(obj, tier)
        except Exception:
            return None

    async def list_memories(
        self,
        tier: MemoryTier | None = None,
        project_id: str | None = None,
        tenant_id: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[Memory], int]:
        """List memories without requiring a search query (uses fetch_objects).
        Returns:
            (memories_on_page, total_count) where total_count is the true
            count of matching items across all queried collections, not just
            the current page size.
        """
        from weaviate.classes.query import Filter

        all_memories: list[Memory] = []
        total_count: int = 0
        collections_to_list = {tier: self.TIER_COLLECTIONS[tier]} if tier else self.TIER_COLLECTIONS
        for tier_key, collection_name in collections_to_list.items():
            collection = self.client.collections.get(collection_name)
            filters = []
            if tenant_id:
                filters.append(Filter.by_property("tenant_id").equal(tenant_id))
            if project_id and tier_key == MemoryTier.PROJECT:
                filters.append(Filter.by_property("project_id").equal(project_id))
            combined_filter = Filter.all_of(filters) if filters else None
            # Use tenant-scoped handle for both aggregate and fetch
            if self.settings.multi_tenancy_enabled:
                effective_tenant = tenant_id or self.settings.default_tenant_id
                await self._ensure_memory_tenant(effective_tenant, collection_name)
            coll = (
                collection.with_tenant(tenant_id or self.settings.default_tenant_id)
                if self.settings.multi_tenancy_enabled
                else collection
            )
            # True total count via aggregate (respects filters)
            aggregate = coll.aggregate.over_all(
                total_count=True,
                filters=combined_filter,
            )
            total_count += aggregate.total_count or 0
            if tier is not None:
                # Single-tier path: Weaviate handles offset/limit natively
                fetch_limit = limit
                fetch_offset = offset
            else:
                # Multi-tier path: fetch offset+limit items from each tier,
                # then apply a single global slice after combining.
                fetch_limit = offset + limit
                fetch_offset = 0
            fetch_result = coll.query.fetch_objects(
                filters=combined_filter,
                limit=fetch_limit,
                offset=fetch_offset,
            )
            for obj in fetch_result.objects:
                all_memories.append(self._obj_to_memory(obj, tier_key))
        if tier is None:
            # Apply global offset+limit slice across all combined tier results
            all_memories = all_memories[offset : offset + limit]
        return all_memories, total_count

    async def delete_memory(
        self, memory_id: UUID, tier: MemoryTier, tenant_id: str | None = None
    ) -> bool:
        """Delete a memory by ID."""
        collection_name = self.TIER_COLLECTIONS[tier]
        collection = self.client.collections.get(collection_name)
        try:
            if self.settings.multi_tenancy_enabled:
                effective_tenant = tenant_id or self.settings.default_tenant_id
                await self._ensure_memory_tenant(effective_tenant, collection_name)
                collection.with_tenant(effective_tenant).data.delete_by_id(str(memory_id))
            else:
                collection.data.delete_by_id(str(memory_id))
            return True
        except Exception:
            return False

    async def add_memories_batch(self, memories: list[Memory]) -> tuple[list[UUID], list]:
        """Insert a batch of Memory objects into Weaviate, one at a time.
        Returns (successful_ids, failed_objects).
        """
        successful_ids: list[UUID] = []
        failed_objects: list = []
        for memory in memories:
            try:
                uid = await self.add_memory(memory)
                successful_ids.append(uid)
            except Exception as exc:  # noqa: BLE001
                console.print(f"[red]Batch insert failed for memory {memory.id}: {exc}[/red]")
                failed_objects.append(memory)
        return successful_ids, failed_objects

    async def get_stats(self, tenant_id: str | None = None) -> MemoryStats:
        """Get memory statistics."""
        stats = MemoryStats()
        for tier, collection_name in self.TIER_COLLECTIONS.items():
            collection = self.client.collections.get(collection_name)
            if self.settings.multi_tenancy_enabled:
                effective_tenant = tenant_id or self.settings.default_tenant_id
                await self._ensure_memory_tenant(effective_tenant, collection_name)
                aggregate = collection.with_tenant(effective_tenant).aggregate.over_all(
                    total_count=True
                )
            else:
                aggregate = collection.aggregate.over_all(total_count=True)
            count = aggregate.total_count
            stats.total_memories += count
            if tier == MemoryTier.PROJECT:
                stats.tier1_count = count
            elif tier == MemoryTier.GENERAL:
                stats.tier2_count = count
            else:
                stats.tier3_count = count
        return stats

    async def close(self) -> None:
        """Close the Weaviate connection."""
        if self._client:
            self._client.close()
            console.print("[cyan]Weaviate connection closed[/cyan]")

    @property
    def is_connected(self) -> bool:
        """Check if client is connected."""
        return self._client is not None and self._client.is_ready()

    async def _migrate_memory_collection(self, collection_name: str) -> None:
        """Add Phase B properties to existing memory collections (idempotent)."""
        from weaviate.classes.config import DataType, Property

        new_props = {
            "metadata": DataType.TEXT,
            "embedding_model": DataType.TEXT,
            "embedding_dimension": DataType.INT,
            "embedding_updated_at": DataType.DATE,
            "access_count": DataType.INT,
            "last_accessed_at": DataType.DATE,
            "decay_factor": DataType.NUMBER,
            "canonical_id": DataType.TEXT,
            "is_canonical": DataType.BOOL,
            "overall_confidence": DataType.NUMBER,
            "confidence_factors": DataType.TEXT,
            "provenance": DataType.TEXT,
            "modification_history": DataType.TEXT,
            "contradictions": DataType.TEXT_ARRAY,
            "contradictions_resolved": DataType.BOOL,
            "is_deprecated": DataType.BOOL,
            "deprecated_by": DataType.TEXT,
            "supporting_evidence_ids": DataType.TEXT_ARRAY,
            "contradicting_evidence_ids": DataType.TEXT_ARRAY,
            "last_contradiction_check": DataType.DATE,
            "last_confidence_update": DataType.DATE,
            "temporal_bounds": DataType.TEXT,
            "is_event": DataType.BOOL,
            "cause_ids": DataType.TEXT_ARRAY,
            "effect_ids": DataType.TEXT_ARRAY,
        }
        try:
            collection = self.client.collections.get(collection_name)
            existing_props = {p.name for p in collection.config.get().properties}
            for prop_name, data_type in new_props.items():
                if prop_name not in existing_props:
                    collection.config.add_property(Property(name=prop_name, data_type=data_type))
                    console.print(f"[cyan]Migrated {collection_name}: added {prop_name}[/cyan]")
        except Exception as e:
            console.print(
                f"[yellow]Memory collection migration warning ({collection_name}): {e}[/yellow]"
            )

    async def _migrate_entity_collection(self) -> None:
        """Add missing properties to existing entity collection (idempotent)."""
        from weaviate.classes.config import DataType, Property

        try:
            collection = self.client.collections.get(ENTITY_COLLECTION)
            existing_props = {p.name for p in collection.config.get().properties}
            new_props = {
                "project_id": DataType.TEXT,
                "created_at": DataType.DATE,
                "updated_at": DataType.DATE,
                "last_seen_at": DataType.DATE,
                "mention_count": DataType.INT,
                "confidence": DataType.NUMBER,
            }
            for prop_name, data_type in new_props.items():
                if prop_name not in existing_props:
                    collection.config.add_property(Property(name=prop_name, data_type=data_type))
                    console.print(f"[cyan]Migrated entity collection: added {prop_name}[/cyan]")
        except Exception as e:
            console.print(f"[yellow]Entity migration warning: {e}[/yellow]")

    async def _migrate_relation_collection(self) -> None:
        """Add missing properties to existing relation collection (idempotent)."""
        from weaviate.classes.config import DataType, Property

        try:
            collection = self.client.collections.get(RELATION_COLLECTION)
            existing_props = {p.name for p in collection.config.get().properties}
            new_props = {
                "source_entity_id": DataType.TEXT,
                "target_entity_id": DataType.TEXT,
                "project_id": DataType.TEXT,
                "created_at": DataType.DATE,
                "confidence": DataType.NUMBER,
                "evidence_memory_ids": DataType.TEXT_ARRAY,
                "last_updated_at": DataType.DATE,
            }
            for prop_name, data_type in new_props.items():
                if prop_name not in existing_props:
                    collection.config.add_property(Property(name=prop_name, data_type=data_type))
                    console.print(f"[cyan]Migrated relation collection: added {prop_name}[/cyan]")
        except Exception as e:
            console.print(f"[yellow]Relation migration warning: {e}[/yellow]")

    async def _ensure_graph_tenant(self, tenant_id: str) -> None:
        """Create tenant in entity/relation collections if it doesn't already exist."""
        if not self.settings.multi_tenancy_enabled or not tenant_id:
            return
        from weaviate.classes.tenants import Tenant

        for collection_name in (ENTITY_COLLECTION, RELATION_COLLECTION):
            collection = self.client.collections.get(collection_name)
            existing_tenants = {t.name for t in collection.tenants.get().values()}
            if tenant_id not in existing_tenants:
                collection.tenants.create([Tenant(name=tenant_id)])
                console.print(f"[cyan]Created tenant '{tenant_id}' in {collection_name}[/cyan]")

    # ---------------------------------------------------------------------------
    # Knowledge Graph CRUD
    # ---------------------------------------------------------------------------
    def _get_graph_collection(self, collection_name: str, tenant_id: str | None):
        """Return a tenant-scoped (or plain) collection handle.
        When multi-tenancy is enabled, always scope to a tenant.
        Falls back to the default tenant if none is provided.
        """
        collection = self.client.collections.get(collection_name)
        if self.settings.multi_tenancy_enabled:
            effective_tenant = tenant_id or self.settings.default_tenant_id
            return collection.with_tenant(effective_tenant)
        return collection

    async def add_entity(self, entity: KnowledgeEntity) -> UUID:
        """Insert a knowledge graph entity into Weaviate."""
        import json

        await self._ensure_graph_tenant(entity.tenant_id)
        collection = self._get_graph_collection(ENTITY_COLLECTION, entity.tenant_id)
        properties = {
            "name": entity.name,
            "entity_type": entity.entity_type,
            "description": entity.description or "",
            "project_id": entity.project_id or "",
            "tenant_id": entity.tenant_id,
            "aliases": entity.aliases,
            "metadata": json.dumps(entity.metadata),
            "created_at": entity.created_at.isoformat(),
            "updated_at": entity.updated_at.isoformat(),
        }
        collection.data.insert(uuid=str(entity.id), properties=properties)
        return entity.id

    async def get_entity(
        self, entity_id: UUID, tenant_id: str | None = None
    ) -> KnowledgeEntity | None:
        """Retrieve a knowledge graph entity by ID."""
        collection = self._get_graph_collection(ENTITY_COLLECTION, tenant_id)
        try:
            obj = collection.query.fetch_object_by_id(str(entity_id))
            if obj is None:
                return None
            return self._obj_to_entity(obj)
        except Exception:
            return None

    async def find_entity_by_name(
        self, name: str, project_id: str | None = None, tenant_id: str | None = None
    ) -> KnowledgeEntity | None:
        """Find the first entity matching name (exact, case-insensitive) within project scope."""
        from weaviate.classes.query import Filter

        collection = self._get_graph_collection(ENTITY_COLLECTION, tenant_id)
        filters = [Filter.by_property("name").equal(name)]
        if project_id:
            filters.append(Filter.by_property("project_id").equal(project_id))
        combined = Filter.all_of(filters) if len(filters) > 1 else filters[0]
        results = collection.query.fetch_objects(filters=combined, limit=1)
        if results.objects:
            return self._obj_to_entity(results.objects[0])
        return None

    async def list_entities(
        self,
        project_id: str | None = None,
        tenant_id: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[KnowledgeEntity]:
        """List knowledge graph entities (no query required)."""
        from weaviate.classes.query import Filter

        collection = self._get_graph_collection(ENTITY_COLLECTION, tenant_id)
        filters = []
        if project_id:
            filters.append(Filter.by_property("project_id").equal(project_id))
        combined_filter = Filter.all_of(filters) if filters else None
        results = collection.query.fetch_objects(
            filters=combined_filter,
            limit=limit,
            offset=offset,
        )
        return [self._obj_to_entity(obj) for obj in results.objects]

    async def add_relation(self, relation: KnowledgeRelation) -> UUID:
        """Insert a knowledge graph relation into Weaviate."""
        await self._ensure_graph_tenant(relation.tenant_id)
        collection = self._get_graph_collection(RELATION_COLLECTION, relation.tenant_id)
        properties = {
            "source_entity_id": str(relation.source_entity_id),
            "target_entity_id": str(relation.target_entity_id),
            "relation_type": relation.relation_type,
            "weight": relation.weight,
            "project_id": relation.project_id or "",
            "tenant_id": relation.tenant_id,
            "context": relation.context or "",
            "created_at": relation.created_at.isoformat(),
        }
        collection.data.insert(uuid=str(relation.id), properties=properties)
        return relation.id

    async def query_graph(
        self,
        entity_id: UUID,
        project_id: str | None = None,
        tenant_id: str | None = None,
        depth: int = 1,
    ) -> GraphQueryResult:
        """BFS traversal from entity_id up to `depth` hops, project-scoped."""
        root = await self.get_entity(entity_id, tenant_id)
        if root is None:
            raise ValueError(f"Entity {entity_id} not found")
        visited_entity_ids: set[str] = {str(entity_id)}
        frontier: list[UUID] = [entity_id]
        all_relations: list[KnowledgeRelation] = []
        all_neighbors: list[KnowledgeEntity] = []
        depth_reached = 0
        for _hop in range(depth):
            if not frontier:
                break
            next_frontier: list[UUID] = []
            for eid in frontier:
                relations = await self._get_relations_for_entity(
                    eid, project_id=project_id, tenant_id=tenant_id
                )
                for rel in relations:
                    all_relations.append(rel)
                    neighbor_id = (
                        rel.target_entity_id
                        if rel.source_entity_id == eid
                        else rel.source_entity_id
                    )
                    nid_str = str(neighbor_id)
                    if nid_str not in visited_entity_ids:
                        visited_entity_ids.add(nid_str)
                        neighbor = await self.get_entity(neighbor_id, tenant_id)
                        if neighbor is not None:
                            # Enforce project isolation
                            if (
                                project_id
                                and neighbor.project_id
                                and neighbor.project_id != project_id
                            ):
                                continue
                            all_neighbors.append(neighbor)
                            next_frontier.append(neighbor_id)
            frontier = next_frontier
            depth_reached = _hop + 1
        # Deduplicate relations by id
        seen_rel_ids: set[str] = set()
        unique_relations: list[KnowledgeRelation] = []
        for rel in all_relations:
            rid = str(rel.id)
            if rid not in seen_rel_ids:
                seen_rel_ids.add(rid)
                unique_relations.append(rel)
        return GraphQueryResult(
            entity=root,
            relations=unique_relations,
            neighbors=all_neighbors,
            depth_reached=depth_reached,
        )

    async def _get_relations_for_entity(
        self,
        entity_id: UUID,
        project_id: str | None = None,
        tenant_id: str | None = None,
    ) -> list[KnowledgeRelation]:
        """Fetch all relations where entity is source or target, within project scope."""
        from weaviate.classes.query import Filter

        collection = self._get_graph_collection(RELATION_COLLECTION, tenant_id)
        eid_str = str(entity_id)
        relations: list[KnowledgeRelation] = []
        for field in ("source_entity_id", "target_entity_id"):
            filters = [Filter.by_property(field).equal(eid_str)]
            if project_id:
                filters.append(Filter.by_property("project_id").equal(project_id))
            combined = Filter.all_of(filters) if len(filters) > 1 else filters[0]
            results = collection.query.fetch_objects(filters=combined, limit=100)
            for obj in results.objects:
                rel = self._obj_to_relation(obj)
                if rel is not None:
                    relations.append(rel)
        return relations

    async def delete_entity(self, entity_id: UUID, tenant_id: str | None = None) -> bool:
        """Delete a knowledge graph entity by ID."""
        collection = self._get_graph_collection(ENTITY_COLLECTION, tenant_id)
        try:
            collection.data.delete_by_id(str(entity_id))
            return True
        except Exception:
            return False

    def _obj_to_entity(self, obj) -> KnowledgeEntity:
        """Convert a Weaviate object to a KnowledgeEntity."""
        import json

        raw_meta = obj.properties.get("metadata", "{}")
        try:
            metadata = json.loads(raw_meta) if raw_meta else {}
        except (ValueError, TypeError):
            metadata = {}
        return KnowledgeEntity(
            id=UUID(str(obj.uuid)),
            name=obj.properties.get("name", ""),
            entity_type=obj.properties.get("entity_type", ""),
            description=obj.properties.get("description") or None,
            project_id=obj.properties.get("project_id") or None,
            tenant_id=obj.properties.get("tenant_id", "default"),
            aliases=obj.properties.get("aliases", []),
            metadata=metadata,
            created_at=obj.properties.get("created_at"),
            updated_at=obj.properties.get("updated_at"),
        )

    def _obj_to_relation(self, obj) -> KnowledgeRelation | None:
        """Convert a Weaviate object to a KnowledgeRelation."""
        try:
            return KnowledgeRelation(
                id=UUID(str(obj.uuid)),
                source_entity_id=UUID(obj.properties.get("source_entity_id", "")),
                target_entity_id=UUID(obj.properties.get("target_entity_id", "")),
                relation_type=obj.properties.get("relation_type", ""),
                weight=obj.properties.get("weight", 1.0),
                project_id=obj.properties.get("project_id") or None,
                tenant_id=obj.properties.get("tenant_id", "default"),
                context=obj.properties.get("context") or None,
                created_at=obj.properties.get("created_at"),
            )
        except Exception:
            return None

    # -----------------------------------------------------------------------
    # Tenant management
    # -----------------------------------------------------------------------
    async def create_tenant(self, tenant_id: str) -> bool:
        """Create a tenant across all multi-tenancy-enabled collections."""
        all_collections = [
            TIER1_COLLECTION,
            TIER2_COLLECTION,
            TIER3_COLLECTION,
            ENTITY_COLLECTION,
            RELATION_COLLECTION,
        ]
        try:
            from weaviate.classes.tenants import Tenant, TenantActivityStatus

            tenant_obj = Tenant(name=tenant_id, activity_status=TenantActivityStatus.HOT)
            for coll_name in all_collections:
                collection = self.client.collections.get(coll_name)
                existing = {t.name for t in collection.tenants.get().values()}
                if tenant_id not in existing:
                    collection.tenants.create([tenant_obj])
            return True
        except Exception as exc:  # noqa: BLE001
            console.print(f"[red]create_tenant failed: {exc}[/red]")
            return False

    async def list_tenants(self) -> list[str]:
        """Return tenant names from the first tier collection (representative)."""
        try:
            collection = self.client.collections.get(TIER1_COLLECTION)
            tenants = collection.tenants.get()
            return [t.name for t in tenants.values()]
        except Exception as exc:  # noqa: BLE001
            console.print(f"[red]list_tenants failed: {exc}[/red]")
            return []

    async def increment_access_count(
        self,
        memory_id: UUID,
        tier: MemoryTier,
        current_count: int = 0,
        tenant_id: str | None = None,
    ) -> None:
        """Increment the access counter and update last_accessed_at for a memory."""
        new_count = current_count + 1
        await self.update_memory_fields(
            memory_id=memory_id,
            tier=tier,
            fields={
                "access_count": new_count,
                "last_accessed_at": datetime.now(UTC).isoformat(),
            },
            tenant_id=tenant_id,
        )

    async def update_memory_fields(
        self,
        memory_id: UUID,
        tier: MemoryTier,
        fields: dict,
        tenant_id: str | None = None,
    ) -> bool:
        """Update specific fields on a memory object (best-effort).
        Attempts a partial update via Weaviate's data.update(); returns False on failure.
        """
        collection_name = self.TIER_COLLECTIONS[tier]
        collection = self.client.collections.get(collection_name)
        try:
            if self.settings.multi_tenancy_enabled:
                effective_tenant = tenant_id or self.settings.default_tenant_id
                collection.with_tenant(effective_tenant).data.update(
                    uuid=str(memory_id), properties=fields
                )
            else:
                collection.data.update(uuid=str(memory_id), properties=fields)
            return True
        except Exception as exc:  # noqa: BLE001
            console.print(f"[yellow]update_memory_fields failed: {exc}[/yellow]")
            return False

    async def update_memory_metadata(
        self,
        memory_id: UUID,
        tier: MemoryTier,
        metadata: dict,
        tenant_id: str | None = None,
    ) -> bool:
        """Merge metadata into the memory object's JSON metadata field."""
        merged_metadata: dict
        try:
            existing_memory = await self.get_memory(memory_id, tier, tenant_id)
            existing_metadata = existing_memory.metadata if existing_memory is not None else {}
            merged_metadata = {
                **existing_metadata,
                **metadata,
            }
        except Exception:
            merged_metadata = metadata

        return await self.update_memory_fields(
            memory_id,
            tier,
            {"metadata": json.dumps(merged_metadata)},
            tenant_id,
        )

    async def delete_expired_memories(
        self,
        tier: MemoryTier,
        tenant_id: str | None = None,
    ) -> int:
        """Delete memories past their expires_at date. Returns count deleted."""
        from weaviate.classes.query import Filter

        collection_name = self.TIER_COLLECTIONS[tier]
        collection = self.client.collections.get(collection_name)
        now_iso = datetime.now(UTC).isoformat()
        try:
            if self.settings.multi_tenancy_enabled:
                effective_tenant = tenant_id or self.settings.default_tenant_id
                await self._ensure_memory_tenant(effective_tenant, collection_name)
                coll = collection.with_tenant(effective_tenant)
            else:
                coll = collection
            # Find expired memories: expires_at is set (non-empty) and less than now
            expired_filter = Filter.all_of(
                [
                    Filter.by_property("expires_at").not_equal(""),
                    Filter.by_property("expires_at").less_than(now_iso),
                ]
            )
            results = coll.query.fetch_objects(filters=expired_filter, limit=1000)
            count = 0
            for obj in results.objects:
                try:
                    coll.data.delete_by_id(str(obj.uuid))
                    count += 1
                except Exception:
                    pass
            return count
        except Exception as exc:
            console.print(f"[yellow]delete_expired_memories failed for {tier}: {exc}[/yellow]")
            return 0

    async def find_similar_memories_by_vector(
        self,
        vector: list[float],
        tier: MemoryTier,
        tenant_id: str | None = None,
        limit: int = 10,
        threshold: float = 0.9,
        project_id: str | None = None,
    ) -> list[Memory]:
        """Find memories with similar vectors (used for deduplication).
        Returns memories where cosine similarity >= threshold (distance <= 1 - threshold).
        """
        from weaviate.classes.query import Filter, MetadataQuery

        collection_name = self.TIER_COLLECTIONS[tier]
        collection = self.client.collections.get(collection_name)
        distance_threshold = 1.0 - threshold
        try:
            if self.settings.multi_tenancy_enabled:
                effective_tenant = tenant_id or self.settings.default_tenant_id
                await self._ensure_memory_tenant(effective_tenant, collection_name)
                coll = collection.with_tenant(effective_tenant)
            else:
                coll = collection
            filters = []
            if tenant_id:
                filters.append(Filter.by_property("tenant_id").equal(tenant_id))
            if project_id:
                filters.append(Filter.by_property("project_id").equal(project_id))
            combined_filter = Filter.all_of(filters) if filters else None
            results = coll.query.near_vector(
                near_vector=vector,
                distance=distance_threshold,
                limit=limit,
                filters=combined_filter,
                return_metadata=MetadataQuery(distance=True),
            )
            memories = []
            for obj in results.objects:
                if (
                    obj.metadata.distance is not None
                    and obj.metadata.distance <= distance_threshold
                ):
                    memories.append(self._obj_to_memory(obj, tier))
            return memories
        except Exception as exc:
            console.print(f"[yellow]find_similar_memories_by_vector failed: {exc}[/yellow]")
            return []

    async def find_consolidation_candidates(
        self,
        tier: MemoryTier,
        tenant_id: str | None = None,
        project_id: str | None = None,
        limit: int = 50,
        hours_back: int = 48,
    ) -> list[Memory]:
        """Find memories that are candidates for consolidation.
        Returns a flat list of recent memories from the specified tier.
        """
        from weaviate.classes.query import Filter

        collection_name = self.TIER_COLLECTIONS[tier]
        collection = self.client.collections.get(collection_name)
        cutoff = (
            datetime.now(UTC) - __import__("datetime").timedelta(hours=hours_back)
        ).isoformat()
        try:
            if self.settings.multi_tenancy_enabled:
                effective_tenant = tenant_id or self.settings.default_tenant_id
                await self._ensure_memory_tenant(effective_tenant, collection_name)
                coll = collection.with_tenant(effective_tenant)
            else:
                coll = collection
            filters = [Filter.by_property("created_at").greater_or_equal(cutoff)]
            if tenant_id:
                filters.append(Filter.by_property("tenant_id").equal(tenant_id))
            if project_id:
                filters.append(Filter.by_property("project_id").equal(project_id))
            combined_filter = Filter.all_of(filters)
            results = coll.query.fetch_objects(filters=combined_filter, limit=limit)
            return [self._obj_to_memory(obj, tier) for obj in results.objects]
        except Exception as exc:
            console.print(f"[yellow]find_consolidation_candidates failed: {exc}[/yellow]")
            return []

    async def add_analysis(self, analysis: object) -> None:
        """Store a memory analysis result as metadata on the memory object."""
        memory_id = getattr(analysis, "memory_id", None)
        if not memory_id:
            return
        tier_name = getattr(analysis, "tier", "tier1")
        tier = tier_name if isinstance(tier_name, str) else "tier1"
        tenant_id = getattr(analysis, "tenant_id", None)
        tier_key = tier if isinstance(tier, MemoryTier) else MemoryTier(tier)
        collection_name = self.TIER_COLLECTIONS.get(tier_key, TIER1_COLLECTION)
        try:
            coll = self.client.collections.get(collection_name)
            metadata = {
                "analysis_quality_score": getattr(analysis, "quality_score", None),
                "analysis_importance": getattr(analysis, "importance", None),
                "analysis_reasoning": getattr(analysis, "importance_reasoning", None),
                "analyzed_at": datetime.now(UTC).isoformat(),
            }
            metadata = {k: v for k, v in metadata.items() if v is not None}
            if metadata:
                coll.data.update(
                    uuid=str(memory_id),
                    properties=metadata,
                    tenant=tenant_id,
                )
        except Exception as exc:
            console.print(f"[yellow]add_analysis failed for {memory_id}: {exc}[/yellow]")

    async def delete_tenant(self, tenant_id: str) -> bool:
        """Delete a tenant from all collections."""
        all_collections = [
            TIER1_COLLECTION,
            TIER2_COLLECTION,
            TIER3_COLLECTION,
            ENTITY_COLLECTION,
            RELATION_COLLECTION,
        ]
        try:
            for coll_name in all_collections:
                collection = self.client.collections.get(coll_name)
                existing = {t.name for t in collection.tenants.get().values()}
                if tenant_id in existing:
                    collection.tenants.remove([tenant_id])
            return True
        except Exception as exc:  # noqa: BLE001
            console.print(f"[red]delete_tenant failed: {exc}[/red]")
            return False
