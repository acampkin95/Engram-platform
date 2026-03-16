# weaviate_memory/consolidation.py
"""
Memory consolidation: converting episodic memories to semantic knowledge.
"""

import weaviate
import weaviate.classes.query as wvc
from datetime import datetime, timedelta
from typing import Optional, Callable
from collections import Counter


class MemoryConsolidation:
    """Consolidates episodic memories into semantic knowledge."""
    
    def __init__(
        self,
        client: weaviate.WeaviateClient,
        llm_client: Optional[Callable] = None
    ):
        """
        Initialize consolidation engine.
        
        Args:
            client: Weaviate client
            llm_client: Optional LLM client for intelligent consolidation
        """
        self.client = client
        self.llm = llm_client
        self.episodic = client.collections.get("EpisodicMemory")
        self.semantic = client.collections.get("SemanticMemory")
    
    def identify_consolidation_candidates(
        self,
        min_episode_count: int = 3,
        hours_back: int = 48
    ) -> dict[str, list]:
        """
        Find groups of related episodic memories for consolidation.
        
        Args:
            min_episode_count: Minimum episodes needed to consolidate
            hours_back: How far back to look for candidates
        
        Returns:
            Dict mapping event_type to list of candidate episodes
        """
        cutoff = datetime.now() - timedelta(hours=hours_back)
        
        response = self.episodic.query.fetch_objects(
            filters=(
                wvc.Filter.by_property("consolidatedToSemantic").equal(False) &
                wvc.Filter.by_property("timestamp").greater_than(cutoff.isoformat())
            ),
            limit=200
        )
        
        # Group by event type
        groups = {}
        for obj in response.objects:
            event_type = obj.properties.get("eventType", "unknown")
            if event_type not in groups:
                groups[event_type] = []
            groups[event_type].append({
                "uuid": str(obj.uuid),
                "content": obj.properties.get("content", ""),
                "outcomes": obj.properties.get("observedOutcomes", []),
                "success": obj.properties.get("successScore", 0.5),
                "actions": obj.properties.get("actionsTaken", [])
            })
        
        # Filter groups with enough episodes
        return {k: v for k, v in groups.items() if len(v) >= min_episode_count}
    
    def consolidate_episodes_to_fact(
        self,
        episodes: list[dict],
        event_type: str
    ) -> Optional[str]:
        """
        Consolidate a group of episodes into a semantic fact.
        
        Args:
            episodes: List of episode dicts
            event_type: The event type being consolidated
        
        Returns:
            Generalized fact string or None
        """
        if not episodes:
            return None
        
        if self.llm:
            return self._llm_consolidation(episodes, event_type)
        else:
            return self._heuristic_consolidation(episodes, event_type)
    
    def _llm_consolidation(
        self,
        episodes: list[dict],
        event_type: str
    ) -> str:
        """Use LLM to extract generalizable knowledge."""
        episodes_text = "\n".join([
            f"- {ep['content']}: Outcomes: {', '.join(ep['outcomes'])}, Success: {ep['success']}"
            for ep in episodes[:10]
        ])
        
        prompt = f"""Analyze these related episodes and extract ONE generalizable fact or pattern:

Event Type: {event_type}
Episodes:
{episodes_text}

Provide a single concise factual statement that captures the pattern these episodes demonstrate.
Format: A clear, actionable fact that can guide future decisions."""
        
        # Call LLM - implementation depends on your LLM client
        # fact = self.llm(prompt)
        fact = f"Based on {len(episodes)} {event_type} episodes: pattern identified"
        
        return fact
    
    def _heuristic_consolidation(
        self,
        episodes: list[dict],
        event_type: str
    ) -> str:
        """Simple heuristic-based consolidation without LLM."""
        # Calculate average success
        avg_success = sum(ep['success'] or 0.5 for ep in episodes) / len(episodes)
        
        # Find common outcomes
        all_outcomes = []
        for ep in episodes:
            all_outcomes.extend(ep.get("outcomes", []))
        
        outcome_counts = Counter(all_outcomes)
        common_outcomes = [o for o, c in outcome_counts.most_common(3) if c > 1]
        
        # Find common actions
        all_actions = []
        for ep in episodes:
            all_actions.extend(ep.get("actions", []))
        
        action_counts = Counter(all_actions)
        common_actions = [a for a, c in action_counts.most_common(3) if c > 1]
        
        # Build fact
        fact_parts = [f"In {event_type} situations"]
        
        if common_actions:
            fact_parts.append(f"effective actions include: {', '.join(common_actions)}")
        
        if common_outcomes:
            fact_parts.append(f"typical outcomes are: {', '.join(common_outcomes)}")
        
        fact_parts.append(f"Average success rate: {avg_success:.0%}")
        
        return ". ".join(fact_parts)
    
    def store_consolidated_fact(
        self,
        fact: str,
        event_type: str,
        source_episode_ids: list[str],
        confidence: float = 0.7
    ) -> str:
        """
        Store newly consolidated knowledge as semantic memory.
        
        Args:
            fact: The consolidated fact
            event_type: Source event type (becomes domain)
            source_episode_ids: UUIDs of source episodes
            confidence: Confidence score for the fact
        
        Returns:
            UUID of new semantic memory
        """
        semantic_memory = {
            "fact": fact,
            "factType": "consolidated_pattern",
            "domain": event_type,
            "category": "agent_knowledge",
            "tags": ["consolidated", event_type],
            "confidenceScore": confidence,
            "derivedFromEpisodes": source_episode_ids,
            "relatedConcepts": [event_type],
            "createdAt": datetime.now().isoformat(),
            "lastUpdated": datetime.now().isoformat(),
            "usageFrequency": 0,
            "importanceScore": 0.6,
            "version": 1,
        }
        
        uuid = self.semantic.data.insert(properties=semantic_memory)
        return str(uuid)
    
    def mark_episodes_consolidated(
        self,
        episode_uuids: list[str],
        semantic_uuid: str
    ):
        """Mark source episodes as consolidated."""
        for ep_uuid in episode_uuids:
            self.episodic.data.update(
                uuid=ep_uuid,
                properties={
                    "consolidatedToSemantic": True,
                    "consolidationDate": datetime.now().isoformat()
                }
            )
    
    def run_consolidation_cycle(self) -> dict:
        """
        Execute one consolidation cycle.
        
        Returns:
            Dict with consolidation statistics
        """
        candidates = self.identify_consolidation_candidates()
        
        consolidated_count = 0
        new_facts = []
        
        for event_type, episodes in candidates.items():
            fact = self.consolidate_episodes_to_fact(episodes, event_type)
            
            if fact:
                episode_uuids = [ep["uuid"] for ep in episodes]
                
                # Store new semantic fact
                semantic_uuid = self.store_consolidated_fact(
                    fact=fact,
                    event_type=event_type,
                    source_episode_ids=episode_uuids
                )
                
                # Mark episodes as consolidated
                self.mark_episodes_consolidated(episode_uuids, semantic_uuid)
                
                consolidated_count += len(episodes)
                new_facts.append({
                    "fact": fact,
                    "event_type": event_type,
                    "source_count": len(episodes),
                    "semantic_uuid": semantic_uuid
                })
        
        return {
            "episodes_consolidated": consolidated_count,
            "new_semantic_facts": len(new_facts),
            "facts": new_facts
        }
    
    def get_consolidation_statistics(self) -> dict:
        """Get statistics about consolidation state."""
        # Count unconsolidated episodes
        unconsolidated_response = self.episodic.query.fetch_objects(
            filters=wvc.Filter.by_property("consolidatedToSemantic").equal(False),
            limit=1000
        )
        
        # Count consolidated episodes
        consolidated_response = self.episodic.query.fetch_objects(
            filters=wvc.Filter.by_property("consolidatedToSemantic").equal(True),
            limit=1000
        )
        
        # Count semantic facts derived from consolidation
        derived_response = self.semantic.query.fetch_objects(
            filters=wvc.Filter.by_property("factType").equal("consolidated_pattern"),
            limit=1000
        )
        
        unconsolidated = len(unconsolidated_response.objects)
        consolidated = len(consolidated_response.objects)
        derived_facts = len(derived_response.objects)
        
        return {
            "unconsolidated_episodes": unconsolidated,
            "consolidated_episodes": consolidated,
            "consolidation_rate": round(
                consolidated / (consolidated + unconsolidated) * 100, 2
            ) if (consolidated + unconsolidated) > 0 else 0,
            "derived_semantic_facts": derived_facts
        }
