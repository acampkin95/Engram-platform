# Changelog - AI Services Integration Audit

Date: 2026-03-16

## Completed

### Feature Audit
- Mapped all AI service integrations across AiMemory, AiCrawler, MCP, and Platform.
- Identified 5 embedding providers, 4 LLM providers, 15+ LLM-powered features, and the full RAG pipeline.
- Documented the AIRouter fallback chain, provider priority matrix, and LM Studio compatibility.
- Wrote comprehensive audit report to `plans/2026-03-16-ai-services-feature-audit.md`.

### Fixes Applied
- Added `LMStudioProvider` to `AIRouter.from_settings()` fallback chain in `ai_provider.py`.
- Added `lm_studio_url` config field to `config.py`.
- Removed invalid `cohere` from embedding provider options (no implementation existed).
- Enhanced interactive deploy wizard with provider-specific follow-up prompts.
- Added LLM provider section to deploy wizard with Ollama model recommendations.
- Added LM Studio section with recommended models for 16GB RAM.
- Fixed LM Studio URL default to include `/v1` suffix for OpenAI compatibility.

### Verification
- AiMemory config/system/client/workers: 276 passed, 0 failures.
- Deploy script help/config: validated.
- Compose config: valid with new env vars.
