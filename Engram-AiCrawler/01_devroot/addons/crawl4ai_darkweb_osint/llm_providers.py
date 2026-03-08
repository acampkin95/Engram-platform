"""
LLM provider abstraction for multiple backends.

Supports:
- LM Studio (OpenAI-compatible local)
- Ollama (local)
- OpenAI (cloud)
- Anthropic (cloud)
- Minimax (cloud)
- OpenAI-compatible endpoints (custom)
"""

import asyncio
import logging
from abc import ABC, abstractmethod
from typing import Optional, Any, Literal

from pydantic import BaseModel

from crawl4ai_darkweb_osint.config import LLMProviderConfig, get_config

logger = logging.getLogger(__name__)


class LLMError(Exception):
    """Base exception for LLM errors."""

    pass


class LLMConfigurationError(LLMError):
    """Raised when LLM configuration is invalid."""

    pass


class LLMRequestError(LLMError):
    """Raised when LLM request fails."""

    pass


class ChatMessage(BaseModel):
    """Chat message structure."""

    role: Literal["system", "user", "assistant"]
    content: str


class BaseLLMClient(ABC):
    """Abstract base class for LLM clients."""

    def __init__(self, config: LLMProviderConfig):
        self.config = config

    @abstractmethod
    async def generate(self, prompt: str, **kwargs) -> str:
        """Generate text from a prompt."""
        pass

    @abstractmethod
    async def generate_with_system(self, prompt: str, system: str, **kwargs) -> str:
        """Generate text with system prompt."""
        pass

    @abstractmethod
    async def chat(self, messages: list[ChatMessage], **kwargs) -> str:
        """Generate response from chat messages."""
        pass

    def _get_generation_kwargs(self, **kwargs) -> dict[str, Any]:
        """Merge default config with provided kwargs."""
        return {
            "temperature": kwargs.get("temperature", self.config.temperature),
            "max_tokens": kwargs.get("max_tokens", self.config.max_tokens),
            **{k: v for k, v in kwargs.items() if k not in ["temperature", "max_tokens"]},
        }


class OpenAICompatibleClient(BaseLLMClient):
    """
    Client for OpenAI-compatible APIs (LM Studio, Ollama, custom endpoints).

    Works with any API that follows OpenAI's chat completion format.
    """

    def __init__(
        self,
        config: LLMProviderConfig,
        api_key: Optional[str] = None,
    ):
        super().__init__(config)
        self.base_url = config.base_url or "http://localhost:1234/v1"
        self.api_key = api_key or config.api_key
        self._client = None

    async def _get_client(self):
        """Lazy import and create httpx client."""
        if self._client is None:
            import httpx

            headers = {"Content-Type": "application/json"}
            if self.api_key:
                headers["Authorization"] = f"Bearer {self.api_key}"

            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                headers=headers,
                timeout=self.config.timeout,
            )
        return self._client

    async def _make_request(self, messages: list[dict[str, str]], **kwargs) -> str:
        """Make request to OpenAI-compatible API."""
        gen_kwargs = self._get_generation_kwargs(**kwargs)

        client = await self._get_client()

        payload = {
            "model": self.config.model,
            "messages": messages,
            **gen_kwargs,
        }

        try:
            response = await client.post("/chat/completions", json=payload)
            response.raise_for_status()

            data = response.json()
            return data["choices"][0]["message"]["content"]

        except Exception as e:
            logger.error(f"OpenAI-compatible request failed: {e}")
            raise LLMRequestError(f"Request failed: {e}")

    async def generate(self, prompt: str, **kwargs) -> str:
        """Generate text from a prompt."""
        messages = [{"role": "user", "content": prompt}]
        return await self._make_request(messages, **kwargs)

    async def generate_with_system(self, prompt: str, system: str, **kwargs) -> str:
        """Generate text with system prompt."""
        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ]
        return await self._make_request(messages, **kwargs)

    async def chat(self, messages: list[ChatMessage], **kwargs) -> str:
        """Generate response from chat messages."""
        msg_dicts = [{"role": m.role, "content": m.content} for m in messages]
        return await self._make_request(msg_dicts, **kwargs)

    async def close(self):
        """Close the HTTP client."""
        if self._client:
            await self._client.aclose()
            self._client = None


class LMStudioClient(OpenAICompatibleClient):
    """Client for LM Studio (OpenAI-compatible local LLM)."""

    def __init__(self, config: LLMProviderConfig):
        # LM Studio defaults
        if not config.base_url:
            config.base_url = "http://localhost:1234/v1"
        super().__init__(config, api_key=None)  # LM Studio doesn't need API key
        self.base_url = config.base_url


class OllamaClient(OpenAICompatibleClient):
    """Client for Ollama (OpenAI-compatible local LLM)."""

    def __init__(self, config: LLMProviderConfig):
        # Ollama defaults
        if not config.base_url:
            config.base_url = "http://localhost:11434/v1"
        super().__init__(config, api_key=None)  # Ollama doesn't need API key
        self.base_url = config.base_url


class OpenAIClient(OpenAICompatibleClient):
    """Client for OpenAI API."""

    def __init__(self, config: LLMProviderConfig):
        if not config.api_key:
            raise LLMConfigurationError("OpenAI API key required")
        if not config.base_url:
            config.base_url = "https://api.openai.com/v1"
        super().__init__(config, api_key=config.api_key)


