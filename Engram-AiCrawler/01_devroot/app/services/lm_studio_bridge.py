from __future__ import annotations

import json
import logging
from typing import Any
from openai import AsyncOpenAI, APIError, APITimeoutError

from app.core.retry import lm_studio_retry, CircuitBreaker
from app.core.exceptions import ExternalServiceError
from app.services.cache import get_lm_response, set_lm_response

logger = logging.getLogger(__name__)

_lm_circuit_breaker = CircuitBreaker(failure_threshold=5, recovery_timeout=60.0)


class LMStudioError(Exception):
    pass


PROMPT_TEMPLATES = {
    "alias_discovery": """You are an OSINT specialist. Given a username, generate search queries to find the same person across different platforms.

Username: {username}

Generate search queries for:
1. Direct username searches
2. Name variations
3. Email patterns
4. Professional profiles
5. Social media platforms

Return JSON with format:
{{
    "queries": [
        {{"platform": "twitter", "query": "..."}},
        {{"platform": "linkedin", "query": "..."}},
        ...
    ]
}}""",
    "image_search": """You are an OSINT specialist for reverse image search. Given an image description, generate search queries to find the same image or similar images across the web.

Image description: {image_description}

Generate queries for:
1. Reverse image search engines
2. Social media platforms
3. Photo hosting sites
4. Professional profiles

Return JSON with format:
{{
    "search_urls": [
        {{"engine": "google_lens", "url": "..."}},
        {{"engine": "tineye", "url": "..."}},
        ...
    ]
}}""",
    "crawl_strategy": """You are a web crawling specialist. Given a user's natural language query, generate a crawl configuration.

User query: {user_query}

Analyze the query and generate crawl configuration with:
- extraction_type: "llm", "css", "regex", or "cosine"
- wait_for: CSS selector to wait for (if needed)
- word_count_threshold: minimum words (default 50)
- extraction_schema: if CSS extraction needed
- llm_instruction: if LLM extraction needed

Return valid JSON configuration only, no extra text.
Format:
{{
    "extraction_type": "llm|css|regex|cosine",
    "wait_for": "optional css selector",
    "word_count_threshold": 50,
    "extraction_schema": {{"name": "...", "baseSelector": "...", "fields": [...]}},
    "llm_instruction": "Extract specific information..."
}}""",
    "correlation": """You are an OSINT specialist for correlating crawl results. Given multiple crawl results, identify correlations and merge related information.

Analyze the results and:
1. Identify duplicates (same person/info)
2. Score confidence of matches (0.0-1.0)
3. Merge related information
4. Flag inconsistencies

Return JSON:
{{
    "correlated": [
        {{
            "items": [{"crawl_id": "...", "url": "...", "content": "..."}],
            "confidence": 0.85,
            "reason": "same username, similar bio"
        }}
    ],
    "duplicates": [...],
    "metadata_preserved": true
}}""",
}


