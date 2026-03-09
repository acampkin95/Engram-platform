# weaviate_memory/tenant.py
"""
Multi-tenant memory management for per-agent/user isolation.
"""

import weaviate
import weaviate.classes.query as wvc
from weaviate.classes.tenants import Tenant
from datetime import datetime
from typing import Optional


class TenantMemoryManager:
    """Manage memory for a specific agent/user tenant."""
    
    def __init__(
        self,
        client: weaviate.WeaviateClient,
        tenant_id: str
    ):
        """
        Initialize tenant memory manager.
        
        Args:
            client: Weaviate client
            tenant_id: Unique tenant identifier (agent_id or user_id)
        """
        self.client = client
        self.tenant_id = tenant_id
        self._ensure_tenant_exists()
    
    def _ensure_tenant_exists(self):
        """Create tenant if it doesn't exist."""
        for collection_name in ["EpisodicMemoryMT", "SemanticMemoryMT"]:
            try:
                collection = self.client.collections.get(collection_name)
                collection.tenants.create([Tenant(name=self.tenant_id)])
            except Exception:
                pass  # Tenant already exists or collection doesn't exist
    
    def get_episodic(self):
        """Get tenant-scoped episodic collection."""
        return self.client.collections.get("EpisodicMemoryMT").with_tenant(self.tenant_id)
    
    def get_semantic(self):
        """Get tenant-scoped semantic collection."""
        return self.client.collections.get("SemanticMemoryMT").with_tenant(self.tenant_id)
    
    def store_memory(
        self,
        content: str,
        memory_type: str = "episodic",
        **kwargs
    ) -> str:
        """
        Store memory for this tenant.
        
        Args:
            content: Memory content
            memory_type: 'episodic' or 'semantic'
            **kwargs: Additional properties
        
        Returns:
            UUID of stored memory
        """
        if memory_type == "episodic":
            collection = self.get_episodic()
            properties = {
                "content": content,
                "eventType": kwargs.get("event_type", "general"),
                "timestamp": datetime.now().isoformat(),
                "importanceScore": kwargs.get("importance", 0.5),
                "recencyScore": 1.0,
                "accessCount": 0,
            }
        else:  # semantic
            collection = self.get_semantic()
            properties = {
                "fact": content,
                "factType": kwargs.get("fact_type", "general"),
                "domain": kwargs.get("domain"),
                "confidenceScore": kwargs.get("confidence", 0.8),
                "usageFrequency": 0,
            }
        
        uuid = collection.data.insert(properties=properties)
        return str(uuid)
    
    def search_memories(
        self,
        query: str,
        memory_type: str = "episodic",
        limit: int = 10
    ) -> list[dict]:
        """
        Search memories for this tenant only.
        
        Args:
            query: Search query
            memory_type: 'episodic' or 'semantic'
            limit: Maximum results
        
        Returns:
            List of memory property dicts
        """
        collection = self.get_episodic() if memory_type == "episodic" else self.get_semantic()
        
        response = collection.query.near_text(
            query=query,
            limit=limit,
            return_metadata=wvc.MetadataQuery(distance=True)
        )
        
        return [{
            "uuid": str(obj.uuid),
            "properties": obj.properties,
            "distance": obj.metadata.distance
        } for obj in response.objects]
    
    def get_all_memories(
        self,
        memory_type: str = "episodic",
        limit: int = 100
    ) -> list[dict]:
        """Get all memories for this tenant."""
        collection = self.get_episodic() if memory_type == "episodic" else self.get_semantic()
        
        response = collection.query.fetch_objects(limit=limit)
        return [obj.properties for obj in response.objects]
    
    def delete_memory(
        self,
        uuid: str,
        memory_type: str = "episodic"
    ) -> bool:
        """Delete a specific memory."""
        collection = self.get_episodic() if memory_type == "episodic" else self.get_semantic()
        collection.data.delete_by_id(uuid)
        return True
    
    def clear_all_memories(self, memory_type: str = "episodic"):
        """Clear all memories for this tenant (use with caution)."""
        collection = self.get_episodic() if memory_type == "episodic" else self.get_semantic()
        
        # Delete all objects
        for obj in collection.iterator():
            collection.data.delete_by_id(obj.uuid)


class HybridMemoryArchitecture:
    """
    Combines shared domain knowledge (all agents)
    with tenant-specific customizations.
    """
    
    def __init__(
        self,
        client: weaviate.WeaviateClient,
        tenant_id: str
    ):
        """
        Initialize hybrid architecture.
        
        Args:
            client: Weaviate client
            tenant_id: Tenant identifier
        """
        self.client = client
        self.tenant_id = tenant_id
        self.shared = client.collections.get("SemanticMemory")
        self.tenant_manager = TenantMemoryManager(client, tenant_id)
    
    def retrieve_knowledge_with_overrides(
        self,
        query: str,
        limit: int = 10
    ) -> list[dict]:
        """
        Retrieve knowledge combining shared facts with tenant overrides.
        Tenant-specific facts take precedence.
        
        Args:
            query: Search query
            limit: Maximum results
        
        Returns:
            List of knowledge items (tenant overrides shared)
        """
        # Get shared knowledge
        shared_results = self.shared.query.near_text(
            query=query,
            limit=limit,
            return_metadata=wvc.MetadataQuery(distance=True)
        )
        
        # Get tenant-specific knowledge
        tenant_results = self.tenant_manager.search_memories(
            query=query,
            memory_type="semantic",
            limit=limit
        )
        
        # Build result set with overrides
        shared_facts = {}
        for obj in shared_results.objects:
            domain = obj.properties.get("domain", "general")
            shared_facts[domain] = {
                "properties": obj.properties,
                "source": "shared",
                "distance": obj.metadata.distance
            }
        
        # Tenant overrides shared facts in same domain
        for item in tenant_results:
            domain = item["properties"].get("domain", "tenant")
            shared_facts[domain] = {
                "properties": item["properties"],
                "source": "tenant",
                "distance": item.get("distance")
            }
        
        results = list(shared_facts.values())
        results.sort(key=lambda x: x.get("distance") or 1.0)
        
        return results[:limit]
    
    def store_tenant_override(
        self,
        fact: str,
        domain: str,
        confidence: float = 0.9
    ) -> str:
        """
        Store a tenant-specific fact that overrides shared knowledge.
        
        Args:
            fact: The fact content
            domain: Domain to override
            confidence: Confidence score
        
        Returns:
            UUID of stored override
        """
        return self.tenant_manager.store_memory(
            content=fact,
            memory_type="semantic",
            fact_type="override",
            domain=domain,
            confidence=confidence
        )
    
    def store_shared_knowledge(
        self,
        fact: str,
        domain: str,
        category: Optional[str] = None,
        confidence: float = 0.8
    ) -> str:
        """
        Store knowledge in shared collection (available to all tenants).
        
        Args:
            fact: The fact content
            domain: Knowledge domain
            category: Optional category
            confidence: Confidence score
        
        Returns:
            UUID of stored fact
        """
        properties = {
            "fact": fact,
            "factType": "shared_knowledge",
            "domain": domain,
            "category": category,
            "confidenceScore": confidence,
            "createdAt": datetime.now().isoformat(),
            "lastUpdated": datetime.now().isoformat(),
            "usageFrequency": 0,
            "importanceScore": 0.6,
            "version": 1,
        }
        
        uuid = self.shared.data.insert(properties=properties)
        return str(uuid)
