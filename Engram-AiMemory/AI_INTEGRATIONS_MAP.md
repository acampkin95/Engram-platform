# Engram-AiMemory: AI Service Integrations Map

**Generated:** 2026-03-16  
**Scope:** Complete mapping of embedding providers, LLM integrations, RAG pipeline, and LLM-powered features

---

## 1. EMBEDDING PROVIDERS

### Configuration
- **File:** `/Users/alex/Projects/Dev/LIVE/Production/09_EngramPlatform/Engram-AiMemory/packages/core/src/memory_system/config.py`
- **Lines:** 33-45, 125-150
- **Config Variable:** `EMBEDDING_PROVIDER`
- **Default:** `"nomic"`

### Supported Providers

#### 1.1 Nomic (Local, Default)
- **File:** `packages/core/src/memory_system/embeddings.py` (lines 16-63)
- **Model:** `nomic-ai/nomic-embed-text-v1.5`
- **Dimension:** 768
- **Size:** ~275MB
- **Features:**
  - Task prefixes: `search_document`, `search_query`, `clustering`, `classification`
  - Matryoshka support (dimension truncation)
  - Layer normalization + L2 normalization
- **Status:** ✅ Complete, production-ready
- **Dependencies:** `sentence-transformers`

#### 1.2 Ollama (Local, OpenAI-compatible)
- **File:** `packages/core/src/memory_system/embeddings.py` (lines 101-157)
- **Default Model:** `nomic-embed-text:v1.5`
- **Dimension:** 768 (configurable)
- **Endpoint:** `/api/embeddings`
- **Connection:** Async httpx with connection pooling (max 10 connections, 30s keepalive)
- **Status:** ✅ Complete, production-ready
- **Config Variables:**
  - `OLLAMA_HOST` (required when provider='ollama')
  - `OLLAMA_EMBEDDING_MODEL` (default: `nomic-embed-text:v1.5`)
- **Notes:** Sequential embedding (Ollama is single-text API)

#### 1.3 OpenAI
- **File:** `packages/core/src/memory_system/system.py` (lines 114-121)
- **Model:** Configurable via `EMBEDDING_MODEL` (default: `text-embedding-3-small`)
- **Dimension:** Configurable via `EMBEDDING_DIMENSIONS` (default: 768)
- **Status:** ✅ Complete
- **Config Variables:**
  - `OPENAI_API_KEY` (required)
  - `EMBEDDING_MODEL`
  - `EMBEDDING_DIMENSIONS`

#### 1.4 DeepInfra (Cloud, OpenAI-compatible)
- **File:** `packages/core/src/memory_system/system.py` (lines 131-139)
- **Base URL:** `https://api.deepinfra.com/v1/openai`
- **Default Model:** `BAAI/bge-m3` (768d)
- **Status:** ✅ Complete
- **Config Variables:**
  - `DEEPINFRA_API_KEY` (required)
  - `DEEPINFRA_EMBED_MODEL` (default: `BAAI/bge-m3`)
- **Notes:** Uses AsyncOpenAI client with custom base_url

#### 1.5 Local (Placeholder)
- **File:** `packages/core/src/memory_system/system.py` (lines 141-144)
- **Status:** ⚠️ Placeholder only, not implemented
- **Notes:** Returns mock embeddings for development

### Provider Selection Logic
- **File:** `packages/core/src/memory_system/system.py` (lines 110-159)
- **Method:** `MemorySystem._init_embedding_client()`
- **Caching:** LRU cache with max 100 providers (lines 158-237 in embeddings.py)
- **Fallback:** None — provider must be explicitly configured

### Embedding Caching
- **File:** `packages/core/src/memory_system/cache.py`
- **Key:** SHA256 hash of text
- **Storage:** Redis
- **TTL:** Configurable (default: 24 hours)

---

## 2. OLLAMA INTEGRATION

### Ollama Client
- **File:** `packages/core/src/memory_system/ollama_client.py` (231 lines)
- **Host:** Configurable via `OLLAMA_HOST` (default: `http://localhost:11434`)
- **Timeout:** Configurable via `OLLAMA_REQUEST_TIMEOUT` (default: 30s)
- **Connection:** Persistent async httpx.AsyncClient