class AnthropicClient(BaseLLMClient):
    """Client for Anthropic Claude API."""

    def __init__(self, config: LLMProviderConfig):
        super().__init__(config)
        if not config.api_key:
            raise LLMConfigurationError("Anthropic API key required")
        self.api_key = config.api_key
        self._client = None

    async def _get_client(self):
        """Lazy import and create httpx client."""
        if self._client is None:
            import httpx

            self._client = httpx.AsyncClient(
                base_url="https://api.anthropic.com/v1",
                headers={
                    "Content-Type": "application/json",
                    "x-api-key": self.api_key,
                    "anthropic-version": "2023-06-01",
                },
                timeout=self.config.timeout,
            )
        return self._client

    async def _make_request(
        self, messages: list[dict[str, str]], system: Optional[str] = None, **kwargs
    ) -> str:
        """Make request to Anthropic API."""
        gen_kwargs = self._get_generation_kwargs(**kwargs)

        client = await self._get_client()

        payload = {
            "model": self.config.model,
            "messages": messages,
            **gen_kwargs,
        }

        if system:
            payload["system"] = system

        try:
            response = await client.post("/messages", json=payload)
            response.raise_for_status()

            data = response.json()
            return data["content"][0]["text"]

        except Exception as e:
            logger.error(f"Anthropic request failed: {e}")
            raise LLMRequestError(f"Request failed: {e}")

    async def generate(self, prompt: str, **kwargs) -> str:
        """Generate text from a prompt."""
        messages = [{"role": "user", "content": prompt}]
        return await self._make_request(messages, **kwargs)

    async def generate_with_system(self, prompt: str, system: str, **kwargs) -> str:
        """Generate text with system prompt."""
        messages = [{"role": "user", "content": prompt}]
        return await self._make_request(messages, system=system, **kwargs)

    async def chat(self, messages: list[ChatMessage], **kwargs) -> str:
        """Generate response from chat messages."""
        # Anthropic doesn't support system in messages, extract it
        system = None
        msg_dicts = []

        for m in messages:
            if m.role == "system":
                system = m.content
            else:
                msg_dicts.append({"role": m.role, "content": m.content})

        return await self._make_request(msg_dicts, system=system, **kwargs)

    async def close(self):
        """Close the HTTP client."""
        if self._client:
            await self._client.aclose()
            self._client = None


class MinimaxClient(OpenAICompatibleClient):
    """Client for Minimax API (OpenAI-compatible)."""

    def __init__(self, config: LLMProviderConfig):
        if not config.api_key:
            raise LLMConfigurationError("Minimax API key required")
        if not config.base_url:
            config.base_url = "https://api.minimax.chat/v1"
        super().__init__(config, api_key=config.api_key)


def get_llm_client(config: Optional[LLMProviderConfig] = None) -> BaseLLMClient:
    """
    Factory function to create LLM client based on configuration.

    Args:
        config: LLM provider configuration (uses global config if not provided)

    Returns:
        LLM client instance

    Raises:
        LLMConfigurationError: If configuration is invalid
    """
    if config is None:
        config = get_config().llm

    provider = config.provider.lower()

    clients = {
        "lmstudio": LMStudioClient,
        "ollama": OllamaClient,
        "openai": OpenAIClient,
        "anthropic": AnthropicClient,
        "minimax": MinimaxClient,
        "openai_compatible": OpenAICompatibleClient,
    }

    client_class = clients.get(provider)
    if not client_class:
        raise LLMConfigurationError(f"Unknown LLM provider: {provider}")

    return client_class(config)


# Convenience function for quick generation
async def generate_text(
    prompt: str, system: Optional[str] = None, config: Optional[LLMProviderConfig] = None, **kwargs
) -> str:
    """
    Quick text generation helper.

    Args:
        prompt: User prompt
        system: Optional system prompt
        config: LLM configuration
        **kwargs: Additional generation parameters

    Returns:
        Generated text
    """
    client = get_llm_client(config)

    try:
        if system:
            return await client.generate_with_system(prompt, system, **kwargs)
        else:
            return await client.generate(prompt, **kwargs)
    finally:
        if hasattr(client, "close"):
            await client.close()


# CLI entry point
if __name__ == "__main__":
    import argparse
    import asyncio

    parser = argparse.ArgumentParser(description="LLM provider utilities")
    parser.add_argument("--test", action="store_true", help="Test LLM connection")
    parser.add_argument("--prompt", type=str, help="Prompt to send to LLM")
    parser.add_argument("--provider", default="lmstudio", help="LLM provider")
    parser.add_argument("--model", default="glm-5", help="Model name")
    parser.add_argument("--base-url", help="API base URL")

    args = parser.parse_args()

    async def test_llm():
        config = LLMProviderConfig(
            provider=args.provider,
            model=args.model,
            base_url=args.base_url,
        )

        client = get_llm_client(config)

        try:
            if args.prompt:
                result = await client.generate(args.prompt)
                print(f"Response: {result}")
            else:
                result = await client.generate("Hello, are you working?")
                print(f"Connection test: {result[:100]}...")
        finally:
            if hasattr(client, "close"):
                await client.close()

    if args.test or args.prompt:
        asyncio.run(test_llm())
    else:
        parser.print_help()
