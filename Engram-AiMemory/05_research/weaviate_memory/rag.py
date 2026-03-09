# weaviate_memory/rag.py
"""
RAG (Retrieval-Augmented Generation) implementation with memory context.
"""

import weaviate
import weaviate.classes.query as wvc
from typing import Optional
from .retrieval import MemoryRetrieval
from .context import ContextBuilder


class MemoryAugmentedRAG:
    """RAG pipeline with memory context injection."""
    
    def __init__(
        self,
        client: weaviate.WeaviateClient,
        collection_name: str = "EpisodicMemory"
    ):
        """
        Initialize RAG pipeline.
        
        Args:
            client: Weaviate client
            collection_name: Primary collection for RAG
        """
        self.client = client
        self.collection = client.collections.get(collection_name)
        self.retrieval = MemoryRetrieval(client)
        self.context_builder = ContextBuilder(self.retrieval)
    
    def generate_with_context(
        self,
        query: str,
        single_prompt: Optional[str] = None,
        limit: int = 5
    ) -> dict:
        """
        Generate response using memory as context (per-object generation).
        
        Args:
            query: Search query
            single_prompt: Prompt template with {property} placeholders
            limit: Number of memories to use
        
        Returns:
            Dict with individual insights from each memory
        """
        if single_prompt is None:
            single_prompt = """Based on this memory: {content}
            
Context type: {eventType}
Outcomes observed: {observedOutcomes}

Provide a brief insight relevant to the current query."""
        
        response = self.collection.generate.near_text(
            query=query,
            limit=limit,
            single_prompt=single_prompt
        )
        
        return {
            "individual_insights": [
                {
                    "memory": obj.properties,
                    "generated": obj.generated
                }
                for obj in response.objects
            ]
        }
    
    def generate_synthesis(
        self,
        query: str,
        synthesis_prompt: Optional[str] = None,
        limit: int = 5
    ) -> dict:
        """
        Generate synthesized response from multiple memories.
        
        Args:
            query: Search query
            synthesis_prompt: Prompt for synthesis
            limit: Number of memories to synthesize
        
        Returns:
            Dict with synthesis and source memories
        """
        if synthesis_prompt is None:
            synthesis_prompt = f"""Based on these memories, answer the following:
        
Query: {query}

Provide a comprehensive response that synthesizes insights from all relevant memories."""
        
        response = self.collection.generate.hybrid(
            query=query,
            alpha=0.7,
            limit=limit,
            grouped_task=synthesis_prompt,
            grouped_properties=["content", "eventType", "observedOutcomes"]
        )
        
        return {
            "synthesis": response.generated,
            "source_memories": [obj.properties for obj in response.objects]
        }
    
    def answer_with_full_context(
        self,
        query: str,
        user_id: Optional[str] = None,
        session_id: Optional[str] = None,
        include_preferences: bool = True,
        include_procedures: bool = False
    ) -> dict:
        """
        Full RAG with comprehensive memory context.
        
        Args:
            query: User query
            user_id: Optional user for preferences
            session_id: Optional session for context
            include_preferences: Include user preferences
            include_procedures: Include procedural memories
        
        Returns:
            Dict with answer, context used, and source count
        """
        # Build comprehensive context
        rag_context = self.context_builder.build_rag_context(
            query=query,
            user_id=user_id,
            session_id=session_id
        )
        
        # Build synthesis prompt with full context
        context_section = rag_context['formatted_context']
        
        synthesis_prompt = f"""You have access to the following memory context:

{context_section}

Based on this context, answer: {query}

Provide a helpful, personalized response that draws on relevant memories.
If the memories don't contain relevant information, say so clearly."""
        
        # Generate with grouped task
        response = self.collection.generate.hybrid(
            query=query,
            alpha=0.7,
            limit=5,
            grouped_task=synthesis_prompt
        )
        
        return {
            "answer": response.generated,
            "context_used": rag_context,
            "source_count": len(response.objects),
            "sources": [
                {
                    "content": obj.properties.get("content", "")[:100],
                    "type": obj.properties.get("eventType", "unknown")
                }
                for obj in response.objects
            ]
        }
    
    def semantic_cache_query(
        self,
        query: str,
        threshold: float = 0.95,
        generate_fn=None
    ) -> dict:
        """
        Use Weaviate as semantic cache for LLM responses.
        
        Args:
            query: Query to check/cache
            threshold: Similarity threshold for cache hit
            generate_fn: Function to generate new response on cache miss
        
        Returns:
            Dict with response and cache_hit status
        """
        # Try to find cached response
        try:
            cache = self.client.collections.get("QueryCache")
            
            response = cache.query.near_text(
                query=query,
                limit=1,
                return_metadata=wvc.MetadataQuery(distance=True)
            )
            
            if response.objects:
                obj = response.objects[0]
                similarity = 1.0 - (obj.metadata.distance / 2.0) if obj.metadata.distance else 0
                
                if similarity >= threshold:
                    return {
                        "response": obj.properties.get("cached_response"),
                        "cache_hit": True,
                        "similarity": similarity
                    }
        except Exception:
            # Cache collection may not exist
            pass
        
        # Cache miss - generate new response
        if generate_fn:
            new_response = generate_fn(query)
        else:
            # Use RAG to generate
            result = self.generate_synthesis(query)
            new_response = result.get("synthesis", "")
        
        # Store in cache
        try:
            cache = self.client.collections.get("QueryCache")
            cache.data.insert({
                "query": query,
                "cached_response": new_response
            })
        except Exception:
            pass
        
        return {
            "response": new_response,
            "cache_hit": False,
            "similarity": None
        }
    
    def multi_collection_rag(
        self,
        query: str,
        collections: Optional[list[str]] = None,
        limit_per_collection: int = 3
    ) -> dict:
        """
        RAG across multiple memory collections.
        
        Args:
            query: Search query
            collections: List of collection names to search
            limit_per_collection: Results per collection
        
        Returns:
            Dict with combined results and synthesis
        """
        collections = collections or ["EpisodicMemory", "SemanticMemory"]
        
        all_results = []
        
        for coll_name in collections:
            try:
                coll = self.client.collections.get(coll_name)
                response = coll.query.near_text(
                    query=query,
                    limit=limit_per_collection,
                    return_metadata=wvc.MetadataQuery(distance=True)
                )
                
                for obj in response.objects:
                    all_results.append({
                        "collection": coll_name,
                        "properties": obj.properties,
                        "distance": obj.metadata.distance
                    })
            except Exception as e:
                print(f"Error querying {coll_name}: {e}")
        
        # Sort by distance
        all_results.sort(key=lambda x: x.get("distance", 1.0))
        
        # Build context from all results
        context_parts = []
        for r in all_results[:10]:
            coll = r["collection"]
            props = r["properties"]
            
            if coll == "EpisodicMemory":
                context_parts.append(f"[Episode] {props.get('content', '')[:150]}")
            elif coll == "SemanticMemory":
                context_parts.append(f"[Fact] {props.get('fact', '')[:150]}")
            elif coll == "ProceduralMemory":
                context_parts.append(f"[Workflow] {props.get('workflowName', '')}")
        
        return {
            "results": all_results,
            "context": "\n".join(context_parts),
            "result_count": len(all_results)
        }