### Models Used
| Task | Model | Size | Purpose |
|------|-------|------|---------|
| Importance Scoring | `qwen2.5:0.5b-instruct` | 0.5B | Classification (simple) |
| Summarization | `liquid/lfm2.5:1.2b` | 1.2B | Text generation (standard) |
| Contradiction Detection | `liquid/lfm2.5:1.2b` | 1.2B | Analysis (standard) |
| Entity Extraction | `qwen2.5:0.5b-instruct` | 0.5B | Classification (simple) |
| Memory Consolidation | `liquid/lfm2.5:1.2b` | 1.2B | Text generation (complex) |

### Ollama Features

#### 2.1 Importance Scoring
- **File:** `ollama_client.py` (lines 135-146)
- **Prompt:** `IMPORTANCE_PROMPT` (lines 15-26)
- **Output:** `(score: float, reason: str)`
- **Scale:** 0.0-1.0
- **Guidelines:**
  - 0.9-1.0: Critical decisions, architectural choices, security issues
  - 0.7-0.9: Important preferences, significant facts
  - 0.5-0.7: Useful context, common patterns
  - 0.3-0.5: Routine information
  - 0.0-0.3: Trivial, redundant information
- **Status:** ✅ Complete

#### 2.2 Summarization
- **File:** `ollama_client.py` (lines 148-158)
- **Prompt:** `SUMMARIZATION_PROMPT` (lines 28-39)
- **Trigger:** Content > 200 chars
- **Output:** 1-2 sentence summary (max 150 words)
- **Rules:** Preserve entities, numbers, dates; remove filler
- **Status:** ✅ Complete

#### 2.3 Contradiction Detection
- **File:** `ollama_client.py` (lines 160-179)
- **Prompt:** `CONTRADICTION_PROMPT` (lines 41-51)
- **Output:** `{contradicts: bool, confidence: float, more_likely_correct: str, reason: str}`
- **Analysis:** Factual conflicts, temporal conflicts, context-dependent truth
- **Status:** ✅ Complete

#### 2.4 Entity Extraction
- **File:** `ollama_client.py` (lines 181-202)
- **Prompt:** `ENTITY_EXTRACTION_PROMPT` (lines 53-59)
- **Entity Types:** PERSON, PROJECT, TECHNOLOGY, CONCEPT, FILE, URL
- **Output:** `[{name, type, confidence}]`
- **Status:** ✅ Complete

#### 2.5 Memory Consolidation
- **File:** `ollama_client.py` (lines 204-216)
- **Prompt:** `CONSOLIDATION_PROMPT` (lines 61-72)
- **Input:** Up to 5 similar memories
- **Output:** Merged memory text
- **Rules:** Preserve all facts, resolve contradictions, no new information
- **Status:** ✅ Complete

### Ollama Availability Check
- **File:** `ollama_client.py` (lines 116-123)
- **Endpoint:** `/api/tags`
- **Graceful Degradation:** If unavailable, AI maintenance disabled (system.py lines 97-105)

---

## 3. LM STUDIO / OPENAI-COMPATIBLE API

### LM Studio Provider
- **File:** `packages/core/src/memory_system/ai_provider.py` (lines 275-312)
- **Base URL:** `http://localhost:1234/v1` (default, configurable)
- **API Key:** Not required (dummy value: `"not-needed"`)
- **Status:** ✅ Complete, production-ready
- **Implementation:** Uses AsyncOpenAI client with custom base_url

### OpenAI-Compatible Endpoints
Both DeepInfra and LM Studio use OpenAI-compatible API:
- `POST /v1/chat/completions` — Chat completion
- `POST /v1/embeddings` — Embeddings
- `GET /v1/models` — List models (availability check)

---

## 4. AI PROVIDER ROUTER (Fallback Chain)

### AIRouter Class
- **File:** `packages/core/src/memory_system/ai_provider.py` (lines 320-488)
- **Purpose:** Unified provider abstraction with fallback routing and token tracking
- **Provider Order:** Ollama → DeepInfra → OpenAI → LM Studio

