"""
LLM-powered query refinement for dark web search.

Uses LLM to:
- Optimize search queries for dark web engines
- Generate alternative query variations
- Filter and rank results semantically
"""

import logging
from dataclasses import dataclass
from typing import Optional

from crawl4ai_darkweb_osint.config import get_config, LLMProviderConfig
from crawl4ai_darkweb_osint.llm_providers import get_llm_client, BaseLLMClient

logger = logging.getLogger(__name__)


# Default system prompt for query refinement (from Robin)
DEFAULT_REFINEMENT_SYSTEM_PROMPT = """You are a cybersecurity expert specializing in dark web intelligence.
Your task is to optimize search queries for dark web search engines.

Guidelines:
1. Keep queries focused and specific
2. Use boolean operators when appropriate (AND, OR, NOT)
3. Include relevant synonyms and variations
4. Consider how criminal actors might phrase things
5. Avoid overly broad or vague terms
6. Return ONLY the refined query, no explanation"""


# Cybercrime expert prompt for query generation (from Robin)
CYBERCRIME_EXPERT_PROMPT = """You are a cybercrime expert. A user is searching the dark web for: "{query}"

Generate 3-5 alternative search queries that might yield relevant results.
Consider:
- Common criminal terminology
- Data breach naming conventions
- Ransomware group names
- Dark web market terminology
- Forum-specific jargon

Return ONLY the queries, one per line, no numbering or explanation."""


@dataclass
class RefinedQuery:
    """A refined search query."""

    original: str
    refined: str
    alternatives: list[str]
    reasoning: Optional[str] = None


class QueryRefiner:
    """
    LLM-powered query refinement for dark web search.
    """

    def __init__(
        self,
        config: Optional[LLMProviderConfig] = None,
        system_prompt: Optional[str] = None,
    ):
        self.config = config or get_config().llm
        self.system_prompt = system_prompt or DEFAULT_REFINEMENT_SYSTEM_PROMPT
        self._client: Optional[BaseLLMClient] = None

    async def _get_client(self) -> BaseLLMClient:
        """Get or create LLM client."""
        if self._client is None:
            self._client = get_llm_client(self.config)
        return self._client

    async def refine(
        self,
        query: str,
        generate_alternatives: bool = True,
    ) -> RefinedQuery:
        """
        Refine a search query using LLM.

        Args:
            query: Original search query
            generate_alternatives: Whether to generate alternative queries

        Returns:
            RefinedQuery with optimized query and alternatives
        """
        client = await self._get_client()

        # Refine the main query
        refined = await client.generate_with_system(
            prompt=f"Optimize this dark web search query: {query}",
            system=self.system_prompt,
        )
        refined = refined.strip().strip("\"'")

        # Generate alternatives
        alternatives = []
        if generate_alternatives:
            try:
                alt_prompt = CYBERCRIME_EXPERT_PROMPT.format(query=query)
                alt_response = await client.generate(alt_prompt)

                # Parse alternatives (one per line)
                alternatives = [
                    line.strip().strip("\"'- ")
                    for line in alt_response.strip().split("\n")
                    if line.strip() and not line.strip().startswith(("#", "//"))
                ][:5]  # Max 5 alternatives

            except Exception as e:
                logger.warning(f"Failed to generate alternatives: {e}")

        return RefinedQuery(
            original=query,
            refined=refined,
            alternatives=alternatives,
        )

    async def expand_query(
        self,
        query: str,
        max_expansions: int = 3,
    ) -> list[str]:
        """
        Expand a query with related terms and variations.

        Args:
            query: Original query
            max_expansions: Maximum number of expanded queries

        Returns:
            List of expanded queries including original
        """
        client = await self._get_client()

        prompt = f"""Expand this search query with related terms and variations.
Original: {query}

Return up to {max_expansions} expanded queries, one per line.
Focus on: synonyms, related concepts, common misspellings, criminal slang."""

        try:
            response = await client.generate(prompt)

            expansions = [
                line.strip()
                for line in response.strip().split("\n")
                if line.strip() and not line.strip().startswith(("#", "//", "- "))
            ]

            # Include original and return limited set
            all_queries = [query] + expansions
            return all_queries[: max_expansions + 1]

        except Exception as e:
            logger.error(f"Query expansion failed: {e}")
            return [query]

    async def filter_results(
        self,
        results: list,  # List[SearchResult]
        query: str,
        relevance_threshold: float = 0.5,
    ) -> list:
        """
        Filter search results based on relevance to query.

        Args:
            results: List of SearchResult objects
            query: Original search query
            relevance_threshold: Minimum relevance score (0-1)

        Returns:
            Filtered list of relevant results
        """
        if not results:
            return []

        client = await self._get_client()

        # Build prompt for relevance scoring
        results_text = "\n".join(
            [
                f"{i+1}. {r.title}\n   {r.description[:100]}"
                for i, r in enumerate(results[:20])  # Limit to avoid token limits
            ]
        )

        prompt = f"""Rate the relevance of these search results to the query: "{query}"

Results:
{results_text}

For each result number, give a relevance score from 0 to 1.
Return ONLY the numbers and scores in format: "1:0.8, 2:0.3, ..." """

        try:
            response = await client.generate(prompt)

            # Parse scores
            scores = {}
            for part in response.split(","):
                if ":" in part:
                    try:
                        num, score = part.strip().split(":")
                        idx = int(num.strip())
                        scores[idx - 1] = float(score.strip())
                    except (ValueError, IndexError):
                        continue

            # Filter by threshold
            filtered = []
            for i, result in enumerate(results):
                if i in scores and scores[i] >= relevance_threshold:
                    filtered.append(result)
                elif i not in scores:
                    # Include if not scored (fallback)
                    filtered.append(result)

            return filtered

        except Exception as e:
            logger.error(f"Result filtering failed: {e}")
            return results  # Return all on failure

    async def close(self):
        """Close the LLM client."""
        if self._client and hasattr(self._client, "close"):
            await self._client.close()
            self._client = None


# Convenience function
async def refine_query(
    query: str,
    config: Optional[LLMProviderConfig] = None,
) -> RefinedQuery:
    """
    Quick query refinement helper.

    Args:
        query: Search query to refine
        config: LLM configuration

    Returns:
        RefinedQuery with optimized query
    """
    refiner = QueryRefiner(config=config)

    try:
        return await refiner.refine(query)
    finally:
        await refiner.close()


# CLI entry point
if __name__ == "__main__":
    import argparse
    import asyncio

    parser = argparse.ArgumentParser(description="Query refinement")
    parser.add_argument("query", help="Query to refine")
    parser.add_argument("--provider", default="lmstudio", help="LLM provider")
    parser.add_argument("--expand", action="store_true", help="Generate expansions")

    args = parser.parse_args()

    async def main():
        config = LLMProviderConfig(provider=args.provider, model="glm-5")  # type: ignore
        refiner = QueryRefiner(config=config)

        try:
            if args.expand:
                queries = await refiner.expand_query(args.query)
                print("Expanded queries:")
                for q in queries:
                    print(f"  - {q}")
            else:
                result = await refiner.refine(args.query)
                print(f"Original: {result.original}")
                print(f"Refined:  {result.refined}")
                if result.alternatives:
                    print("\nAlternatives:")
                    for alt in result.alternatives:
                        print(f"  - {alt}")
        finally:
            await refiner.close()

    asyncio.run(main())
