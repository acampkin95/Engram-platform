# AI Memory System — Phase 2 Upgrade Plan (FINAL)

**Status**: Approved — ready to implement  
**Date**: 2026-02-26  
**Target**: Ubuntu server (vd-devnode / acdev-devnode)  
**Host specs**: i7-12th gen, 16GB RAM, 1TB NVMe, 1Gbps WAN  
**Budget**: 3GB RAM for model serving (within 16GB total)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                 Ubuntu Server (acdev-devnode)                    │
│                  Tailscale VPN: 100.x.x.x                       │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   Traefik (port 80/443)                   │   │
│  │   Routes: api.memory.ts → :8000                          │   │
│  │           dashboard.memory.ts → :3001                    │   │
│  │           ollama.memory.ts → :11434 (internal only)      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │ Weaviate │  │  Redis   │  │  Ollama  │  │  Memory API  │   │
│  │  :8080   │  │  :6379   │  │  :11434  │  │  (FastAPI)   │   │
│  │  ~512MB  │  │  ~256MB  │  │  ~3GB    │  │  :8000       │   │
│  └──────────┘  └──────────┘  │  Models: │  │  ~600MB      │   │
│                               │  LFM2.5  │  │  (incl.      │   │
│                               │  Qwen0.5B│  │  nomic-embed │   │
│                               └──────────┘  │  + reranker) │   │
│                                             └──────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Dashboard (Next.js) :3001                    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Total RAM: ~4.4GB (well within 16GB)                           │
└─────────────────────────────────────────────────────────────────┘
         ↑ Tailscale VPN only (no public internet exposure)
         Mac Dev Machine connects via Tailscale
