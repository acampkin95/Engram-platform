# weaviate_memory/retrieval.py
"""
Memory retrieval strategies with hybrid search, recency-importance weighting.
"""

import weaviate
import weaviate.classes.query as wvc
from datetime import datetime, timedelta
from typing import Optional


class MemoryRetrieval:
    """Handles retrieval operations across all memory types."""
    
    def __init__(self, client: weaviate.WeaviateClient):
        self.client = client
        self.episodic = client.collections.get("EpisodicMemory")
        self.semantic = client.collections.get("SemanticMemory")
        self.procedural = client.collections.get("ProceduralMemory")
        self.working = client.collections.get("WorkingMemory")
    
    def retrieve_relevant_memories(
        self,
        query: str,
        memory_types: Optional[list[str]] = None,
        limit: int = 10,
        importance_weight: float = 0.3,
        recency_weight: float = 0.3,
        similarity_weight: float = 0.4,
        min_importance: float = 0.0
    ) -> list[dict]:
        """
        Retrieve memories using hybrid scoring combining:
        - Semantic similarity to query
        - Recency score (exponential decay)
        - Importance score
        
        Args:
            query: Search query
            memory_types: List of types to search (episodic, semantic, procedural)
            limit: Maximum results to return
            importance_weight: Weight for importance in composite score
            recency_weight: Weight for recency in composite score
            similarity_weight: Weight for similarity in composite score
            min_importance: Minimum importance threshold
        
        Returns:
            List of scored memory dicts
        """
        memory_types = memory_types or ["episodic", "semantic"]
        all_results = []
        
        collection_map = {
            "episodic": self.episodic,
            "semantic": self.semantic,
            "procedural": self.procedural,
            "working": self.working
        }
        
        for mem_type in memory_types:
            collection = collection_map.get(mem_type)
            if not collection:
                continue
            
            try:
                response = collection.query.hybrid(
                    query=query,
                    alpha=0.7,
                    limit=limit * 2,
                    return_metadata=wvc.MetadataQuery(distance=True)
                )
                
                for obj in response.objects:
                    similarity = 1.0 - (obj.metadata.distance / 2.0) if obj.metadata.distance else 0.5
                    recency = obj.properties.get("recencyScore", 0.5)
                    importance = obj.properties.get("importanceScore", 0.5)
                    
                    if importance < min_importance:
                        continue
                    
                    composite = (
                        similarity_weight * similarity +
                        recency_weight * recency +
                        importance_weight * importance
                    )
                    
                    all_results.append({
                        "uuid": str(obj.uuid),
                        "type": mem_type,
                        "properties": obj.properties,
                        "scores": {
                            "similarity": round(similarity, 4),
                            "recency": round(recency, 4),
                            "importance": round(importance, 4),
                            "composite": round(composite, 4)
                        }
                    })
            except Exception as e:
                print(f"Error querying {mem_type}: {e}")
                continue
        
        all_results.sort(key=lambda x: x["scores"]["composite"], reverse=True)
        return all_results[:limit]
    
    def retrieve_session_context(
        self,
        session_id: str,
        limit: int = 20
    ) -> list[dict]:
        """Retrieve all memories from a specific session in order."""
        response = self.episodic.query.fetch_objects(
            filters=wvc.Filter.by_property("sessionId").equal(session_id),
            limit=limit,
        )
        
        results = [obj.properties for obj in response.objects]
        results.sort(key=lambda x: x.get("sequenceIndex", 0))
        return results
    
    def retrieve_user_preferences(
        self,
        user_id: str,
        domain: Optional[str] = None
    ) -> list[dict]:
        """Retrieve semantic memories that are user preferences."""
        filters = [
            wvc.Filter.by_property("factType").equal("preference")
        ]
        
        if domain:
            filters.append(wvc.Filter.by_property("domain").equal(domain))
        
        combined_filter = filters[0]
        for f in filters[1:]:
            combined_filter = combined_filter & f
        
        response = self.semantic.query.fetch_objects(
            filters=combined_filter,
            limit=50
        )
        return [obj.properties for obj in response.objects]
    
    def retrieve_applicable_procedures(
        self,
        goal: str,
        context: Optional[str] = None,
        min_success_rate: float = 0.0
    ) -> list[dict]:
        """Find procedures that match the goal and context."""
        search_query = f"{goal} {context or ''}"
        
        response = self.procedural.query.near_text(
            query=search_query,
            limit=10,
            return_metadata=wvc.MetadataQuery(distance=True)
        )
        
        results = []
        for obj in response.objects:
            success_rate = obj.properties.get("successRate", 0)
            if success_rate >= min_success_rate:
                results.append({
                    "properties": obj.properties,
                    "relevance": 1.0 - (obj.metadata.distance / 2.0) if obj.metadata.distance else 0.5,
                    "success_rate": success_rate
                })
        
        return sorted(results, key=lambda x: x["success_rate"], reverse=True)
    
    def retrieve_memories_in_timeframe(
        self,
        start_date: datetime,
        end_date: Optional[datetime] = None,
        event_types: Optional[list[str]] = None,
        limit: int = 100
    ) -> list[dict]:
        """Retrieve memories within a specific time window."""
        end_date = end_date or datetime.now()
        
        filters = [
            wvc.Filter.by_property("timestamp").greater_than(start_date.isoformat()),
            wvc.Filter.by_property("timestamp").less_than(end_date.isoformat())
        ]
        
        if event_types:
            type_filter = wvc.Filter.by_property("eventType").equal(event_types[0])
            for et in event_types[1:]:
                type_filter = type_filter | wvc.Filter.by_property("eventType").equal(et)
            filters.append(type_filter)
        
        combined_filter = filters[0]
        for f in filters[1:]:
            combined_filter = combined_filter & f
        
        response = self.episodic.query.fetch_objects(
            filters=combined_filter,
            limit=limit,
        )
        
        results = [obj.properties for obj in response.objects]
        results.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
        return results
    
    def retrieve_recent_interactions(
        self,
        hours_back: int = 24,
        user_id: Optional[str] = None,
        limit: int = 50
    ) -> list[dict]:
        """Retrieve recent interactions for context building."""
        cutoff = datetime.now() - timedelta(hours=hours_back)
        
        filters = [
            wvc.Filter.by_property("timestamp").greater_than(cutoff.isoformat())
        ]
        
        if user_id:
            filters.append(wvc.Filter.by_property("userId").equal(user_id))
        
        combined_filter = filters[0]
        for f in filters[1:]:
            combined_filter = combined_filter & f
        
        response = self.episodic.query.fetch_objects(
            filters=combined_filter,
            limit=limit,
        )
        
        results = [obj.properties for obj in response.objects]
        results.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
        return results
    
    def search_with_context(
        self,
        query: str,
        user_id: Optional[str] = None,
        event_types: Optional[list[str]] = None,
        min_importance: Optional[float] = None,
        limit: int = 10
    ) -> list[dict]:
        """Semantic search with contextual filters."""
        filter_conditions = []
        
        if user_id:
            filter_conditions.append(
                wvc.Filter.by_property("userId").equal(user_id)
            )
        
        if event_types:
            type_filter = wvc.Filter.by_property("eventType").equal(event_types[0])
            for et in event_types[1:]:
                type_filter = type_filter | wvc.Filter.by_property("eventType").equal(et)
            filter_conditions.append(type_filter)
        
        if min_importance:
            filter_conditions.append(
                wvc.Filter.by_property("importanceScore").greater_or_equal(min_importance)
            )
        
        combined_filter = None
        if filter_conditions:
            combined_filter = filter_conditions[0]
            for f in filter_conditions[1:]:
                combined_filter = combined_filter & f
        
        response = self.episodic.query.near_text(
            query=query,
            filters=combined_filter,
            limit=limit,
            return_metadata=wvc.MetadataQuery(distance=True)
        )
        
        return [{
            "uuid": str(obj.uuid),
            "properties": obj.properties,
            "distance": obj.metadata.distance
        } for obj in response.objects]
    
    def get_working_memory_context(
        self,
        session_id: str,
        limit: int = 10
    ) -> list[dict]:
        """Get active working memory for current session."""
        now = datetime.now().isoformat()
        
        response = self.working.query.fetch_objects(
            filters=(
                wvc.Filter.by_property("sessionId").equal(session_id) &
                wvc.Filter.by_property("expiresAt").greater_than(now)
            ),
            limit=limit,
        )
        
        results = [obj.properties for obj in response.objects]
        results.sort(key=lambda x: x.get("turnIndex", 0))
        return results
    
    def find_similar_episodes(
        self,
        content: str,
        threshold: float = 0.3,
        limit: int = 5
    ) -> list[dict]:
        """Find episodes semantically similar to given content."""
        response = self.episodic.query.near_text(
            query=content,
            limit=limit,
            return_metadata=wvc.MetadataQuery(distance=True)
        )
        
        results = []
        for obj in response.objects:
            if obj.metadata.distance and obj.metadata.distance <= threshold:
                results.append({
                    "uuid": str(obj.uuid),
                    "properties": obj.properties,
                    "similarity": 1.0 - (obj.metadata.distance / 2.0)
                })
        
        return results
    
    def get_facts_by_domain(
        self,
        domain: str,
        category: Optional[str] = None,
        limit: int = 20
    ) -> list[dict]:
        """Retrieve semantic facts for a specific domain."""
        filters = [wvc.Filter.by_property("domain").equal(domain)]
        
        if category:
            filters.append(wvc.Filter.by_property("category").equal(category))
        
        combined_filter = filters[0]
        for f in filters[1:]:
            combined_filter = combined_filter & f
        
        response = self.semantic.query.fetch_objects(
            filters=combined_filter,
            limit=limit,
        )
        
        return [obj.properties for obj in response.objects]
