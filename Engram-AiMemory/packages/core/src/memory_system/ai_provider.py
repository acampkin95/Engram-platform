"""
Unified AI provider abstraction with fallback routing, token tracking, and task-complexity routing.

Providers (ordered by preference in AIRouter.from_settings):
    1. OllamaProvider  — local, free, httpx direct
    2. DeepInfraProvider — cloud, cheap, OpenAI-compatible
    3. OpenAIProvider  — cloud, standard
    4. LMStudioProvider — local OpenAI-compatible

Token cost rates (approximate, per 1K tokens):
    Ollama:            $0.00 (local)
    DeepInfra:         $0.0001 input+output blended
    OpenAI gpt-4o-mini: $0.00015 input / $0.0006 output
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Protocol, runtime_checkable

import httpx

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Protocol
# ---------------------------------------------------------------------------


@runtime_checkable
class AIProvider(Protocol):
    """Minimal interface every provider must satisfy."""

    async def chat_completion(
        self,
        messages: list[dict],
        model: str,
        temperature: float = 0.1,
        max_tokens: int = 500,
        stream: bool = False,
    ) -> str: ...

    async def embed(self, texts: list[str], model: str) -> list[list[float]]: ...

    async def is_available(self) -> bool: ...


# ---------------------------------------------------------------------------
# Token tracking
# ---------------------------------------------------------------------------


@dataclass
class TokenUsage:
    provider: str
    model: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    cost_usd: float
    timestamp: datetime = field(default_factory=datetime.utcnow)


# ---------------------------------------------------------------------------
# Task complexity enum
# ---------------------------------------------------------------------------


class TaskComplexity(str, Enum):
    SIMPLE = "simple"      # classification, scoring → small fast model
    STANDARD = "standard"  # summarization, extraction → medium model
    COMPLEX = "complex"    # analysis, synthesis → large model


# ---------------------------------------------------------------------------
# Cost helpers
# ---------------------------------------------------------------------------

# Approximate costs per 1K tokens (blended input+output where not split)
_COST_PER_1K: dict[str, float] = {
    "ollama": 0.0,
    "deepinfra": 0.0001,
    "openai_input": 0.00015,
    "openai_output": 0.0006,
    "lmstudio": 0.0,
}


def _estimate_cost(provider_name: str, prompt_tokens: int, completion_tokens: int) -> float:
    if provider_name == "ollama":
        return 0.0
    if provider_name == "lmstudio":
        return 0.0
    if provider_name == "deepinfra":
        return (prompt_tokens + completion_tokens) / 1000 * _COST_PER_1K["deepinfra"]
    if provider_name == "openai":
        return (
            prompt_tokens / 1000 * _COST_PER_1K["openai_input"]
            + completion_tokens / 1000 * _COST_PER_1K["openai_output"]
        )
    # Unknown provider — use deepinfra rate as conservative estimate
    return (prompt_tokens + completion_tokens) / 1000 * _COST_PER_1K["deepinfra"]


# ---------------------------------------------------------------------------
# OllamaProvider
# ---------------------------------------------------------------------------


class OllamaProvider:
    """Calls Ollama REST API directly via httpx with a persistent AsyncClient."""

    _provider_name = "ollama"

    def __init__(self, host: str = "http://localhost:11434", timeout: int = 30) -> None:
        self.host = host.rstrip("/")
        self.timeout = timeout
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=self.timeout)
        return self._client

    async def aclose(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    async def chat_completion(
        self,
        messages: list[dict],
        model: str,
        temperature: float = 0.1,
        max_tokens: int = 500,
        stream: bool = False,
    ) -> str:
        # Flatten messages into a single prompt for /api/generate
        prompt = "\n".join(
            f"{m.get('role', 'user').capitalize()}: {m.get('content', '')}"
            for m in messages
        )
        client = await self._get_client()
        response = await client.post(
            f"{self.host}/api/generate",
            json={
                "model": model,
                "prompt": prompt,
                "stream": False,
                "options": {"temperature": temperature, "num_predict": max_tokens},
            },
        )
        response.raise_for_status()
        return response.json()["response"].strip()

    async def embed(self, texts: list[str], model: str) -> list[list[float]]:
        client = await self._get_client()
        results: list[list[float]] = []
        for text in texts:
            response = await client.post(
                f"{self.host}/api/embeddings",
                json={"model": model, "prompt": text},
            )
            response.raise_for_status()
            results.append(response.json()["embedding"])
        return results

    async def is_available(self) -> bool:
        try:
            client = await self._get_client()
            r = await client.get(f"{self.host}/api/tags")
            return r.status_code == 200
        except Exception:
            return False


# ---------------------------------------------------------------------------
# DeepInfraProvider
# ---------------------------------------------------------------------------


class DeepInfraProvider:
    """OpenAI-compatible client targeting DeepInfra's inference API."""

    _provider_name = "deepinfra"
    _BASE_URL = "https://api.deepinfra.com/v1/openai"

    def __init__(self, api_key: str) -> None:
        from openai import AsyncOpenAI

        self._client = AsyncOpenAI(base_url=self._BASE_URL, api_key=api_key)

    async def chat_completion(
        self,
        messages: list[dict],
        model: str,
        temperature: float = 0.1,
        max_tokens: int = 500,
        stream: bool = False,
    ) -> str:
        response = await self._client.chat.completions.create(
            model=model,
            messages=messages,  # type: ignore[arg-type]
            temperature=temperature,
            max_tokens=max_tokens,
            stream=False,
        )
        content = response.choices[0].message.content
        return content.strip() if content else ""

    async def embed(self, texts: list[str], model: str) -> list[list[float]]:
        response = await self._client.embeddings.create(input=texts, model=model)
        return [item.embedding for item in response.data]

    async def is_available(self) -> bool:
        try:
            await self._client.models.list()
            return True
        except Exception:
            return False