### Provider Chain
```python
providers = [
    OllamaProvider(host=OLLAMA_HOST),           # Local, free
    DeepInfraProvider(api_key=DEEPINFRA_KEY),   # Cloud, cheap
    OpenAIProvider(api_key=OPENAI_KEY),         # Cloud, standard
    LMStudioProvider(base_url=LM_STUDIO_URL),   # Local, free
]
```

### Token Tracking
- **Class:** `TokenUsage` (lines 56-64)
- **Tracked:** `provider`, `model`, `prompt_tokens`, `completion_tokens`, `cost_usd`, `timestamp`
- **Cost Estimation:** (lines 92-105)
  - Ollama: $0.00
  - LM Studio: $0.00
  - DeepInfra: $0.0001 per 1K tokens (blended)
  - OpenAI: $0.00015 input / $0.0006 output per 1K tokens

### Task Complexity Enum
- **File:** `ai_provider.py` (lines 72-75)
- **Values:** `SIMPLE`, `STANDARD`, `COMPLEX`
- **Purpose:** Informational (future automatic model selection)

### Fallback Logic
- **File:** `ai_provider.py` (lines 338-380)
- **Behavior:** Try each provider in order, fall back on exception
- **Error Handling:** Logs warnings, continues to next provider
- **Final Error:** Raises RuntimeError if all providers fail

---

## 5. RAG PIPELINE

### MemoryRAG Class
- **File:** `packages/core/src/memory_system/rag.py` (206 lines)
- **Purpose:** Retrieval-Augmented Generation with memory context
- **Modes:** Context-only (no server-side generation)

### RAG Methods

#### 5.1 generate_with_context()
- **Lines:** 37-75
- **Input:** `query`, `tier`, `project_id`, `limit`
- **Output:** Individual insights with scores, compressed content
- **Process:**
  1. Search memories (vector + reranking)
  2. Compress each memory
  3. Return ranked results with metadata

#### 5.2 generate_synthesis()
- **Lines:** 77-122
- **Input:** `query`, `tier`, `project_id`, `limit`
- **Output:** Synthesis prompt + context + source memories
- **Process:**
  1. Search memories
  2. Build synthesis prompt from config
  3. Return prompt + context for client-side generation

#### 5.3 answer_with_full_context()
- **Lines:** 124-153
- **Input:** `query`, `user_id`, `session_id`, `project_id`
- **Output:** Full context + synthesis prompt
- **Process:**
  1. Build RAG context (multi-tier)
  2. Format context
  3. Return prompt for client-side generation

#### 5.4 multi_tier_rag()
- **Lines:** 155-206
- **Input:** `query`, `tiers`, `limit_per_tier`, `project_id`
- **Output:** Results grouped by tier with tier counts
- **Process:**
  1. Search each tier separately
  2. Aggregate and sort by score
  3. Return tier-aware results

### RAG Configuration
- **File:** `config.py` (lines 62-76)
- **Variables:**
  - `RAG_MAX_CONTEXT_TOKENS` (default: 4000)
  - `RAG_DEFAULT_LIMIT` (default: 5, range: 1-50)
  - `RAG_SYNTHESIS_PROMPT` (default: generic synthesis instruction)

### RAG Context Builder
- **File:** `packages/core/src/memory_system/context.py`
- **Purpose:** Compress and format memories for RAG
- **Methods:** `compress_memory()`, `build_rag_context()`

---

## 6. LLM-POWERED FEATURES

### 6.1 Auto-Importance Scoring
- **Trigger:** New memory added
- **Worker Job:** `_job_score_importance()` (workers.py lines 335-365)
- **Schedule:** Every 5 minutes
- **Model:** Qwen2.5-0.5B (via Ollama or AIRouter)
- **Output:** Importance score (0.0-1.0) + reasoning
- **Config:** `AUTO_IMPORTANCE_ENABLED` (default: true)
- **Status:** ✅ Complete

