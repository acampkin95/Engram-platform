# Engram AI Memory System — Features & Operations

This document outlines the capabilities, architecture, and operations of the Engram AI Memory platform. The system provides a highly scalable, multi-tenant vector memory and knowledge graph for AI agents, integrated seamlessly through a Model Context Protocol (MCP) server and a Next.js dashboard.

## 1. Core Architecture
- **Vector Engine:** Powered by Weaviate, supporting hybrid search (BM25 + Vector).
- **Backend API:** Python FastAPI application handling business logic, embeddings, and AI interactions.
- **Caching Layer:** Redis-backed caching for search results and system statistics, preventing LLM stampedes via mutex locks.
- **Agent Interface:** TypeScript MCP Server (`Engram-MCP`) exposing memory operations as standardized tools for AI assistants.
- **User Interface:** Next.js React Dashboard (`Engram-Platform`) for visualizing analytics, managing memories, and manually triggering maintenance.

## 2. Structural Concepts
### Memory Tiers
The system organizes memories into three hierarchical tiers to manage scope and relevance:
1. **Tier 1 (Project/Matter):** Highly specific context bound to a particular investigation or project (`project_id`).
2. **Tier 2 (Tenant/General):** Workspace-wide generalized knowledge applicable across multiple projects within a tenant.
3. **Tier 3 (Global):** Universal system facts and rules.

### Multi-Tenancy & Matters
- **Tenants:** Isolated workspaces (`tenant_id`). All Weaviate collections enforce tenant isolation.
- **Matters:** Groupings of memories and entities representing a specific legal case, investigation, or project.

## 3. Key Features & Capabilities

### 3.1. Advanced Search & Retrieval
- **Hybrid Search:** Combines semantic vector similarity with keyword matching.
- **Cross-Encoder Reranking:** Results are re-scored using an external cross-encoder model (e.g., `BGEReranker` or MS-MARCO) to ensure contextual relevance over mere textual similarity.
- **Rich Metadata Filtering:** Query by tags, tiers, source, importance, and date ranges.

### 3.2. Automated Memory Management & Maintenance
The system utilizes background workers (APScheduler) to self-heal and optimize the memory database automatically.
- **Relevance Decay (Exponential):** Memories decay over time based on a half-life algorithm. However, reading a memory boosts its relevance (via `access_count` and `last_accessed_at`). This ensures frequently used information stays fresh while stale data fades.
- **Consolidation & Deduplication:** AI workers periodically scan for near-duplicate memories, clustering them via vector similarity and merging them into canonical master memories.
- **Contradiction Detection:** Evaluates incoming facts against existing memories to detect and resolve conflicting information.
- **Expiration Cleanup:** Automatically prunes memories that have surpassed their defined `expires_at` timestamp.

### 3.3. Knowledge Graph Integration
Parallel to semantic text memory, the system maintains a structured Knowledge Graph.
- **Entities:** Nodes representing people, organizations, concepts, or tools.
- **Relations:** Directed, weighted edges connecting entities (e.g., `works_on`, `depends_on`).
- **Traversal:** Ability to query and traverse the graph to map out investigative networks.

### 3.4. Retrieval-Augmented Generation (RAG)
- **Context Builder:** Intelligently compiles memory search results into token-optimized context windows for LLM prompts.
- **Memory RAG:** Direct endpoint to ask questions of the memory system, automatically retrieving relevant sources and synthesizing an answer using Ollama or external models.

## 4. Exposed Interfaces & Operations

### 4.1. REST API Endpoints (Backend)
- `POST /memories/search` — Search memories with hybrid + reranking.
- `POST /memories`, `PUT /memories/{id}`, `DELETE /memories/{id}` — Standard CRUD.
- `POST /memories/batch` — Bulk ingestion.
- `GET /matters/`, `POST /graph/entities`, `POST /graph/relations` — Matters and Knowledge Graph.
- **Maintenance Triggers:**
  - `POST /memories/decay` — Trigger relevance recalculation.
  - `POST /memories/consolidate` — Trigger deduplication.
  - `POST /memories/cleanup` — Prune expired items.

### 4.2. MCP Server Tools (For AI Agents)
Agents connected via the MCP have access to the following tools:
- `add_memory` / `batch_add_memories` — Ingest new facts.
- `get_memory` / `search_memory` / `update_memory` — Retrieve and modify context.
- `build_context` / `rag_query` — Deep context extraction for complex reasoning.
- `consolidate_memories` — Trigger the consolidation routine.
- `cleanup_expired` — Trigger the deletion of stale temporary data.
- `run_decay` — Manually force the exponential decay update.

### 4.3. Platform UI (Next.js Dashboard)
The visual dashboard empowers users to monitor and interact with the AI's brain:
- **Analytics:** Visualize memory growth, matter distribution, entity types, and memory tiers.
- **Memories Explorer:** View, edit, and filter raw memory data.
- **Action Buttons:** Direct UI triggers for **Run Decay** and **Consolidate** tasks directly from the Memories header.
- **Knowledge Graph View:** Node-link visualizations of extracted entities and investigations.

## 5. Roadmap & Advanced Features to Consider
Based on the current architecture, the following areas represent high-impact opportunities for future development:

### 5.1. Memory Confidence & Uncertainty Scoring
- **Source Reliability Tracking**: Assign confidence scores based on source credibility.
- **Contradiction Resolution**: When contradictions arise, track which version is more reliable based on provenance.
- **Evidence Chains**: Link memories to their supporting evidence sources (e.g., specific crawled documents).
- **Uncertainty Propagation**: Track uncertainty levels when new memories are inferred by the LLM rather than explicitly stated.

### 5.2. Temporal Reasoning & Event Modeling
- **Event Timeline Construction**: Automatically build chronological sequences from memories.
- **Causal Inference**: Identify likely cause-effect relationships between events.
- **Temporal Consistency Checking**: Flag temporally impossible sequences during ingestion.
- **Event Pattern Recognition**: Detect recurring event patterns over time for predictive intelligence.

### 5.3. Cross-Modal Memory Integration
- **File Content Indexing**: Extract and index memories from uploaded documents (PDFs, Word docs).
- **Image OCR & Analysis**: Extract text and semantic content from images to feed into the graph.
- **Audio/Video Transcription**: Process multimedia content into searchable memories.
- **Code Analysis**: Extract concepts, APIs, and architectural patterns from code files into Tier 1 (Project) memory.

### 5.4. Advanced Graph Analytics
- **Community Detection**: Identify clusters of strongly connected entities.
- **Influence Analysis**: Determine which entities are most central or influential in an investigation.
- **Path Prediction**: Predict likely connections between seemingly unrelated entities based on topological patterns.
- **Anomaly Detection**: Spot unusual patterns in the knowledge graph.

### 5.5. Memory Explainability & Provenance
- **Provenance Tracking**: Document how each memory was created or modified.
- **Inference Chains**: Show the reasoning steps that led the AI to derive specific conclusions.
- **Confidence Visualization**: Visual indicators of memory reliability within the Platform UI.
- **Source Attribution**: Link memories directly back to their original sources (e.g., URLs from the AiCrawler).