# ---------------------------------------------------------------------------
# OpenAIProvider
# ---------------------------------------------------------------------------


class OpenAIProvider:
    """Standard OpenAI API client."""

    _provider_name = "openai"

    def __init__(self, api_key: str) -> None:
        from openai import AsyncOpenAI

        self._client = AsyncOpenAI(api_key=api_key)

    async def chat_completion(
        self,
        messages: list[dict],
        model: str,
        temperature: float = 0.1,
        max_tokens: int = 500,
        stream: bool = False,
    ) -> str:
        response = await self._client.chat.completions.create(
            model=model,
            messages=messages,  # type: ignore[arg-type]
            temperature=temperature,
            max_tokens=max_tokens,
            stream=False,
        )
        content = response.choices[0].message.content
        return content.strip() if content else ""

    async def embed(self, texts: list[str], model: str) -> list[list[float]]:
        response = await self._client.embeddings.create(input=texts, model=model)
        return [item.embedding for item in response.data]

    async def is_available(self) -> bool:
        try:
            await self._client.models.list()
            return True
        except Exception:
            return False


# ---------------------------------------------------------------------------
# LMStudioProvider
# ---------------------------------------------------------------------------


class LMStudioProvider:
    """LM Studio local server — OpenAI-compatible REST API."""

    _provider_name = "lmstudio"

    def __init__(self, base_url: str = "http://localhost:1234/v1") -> None:
        from openai import AsyncOpenAI

        self._client = AsyncOpenAI(base_url=base_url, api_key="not-needed")

    async def chat_completion(
        self,
        messages: list[dict],
        model: str,
        temperature: float = 0.1,
        max_tokens: int = 500,
        stream: bool = False,
    ) -> str:
        response = await self._client.chat.completions.create(
            model=model,
            messages=messages,  # type: ignore[arg-type]
            temperature=temperature,
            max_tokens=max_tokens,
            stream=False,
        )
        content = response.choices[0].message.content
        return content.strip() if content else ""

    async def embed(self, texts: list[str], model: str) -> list[list[float]]:
        response = await self._client.embeddings.create(input=texts, model=model)
        return [item.embedding for item in response.data]

    async def is_available(self) -> bool:
        try:
            await self._client.models.list()
            return True
        except Exception:
            return False


# ---------------------------------------------------------------------------
# AIRouter
# ---------------------------------------------------------------------------