### 6.2 Memory Summarization
- **Trigger:** New memory > 200 chars
- **Worker Job:** `_job_summarize()` (workers.py lines 367-395)
- **Schedule:** Every 15 minutes
- **Model:** LFM 2.5 1.2B (via Ollama or AIRouter)
- **Output:** 1-2 sentence summary
- **Status:** ✅ Complete

### 6.3 Contradiction Detection
- **Trigger:** New memory added
- **Worker Job:** `_job_detect_contradictions()` (workers.py lines 397-440)
- **Schedule:** Every 1 hour
- **Model:** LFM 2.5 1.2B (via Ollama or AIRouter)
- **Output:** Contradiction flag + confidence + resolution
- **Resolver:** `MultiFactorResolver` (contradiction.py lines 30-111)
- **Resolution Methods:**
  - Confidence-based (25% weight)
  - Corroboration-based (20% weight)
  - Temporal relevance (20% weight)
  - Hybrid multi-factor (ADR-044)
- **Status:** ✅ Complete

### 6.4 Entity Extraction
- **Trigger:** New memory added
- **Worker Job:** `_job_extract_entities()` (workers.py lines 442-475)
- **Schedule:** Every 6 hours
- **Model:** Qwen2.5-0.5B (via Ollama or AIRouter)
- **Output:** `[{name, type, confidence}]`
- **Entity Types:** PERSON, PROJECT, TECHNOLOGY, CONCEPT, FILE, URL
- **Status:** ✅ Complete

### 6.5 Memory Consolidation
- **Trigger:** Scheduled maintenance
- **Worker Job:** `_job_consolidate()` (workers.py lines 477-530)
- **Schedule:** Daily at 3am
- **Model:** LFM 2.5 1.2B (via Ollama or AIRouter)
- **Input:** Similar memories (grouped by semantic similarity)
- **Output:** Merged memory
- **Config:**
  - `CONSOLIDATION_MIN_GROUP_SIZE` (default: 3)
  - `CONSOLIDATION_HOURS_BACK` (default: 48)
  - `CONSOLIDATION_CONFIDENCE` (default: 0.7)
- **Status:** ✅ Complete

### 6.6 Memory Analysis (MemoryAnalyzer)
- **File:** `packages/core/src/memory_system/analyzer.py` (271 lines)
- **Purpose:** Self-management analysis pipeline
- **Features:**
  - Auto-importance scoring
  - Contradiction detection
  - Deduplication (similarity detection)
  - Suggested tags
- **Config:**
  - `AUTO_IMPORTANCE_ENABLED`
  - `CONTRADICTION_DETECTION_ENABLED`
  - `DEDUPLICATION_ENABLED`
- **Status:** ✅ Complete

---

## 7. CONFIGURATION SUMMARY

### Environment Variables (Complete List)

#### Embedding Configuration
```env
EMBEDDING_PROVIDER=nomic|openai|deepinfra|ollama|local
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=768
OPENAI_API_KEY=sk_...
DEEPINFRA_API_KEY=...
OLLAMA_HOST=http://localhost:11434
OLLAMA_EMBEDDING_MODEL=nomic-embed-text:v1.5
```

#### LLM Configuration
```env
LLM_PROVIDER=openai|anthropic|local|deepinfra
LLM_MODEL=gpt-4o-mini
DEEPINFRA_CHAT_MODEL=meta-llama/Meta-Llama-3.1-8B-Instruct
```

#### Ollama Configuration
```env
OLLAMA_HOST=http://localhost:11434
OLLAMA_MAINTENANCE_MODEL=liquid/lfm2.5:1.2b
OLLAMA_CLASSIFIER_MODEL=qwen2.5:0.5b-instruct
OLLAMA_REQUEST_TIMEOUT=30
```

#### Memory Features
```env
AUTO_IMPORTANCE_ENABLED=true
CONTRADICTION_DETECTION_ENABLED=true
DEDUPLICATION_ENABLED=true
CONSOLIDATION_MIN_GROUP_SIZE=3
CONSOLIDATION_HOURS_BACK=48
CONSOLIDATION_CONFIDENCE=0.7
```

#### RAG Configuration
```env
RAG_MAX_CONTEXT_TOKENS=4000
RAG_DEFAULT_LIMIT=5
RAG_SYNTHESIS_PROMPT="Based on these memories..."
```

