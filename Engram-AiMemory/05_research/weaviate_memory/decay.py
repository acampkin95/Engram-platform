# weaviate_memory/decay.py
"""
Memory decay and forgetting mechanisms using exponential decay functions.
"""

import math
import weaviate
from datetime import datetime, timedelta
from typing import Optional


class MemoryDecay:
    """Implements exponential decay and intelligent forgetting."""
    
    def __init__(
        self,
        client: weaviate.WeaviateClient,
        half_life_days: int = 7
    ):
        """
        Initialize decay manager.
        
        Args:
            client: Weaviate client
            half_life_days: Days until memory decays to 50% recency
        """
        self.client = client
        self.half_life_days = half_life_days
    
    def calculate_recency_score(
        self,
        storage_timestamp: datetime,
        current_timestamp: Optional[datetime] = None
    ) -> float:
        """
        Calculate recency using exponential decay.
        Score = 2^(-age/half_life)
        
        Args:
            storage_timestamp: When memory was stored
            current_timestamp: Current time (defaults to now)
        
        Returns:
            Recency score between 0.0 and 1.0
        """
        current_timestamp = current_timestamp or datetime.now()
        
        if isinstance(storage_timestamp, str):
            # Handle ISO format with potential timezone
            storage_timestamp = datetime.fromisoformat(
                storage_timestamp.replace('Z', '+00:00').split('+')[0]
            )
        
        age_days = (current_timestamp - storage_timestamp).total_seconds() / 86400
        
        # Exponential decay: 2^(-age/half_life)
        decay_rate = math.exp(-math.log(2) * age_days / self.half_life_days)
        
        return max(0.0, min(1.0, decay_rate))
    
    def update_all_recency_scores(
        self,
        collection_name: str = "EpisodicMemory"
    ) -> int:
        """
        Batch update recency scores for all memories in collection.
        
        Args:
            collection_name: Name of collection to update
        
        Returns:
            Number of memories updated
        """
        collection = self.client.collections.get(collection_name)
        current_time = datetime.now()
        
        updated_count = 0
        
        for obj in collection.iterator():
            timestamp = obj.properties.get("timestamp")
            if timestamp:
                new_recency = self.calculate_recency_score(timestamp, current_time)
                
                collection.data.update(
                    uuid=obj.uuid,
                    properties={"recencyScore": new_recency}
                )
                updated_count += 1
        
        return updated_count
    
    def calculate_memory_fitness(
        self,
        memory: dict,
        access_weight: float = 0.3,
        importance_weight: float = 0.4,
        recency_weight: float = 0.3
    ) -> float:
        """
        Calculate overall memory fitness for retention decisions.
        
        Args:
            memory: Memory properties dict
            access_weight: Weight for access frequency
            importance_weight: Weight for importance score
            recency_weight: Weight for recency score
        
        Returns:
            Fitness score between 0.0 and 1.0
        """
        access_count = memory.get("accessCount", 0)
        # Log scale to prevent access domination
        access_score = min(1.0, math.log10(access_count + 1) / 2)
        
        importance = memory.get("importanceScore", 0.5)
        recency = memory.get("recencyScore", 0.5)
        
        fitness = (
            access_weight * access_score +
            importance_weight * importance +
            recency_weight * recency
        )
        
        return fitness
    
    def identify_forgetting_candidates(
        self,
        collection_name: str = "EpisodicMemory",
        fitness_threshold: float = 0.3,
        limit: int = 100
    ) -> list[dict]:
        """
        Identify low-fitness memories for potential removal.
        
        Args:
            collection_name: Collection to analyze
            fitness_threshold: Maximum fitness to be a candidate
            limit: Maximum candidates to return
        
        Returns:
            List of candidate memory dicts with fitness scores
        """
        collection = self.client.collections.get(collection_name)
        
        candidates = []
        
        for obj in collection.iterator():
            fitness = self.calculate_memory_fitness(obj.properties)
            
            if fitness < fitness_threshold:
                candidates.append({
                    "uuid": str(obj.uuid),
                    "content": obj.properties.get("content", "")[:100],
                    "fitness": round(fitness, 4),
                    "recency": obj.properties.get("recencyScore", 0),
                    "importance": obj.properties.get("importanceScore", 0),
                    "accessCount": obj.properties.get("accessCount", 0)
                })
            
            if len(candidates) >= limit:
                break
        
        return sorted(candidates, key=lambda x: x["fitness"])
    
    def apply_intelligent_forgetting(
        self,
        collection_name: str = "EpisodicMemory",
        fitness_threshold: float = 0.2,
        dry_run: bool = True
    ) -> dict:
        """
        Remove or degrade low-fitness memories.
        Uses gradual degradation before deletion.
        
        Args:
            collection_name: Collection to process
            fitness_threshold: Threshold for forgetting
            dry_run: If True, only report what would happen
        
        Returns:
            Dict with degraded and deleted counts
        """
        collection = self.client.collections.get(collection_name)
        candidates = self.identify_forgetting_candidates(
            collection_name,
            fitness_threshold,
            limit=500
        )
        
        degraded = 0
        deleted = 0
        
        for candidate in candidates:
            uuid = candidate["uuid"]
            fitness = candidate["fitness"]
            
            if fitness < 0.1:
                # Very low fitness - delete
                if not dry_run:
                    collection.data.delete_by_id(uuid)
                deleted += 1
            else:
                # Low fitness - degrade scores further
                if not dry_run:
                    collection.data.update(
                        uuid=uuid,
                        properties={
                            "importanceScore": max(0, candidate["importance"] - 0.1),
                            "recencyScore": max(0, candidate["recency"] - 0.05)
                        }
                    )
                degraded += 1
        
        return {
            "degraded": degraded,
            "deleted": deleted,
            "dry_run": dry_run
        }
    
    def boost_accessed_memory(
        self,
        collection_name: str,
        uuid: str,
        boost_amount: float = 0.1
    ) -> bool:
        """
        Boost importance of recently accessed memory.
        Memories that get used become more important.
        
        Args:
            collection_name: Collection containing memory
            uuid: Memory UUID
            boost_amount: Amount to increase importance
        
        Returns:
            Success boolean
        """
        collection = self.client.collections.get(collection_name)
        
        obj = collection.query.fetch_object_by_id(uuid)
        if obj:
            current_importance = obj.properties.get("importanceScore", 0.5)
            new_importance = min(1.0, current_importance + boost_amount)
            
            collection.data.update(
                uuid=uuid,
                properties={"importanceScore": new_importance}
            )
            return True
        
        return False
    
    def get_decay_statistics(
        self,
        collection_name: str = "EpisodicMemory"
    ) -> dict:
        """
        Get statistics about memory decay state.
        
        Returns:
            Dict with decay statistics
        """
        collection = self.client.collections.get(collection_name)
        
        total = 0
        recency_sum = 0
        importance_sum = 0
        fitness_sum = 0
        low_fitness_count = 0
        
        for obj in collection.iterator():
            total += 1
            recency_sum += obj.properties.get("recencyScore", 0)
            importance_sum += obj.properties.get("importanceScore", 0)
            
            fitness = self.calculate_memory_fitness(obj.properties)
            fitness_sum += fitness
            
            if fitness < 0.3:
                low_fitness_count += 1
        
        return {
            "total_memories": total,
            "avg_recency": round(recency_sum / total, 4) if total > 0 else 0,
            "avg_importance": round(importance_sum / total, 4) if total > 0 else 0,
            "avg_fitness": round(fitness_sum / total, 4) if total > 0 else 0,
            "low_fitness_count": low_fitness_count,
            "low_fitness_percentage": round(low_fitness_count / total * 100, 2) if total > 0 else 0
        }
