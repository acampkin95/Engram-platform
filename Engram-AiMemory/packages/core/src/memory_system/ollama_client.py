"""
Ollama HTTP client for LFM 2.5 1.2B and Qwen2.5-0.5B.
Provides: importance scoring, summarization, contradiction detection, entity extraction,
and memory consolidation.
"""

import json
import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)

IMPORTANCE_PROMPT = """You are a memory importance classifier. Rate the importance of the following memory on a scale from 0.0 to 1.0.

Guidelines:
- 0.9-1.0: Critical decisions, architectural choices, non-obvious bugs, security issues
- 0.7-0.9: Important preferences, significant facts, project-specific knowledge
- 0.5-0.7: Useful context, common patterns, general knowledge
- 0.3-0.5: Routine information, easily re-discoverable facts
- 0.0-0.3: Trivial, redundant, or temporary information

Memory: {content}

Respond with ONLY a JSON object: {{"importance": 0.X, "reason": "brief reason"}}"""

SUMMARIZATION_PROMPT = """You are a memory summarizer. Create a concise 1-2 sentence summary of the following memory.

Rules:
- Preserve all named entities (people, projects, technologies, file paths)
- Preserve all numbers, dates, and specific values
- Remove filler words and redundant context
- Write in present tense as a fact statement
- Maximum 150 words

Memory: {content}

Respond with ONLY the summary text, no preamble."""

CONTRADICTION_PROMPT = """You are a contradiction detector for an AI memory system. Compare these two memories and determine if they contradict each other.

Memory A: {memory_a}
Memory B: {memory_b}

Analyze:
1. Do they make conflicting factual claims?
2. If contradicting, which is more likely correct?
3. Could both be true (different contexts, time periods)?

Respond with ONLY JSON: {{"contradicts": true/false, "confidence": 0.X, "more_likely_correct": "A"/"B"/"both"/"neither", "reason": "brief explanation"}}"""

ENTITY_EXTRACTION_PROMPT = """Extract named entities from the following memory. Focus on entities relevant to software development and AI.

Entity types: PERSON, PROJECT, TECHNOLOGY, CONCEPT, FILE, URL

Memory: {content}

Respond with ONLY JSON: {{"entities": [{{"name": "...", "type": "PERSON|PROJECT|TECHNOLOGY|CONCEPT|FILE|URL", "confidence": 0.X}}]}}"""

CONSOLIDATION_PROMPT = """You are a memory consolidator. These memories appear to be about the same topic. Merge them into a single, comprehensive memory that preserves all unique information.

Memories to merge:
{memories_list}

Rules:
- Preserve ALL specific facts, numbers, file paths, and entity names
- Resolve any minor contradictions by noting both versions
- Write in a clear, factual style
- Do not add information not present in the originals

Respond with ONLY the merged memory text."""