---

## 8. COMPLETENESS ASSESSMENT

### ✅ Complete & Production-Ready
1. **Embedding Providers:** Nomic, Ollama, OpenAI, DeepInfra
2. **Ollama Integration:** All 5 maintenance tasks (importance, summarization, contradiction, entity extraction, consolidation)
3. **AIRouter:** Fallback chain with token tracking
4. **RAG Pipeline:** Context-only mode (no server-side generation)
5. **Memory Analysis:** Auto-importance, contradiction detection, deduplication
6. **Background Workers:** 8 scheduled jobs via APScheduler

### ⚠️ Partial / Needs Review
1. **Local Embeddings:** Placeholder only (lines 141-144 in system.py)
2. **LM Studio:** Implemented but not tested in CI/CD
3. **Generative Module:** RAG mentions Weaviate generative module but falls back to context-only (rag.py lines 23-29)

### ❌ Not Implemented
1. **Streaming:** No streaming support for chat completions
2. **Batch Processing:** Embeddings are sequential for Ollama
3. **Caching:** Token usage not persisted (in-memory only)

---

## 9. CRITICAL INTEGRATION POINTS

### Entry Points
| Component | File | Port | Purpose |
|-----------|------|------|---------|
| Memory API | `api.py` | 8000 | FastAPI REST endpoints |
| Ollama Client | `ollama_client.py` | 11434 | Local LLM inference |
| Embedding Cache | `cache.py` | 6379 | Redis caching |
| Weaviate | `client.py` | 8080 | Vector database |

### Data Flow
```
User Input
  ↓
API Endpoint (api.py)
  ↓
MemorySystem (system.py)
  ├→ Embedding (embeddings.py + cache.py)
  ├→ Weaviate Search (client.py)
  ├→ RAG Pipeline (rag.py)
  └→ Background Workers (workers.py)
       ├→ Ollama Client (ollama_client.py)
       ├→ AIRouter (ai_provider.py)
       └→ MemoryAnalyzer (analyzer.py)
```

---

## 10. TESTING & VALIDATION

### Test Files
- `packages/core/tests/test_embeddings.py` — Embedding provider tests
- `packages/core/tests/test_rag.py` — RAG pipeline tests
- `packages/core/tests/test_analyzer.py` — Memory analysis tests
- `packages/core/tests/test_api_integration.py` — API integration tests

### Coverage Target
- Python: 80% minimum (enforced in `.coveragerc`)
- Current: ~79.8% (needs refresh)

---

## 11. DEPLOYMENT NOTES

### Docker Compose
- **Master File:** `Engram-Platform/docker-compose.yml`
- **Memory Services:** Weaviate, Redis, Memory API, Ollama (optional)
- **Resource Limits:** See AGENTS.md for current/target allocations

### Health Checks
- **Memory API:** `GET /health` (api.py)
- **Ollama:** `GET /api/tags` (ollama_client.py)
- **Weaviate:** Connection test on startup

---

## 12. KNOWN ISSUES & GAPS

1. **Local Embeddings:** Placeholder implementation (system.py line 143)
2. **Token Persistence:** Token usage logged in-memory only (ai_provider.py line 336)
3. **Streaming:** No streaming support for chat completions
4. **Batch Embeddings:** Ollama processes sequentially (embeddings.py line 143)
5. **Generative Module:** RAG falls back to context-only (rag.py lines 23-29)
6. **Error Handling:** Limited retry logic for Ollama timeouts

---

## Summary

**Engram-AiMemory** has a **comprehensive, production-ready AI integration architecture** with:
- ✅ 4 embedding providers (Nomic, Ollama, OpenAI, DeepInfra)
- ✅ 5 Ollama-powered maintenance tasks
- ✅ Unified AIRouter with fallback chain
- ✅ Complete RAG pipeline
- ✅ 8 background maintenance jobs
- ✅ Token tracking and cost estimation

**Status:** ~95% complete. Ready for production deployment with minor enhancements (local embeddings, streaming, batch optimization).

