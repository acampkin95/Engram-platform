"""Model review pipeline — LM Studio scores crawl results for relevance."""

import json
import logging
from datetime import datetime, UTC

from enum import StrEnum

from typing import Any

from pydantic import BaseModel, Field

from app.services.lm_studio_bridge import LMStudioBridge

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class ReviewDecision(StrEnum):
    KEEP = "keep"
    DERANK = "derank"
    ARCHIVE = "archive"

class ReviewResult(BaseModel):
    crawl_id: str
    url: str
    relevance_score: float = Field(ge=0.0, le=1.0)
    decision: ReviewDecision
    reasoning: str
    keywords_found: list[str]
    timestamp: str

class BatchReviewResult(BaseModel):
    results: list[ReviewResult]
    total_reviewed: int
    kept: int
    deranked: int
    archived: int
    average_relevance: float
    timestamp: str

# ---------------------------------------------------------------------------
# Prompt
# ---------------------------------------------------------------------------

REVIEW_PROMPT_TEMPLATE = """You are a content relevance reviewer for an OSINT intelligence platform.

Review the following crawl result and assess its relevance to the original search intent.

URL: {url}
Search Intent: {query_context}

Content (first 2000 characters):
---
{content_snippet}
---

Evaluate the content and return ONLY valid JSON with this exact structure:
{{
    "relevance_score": <float 0.0 to 1.0>,
    "decision": "<keep|derank|archive>",
    "reasoning": "<1-2 sentence explanation>",
    "keywords_found": ["<keyword1>", "<keyword2>", ...]
}}

Scoring guide:
- 0.8-1.0: Highly relevant, actionable intelligence
- 0.5-0.79: Somewhat relevant, useful context
- 0.3-0.49: Low relevance, may contain tangential info
- 0.0-0.29: Not relevant, noise or unrelated content
"""

# ---------------------------------------------------------------------------
# Pipeline
# ---------------------------------------------------------------------------

class ModelReviewPipeline:
    """Reviews crawl results using LM Studio for relevance scoring."""

    def __init__(
        self,
        lm_bridge: LMStudioBridge,
        relevance_threshold: float = 0.5,
        derank_threshold: float = 0.3,
    ) -> None:
        self.lm_bridge = lm_bridge
        self.relevance_threshold = relevance_threshold
        self.derank_threshold = derank_threshold

    def _apply_decision(self, score: float) -> ReviewDecision:
        """Determine decision based on relevance score and thresholds."""
        if score >= self.relevance_threshold:
            return ReviewDecision.KEEP
        if score >= self.derank_threshold:
            return ReviewDecision.DERANK
        return ReviewDecision.ARCHIVE

    async def review_single(
        self,
        crawl_id: str,
        url: str,
        markdown_content: str,
        query_context: str = "",
    ) -> ReviewResult:
        """Review a single crawl result for relevance.

        Args:
            crawl_id: Unique identifier for the crawl.
            url: Source URL.
            markdown_content: Crawled markdown content.
            query_context: Original search intent / query.

        Returns:
            ReviewResult with score, decision, reasoning, and keywords.
        """
        snippet = markdown_content[:2000] if markdown_content else ""
        prompt = REVIEW_PROMPT_TEMPLATE.format(
            url=url,
            query_context=query_context or "(no specific query)",
            content_snippet=snippet,
        )

        try:
            response = await self.lm_bridge._make_request_with_retry(
                "/chat/completions",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a content relevance reviewer. Respond with valid JSON only.",
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=0.3,
            )

            # Parse LLM JSON response
            choices = response.get("choices", [])
            content = choices[0].get("message", {}).get("content", "") if choices else ""
            parsed = json.loads(content)

            score = float(parsed.get("relevance_score", 0.0))
            score = max(0.0, min(1.0, score))

            return ReviewResult(
                crawl_id=crawl_id,
                url=url,
                relevance_score=score,
                decision=self._apply_decision(score),
                reasoning=parsed.get("reasoning", "No reasoning provided"),
                keywords_found=parsed.get("keywords_found", []),
                timestamp=datetime.now(UTC).isoformat(),
            )
        except (json.JSONDecodeError, KeyError, IndexError) as e:
            logger.warning(f"Failed to parse LLM review for {url}: {e}")
            return ReviewResult(
                crawl_id=crawl_id,
                url=url,
                relevance_score=0.0,
                decision=ReviewDecision.ARCHIVE,
                reasoning=f"Review failed: {e}",
                keywords_found=[],
                timestamp=datetime.now(UTC).isoformat(),
            )
        except Exception as e:
            logger.error(f"Review pipeline error for {url}: {e}")
            return ReviewResult(
                crawl_id=crawl_id,
                url=url,
                relevance_score=0.0,
                decision=ReviewDecision.ARCHIVE,
                reasoning=f"Review error: {e}",
                keywords_found=[],
                timestamp=datetime.now(UTC).isoformat(),
            )

    async def review_batch(
        self,
        items: list[dict[str, Any]],
        query_context: str = "",
    ) -> BatchReviewResult:
        """Review a batch of crawl results sequentially.

        Args:
            items: List of dicts with keys: crawl_id, url, markdown.
            query_context: Original search intent.

        Returns:
            BatchReviewResult with aggregated statistics.
        """
        results: list[ReviewResult] = []

        for item in items:
            result = await self.review_single(
                crawl_id=item["crawl_id"],
                url=item["url"],
                markdown_content=item.get("markdown", ""),
                query_context=query_context,
            )
            results.append(result)

        kept = sum(1 for r in results if r.decision == ReviewDecision.KEEP)
        deranked = sum(1 for r in results if r.decision == ReviewDecision.DERANK)
        archived = sum(1 for r in results if r.decision == ReviewDecision.ARCHIVE)
        avg = sum(r.relevance_score for r in results) / len(results) if results else 0.0

        return BatchReviewResult(
            results=results,
            total_reviewed=len(results),
            kept=kept,
            deranked=deranked,
            archived=archived,
            average_relevance=round(avg, 4),
            timestamp=datetime.now(UTC).isoformat(),
        )
