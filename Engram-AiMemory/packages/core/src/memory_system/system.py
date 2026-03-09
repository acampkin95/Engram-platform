"""
Main MemorySystem class - orchestrates all memory operations.
"""

import asyncio
import hashlib
from collections import Counter
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from rich.console import Console

from memory_system.analyzer import MemoryAnalyzer
from memory_system.cache import RedisCache
from memory_system.client import WeaviateMemoryClient
from memory_system.config import Settings, get_settings
from memory_system.context import ContextBuilder
from memory_system.decay import MemoryReranker
from memory_system.memory import (
    GraphQueryResult,
    KnowledgeEntity,
    KnowledgeRelation,
    Memory,
    MemoryQuery,
    MemorySearchResult,
    MemorySource,
    MemoryStats,
    MemoryTier,
    MemoryType,
)
from memory_system.rag import MemoryRAG

console = Console()


class MemorySystem:
    """
    Main class for the 3-tier AI memory system.

    Provides a unified interface for:
    - Adding memories to appropriate tiers
    - Searching across tiers with caching
    - Memory consolidation and cleanup
    - Multi-tenant isolation

    Usage:
        memory = MemorySystem()
        await memory.initialize()

        # Add a project memory
        mem_id = await memory.add(
            content="Important project insight",
            project_id="my-project",
            importance=0.9
        )

        # Search memories
        results = await memory.search("project insights", project_id="my-project")
    """

    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()
        self._weaviate = WeaviateMemoryClient(self.settings)
        self._cache = RedisCache(self.settings)
        self._embedding_client = None
        self._initialized = False
        self._context_builder: ContextBuilder | None = None
        self._rag: MemoryRAG | None = None
        self._reranker: MemoryReranker | None = None  # BGEReranker (lazy-loaded)
        self._analyzer: MemoryAnalyzer | None = None
        self._nomic_embedder: Any = None  # NomicEmbedder (lazy-loaded)
        self._ollama: Any = None  # OllamaClient (lazy-loaded)
        self._bge_reranker: Any = None  # BGEReranker (lazy-loaded)

    async def initialize(self) -> None:
        """Initialize all components."""
        console.print("[blue]Initializing AI Memory System...[/blue]")

        # Connect to Weaviate
        await self._weaviate.connect()

        # Connect to Redis
        await self._cache.connect()

        # Initialize embedding client based on provider
        await self._init_embedding_client()

        # Initialize Ollama client (optional — graceful degradation if unavailable)
        if self.settings.ollama_host:
            from memory_system.ollama_client import OllamaClient

            self._ollama = OllamaClient(
                host=self.settings.ollama_host,
                timeout=self.settings.ollama_request_timeout,
            )
            available = await self._ollama.is_available()
            if available:
                console.print(f"[green]✓ Ollama available at {self.settings.ollama_host}[/green]")
            else:
                console.print(
                    f"[yellow]⚠ Ollama not available at {self.settings.ollama_host}"
                    " — AI maintenance disabled[/yellow]"
                )
                self._ollama = None

        self._initialized = True
        console.print("[green]✓ AI Memory System initialized[/green]")

    async def _init_embedding_client(self) -> None:
        """Initialize the embedding client based on provider."""
        provider = self.settings.embedding_provider

        if provider == "openai":
            from openai import AsyncOpenAI

            client_kwargs: dict = {"api_key": self.settings.openai_api_key}
            if self.settings.openai_base_url:
                client_kwargs["base_url"] = self.settings.openai_base_url
            self._embedding_client = AsyncOpenAI(**client_kwargs)
            console.print(f"[cyan]Using OpenAI embeddings: {self.settings.embedding_model}[/cyan]")

        elif provider == "nomic":
            from memory_system.embeddings import NomicEmbedder

            self._nomic_embedder = NomicEmbedder(dimension=self.settings.embedding_dimensions)
            console.print(
                f"[cyan]Using nomic-embed-text-v1.5 ({self.settings.embedding_dimensions}-dim)[/cyan]"
            )

        elif provider == "deepinfra":
            from openai import AsyncOpenAI

            self._embedding_client = AsyncOpenAI(
                api_key=self.settings.deepinfra_api_key or "",
                base_url="https://api.deepinfra.com/v1/openai",
            )
            model = self.settings.deepinfra_embed_model or self.settings.embedding_model
            console.print(f"[cyan]Using DeepInfra embeddings: {model}[/cyan]")

        elif provider == "local":
            # For local embeddings, could use sentence-transformers
            console.print("[yellow]Local embeddings not yet implemented, using mock[/yellow]")
            self._embedding_client = None

        elif provider == "ollama":
            from memory_system.embeddings import OllamaEmbedder

            ollama_host = self.settings.ollama_host or "http://localhost:11434"
            ollama_model = getattr(self.settings, "ollama_embedding_model", "nomic-embed-text:v1.5")
            self._nomic_embedder = OllamaEmbedder(
                host=ollama_host,
                model=ollama_model,
                dimension=self.settings.embedding_dimensions,
            )
            console.print(
                f"[cyan]Using Ollama embeddings: {ollama_model} "
                f"({self.settings.embedding_dimensions}-dim) at {ollama_host}[/cyan]"
            )

    async def _get_embedding(self, text: str) -> list[float]:
        """Generate embedding for text."""
        # Check cache first
        text_hash = hashlib.sha256(text.encode()).hexdigest()
        cached = await self._cache.get_embedding(text_hash)
        if cached:
            return cached

        # Generate embedding
        if self._nomic_embedder is not None:
            embedding = await asyncio.to_thread(self._nomic_embedder.embed_query, text)
        elif self._embedding_client is None:
            # Return mock embedding for development
            import random

            embedding = [random.uniform(-1, 1) for _ in range(self.settings.embedding_dimensions)]
        else:
            response = await self._embedding_client.embeddings.create(
                model=self.settings.embedding_model,
                input=text,
            )
            embedding = response.data[0].embedding

        # Cache the embedding
        await self._cache.set_embedding(text_hash, embedding)
        return embedding

    async def _get_embeddings_batch(self, texts: list[str]) -> list[list[float]]:
        """
        Generate embeddings for multiple texts in a single API call.

        Uses OpenAI's batch embedding support (single request with multiple inputs)
        for efficient bulk embedding generation. Falls back to mock embeddings
        when no embedding client is configured.

        Args:
            texts: List of text strings to embed.

        Returns:
            List of embedding vectors, one per input text, in the same order.
        """
        if self._nomic_embedder is not None:
            return await asyncio.to_thread(
                self._nomic_embedder.embed_batch, texts, "search_document"
            )

        if self._embedding_client is None:
            # Return mock embeddings for development
            import random

            return [
                [random.uniform(-1, 1) for _ in range(self.settings.embedding_dimensions)]
                for _ in texts
            ]

        # OpenAI supports batch embedding in a single API call
        response = await self._embedding_client.embeddings.create(
            model=self.settings.embedding_model,
            input=texts,
        )

        # Sort by index to maintain input order
        sorted_data = sorted(response.data, key=lambda x: x.index)
        return [item.embedding for item in sorted_data]

    async def add(
        self,
        content: str,
        tier: MemoryTier = MemoryTier.PROJECT,
        memory_type: MemoryType = MemoryType.FACT,
        source: MemorySource = MemorySource.AGENT,
        project_id: str | None = None,
        user_id: str | None = None,
        tenant_id: str | None = None,
        session_id: str | None = None,
        importance: float = 0.5,
        confidence: float = 1.0,
        tags: list[str] | None = None,
        metadata: dict[str, Any] | None = None,
        expires_in_days: int | None = None,
    ) -> UUID:
        """
        Add a new memory to the system.

        Args:
            content: The memory content
            tier: Memory tier (PROJECT, GENERAL, GLOBAL)
            memory_type: Type of memory (fact, insight, code, etc.)
            source: Source of the memory
            project_id: Project identifier (required for Tier 1)
            user_id: User identifier
            tenant_id: Tenant identifier for multi-tenancy
            session_id: Session identifier
            importance: Importance score (0.0 to 1.0)
            confidence: Confidence score (0.0 to 1.0)
            tags: List of tags for categorization
            metadata: Additional metadata
            expires_in_days: Days until memory expires

        Returns:
            UUID of the created memory
        """
        if not self._initialized:
            raise RuntimeError("MemorySystem not initialized. Call initialize() first.")

        # Generate embedding
        embedding = await self._get_embedding(content)

        # Calculate expiration
        expires_at = None
        if expires_in_days:
            expires_at = datetime.now(UTC) + timedelta(days=expires_in_days)
        elif self.settings.memory_retention_days > 0:
            expires_at = datetime.now(UTC) + timedelta(days=self.settings.memory_retention_days)

        # Create memory object
        memory = Memory(
            content=content,
            tier=tier,
            memory_type=memory_type,
            source=source,
            project_id=project_id,
            user_id=user_id,
            tenant_id=tenant_id or self.settings.default_tenant_id,
            session_id=session_id,
            importance=importance,
            confidence=confidence,
            tags=tags or [],
            metadata=metadata or {},
            vector=embedding,
            expires_at=expires_at,
        )

        # Handle deduplication before storing
        if self.settings.deduplication_enabled and project_id and memory.vector:
            similar = await self._weaviate.find_similar_memories_by_vector(
                vector=memory.vector,
                project_id=project_id,
                tenant_id=memory.tenant_id,
                threshold=self.settings.deduplication_threshold,
                limit=5,
                tier=tier,
            )
            if similar:
                if self.settings.deduplication_action == "skip":
                    console.print(f"[yellow]Skipping duplicate memory: {similar[0].id}[/yellow]")
                    return similar[0].id
                elif self.settings.deduplication_action == "update":
                    await self._weaviate.update_memory_metadata(
                        memory_id=similar[0].id,
                        tier=similar[0].tier,
                        metadata={
                            "reinforcement_count": similar[0].metadata.get("reinforcement_count", 0)
                            + 1
                        },
                        tenant_id=memory.tenant_id,
                    )
                    console.print(
                        f"[yellow]Updated reinforcement count for: {similar[0].id}[/yellow]"
                    )
                    return similar[0].id
                elif self.settings.deduplication_action == "merge":
                    merged_content = f"{similar[0].content}\n\n[Also noted]: {content}"
                    await self._weaviate.update_memory_metadata(
                        memory_id=similar[0].id,
                        tier=similar[0].tier,
                        metadata={"content": merged_content},
                        tenant_id=memory.tenant_id,
                    )
                    console.print(f"[yellow]Merged duplicate into: {similar[0].id}[/yellow]")
                    return similar[0].id

        # Check for contradictions synchronously when action is "reject"
        if (
            self.settings.contradiction_detection_enabled
            and self.settings.contradiction_action == "reject"
            and project_id
        ):
            conflicting_id = await self._check_contradiction_sync(memory, project_id)
            if conflicting_id:
                raise ValueError(f"Memory rejected: contradicts existing memory {conflicting_id}")

        # Store in Weaviate
        memory_id = await self._weaviate.add_memory(memory)

        # Run assessment pipeline (fire-and-forget)
        if (
            self.settings.auto_importance_enabled
            or self.settings.contradiction_detection_enabled
            or self.settings.deduplication_enabled
        ):
            asyncio.create_task(self._run_assessment(memory, memory_id))

        # Fire-and-forget: AI scoring + summarization via Ollama
        if self._ollama and len(content) > 200:
            asyncio.create_task(self._ai_enrich_memory(memory_id, memory))

        # Invalidate relevant caches
        await self._cache.invalidate_stats(memory.tenant_id)

        console.print(f"[green]✓ Added memory {memory_id} to {tier.name}[/green]")
        return memory_id

    async def add_batch(
        self,
        memories_data: list[dict[str, Any]],
    ) -> tuple[list[UUID], int]:
        """
        Add multiple memories in a single batch operation.

        Generates embeddings for all items in one API call, creates Memory
        objects, and inserts them via the client's batch API.

        Args:
            memories_data: List of dicts with memory fields. Each dict must
                contain 'content' and may include any field accepted by add().

        Returns:
            Tuple of (successful_ids, failed_count).
        """
        if not self._initialized:
            raise RuntimeError("MemorySystem not initialized. Call initialize() first.")

        # Batch embed all content in a single API call
        contents = [m["content"] for m in memories_data]
        embeddings = await self._get_embeddings_batch(contents)

        # Create Memory objects
        memories: list[Memory] = []
        for i, data in enumerate(memories_data):
            # Calculate expiration
            expires_at = None
            expires_in_days = data.get("expires_in_days")
            if expires_in_days:
                expires_at = datetime.now(UTC) + timedelta(days=expires_in_days)
            elif self.settings.memory_retention_days > 0:
                expires_at = datetime.now(UTC) + timedelta(days=self.settings.memory_retention_days)

            memory = Memory(
                content=data["content"],
                tier=data.get("tier", MemoryTier.PROJECT),
                memory_type=data.get("memory_type", MemoryType.FACT),
                source=data.get("source", MemorySource.AGENT),
                project_id=data.get("project_id"),
                user_id=data.get("user_id"),
                tenant_id=data.get("tenant_id") or self.settings.default_tenant_id,
                session_id=data.get("session_id"),
                importance=data.get("importance", 0.5),
                confidence=data.get("confidence", 1.0),
                tags=data.get("tags", []),
                metadata=data.get("metadata", {}),
                vector=embeddings[i],
                expires_at=expires_at,
            )
            memories.append(memory)

        # Batch insert into Weaviate
        successful_ids, failed_objects = await self._weaviate.add_memories_batch(memories)

        # Invalidate stats cache for all affected tenants
        tenants = {m.tenant_id for m in memories}
        for tenant in tenants:
            await self._cache.invalidate_stats(tenant)

        console.print(
            f"[green]✓ Batch added {len(successful_ids)} memories "
            f"({len(failed_objects)} failed)[/green]"
        )
        return successful_ids, len(failed_objects)

    async def search(
        self,
        query: str,
        tier: MemoryTier | None = None,
        project_id: str | None = None,
        user_id: str | None = None,
        tenant_id: str | None = None,
        tags: list[str] | None = None,
        min_importance: float | None = None,
        limit: int = 10,
        event_only: bool = False,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
    ) -> list[MemorySearchResult]:
        """
        Search memories across tiers.

        Args:
            query: Search query text
            tier: Optional tier filter
            project_id: Filter by project (Tier 1 only)
            user_id: Filter by user
            tenant_id: Filter by tenant
            tags: Filter by tags
            min_importance: Minimum importance filter
            limit: Maximum results to return

        Returns:
            List of MemorySearchResult with relevance scores
        """
        if not self._initialized:
            raise RuntimeError("MemorySystem not initialized. Call initialize() first.")

        # Build query object
        memory_query = MemoryQuery(
            query=query,
            tier=tier,
            project_id=project_id,
            user_id=user_id,
            tenant_id=tenant_id or self.settings.default_tenant_id,
            tags=tags,
            min_importance=min_importance,
            limit=limit,
            event_only=event_only,
            start_date=start_date,
            end_date=end_date,
        )

        # Check cache
        cached = await self._cache.get_search_results(memory_query)
        if cached:
            console.print("[cyan]Using cached search results[/cyan]")
            return [MemorySearchResult(**r) for r in cached]

        # Generate query embedding
        query_vector = await self._get_embedding(query)

        # Search Weaviate (hybrid: BM25 + vector with composite scoring)
        results = await self._weaviate.search(memory_query, query_vector)

        # Optional reranking
        if self.settings.reranker_enabled and results:
            results = await self._apply_reranking(query, results, top_k=limit)


        # --- Apply Confidence Weighting ---
        confidence_weight = 0.3
        for result in results:
            hybrid_score = result.score or 0.0
            if hasattr(result, 'rerank_score') and result.rerank_score is not None:
                hybrid_score = result.rerank_score
                
            confidence_score = getattr(result.memory, 'overall_confidence', 0.5)
            
            # Weighted combination
            combined_score = (hybrid_score * (1 - confidence_weight)) + (confidence_score * confidence_weight)
            
            # Apply temporal freshness factor if available
            try:
                if hasattr(result.memory, 'confidence_factors') and isinstance(result.memory.confidence_factors, dict):
                    temporal_freshness = result.memory.confidence_factors.get('temporal_freshness', 1.0)
                    combined_score *= temporal_freshness
            except Exception:
                pass
                
            result.composite_score = combined_score
            
        # Re-sort by composite_score
        results.sort(key=lambda x: x.composite_score, reverse=True)
        # -----------------------------------

        # Increment access_count for returned memories (fire-and-forget)
        for result in results:
            asyncio.ensure_future(
                self._weaviate.increment_access_count(
                    memory_id=result.memory.id,
                    tier=result.memory.tier,
                    current_count=result.memory.access_count,
                    tenant_id=result.memory.tenant_id,
                )
            )

        # Cache results (mode="json" ensures datetime is serializable)
        await self._cache.set_search_results(
            memory_query, [r.model_dump(mode="json") for r in results]
        )

        return results

    async def get(
        self, memory_id: UUID | str, tier: MemoryTier, tenant_id: str | None = None
    ) -> Memory | None:
        """Retrieve a specific memory by ID."""
        if isinstance(memory_id, str):
            memory_id = UUID(memory_id)

        # Check cache first
        cached = await self._cache.get_memory(str(memory_id), tier.value)
        if cached:
            return Memory(**cached)

        # Fetch from Weaviate
        memory = await self._weaviate.get_memory(memory_id, tier, tenant_id)

        if memory:
            await self._cache.set_memory(str(memory_id), tier.value, memory.model_dump(mode="json"))

        return memory

    async def list_memories(
        self,
        tier: MemoryTier | None = None,
        project_id: str | None = None,
        tenant_id: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[Memory], int]:
        """List memories without a search query.

        Returns:
            (memories_on_page, total_count) — total_count is the true count
            matching the filters, not just the size of the current page.
        """
        if not self._initialized:
            raise RuntimeError("MemorySystem not initialized. Call initialize() first.")
        return await self._weaviate.list_memories(
            tier=tier,
            project_id=project_id,
            tenant_id=tenant_id or self.settings.default_tenant_id,
            limit=limit,
            offset=offset,
        )

    async def delete(
        self, memory_id: UUID | str, tier: MemoryTier, tenant_id: str | None = None
    ) -> bool:
        """Delete a memory by ID."""
        if isinstance(memory_id, str):
            memory_id = UUID(memory_id)

        success = await self._weaviate.delete_memory(memory_id, tier, tenant_id)

        if success:
            # Invalidate caches
            await self._cache.delete_memory(str(memory_id), tier.value)
            await self._cache.invalidate_stats(tenant_id or self.settings.default_tenant_id)

        return success

    async def get_stats(self, tenant_id: str | None = None) -> MemoryStats:
        """Get memory statistics."""
        tenant = tenant_id or self.settings.default_tenant_id

        # Check cache
        cached = await self._cache.get_stats(tenant)
        if cached:
            return MemoryStats(**cached)

        # Get from Weaviate
        stats = await self._weaviate.get_stats(tenant)

        # Cache stats
        await self._cache.set_stats(tenant, stats.model_dump(mode="json"))

        return stats

    def _heuristic_consolidation(self, memories: list[Memory], memory_type: str) -> str | None:
        if not memories:
            return None

        avg_importance = sum(m.importance for m in memories) / len(memories)

        all_tags: list[str] = []
        for m in memories:
            all_tags.extend(m.tags)

        tag_counts = Counter(all_tags)
        common_tags = [tag for tag, count in tag_counts.most_common(5) if count > 1]

        fact_parts = [f"In {memory_type} situations ({len(memories)} observations)"]

        if common_tags:
            fact_parts.append(f"common themes: {', '.join(common_tags)}")

        fact_parts.append(f"Average importance: {avg_importance:.0%}")

        return ". ".join(fact_parts)

    async def consolidate(self, project_id: str | None = None, tenant_id: str | None = None) -> int:
        """
        Consolidate memories - merge similar ones, promote important ones.

        This is a background operation that:
        1. Finds similar memories
        2. Merges duplicates
        3. Promotes high-importance Tier 1 memories to Tier 2
        4. Cleans up expired memories

        Returns:
            Number of memories processed
        """
        if not self._initialized:
            raise RuntimeError("MemorySystem not initialized. Call initialize() first.")

        tenant = tenant_id or self.settings.default_tenant_id
        processed = 0

        # find_consolidation_candidates returns list[Memory] (flat list)
        candidates: list[Memory] = await self._weaviate.find_consolidation_candidates(
            tier=MemoryTier.PROJECT,
            hours_back=self.settings.consolidation_hours_back,
            tenant_id=tenant,
            project_id=project_id,
        )

        # Group by memory_type for heuristic consolidation
        grouped: dict[str, list[Memory]] = {}
        for mem in candidates:
            mt = mem.memory_type if isinstance(mem.memory_type, str) else mem.memory_type.value
            grouped.setdefault(mt, []).append(mem)

        for memory_type, memories in grouped.items():
            if len(memories) < self.settings.consolidation_min_group_size:
                continue

            fact = self._heuristic_consolidation(memories, memory_type)
            if not fact:
                continue

            embedding = await self._get_embedding(fact)

            consolidated_memory = Memory(
                content=fact,
                tier=MemoryTier.GENERAL,
                memory_type=MemoryType.CONSOLIDATED,
                source=MemorySource.SYSTEM,
                project_id=project_id,
                tenant_id=tenant,
                importance=0.7,
                confidence=self.settings.consolidation_confidence,
                tags=["consolidated", memory_type],
                metadata={"source_count": len(memories), "source_type": memory_type},
                vector=embedding,
            )
            new_id = await self._weaviate.add_memory(consolidated_memory)

            for mem in memories:
                await self._weaviate.update_memory_metadata(
                    memory_id=mem.id,
                    tier=MemoryTier.PROJECT,
                    metadata={"consolidated": True, "consolidated_to": str(new_id)},
                    tenant_id=tenant,
                )

            processed += len(memories)

        promoted = await self._promote_important_memories(tenant, project_id)
        processed += promoted

        await self._cache.invalidate_stats(tenant)

        console.print(f"[green]✓ Consolidated {processed} memories[/green]")
        return processed

    async def _promote_important_memories(
        self, tenant_id: str, project_id: str | None = None
    ) -> int:
        promoted = 0
        # find_consolidation_candidates returns list[Memory]
        candidates: list[Memory] = await self._weaviate.find_consolidation_candidates(
            tier=MemoryTier.PROJECT,
            hours_back=self.settings.consolidation_hours_back,
            tenant_id=tenant_id,
            project_id=project_id,
        )

        for mem in candidates:
            if mem.importance > 0.8:
                embedding = await self._get_embedding(mem.content)
                promoted_memory = Memory(
                    content=mem.content,
                    tier=MemoryTier.GENERAL,
                    memory_type=mem.memory_type,
                    source=mem.source,
                    project_id=mem.project_id,
                    tenant_id=tenant_id,
                    importance=mem.importance,
                    confidence=mem.confidence,
                    tags=mem.tags,
                    metadata={**mem.metadata, "promoted_from": str(mem.id)},
                    vector=embedding,
                )
                new_id = await self._weaviate.add_memory(promoted_memory)

                await self._weaviate.update_memory_metadata(
                    memory_id=mem.id,
                    tier=MemoryTier.PROJECT,
                    metadata={"promoted": True, "promoted_to": str(new_id)},
                    tenant_id=tenant_id,
                )
                promoted += 1

        return promoted

    async def cleanup_expired(self, tenant_id: str | None = None) -> int:
        """
        Remove expired memories across all tiers.

        Deletes memories where expires_at < now for each tier,
        then invalidates the stats cache so counts stay accurate.

        Args:
            tenant_id: Tenant identifier for multi-tenancy

        Returns:
            Number of memories removed
        """
        if not self._initialized:
            raise RuntimeError("MemorySystem not initialized. Call initialize() first.")

        tenant = tenant_id or self.settings.default_tenant_id
        total_deleted = 0

        for tier in MemoryTier:
            deleted = await self._weaviate.delete_expired_memories(tier, tenant)
            total_deleted += deleted

        if total_deleted > 0:
            await self._cache.invalidate_stats(tenant)

        console.print(f"[green]✓ Cleaned up {total_deleted} expired memories[/green]")
        return total_deleted

    def _get_context_builder(self) -> ContextBuilder:
        if self._context_builder is None:
            self._context_builder = ContextBuilder(self)
        return self._context_builder

    def _get_reranker(self) -> "MemoryReranker":
        """Return the legacy MemoryReranker (kept for backward compat)."""
        if self._reranker is None:
            self._reranker = MemoryReranker(model_name=self.settings.reranker_model)
        assert self._reranker is not None
        return self._reranker

    async def _apply_reranking(
        self, query: str, results: list[MemorySearchResult], top_k: int
    ) -> list[MemorySearchResult]:
        """Rerank search results using BGEReranker (CPU-bound, run in thread)."""
        from memory_system.embeddings import BGEReranker

        if not hasattr(self, "_bge_reranker") or self._bge_reranker is None:
            self._bge_reranker = BGEReranker()

        documents = [r.memory.content for r in results]
        ranked = await asyncio.to_thread(self._bge_reranker.rerank, query, documents, top_k)

        reranked = []
        for position, (orig_idx, score) in enumerate(ranked):
            result = results[orig_idx]
            result.rerank_score = float(score)
            result.rerank_position = position
            reranked.append(result)
        return reranked

    def _get_rag(self) -> MemoryRAG:
        if self._rag is None:
            self._rag = MemoryRAG(self, self._get_context_builder())
        return self._rag

    def _get_analyzer(self) -> MemoryAnalyzer:
        if self._analyzer is None:
            self._analyzer = MemoryAnalyzer(self)
        return self._analyzer

    async def _check_contradiction_sync(self, memory: Memory, project_id: str) -> UUID | None:
        """
        Synchronous heuristic contradiction check (no LLM) for use in add().
        Returns the ID of a contradicting memory, or None if no contradiction found.
        """
        tenant_id = memory.tenant_id or self.settings.default_tenant_id
        try:
            # find_consolidation_candidates returns list[Memory]
            all_recent: list[Memory] = await self._weaviate.find_consolidation_candidates(
                tier=memory.tier,
                hours_back=self.settings.consolidation_hours_back,
                tenant_id=tenant_id,
                project_id=project_id,
            )

            content_lower = memory.content.lower()
            negation_words = ["not", "never", "no", "don't", "doesn't", "won't", "isn't"]
            has_negation = any(neg in content_lower for neg in negation_words)

            for mem in all_recent:
                if mem.project_id is None or str(mem.project_id) != project_id:
                    continue
                mem_lower = mem.content.lower()
                mem_has_negation = any(neg in mem_lower for neg in negation_words)
                if has_negation != mem_has_negation:
                    shared = set(content_lower.split()) & set(mem_lower.split())
                    if len(shared) > 3:
                        return mem.id
        except Exception:
            pass
        return None

    async def _run_assessment(self, memory: Memory, memory_id: UUID) -> None:
        """Fire-and-forget assessment pipeline."""
        try:
            analyzer = self._get_analyzer()
            analysis = await analyzer.analyze(memory)

            if analysis.contradicts and self.settings.contradiction_detection_enabled:
                if self.settings.contradiction_action == "flag":
                    await self._weaviate.update_memory_metadata(
                        memory_id=memory_id,
                        tier=memory.tier,
                        metadata={"contradicts_with": [str(mid) for mid in analysis.contradicts]},
                        tenant_id=memory.tenant_id,
                    )
                elif self.settings.contradiction_action == "merge":
                    resolution_content = (
                        f"Resolution: Memory {memory_id} addresses conflicting perspectives."
                    )
                    resolution = Memory(
                        content=resolution_content,
                        tier=memory.tier,
                        memory_type=MemoryType.INSIGHT,
                        source=MemorySource.SYSTEM,
                        project_id=memory.project_id,
                        tenant_id=memory.tenant_id,
                        importance=0.6,
                        confidence=0.5,
                        metadata={
                            "resolves": str(memory_id),
                            "conflicts": [str(mid) for mid in analysis.contradicts],
                        },
                        vector=memory.vector,
                    )
                    await self._weaviate.add_memory(resolution)
            if (
                analysis.importance is not None
                and self.settings.auto_importance_enabled
                and analysis.importance >= self.settings.auto_importance_threshold
            ):
                # Persist importance to the top-level Weaviate field
                await self._weaviate.update_memory_fields(
                    memory_id=memory_id,
                    tier=memory.tier,
                    fields={"importance": analysis.importance},
                    tenant_id=memory.tenant_id,
                )
                # Persist reasoning to the metadata JSON blob
                await self._weaviate.update_memory_metadata(
                    memory_id=memory_id,
                    tier=memory.tier,
                    metadata={"importance_reasoning": analysis.importance_reasoning},
                    tenant_id=memory.tenant_id,
                )
            if analysis.suggested_tags:
                existing = memory.tags or []
                new_tags = list(set(existing + analysis.suggested_tags))
                await self._weaviate.update_memory_fields(
                    memory_id=memory_id,
                    tier=memory.tier,
                    fields={"tags": new_tags},
                    tenant_id=memory.tenant_id,
                )

            await self._weaviate.add_analysis(analysis)
            console.print(f"[cyan]✓ Analyzed memory {memory_id}[/cyan]")
        except Exception as e:
            console.print(f"[yellow]Warning: assessment failed for {memory_id}: {e}[/yellow]")

    async def _ai_enrich_memory(self, memory_id: UUID, memory: Memory) -> None:
        """Fire-and-forget: score importance + summarize using Ollama."""
        if not self._ollama:
            return
        try:
            updates = {}
            # Score importance
            if self.settings.auto_importance_enabled:
                importance, reason = await self._ollama.score_importance(memory.content)
                updates["importance"] = importance
                # Store reason in metadata
                await self._weaviate.update_memory_metadata(
                    memory_id=memory_id,
                    tier=memory.tier,
                    metadata={"importance_reasoning": reason},
                    tenant_id=memory.tenant_id,
                )
            # Summarize if long
            if len(memory.content) > 200:
                summary = await self._ollama.summarize(memory.content)
                if summary:
                    updates["summary"] = summary
            if updates:
                await self._weaviate.update_memory_fields(
                    memory_id=memory_id,
                    tier=memory.tier,
                    fields=updates,
                    tenant_id=memory.tenant_id,
                )
        except Exception as e:
            import logging

            logging.getLogger(__name__).warning(f"AI enrichment failed for {memory_id}: {e}")

    async def build_context(
        self,
        query: str,
        tier: MemoryTier | None = None,
        project_id: str | None = None,
        user_id: str | None = None,
        session_id: str | None = None,
        max_tokens: int | None = None,
    ) -> str:
        if not self._initialized:
            raise RuntimeError("MemorySystem not initialized. Call initialize() first.")

        return await self._get_context_builder().build_context(
            query=query,
            tier=tier,
            project_id=project_id,
            user_id=user_id,
            session_id=session_id,
            max_tokens=max_tokens,
        )

    async def rag_query(
        self,
        query: str,
        tier: MemoryTier | None = None,
        project_id: str | None = None,
        user_id: str | None = None,
        session_id: str | None = None,
    ) -> dict[str, Any]:
        if not self._initialized:
            raise RuntimeError("MemorySystem not initialized. Call initialize() first.")

        return await self._get_rag().answer_with_full_context(
            query=query,
            project_id=project_id,
            user_id=user_id,
            session_id=session_id,
        )

    async def create_tenant(self, tenant_id: str) -> bool:
        """Create a new tenant."""
        if not self._initialized:
            raise RuntimeError("MemorySystem not initialized. Call initialize() first.")
        return await self._weaviate.create_tenant(tenant_id)

    async def delete_tenant(self, tenant_id: str) -> bool:
        """Delete a tenant and all their memories."""
        if not self._initialized:
            raise RuntimeError("MemorySystem not initialized. Call initialize() first.")
        success = await self._weaviate.delete_tenant(tenant_id)
        if success:
            await self._cache.invalidate_stats(tenant_id)
        return success

    async def list_tenants(self) -> list[str]:
        """List all tenants."""
        if not self._initialized:
            raise RuntimeError("MemorySystem not initialized. Call initialize() first.")
        return await self._weaviate.list_tenants()

    async def export_memories(
        self,
        tier: MemoryTier,
        project_id: str | None = None,
        tenant_id: str | None = None,
        format: str = "json",
    ) -> str:
        """
        Export memories for backup or migration.

        Args:
            tier: Which tier to export
            project_id: Project filter (Tier 1)
            tenant_id: Tenant filter
            format: Export format (json, markdown)

        Returns:
            Exported data as string
        """
        console.print("[yellow]Memory export not yet implemented[/yellow]")
        return "{}"

    async def close(self) -> None:
        """Close all connections."""
        await self._weaviate.close()
        await self._cache.close()
        self._initialized = False
        console.print("[blue]AI Memory System closed[/blue]")

    @property
    def is_initialized(self) -> bool:
        """Check if system is initialized."""
        return self._initialized

    @property
    def is_healthy(self) -> bool:
        """Check if all components are healthy."""
        return self._initialized and self._weaviate.is_connected and self._cache.is_connected

    # ---------------------------------------------------------------------------
    # Knowledge Graph delegates
    # ---------------------------------------------------------------------------

    def _require_initialized(self) -> None:
        if not self._initialized:
            raise RuntimeError("MemorySystem not initialized. Call initialize() first.")

    async def add_entity(
        self,
        name: str,
        entity_type: str,
        description: str | None = None,
        project_id: str | None = None,
        tenant_id: str | None = None,
        aliases: list[str] | None = None,
        metadata: dict | None = None,
    ) -> UUID:
        """Add a knowledge graph entity."""
        self._require_initialized()
        entity = KnowledgeEntity(
            name=name,
            entity_type=entity_type,
            description=description,
            project_id=project_id,
            tenant_id=tenant_id or self.settings.default_tenant_id,
            aliases=aliases or [],
            metadata=metadata or {},
        )
        return await self._weaviate.add_entity(entity)

    async def get_entity(
        self, entity_id: UUID | str, tenant_id: str | None = None
    ) -> KnowledgeEntity | None:
        """Retrieve a knowledge graph entity by ID."""
        self._require_initialized()
        if isinstance(entity_id, str):
            entity_id = UUID(entity_id)
        return await self._weaviate.get_entity(entity_id, tenant_id)

    async def find_entity_by_name(
        self,
        name: str,
        project_id: str | None = None,
        tenant_id: str | None = None,
    ) -> KnowledgeEntity | None:
        """Find a knowledge graph entity by name."""
        self._require_initialized()
        return await self._weaviate.find_entity_by_name(name, project_id, tenant_id)

    async def list_entities(
        self,
        project_id: str | None = None,
        tenant_id: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[KnowledgeEntity]:
        """List knowledge graph entities."""
        self._require_initialized()
        return await self._weaviate.list_entities(
            project_id=project_id,
            tenant_id=tenant_id,
            limit=limit,
            offset=offset,
        )

    async def add_relation(
        self,
        source_entity_id: UUID | str,
        target_entity_id: UUID | str,
        relation_type: str,
        weight: float = 1.0,
        project_id: str | None = None,
        tenant_id: str | None = None,
        context: str | None = None,
    ) -> UUID:
        """Add a relation between two knowledge graph entities."""
        self._require_initialized()
        if isinstance(source_entity_id, str):
            source_entity_id = UUID(source_entity_id)
        if isinstance(target_entity_id, str):
            target_entity_id = UUID(target_entity_id)
        relation = KnowledgeRelation(
            source_entity_id=source_entity_id,
            target_entity_id=target_entity_id,
            relation_type=relation_type,
            weight=weight,
            project_id=project_id,
            tenant_id=tenant_id or self.settings.default_tenant_id,
            context=context,
        )
        return await self._weaviate.add_relation(relation)

    async def query_graph(
        self,
        entity_id: UUID | str,
        project_id: str | None = None,
        tenant_id: str | None = None,
        depth: int = 1,
    ) -> GraphQueryResult:
        """Traverse the knowledge graph from an entity."""
        self._require_initialized()
        if isinstance(entity_id, str):
            entity_id = UUID(entity_id)
        return await self._weaviate.query_graph(
            entity_id=entity_id,
            project_id=project_id,
            tenant_id=tenant_id,
            depth=depth,
        )

    async def delete_entity(self, entity_id: UUID | str, tenant_id: str | None = None) -> bool:
        """Delete a knowledge graph entity by ID."""
        self._require_initialized()
        if isinstance(entity_id, str):
            entity_id = UUID(entity_id)
        return await self._weaviate.delete_entity(entity_id, tenant_id)