class LMStudioBridge:
    def __init__(
        self,
        base_url: str = "http://host.docker.internal:1234/v1",
        model: str = "local-model",
        timeout: int = 60,
        max_retries: int = 3,
        retry_delay: float = 5.0,
        temperature: float = 0.7,
    ):
        self.base_url = base_url
        self.model = model
        self.timeout = timeout
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        self.temperature = temperature

        self.client = AsyncOpenAI(base_url=base_url, api_key="not-needed", timeout=timeout)

    @lm_studio_retry
    async def _make_request(self, endpoint: str, **kwargs) -> dict[str, Any]:
        try:
            if endpoint == "/models":
                response = await self.client.models.list()
                return {"status": "ok", "models": response.data}
            else:
                response = await self.client.chat.completions.create(model=self.model, **kwargs)
                return response.model_dump()
        except (APIError, APITimeoutError) as e:
            raise ExternalServiceError(f"LM Studio request failed: {e}")
        except LMStudioError:
            raise

    async def _make_request_with_retry(self, endpoint: str, **kwargs) -> dict[str, Any]:
        # Cache LM chat completions based on messages hash
        cache_key: str | None = None
        if endpoint == "/chat/completions" and "messages" in kwargs:
            import hashlib

            raw = json.dumps(kwargs["messages"], sort_keys=True)
            cache_key = hashlib.sha256(raw.encode()).hexdigest()
            cached = await get_lm_response(cache_key)
            if cached:
                logger.debug(f"LM cache HIT for {cache_key[:16]}...")
                return cached

        wrapped = _lm_circuit_breaker.call(self._make_request)
        result = await wrapped(endpoint, **kwargs)

        if cache_key and result:
            await set_lm_response(cache_key, result)

        return result

    async def chat_completion(
        self,
        messages: list[dict[str, Any]],
        temperature: float | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """Send a chat completion request and return {"content": str}.

        Thin public wrapper around ``_make_request_with_retry`` that flattens
        the OpenAI response envelope so callers receive a simple dict with a
        single ``"content"`` key containing the model's reply text.
        """
        response = await self._make_request_with_retry(
            "/chat/completions",
            messages=messages,
            temperature=temperature if temperature is not None else self.temperature,
            **kwargs,
        )
        choices = response.get("choices", [])
        content = ""
        if choices:
            content = choices[0].get("message", {}).get("content", "")
        return {"content": content}

    async def health_check(self) -> bool:
        try:
            await self._make_request_with_retry("/models")
            return True
        except LMStudioError:
            return False

    async def _extract_and_validate_json(
        self,
        response: dict[str, Any],
    ) -> dict[str, Any]:
        try:
            choices = response.get("choices", [])
            if not choices:
                raise LMStudioError("No choices in LLM response")

            content = choices[0].get("message", {}).get("content", "")
            if not content:
                raise LMStudioError("No content in LLM response")

            parsed = json.loads(content)
            return parsed
        except json.JSONDecodeError as e:
            raise LMStudioError(f"Failed to parse JSON response: {e}")
        except Exception as e:
            raise LMStudioError(f"Failed to extract content: {e}")

    async def generate_crawl_strategy(
        self,
        query: str,
        prompt_template: str | None = None,
    ) -> dict[str, Any]:
        template = prompt_template or PROMPT_TEMPLATES["crawl_strategy"]
        prompt = template.format(user_query=query)

        response = await self._make_request_with_retry(
            "/chat/completions",
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful web crawling specialist.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=self.temperature,
        )

        return await self._extract_and_validate_json(response)

    async def generate_alias_discovery_queries(
        self,
        username: str,
    ) -> dict[str, Any]:
        prompt = PROMPT_TEMPLATES["alias_discovery"].format(username=username)

        response = await self._make_request_with_retry(
            "/chat/completions",
            messages=[
                {"role": "system", "content": "You are an OSINT specialist."},
                {"role": "user", "content": prompt},
            ],
            temperature=self.temperature,
        )

        return await self._extract_and_validate_json(response)

    async def generate_image_search_queries(
        self,
        image_description: str,
    ) -> dict[str, Any]:
        prompt = PROMPT_TEMPLATES["image_search"].format(image_description=image_description)

        response = await self._make_request_with_retry(
            "/chat/completions",
            messages=[
                {"role": "system", "content": "You are an OSINT specialist."},
                {"role": "user", "content": prompt},
            ],
            temperature=self.temperature,
        )

        return await self._extract_and_validate_json(response)

    async def correlate_results(
        self,
        results: list[dict[str, Any]],
    ) -> dict[str, Any]:
        import json

        results_json = json.dumps(results, indent=2)
        prompt = PROMPT_TEMPLATES["correlation"].replace(
            "{results}",
            results_json,
        )

        response = await self._make_request_with_retry(
            "/chat/completions",
            messages=[
                {"role": "system", "content": "You are an OSINT specialist."},
                {"role": "user", "content": prompt},
            ],
            temperature=self.temperature,
        )

        return await self._extract_and_validate_json(response)


async def check_lm_studio_connection() -> str:
    """Check if LM Studio is reachable and has a model loaded.

    Uses a short timeout and NO retries — this is a health probe, not an
    operational call.  The caller in main.py also wraps this in
    ``asyncio.wait_for`` as an extra safeguard.
    """
    import os

    base_url = os.getenv("LM_STUDIO_URL", "http://localhost:1234/v1")

    try:
        bridge = LMStudioBridge(base_url=base_url, timeout=5)
        result = await bridge.client.models.list()
        if result and result.data:
            return "connected"
        return "no_model"
    except Exception as e:
        logger.warning(f"LM Studio connection check failed: {e}")
        return "disconnected"