class AIRouter:
    """
    Routes AI calls through a provider fallback chain with token tracking.

    Provider order: Ollama (local) → DeepInfra (cheap cloud) → OpenAI (standard cloud).
    Falls back to next provider when current raises any exception.

    Token usage is accumulated in self.token_log for cost reporting.
    """

    def __init__(
        self,
        providers: list[Any],  # list[AIProvider] — using Any to avoid Protocol issues at runtime
        token_log: list[TokenUsage] | None = None,
    ) -> None:
        self.providers = providers
        self.token_log: list[TokenUsage] = token_log if token_log is not None else []

    async def chat_completion(
        self,
        messages: list[dict],
        model: str,
        temperature: float = 0.1,
        max_tokens: int = 500,
        stream: bool = False,
        complexity: TaskComplexity = TaskComplexity.STANDARD,
    ) -> str:
        """
        Try each provider in order, falling back on exception.

        complexity is informational — callers pass the appropriate model for their task.
        The complexity param is preserved here for future automatic model selection.
        """
        last_exc: Exception | None = None
        for provider in self.providers:
            try:
                result = await provider.chat_completion(
                    messages=messages,
                    model=model,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    stream=stream,
                )
                # Rough token estimation (4 chars ≈ 1 token)
                prompt_text = " ".join(m.get("content", "") for m in messages)
                prompt_tokens = max(1, len(prompt_text) // 4)
                completion_tokens = max(1, len(result) // 4)
                self._log_usage(
                    provider=provider,
                    model=model,
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                )
                return result
            except Exception as exc:
                provider_name = getattr(provider, "_provider_name", type(provider).__name__)
                logger.warning(f"AIRouter: provider {provider_name} failed: {exc}")
                last_exc = exc
                continue

        raise RuntimeError(
            f"All AI providers failed. Last error: {last_exc}"
        ) from last_exc

    async def embed(self, texts: list[str], model: str) -> list[list[float]]:
        """Try each provider in order for embedding."""
        last_exc: Exception | None = None
        for provider in self.providers:
            try:
                return await provider.embed(texts=texts, model=model)
            except Exception as exc:
                provider_name = getattr(provider, "_provider_name", type(provider).__name__)
                logger.warning(f"AIRouter: embed provider {provider_name} failed: {exc}")
                last_exc = exc
                continue

        raise RuntimeError(
            f"All AI providers failed for embed. Last error: {last_exc}"
        ) from last_exc

    def _log_usage(
        self,
        provider: Any,
        model: str,
        prompt_tokens: int,
        completion_tokens: int,
    ) -> None:
        provider_name = getattr(provider, "_provider_name", type(provider).__name__)
        cost = _estimate_cost(provider_name, prompt_tokens, completion_tokens)
        self.token_log.append(
            TokenUsage(
                provider=provider_name,
                model=model,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=prompt_tokens + completion_tokens,
                cost_usd=cost,
            )
        )

    def get_token_stats(self) -> dict:
        """Return total tokens, cost, and per-provider/model breakdown."""
        if not self.token_log:
            return {
                "total_tokens": 0,
                "total_cost_usd": 0.0,
                "calls": 0,
                "by_provider": {},
                "by_model": {},
            }

        total_tokens = sum(u.total_tokens for u in self.token_log)
        total_cost = sum(u.cost_usd for u in self.token_log)

        by_provider: dict[str, dict] = {}
        for u in self.token_log:
            if u.provider not in by_provider:
                by_provider[u.provider] = {"tokens": 0, "cost_usd": 0.0, "calls": 0}
            by_provider[u.provider]["tokens"] += u.total_tokens
            by_provider[u.provider]["cost_usd"] += u.cost_usd
            by_provider[u.provider]["calls"] += 1

        by_model: dict[str, dict] = {}
        for u in self.token_log:
            if u.model not in by_model:
                by_model[u.model] = {"tokens": 0, "cost_usd": 0.0, "calls": 0}
            by_model[u.model]["tokens"] += u.total_tokens
            by_model[u.model]["cost_usd"] += u.cost_usd
            by_model[u.model]["calls"] += 1

        return {
            "total_tokens": total_tokens,
            "total_cost_usd": round(total_cost, 8),
            "calls": len(self.token_log),
            "by_provider": by_provider,
            "by_model": by_model,
        }

    @classmethod
    def from_settings(cls, settings: Any) -> "AIRouter":
        """
        Build router from a Settings object.

        Includes only providers with valid configuration.
        Provider order: Ollama → DeepInfra → OpenAI.
        """
        providers: list[Any] = []

        ollama_host = getattr(settings, "ollama_host", None)
        if ollama_host:
            timeout = getattr(settings, "ollama_request_timeout", 30)
            providers.append(OllamaProvider(host=ollama_host, timeout=timeout))
            logger.debug("AIRouter: added OllamaProvider")

        deepinfra_key = getattr(settings, "deepinfra_api_key", None)
        if deepinfra_key:
            providers.append(DeepInfraProvider(api_key=deepinfra_key))
            logger.debug("AIRouter: added DeepInfraProvider")

        openai_key = getattr(settings, "openai_api_key", None)
        if openai_key:
            providers.append(OpenAIProvider(api_key=openai_key))
            logger.debug("AIRouter: added OpenAIProvider")

        if not providers:
            logger.warning(
                "AIRouter.from_settings: no providers configured — "
                "set OLLAMA_HOST, DEEPINFRA_API_KEY, or OPENAI_API_KEY"
            )

        return cls(providers=providers)
