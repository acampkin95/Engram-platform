import sys

content = open("system.py").read()

search_method_start = content.find("async def search(")

# I need to modify the search method to include confidence weighting on results.
# Instead of doing a complex replace, I'll just append a hook where the score is calculated.

# Find the spot after reranking:
rerank_spot = content.find("        # Increment access_count for returned memories (fire-and-forget)", search_method_start)

confidence_weighting_code = """
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

"""

if "Apply Confidence Weighting" not in content:
    content = content[:rerank_spot] + confidence_weighting_code + content[rerank_spot:]
    open("system.py", "w").write(content)
    print("Updated system.py with confidence weighting")