class OllamaClient:
    """
    HTTP client for Ollama REST API.
    Handles: importance scoring (Qwen), summarization (LFM), contradiction detection (LFM),
    entity extraction (Qwen), memory consolidation (LFM).
    """

    def __init__(self, host: str = "http://localhost:11434", timeout: int = 30):
        self.host = host.rstrip("/")
        self.timeout = timeout
        self._maintenance_model = "liquid/lfm2.5:1.2b"
        self._classifier_model = "qwen2.5:0.5b-instruct"
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        """Lazily create and cache the persistent httpx.AsyncClient."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=self.timeout)
        return self._client

    async def aclose(self) -> None:
        """Close the persistent client. Call on shutdown."""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    async def _generate(self, model: str, prompt: str, temperature: float = 0.1) -> str:
        """Call Ollama /api/generate endpoint."""
        client = await self._get_client()
        response = await client.post(
            f"{self.host}/api/generate",
            json={
                "model": model,
                "prompt": prompt,
                "stream": False,
                "options": {"temperature": temperature},
            },
        )
        response.raise_for_status()
        return response.json()["response"].strip()

    async def is_available(self) -> bool:
        """Check if Ollama is reachable."""
        try:
            client = await self._get_client()
            r = await client.get(f"{self.host}/api/tags")
            return r.status_code == 200
        except Exception:
            return False

    async def list_models(self) -> list[str]:
        """List available models."""
        try:
            client = await self._get_client()
            r = await client.get(f"{self.host}/api/tags")
            data = r.json()
            return [m["name"] for m in data.get("models", [])]
        except Exception:
            return []

    async def score_importance(self, content: str) -> tuple[float, str]:
        """Score memory importance using Qwen2.5-0.5B. Returns (score, reason)."""
        try:
            prompt = IMPORTANCE_PROMPT.format(content=content[:2000])  # truncate for small model
            raw = await self._generate(self._classifier_model, prompt, temperature=0.1)
            data = self._extract_json(raw)
            importance = float(data.get("importance", 0.5))
            reason = data.get("reason", "")
            return max(0.0, min(1.0, importance)), reason
        except Exception as e:
            logger.warning(f"importance scoring failed: {e}")
            return 0.5, "scoring unavailable"

    async def summarize(self, content: str) -> str | None:
        """Summarize memory content using LFM 2.5 1.2B."""
        if len(content) < 200:
            return None  # Short content doesn't need summarization
        try:
            prompt = SUMMARIZATION_PROMPT.format(content=content[:4000])
            summary = await self._generate(self._maintenance_model, prompt, temperature=0.2)
            return summary if summary else None
        except Exception as e:
            logger.warning(f"summarization failed: {e}")
            return None

    async def detect_contradiction(self, memory_a: str, memory_b: str) -> dict[str, Any]:
        """Detect contradiction between two memories using LFM 2.5 1.2B."""
        try:
            prompt = CONTRADICTION_PROMPT.format(memory_a=memory_a[:1500], memory_b=memory_b[:1500])
            raw = await self._generate(self._maintenance_model, prompt, temperature=0.1)
            data = self._extract_json(raw)
            return {
                "contradicts": bool(data.get("contradicts", False)),
                "confidence": float(data.get("confidence", 0.5)),
                "more_likely_correct": data.get("more_likely_correct", "neither"),
                "reason": data.get("reason", ""),
            }
        except Exception as e:
            logger.warning(f"contradiction detection failed: {e}")
            return {
                "contradicts": False,
                "confidence": 0.0,
                "more_likely_correct": "neither",
                "reason": "",
            }

    async def extract_entities(self, content: str) -> list[dict[str, Any]]:
        """Extract entities from memory content using Qwen2.5-0.5B."""
        try:
            prompt = ENTITY_EXTRACTION_PROMPT.format(content=content[:2000])
            raw = await self._generate(self._classifier_model, prompt, temperature=0.1)
            data = self._extract_json(raw)
            entities = data.get("entities", [])
            # Validate each entity
            valid = []
            for e in entities:
                if isinstance(e, dict) and "name" in e and "type" in e:
                    valid.append(
                        {
                            "name": str(e["name"]),
                            "type": str(e.get("type", "CONCEPT")),
                            "confidence": float(e.get("confidence", 0.7)),
                        }
                    )
            return valid
        except Exception as e:
            logger.warning(f"entity extraction failed: {e}")
            return []

    async def consolidate_memories(self, memory_contents: list[str]) -> str | None:
        """Merge multiple similar memories into one using LFM 2.5 1.2B."""
        try:
            memories_list = "\n\n".join(
                f"Memory {i + 1}: {content[:1000]}"
                for i, content in enumerate(memory_contents[:5])  # max 5 memories
            )
            prompt = CONSOLIDATION_PROMPT.format(memories_list=memories_list)
            result = await self._generate(self._maintenance_model, prompt, temperature=0.3)
            return result if result else None
        except Exception as e:
            logger.warning(f"consolidation failed: {e}")
            return None

    def _extract_json(self, text: str) -> dict:
        """Extract JSON from model response (handles markdown code blocks)."""
        text = text.strip()
        # Remove markdown code blocks
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
        # Find JSON object
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            text = text[start:end]
        return json.loads(text)