```

---

## Decisions (Confirmed)

| Decision | Choice |
|----------|--------|
| Embedding migration | Clean wipe — drop all collections, recreate with 768-dim |
| Model serving | Docker containers on Ubuntu server |
| Serving stack | Ollama (Linux x86_64, full GPU/CPU support) |
| Feature priority | Better search quality first |
| Embedding dimension | 768 (full quality) |
| Dashboard | Yes — add monitoring UI (model health, queue, decay, graph) |
| Deployment | Full one-shot setup script |
| Networking | Tailscale + Traefik (internal VPN only, no public internet) |

---

## Model Stack (Ubuntu x86_64)

On Linux x86_64, Ollama has full CUDA + CPU support. i7-12th gen has no dedicated GPU, so all inference is CPU-based.

| Model | HuggingFace / Ollama ID | Purpose | Quantization | RAM |
|-------|------------------------|---------|-------------|-----|
| `nomic-embed-text-v1.5` | `nomic-ai/nomic-embed-text-v1.5` | Text embeddings | FP16 (in-process) | ~350MB |
| `LFM 2.5 1.2B Instruct` | `liquid/lfm2.5:1.2b` | Summarization, contradiction, consolidation | Q4_K_M | ~900MB |
| `Qwen2.5-0.5B-Instruct` | `qwen2.5:0.5b-instruct` | Importance scoring, entity extraction | Q4_K_M | ~600MB |
| `BGE-reranker-base` | `BAAI/bge-reranker-base` | Reranking search results | INT8 ONNX | ~400MB |
| **Total** | | | | **~2.25GB** ✓ |

**CPU performance on i7-12th gen:**
- Qwen2.5-0.5B: ~30-50 tok/sec (fast enough for short tasks)
- LFM 2.5 1.2B: ~15-25 tok/sec (acceptable for background maintenance)
- Ollama max 2 models loaded simultaneously, auto-unload after 5min idle

---

## Implementation Plan

### Phase A: Ubuntu Server Setup (one-shot deploy script)

**File**: `scripts/deploy-server.sh`

Steps:
1. Install Docker + Docker Compose plugin
2. Install Tailscale + join network
3. Install Traefik (via Docker)
4. Create directory structure + copy config files
5. Pull Docker images (Weaviate, Redis, Ollama)
6. Pull Ollama models (`liquid/lfm2.5:1.2b`, `qwen2.5:0.5b-instruct`)
7. Build + start Memory API + Dashboard
8. Configure Traefik routes
9. Run health checks
10. Print status summary

### Phase B: Schema Upgrade

1. Drop all Weaviate collections (clean wipe)
2. Update `client.py` — recreate with 768-dim + new properties
3. Update `memory.py` — new Pydantic models
4. Update `config.py` — model settings

### Phase C: Embedding Integration

1. Add `nomic-embed-text-v1.5` via sentence-transformers
2. Replace mock embedder in `system.py`
3. Add BGE reranker in search pipeline
4. Update Redis cache key format

### Phase D: Ollama Integration

1. Add `OllamaClient` class
2. Wire up importance scoring (Qwen)
3. Wire up summarization (LFM 2.5)
4. Wire up contradiction detection (LFM 2.5)
5. Wire up entity extraction (Qwen)

### Phase E: Service Workers

1. Add APScheduler to API startup
2. Implement all 7 maintenance jobs
3. Add maintenance queue in Redis
4. Expose `/maintenance/*` API endpoints

### Phase F: Dashboard Monitoring UI

1. Model health page
2. Maintenance queue page
3. Memory decay visualization
4. Knowledge graph viewer

### Phase G: Resource Management

1. Docker memory limits in compose file
2. `/health/detailed` endpoint
3. Alert thresholds in settings

---

## Schema Changes (Full Spec)

### Weaviate Collections — New Properties

**MemoryProject / MemoryGeneral / MemoryGlobal** (16 → 24 properties):
```
+ embedding_model: text         # "nomic-embed-text-v1.5"
+ embedding_dimension: int      # 768
+ embedding_updated_at: date    # when vector last regenerated
+ access_count: int             # retrieval count (default 0)
+ last_accessed_at: date        # last retrieval timestamp
+ decay_factor: float           # computed importance after decay
+ canonical_id: text            # if duplicate, points to canonical
+ is_canonical: bool            # true = master version
```

**MemoryEntity** (9 → 13 properties):
```
+ embedding_model: text
+ last_seen_at: date
+ mention_count: int
+ confidence: float
```

**MemoryRelation** (8 → 11 properties):
```
+ confidence: float
+ evidence_memory_ids: text[]
+ last_updated_at: date
```

---

## 15 Features

### Short-Term (Week 1-2)
1. **Real embeddings** — nomic-embed-text-v1.5 replaces mock
2. **Access tracking + decay** — implement access_count, last_accessed_at, decay_factor
3. **Reranking pipeline** — BGE-reranker-base in search flow
4. **Implement all stubs** — find_consolidation_candidates, find_similar_by_vector, delete_expired, update_fields
5. **Ollama integration** — OllamaClient, health checks, graceful degradation

### Medium-Term (Week 3-4)
6. **AI importance scoring** — Qwen2.5-0.5B scores importance on memory creation
7. **Auto-summarization** — LFM 2.5 generates summary field for long memories
8. **Contradiction detection** — LFM 2.5 flags conflicting memories
9. **Entity extraction** — Qwen2.5-0.5B populates knowledge graph automatically
10. **Memory consolidation** — LFM 2.5 merges near-duplicate memories

### Long-Term (Month 2)
11. **Hybrid search** — Weaviate vector + BM25 keyword with alpha control
12. **Memory provenance graph** — lineage tracking, cluster visualization
13. **Adaptive decay** — per-memory-type learned decay rates
14. **Cross-tenant knowledge sharing** — promote high-value memories to Global tier
15. **Context window packing** — MCP tool for token-budget-aware context retrieval

---

## System Prompts

See section 4 of previous draft — all 5 prompts defined (importance, summarization, contradiction, entity extraction, consolidation).

---

## Service Workers Schedule

| Job | Frequency | Model | Purpose |
|-----|-----------|-------|---------|
| Score importance | Every 5min | Qwen2.5-0.5B | Score new unprocessed memories |
| Summarize | Every 15min | LFM 2.5 | Summarize memories > 500 chars |
| Contradiction check | Every 1hr | LFM 2.5 | Check new memories vs existing |
| Entity extraction | Every 6hr | Qwen2.5-0.5B | Populate knowledge graph |
| Decay update | Daily 2am | CPU only | Update decay_factor for all |
| Consolidation | Daily 3am | LFM 2.5 | Merge near-duplicates |
| Delete expired | Daily 4am | CPU only | Remove expired memories |

---

## Resource Limits (docker-compose)

```yaml
services:
  weaviate:    mem_limit: 1g      # 512MB normal, 1GB headroom
  redis:       mem_limit: 256m
  ollama:      mem_limit: 3g      # OLLAMA_MAX_LOADED_MODELS=2
  api:         mem_limit: 1g      # includes embedding + reranker models
  dashboard:   mem_limit: 512m
  traefik:     mem_limit: 128m
  # Total:     ~5.9GB of 16GB
```

---

## Traefik Configuration

Services accessible via Tailscale IP (100.x.x.x) with Traefik routing:
- `http://100.x.x.x/api/` → Memory API :8000
- `http://100.x.x.x/` → Dashboard :3001
- Ollama: internal only (not exposed via Traefik)
- Weaviate/Redis: internal only

Optional: add Tailscale hostname routing if `acdev-devnode.tailnet-name.ts.net` is configured.
