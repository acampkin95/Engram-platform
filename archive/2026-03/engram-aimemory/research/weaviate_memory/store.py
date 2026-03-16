# weaviate_memory/store.py
"""
Memory storage operations for episodic, semantic, and procedural memories.
"""

import weaviate
import weaviate.classes.query as wvc
from datetime import datetime
from typing import Optional, Any
import json


class MemoryStore:
    """Handles storage operations for all memory types."""
    
    def __init__(self, client: weaviate.WeaviateClient):
        self.client = client
        self.episodic = client.collections.get("EpisodicMemory")
        self.semantic = client.collections.get("SemanticMemory")
        self.procedural = client.collections.get("ProceduralMemory")
        self.working = client.collections.get("WorkingMemory")
    
    def store_episode(
        self,
        content: str,
        event_type: str,
        session_id: str,
        user_id: Optional[str] = None,
        agent_id: Optional[str] = None,
        actions: Optional[list[str]] = None,
        outcomes: Optional[list[str]] = None,
        context_factors: Optional[list[str]] = None,
        success_score: Optional[float] = None,
        importance: float = 0.5,
        metadata: Optional[dict] = None
    ) -> str:
        """
        Store an episodic memory with full context.
        
        Args:
            content: The memory content/description
            event_type: Category (interaction, observation, decision, outcome, error)
            session_id: Session identifier for grouping
            user_id: Optional user identifier
            agent_id: Optional agent identifier
            actions: List of actions taken
            outcomes: List of observed outcomes
            context_factors: Environmental/contextual factors
            success_score: Success metric (0.0 to 1.0)
            importance: Initial importance score (0.0 to 1.0)
            metadata: Additional metadata dict
        
        Returns:
            UUID of stored memory
        """
        memory_object = {
            "content": content,
            "eventType": event_type,
            "timestamp": datetime.now().isoformat(),
            "sessionId": session_id,
            "sequenceIndex": self._get_next_sequence_index(session_id),
            "userId": user_id,
            "agentId": agent_id,
            "actionsTaken": actions or [],
            "observedOutcomes": outcomes or [],
            "contextFactors": context_factors or [],
            "successScore": success_score,
            "importanceScore": importance,
            "recencyScore": 1.0,
            "accessCount": 0,
            "consolidatedToSemantic": False,
        }
        
        uuid = self.episodic.data.insert(properties=memory_object)
        return str(uuid)
    
    def _get_next_sequence_index(self, session_id: str) -> int:
        """Get next sequence index for session ordering."""
        try:
            results = self.episodic.query.fetch_objects(
                filters=wvc.Filter.by_property("sessionId").equal(session_id),
                limit=1,
            )
            if results.objects:
                max_index = max(
                    obj.properties.get("sequenceIndex", 0) 
                    for obj in results.objects
                )
                return max_index + 1
        except Exception:
            pass
        return 0
    
    def store_semantic_fact(
        self,
        fact: str,
        fact_type: str,
        domain: Optional[str] = None,
        category: Optional[str] = None,
        confidence: float = 0.8,
        derived_from_episodes: Optional[list[str]] = None,
        related_concepts: Optional[list[str]] = None,
        applicability_conditions: Optional[str] = None,
        user_id: Optional[str] = None,
        agent_id: Optional[str] = None,
        tags: Optional[list[str]] = None
    ) -> str:
        """
        Store a semantic fact/knowledge item.
        
        Args:
            fact: The factual statement
            fact_type: Type (preference, fact, rule, relationship, pattern, insight)
            domain: Knowledge domain
            category: Category within domain
            confidence: Confidence score (0.0 to 1.0)
            derived_from_episodes: Source episode UUIDs
            related_concepts: Related concept strings
            applicability_conditions: When this fact applies
            user_id: Owner user ID
            agent_id: Owner agent ID
            tags: Classification tags
        
        Returns:
            UUID of stored fact
        """
        fact_object = {
            "fact": fact,
            "factType": fact_type,
            "domain": domain,
            "category": category,
            "tags": tags or [],
            "confidenceScore": confidence,
            "derivedFromEpisodes": derived_from_episodes or [],
            "relatedConcepts": related_concepts or [],
            "applicabilityConditions": applicability_conditions,
            "userId": user_id,
            "agentId": agent_id,
            "createdAt": datetime.now().isoformat(),
            "lastUpdated": datetime.now().isoformat(),
            "usageFrequency": 0,
            "importanceScore": 0.5,
            "version": 1,
        }
        
        uuid = self.semantic.data.insert(properties=fact_object)
        return str(uuid)
    
    def store_procedure(
        self,
        name: str,
        description: str,
        goal_type: str,
        steps: list[str],
        prerequisites: Optional[list[str]] = None,
        required_tools: Optional[list[str]] = None,
        success_criteria: Optional[list[str]] = None,
        applicable_contexts: Optional[list[str]] = None,
        decision_points: Optional[list[dict]] = None
    ) -> str:
        """
        Store a procedural workflow.
        
        Args:
            name: Workflow name
            description: What the workflow does
            goal_type: Type of goal this achieves
            steps: Ordered list of steps
            prerequisites: Required preconditions
            required_tools: Tools needed for execution
            success_criteria: How to determine success
            applicable_contexts: When this workflow applies
            decision_points: Conditional branching points
        
        Returns:
            UUID of stored procedure
        """
        procedure_object = {
            "workflowName": name,
            "workflowDescription": description,
            "goalType": goal_type,
            "steps": steps,
            "prerequisiteStates": prerequisites or [],
            "requiredTools": required_tools or [],
            "successCriteria": success_criteria or [],
            "applicableContexts": applicable_contexts or [],
            "successRate": 0.0,
            "executionCount": 0,
            "version": 1,
            "createdAt": datetime.now().isoformat(),
        }
        
        uuid = self.procedural.data.insert(properties=procedure_object)
        return str(uuid)
    
    def store_working_memory(
        self,
        content: str,
        context_type: str,
        session_id: str,
        turn_index: int = 0,
        expires_hours: int = 24,
        user_id: Optional[str] = None,
        agent_id: Optional[str] = None
    ) -> str:
        """
        Store active session context in working memory.
        
        Args:
            content: The context content
            context_type: Type (user_input, agent_response, intermediate, scratchpad)
            session_id: Session identifier
            turn_index: Conversation turn number
            expires_hours: Hours until expiration
            user_id: User identifier
            agent_id: Agent identifier
        
        Returns:
            UUID of stored working memory
        """
        from datetime import timedelta
        
        now = datetime.now()
        working_object = {
            "content": content,
            "contextType": context_type,
            "sessionId": session_id,
            "turnIndex": turn_index,
            "timestamp": now.isoformat(),
            "expiresAt": (now + timedelta(hours=expires_hours)).isoformat(),
            "promoteToLongTerm": False,
            "userId": user_id,
            "agentId": agent_id,
        }
        
        uuid = self.working.data.insert(properties=working_object)
        return str(uuid)
    
    def access_memory(
        self,
        collection_name: str,
        uuid: str
    ) -> Optional[dict]:
        """
        Retrieve memory and update access tracking.
        
        Args:
            collection_name: Name of the collection
            uuid: Memory UUID
        
        Returns:
            Memory properties dict or None
        """
        collection = self.client.collections.get(collection_name)
        
        obj = collection.query.fetch_object_by_id(uuid)
        
        if obj:
            # Update access tracking
            current_count = obj.properties.get("accessCount", 0)
            update_props = {
                "accessCount": current_count + 1,
            }
            if "lastAccessedAt" in [p.name for p in collection.config.get().properties]:
                update_props["lastAccessedAt"] = datetime.now().isoformat()
            
            collection.data.update(uuid=uuid, properties=update_props)
            return obj.properties
        
        return None
    
    def update_importance(
        self,
        collection_name: str,
        uuid: str,
        new_score: float
    ) -> bool:
        """Update a memory's importance score."""
        collection = self.client.collections.get(collection_name)
        collection.data.update(
            uuid=uuid,
            properties={"importanceScore": new_score}
        )
        return True
    
    def mark_consolidated(
        self,
        episode_uuid: str,
        semantic_uuid: str
    ) -> bool:
        """Mark an episodic memory as consolidated to semantic."""
        self.episodic.data.update(
            uuid=episode_uuid,
            properties={
                "consolidatedToSemantic": True,
                "consolidationDate": datetime.now().isoformat()
            }
        )
        return True
    
    def batch_import(
        self,
        memories: list[dict],
        collection_name: str = "EpisodicMemory",
        batch_size: int = 100
    ) -> dict:
        """
        Efficiently import historical memories.
        
        Args:
            memories: List of memory dicts
            collection_name: Target collection
            batch_size: Batch size for import
        
        Returns:
            Dict with imported and failed counts
        """
        collection = self.client.collections.get(collection_name)
        
        imported = 0
        failed = 0
        
        with collection.batch.fixed_size(batch_size=batch_size, concurrent_requests=4) as batch:
            for memory in memories:
                # Ensure required fields
                if "timestamp" not in memory:
                    memory["timestamp"] = datetime.now().isoformat()
                if "importanceScore" not in memory:
                    memory["importanceScore"] = 0.5
                if "recencyScore" not in memory:
                    memory["recencyScore"] = 0.5
                
                batch.add_object(properties=memory)
        
        failed_objects = collection.batch.failed_objects
        failed = len(failed_objects) if failed_objects else 0
        imported = len(memories) - failed
        
        return {"imported": imported, "failed": failed}
    
    def delete_memory(
        self,
        collection_name: str,
        uuid: str
    ) -> bool:
        """Delete a specific memory by UUID."""
        collection = self.client.collections.get(collection_name)
        collection.data.delete_by_id(uuid)
        return True
    
    def cleanup_expired_working_memory(self) -> int:
        """Remove expired working memory entries."""
        now = datetime.now().isoformat()
        
        result = self.working.data.delete_many(
            where=wvc.Filter.by_property("expiresAt").less_than(now)
        )
        
        return result.matches if hasattr(result, 'matches') else 0
