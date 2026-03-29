# Engram-AiMemory Python FastAPI Service Surface Map

## Overview

Engram-AiMemory is a sophisticated 3-tier AI memory system built with FastAPI, Weaviate vector database, Redis caching, and MCP integration. This comprehensive surface map documents all components, endpoints, and architecture details.

---

## Table of Contents

1. [API Endpoints](#api-endpoints)
2. [Data Models](#data-models)
3. [Service Dependencies](#service-dependencies)
4. [Key Modules](#key-modules)
5. [Configuration](#configuration)
6. [Error Handling](#error-handling)
7. [Test Coverage](#test-coverage)
8. [npm Workspaces](#npm-workspaces)
9. [Architecture](#architecture)

---

## API Endpoints

### Health & Status Endpoints

| Method | Endpoint | Description | Rate Limit | Auth |
|--------|----------|-------------|------------|------|
| `GET` | `/health` | Basic health check | - | None |
| `GET` | `/health/detailed` | Detailed health with services | - | None |
| `GET` | `/health/liveness` | Liveness probe | - | None |
| `GET` | `/health/readiness` | Readiness probe | - | None |

### Memory Management Endpoints

#### Tiered Memory CRUD

| Method | Endpoint | Description | Rate Limit | Auth |
|--------|----------|-------------|------------|------|
| `POST` | `/memories` | Create new memory | 100/hr | API Key |
| `GET` | `/memories` | List memories with filters | 300/hr | API Key |
| `GET` | `/memories/{memory_id}` | Get memory by ID | 100/hr | API Key |
| `PUT` | `/memories/{memory_id}` | Update memory | 50/hr | API Key |
| `DELETE` | `/memories/{memory_id}` | Delete memory | 30/hr | API Key |

#### Batch Operations

| Method | Endpoint | Description | Rate Limit | Auth |
|--------|----------|-------------|------------|------|
| `POST` | `/memories/batch` | Create multiple memories | 200/hr | API Key |
| `DELETE` | `/memories/batch` | Delete multiple memories | 100/hr | API Key |

#### Memory Search

| Method | Endpoint | Description | Rate Limit | Auth |
|--------|----------|-------------|------------|------|
| `POST` | `/memories/search` | Semantic search | 300/hr | API Key |
| `GET` | `/memories/trending` | Get trending memories | 100/hr | API Key |
| `GET` | `/memories/recent` | Get recent memories | 100/hr | API Key |
| `GET` | `/memories/stats` | Get memory statistics | 50/hr | API Key |

### Tier-Specific Operations

#### Tier 1 (Project Memory)

| Method | Endpoint | Description | Rate Limit | Auth |
|--------|----------|-------------|------------|------|
| `POST` | `/memories/projects` | Create project memory | 100/hr | API Key |
| `GET` | `/memories/projects/{project_id}` | Get project memories | 200/hr | API Key |
| `PUT` | `/memories/projects/{project_id}` | Update project memory | 50/hr | API Key |

#### Tier 2 (General Memory)

| Method | Endpoint | Description | Rate Limit | Auth |
|--------|----------|-------------|------------|------|
| `POST` | `/memories/general` | Create general memory | 100/hr | API Key |
| `GET` | `/memories/general` | Get user's general memories | 200/hr | API Key |

#### Tier 3 (Global Memory)

| Method | Endpoint | Description | Rate Limit | Auth |
|--------|----------|-------------|------------|------|
| `POST` | `/memories/global` | Create global memory | 50/hr | API Key |
| `GET` | `/memories/global` | Get all global memories | 200/hr | API Key |

### Authentication & Authorization

| Method | Endpoint | Description | Rate Limit | Auth |
|--------|----------|-------------|------------|------|
| `POST` | `/auth/token` | Get JWT token | 100/hr | None |
| `POST` | `/auth/api-key` | Generate API key | 10/hr | JWT |
| `GET` | `/auth/verify` | Verify token | 200/hr | API Key |
| `POST` | `/auth/refresh` | Refresh token | 100/hr | JWT |

### Analytics & Insights

| Method | Endpoint | Description | Rate Limit | Auth |
|--------|----------|-------------|------------|------|
| `GET` | `/analytics/summary` | Memory system summary | 50/hr | API Key |
| `GET` | `/analytics/trends` | Usage trends | 100/hr | API Key |
| `GET` | `/analytics/quality` | Memory quality metrics | 50/hr | API Key |
| `POST` | `/analytics/correlate` | Find correlations | 30/hr | API Key |

### Knowledge Graph Operations

#### Entities Management

| Method | Endpoint | Description | Rate Limit | Auth |
|--------|----------|-------------|------------|------|
| `POST` | `/graph/entities` | Create/update entity | 100/hr | API Key |
| `GET` | `/graph/entities` | List entities | 200/hr | API Key |
| `GET` | `/graph/entities/{entity_id}` | Get entity details | 100/hr | API Key |
| `DELETE` | `/graph/entities/{entity_id}` | Delete entity | 50/hr | API Key |
| `POST` | `/graph/entities/batch` | Batch create entities | 200/hr | API Key |

#### Relationships Management

| Method | Endpoint | Description | Rate Limit | Auth |
|--------|----------|-------------|------------|------|
| `POST` | `/graph/relations` | Create relation | 100/hr | API Key |
| `GET` | `/graph/relations` | List relations | 200/hr | API Key |
| `GET` | `/graph/relations/{relation_id}` | Get relation details | 100/hr | API Key |
| `DELETE` | `/graph/relations/{relation_id}` | Delete relation | 50/hr | API Key |
| `POST` | `/graph/relations/batch` | Batch create relations | 200/hr | API Key |

#### Graph Query

| Method | Endpoint | Description | Rate Limit | Auth |
|--------|----------|-------------|------------|------|
| `POST` | `/graph/query` | Custom graph query | 50/hr | API Key |
| `GET` | `/graph/neighbors/{entity_id}` | Get entity neighbors | 200/hr | API Key |
| `GET` | `/graph/path` | Find path between entities | 30/hr | API Key |

### RAG (Retrieval Augmented Generation)

| Method | Endpoint | Description | Rate Limit | Auth |
|--------|----------|-------------|------------|------|
| `POST` | `/rag/generate` | Generate with context | 100/hr | API Key |
| `POST` | `/rag/query` | RAG search with generation | 100/hr | API Key |

### WebSocket Events

| Endpoint | Description | Auth |
|----------|-------------|------|
| `ws/ws/events` | Real-time memory events | API Key |
| `ws/ws/status` | System status updates | API Key |

### Investigations (Document Processing)

| Method | Endpoint | Description | Rate Limit | Auth |
|--------|----------|-------------|------------|------|
| `POST` | `/ingest/document` | Process document | 20/hr | API Key |
| `POST` | `/ingest/url` | Process URL content | 50/hr | API Key |
| `GET` | `/ingest/jobs` | List processing jobs | 100/hr | API Key |
| `GET` | `/ingest/jobs/{job_id}` | Get job status | 100/hr | API Key |

---

## Data Models

### Memory Models

#### Memory (Base Model)
```python
class Memory(BaseModel):
    id: UUID
    content: str
    project_id: str | None
    tier: MemoryTier
    type: MemoryType
    source: MemorySource
    importance: float = 0.5
    confidence: float = 0.8
    created_at: datetime
    updated_at: datetime
    tags: list[str] = []
    metadata: dict[str, Any] = {}
    embedding: list[float] | None
    access_count: int = 0
    last_accessed: datetime | None
```

#### MemoryCreate
```python
class MemoryCreate(BaseModel):
    content: str
    project_id: str | None = None
    tier: MemoryTier = MemoryTier.GENERAL
    type: MemoryType = MemoryType.INSIGHT
    source: MemorySource = MemorySource.SYSTEM
    importance: float = 0.5
    tags: list[str] = []
    metadata: dict[str, Any] = {}
```

#### MemorySearch
```python
class MemorySearch(BaseModel):
    query: str
    tier: MemoryTier | None = None
    project_id: str | None = None
    limit: int = 10
    min_confidence: float = 0.5
    filters: dict[str, Any] = {}
    include_metadata: bool = True
```

#### MemoryStats
```python
class MemoryStats(BaseModel):
    total_memories: int
    tier_breakdown: dict[MemoryTier, int]
    type_breakdown: dict[MemoryType, int]
    avg_importance: float
    avg_confidence: float
    recent_activity: int
    top_projects: list[dict[str, Any]]
```

### Graph Models

#### KnowledgeEntity
```python
class KnowledgeEntity(BaseModel):
    id: UUID
    name: str
    type: str
    description: str | None
    confidence: float
    properties: dict[str, Any]
    created_at: datetime
    updated_at: datetime
```

#### KnowledgeRelation
```python
class KnowledgeRelation(BaseModel):
    id: UUID
    source_entity: UUID
    target_entity: UUID
    relation_type: str
    weight: float
    metadata: dict[str, Any]
    created_at: datetime
```

#### GraphQuery
```python
class GraphQuery(BaseModel):
    entity_ids: list[UUID] | None = None
    relation_types: list[str] | None = None
    depth: int = 2
    max_results: int = 50
    filters: dict[str, Any] = {}
```

### Auth Models

#### TokenResponse
```python
class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    scope: str
```

#### APIKeyCreate
```python
class APIKeyCreate(BaseModel):
    name: str
    scopes: list[str] = ["memory:read"]
    expires_at: datetime | None = None
```

### Analytics Models

#### AnalyticsSummary
```python
class AnalyticsSummary(BaseModel):
    total_memories: int
    entities_count: int
    relations_count: int
    avg_confidence: float
    memory_growth_rate: float
    top_projects: list[dict[str, Any]]
    system_health: dict[str, Any]
```

---

## Service Dependencies

### Primary Dependencies

| Service | Type | Port | Purpose |
|---------|------|------|---------|
| **Weaviate** | Vector Database | 8080 (HTTP), 50051 (gRPC) | Vector storage and semantic search |
| **Redis** | Cache Layer | 6379 | Memory caching and session storage |
| **PostgreSQL** | Relational DB | 5432 | User/tenant data (optional) |
| **LM Studio** | Local LLM | 1234 | Memory consolidation (optional) |

### External APIs

| API | Purpose | Rate Limits |
|-----|---------|-------------|
| **OpenAI Embeddings** | Text embeddings | 3,000 RPM |
| **OpenAI Chat** | Memory analysis | 5,000 RPM |
| **DeepInfra** | Alternative embeddings/chat | 60 RPM |
| **Nomic API** | Local embeddings | 60 RPM |
| **Ollama** | Local embeddings/chat | 60 RPM |

### MCP Integration

- **MCP Server**: Dual transport (stdio + HTTP)
- **Authentication**: OAuth 2.1 with PKCE
- **Tools Available**: 12+ memory management tools
- **Real-time Events**: WebSocket support for live updates

---

## Key Modules

### Core System Modules

#### `system.py` - Main MemorySystem Class
```python
class MemorySystem:
    """3-tier AI memory system orchestrator."""

    # Components
    _weaviate: WeaviateMemoryClient
    _cache: RedisCache
    _embedding_client: Any
    _context_builder: ContextBuilder
    _rag: MemoryRAG
    _reranker: MemoryReranker
    _analyzer: MemoryAnalyzer
```

**Features:**
- Lazy loading of optional components
- Multi-tenant isolation
- Automatic memory consolidation
- Error recovery and fallbacks

#### `api.py` - FastAPI Application
```python
app = FastAPI(
    title="AI Memory System API",
    description="3-Tier Memory System with Weaviate, Redis, and MCP",
    version="0.1.0",
    lifespan=lifespan,
)
```

**Endpoints Covered:**
- Health checks (5 endpoints)
- Memory CRUD (15+ endpoints)
- Authentication (4 endpoints)
- Analytics (4 endpoints)
- Graph operations (8 endpoints)
- WebSocket (2 endpoints)
- RAG (2 endpoints)
- Investigations (4 endpoints)

#### `memory.py` - Data Models & Types
```python
class MemoryTier(int, Enum):
    PROJECT = 1    # Per-project isolated
    GENERAL = 2    # User-specific cross-project
    GLOBAL = 3     # Shared bootstrap knowledge

class MemoryType(StrEnum):
    CONVERSATION = "conversation"
    DOCUMENT = "document"
    CODE = "code"
    INSIGHT = "insight"
    # ... 8 total types
```

#### `client.py` - Weaviate Client
```python
class WeaviateMemoryClient:
    """Async Weaviate client for 3-tier memory system."""

    TIER_COLLECTIONS = {
        MemoryTier.PROJECT: "tier1_project_memories",
        MemoryTier.GENERAL: "tier2_general_memories",
        MemoryTier.GLOBAL: "tier3_global_memories",
    }
```

**Features:**
- Schema management
- CRUD operations
- Hybrid search
- GraphQL support
- Batch operations

#### `cache.py` - Redis Cache
```python
class RedisCache:
    """Redis-based caching layer."""

    # Key prefixes
    EMBEDDING_PREFIX = "emb:"
    SEARCH_PREFIX = "search:"
    MEMORY_PREFIX = "mem:"
    SESSION_PREFIX = "sess:"

    # TTLs
    EMBEDDING_TTL = 7 days
    SEARCH_TTL = 1 hour
    MEMORY_TTL = 24 hours
```

#### `auth.py` - Authentication System
```python
# JWT utilities
def create_access_token(data, secret, expire_hours=24)
def verify_token(token, secret)

# API key handling
def generate_api_key()
def verify_api_key(api_key)
```

#### `embeddings.py` - Embedding Providers
```python
class NomicEmbedder:
    """nomic-embed-text-v1.5 via sentence-transformers"""
    MODEL_NAME = "nomic-ai/nomic-embed-text-v1.5"
    DIMENSION = 768

class OllamaEmbedder:
    """Ollama /api/embeddings"""
    # Supports any local model
```

#### `rag.py` - RAG Pipeline
```python
class MemoryRAG:
    """RAG with generative-module fallback."""

    async def generate_with_context(
        self,
        query: str,
        tier: MemoryTier | None = None,
        project_id: str | None = None,
        limit: int | None = None,
    )
```

#### `decay.py` - Memory Decay Logic
```python
class MemoryDecay:
    """Exponential decay calculator."""

    def calculate_recency_score(self, created_at, now=None) -> float:
        """2^(-age_days / half_life_days)"""
```

#### `analyzer.py` - Memory Analysis
```python
class MemoryAnalyzer:
    """Self-management features."""

    async def analyze(self, memory: Memory) -> MemoryAnalysis:
        """Auto-importance, contradiction detection, deduplication."""
```

### Support Modules

#### `context.py` - Context Building
- Multi-tier context assembly
- Relevance scoring
- Context window management

#### `config.py` - Configuration Management
```python
class Settings(BaseSettings):
    # Weaviate
    weaviate_url: str = "http://localhost:8080"

    # Redis
    redis_url: str = "redis://localhost:6379"

    # Embeddings
    embedding_provider: Literal["openai", "local", "ollama", "nomic", "deepinfra"] = "nomic"

    # LLM
    llm_provider: Literal["openai", "anthropic", "local", "deepinfra"] = "openai"
```

#### `investigation/` - Document Processing
- `crawler.py`: Web content extraction
- `ingestor.py`: Document ingestion pipeline
- `ocr.py`: Image/text extraction
- `workers.py`: Background processing

---

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `WEAVIATE_URL` | Yes | `http://localhost:8080` | Weaviate HTTP endpoint |
| `WEAVIATE_API_KEY` | No | - | Weaviate API key |
| `REDIS_URL` | Yes | `redis://localhost:6379` | Redis connection |
| `REDIS_PASSWORD` | No | - | Redis password |
| `EMBEDDING_PROVIDER` | Yes | `nomic` | Embedding provider |
| `OPENAI_API_KEY` | Conditional | - | OpenAI API key |
| `LLM_PROVIDER` | Yes | `openai` | LLM provider |
| `JWT_SECRET` | Yes | - | JWT signing secret |
| `OLLAMA_HOST` | No | - | Ollama endpoint |
| `LOG_LEVEL` | No | `INFO` | Logging level |

### Embedding Providers

#### OpenAI
```bash
EMBEDDING_PROVIDER=openai
OPENAI_API_KEY=sk-...
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536
```

#### Nomic (Local)
```bash
EMBEDDING_PROVIDER=nomic
EMBEDDING_MODEL=nomic-embed-text-v1.5
EMBEDDING_DIMENSIONS=768
```

#### DeepInfra
```bash
EMBEDDING_PROVIDER=deepinfra
OPENAI_BASE_URL=https://api.deepinfra.com/v1/openai
```

#### Ollama (Local)
```bash
EMBEDDING_PROVIDER=ollama
OLLAMA_HOST=http://localhost:11434
EMBEDDING_MODEL=nomic-embed-text:v1.5
```

### Collection Schema (Weaviate)

#### Tier 1 - Project Memories
```
Collection: "tier1_project_memories"
Properties:
- content (text)
- project_id (string)
- importance (number)
- confidence (number)
- embedding (vector[768])
- metadata (object)
- created_at (datetime)
- updated_at (datetime)
```

#### Tier 2 - General Memories
```
Collection: "tier2_general_memories"
Properties:
- content (text)
- user_id (string)
- importance (number)
- embedding (vector[768])
- metadata (object)
```

#### Tier 3 - Global Memories
```
Collection: "tier3_global_memories"
Properties:
- content (text)
- category (string)
- tags (array[string])
- embedding (vector[768])
```

#### Knowledge Graph Collections
```
Collection: "knowledge_entities"
Collection: "knowledge_relations"
```

---

## Error Handling

### HTTP Exception Classes

| Status Code | Exception | Description |
|-------------|-----------|-------------|
| 400 | `HTTPException` | Bad Request (validation errors) |
| 401 | `HTTPException` | Unauthorized (invalid token) |
| 403 | `HTTPException` | Forbidden (insufficient scopes) |
| 404 | `HTTPException` | Not Found (resource missing) |
| 429 | `HTTPException` | Too Many Requests (rate limited) |
| 500 | `HTTPException` | Internal Server Error |

### Custom Exceptions

```python
class MemorySystemError(Exception):
    """Base exception for memory system errors."""

class MemoryNotFoundError(MemorySystemError):
    """Memory not found."""

class MemoryValidationError(MemorySystemError):
    """Memory validation failed."""

class RateLimitError(MemorySystemError):
    """Rate limit exceeded."""
```

### Error Response Format

```json
{
    "error": {
        "code": "MEMORY_NOT_FOUND",
        "message": "Memory with ID xxx not found",
        "details": {
            "memory_id": "xxx",
            "searched_in_tiers": ["PROJECT", "GENERAL"]
        }
    },
    "request_id": "req_xxx"
}
```

### Error Handling Patterns

1. **Validation Errors**: Pydantic validation with detailed field errors
2. **Rate Limiting**: SlowAPI with custom limiters per endpoint
3. **Connection Errors**: Retry with tenacity for Weaviate/Redis
4. **Fallback Modes**: Graceful degradation when optional services unavailable

---

## Test Coverage

### Test Structure

```
packages/core/tests/
├── test_*.py                # Unit tests (30+ files)
├── investigation/           # Document processing tests
│   ├── test_crawler.py
│   ├── test_ingestor.py
│   └── test_workers.py
└── integration/            # Integration tests
    ├── test_api_integration.py
    └── test_e2e.py
```

### Test Categories

#### Unit Tests (80%+ Coverage)
- **Memory Operations**: CRUD, search, validation
- **Cache Operations**: Redis operations, TTL handling
- **Client Operations**: Weaviate CRUD, GraphQL
- **Auth Operations**: JWT, API key generation
- **Embedding Operations**: Multiple provider testing

#### Integration Tests
- **API Endpoints**: FastAPI route testing
- **Database Integration**: Weaviate + Redis
- **Authentication Flow**: Token generation and validation
- **WebSocket Events**: Real-time communication

#### Performance Tests
- **Load Testing**: Concurrent memory operations
- **Search Performance**: Large dataset searches
- **Memory Usage**: Long-running operations

### Test Configuration

```ini
[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["packages/core/tests"]
addopts = "--cov=memory_system --cov-report=term-missing --cov-report=html --cov-fail-under=79.8"
```

### Coverage Exclusions
- MCP server code (`mcp/*`)
- Investigation modules (`crawler.py`, `ingestor.py`, etc.)
- Optional components (`ollama_client.py`, `ai_provider.py`)
- Compatibility modules

### Test Dependencies

```python
dev-dependencies = [
    "pytest>=8.0.0",
    "pytest-asyncio>=0.24.0",
    "pytest-cov>=5.0.0",
    "ruff>=0.6.0",
    "mypy>=1.0.0",
]
```

---

## npm Workspaces

### Package Structure

```
packages/
├── cli/                    # CLI Installer
│   ├── package.json
│   └── src/
│       ├── index.ts        # Main CLI entry point
│       └── systemd.ts      # Systemd service management
├── mcp-server/            # MCP Server (TypeScript)
│   └── src/
│       ├── server.ts      # MCP server setup
│       ├── tools/         # MCP tools definitions
│       └── auth/          # OAuth 2.1 auth
└── dashboard/             # React Dashboard
    ├── src/
    │   ├── components/    # React components
    │   ├── stores/        # Zustand state
    │   └── lib/           # API client
```

### CLI Package (`@ai-memory/cli`)

**Package**: `packages/cli/package.json`
- **Version**: 0.1.0
- **Type**: ES Module
- **Main**: `src/index.ts`
- **Bin**: `ai-memory`

**Features:**
- Interactive installer
- Systemd service management
- Docker deployment
- Health checks
- Diagnostic tools

**Usage:**
```bash
ai-memory install      # Install as systemd service
ai-memory health       # Check system health
ai-memory deploy       # Deploy to production
```

### MCP Server Package

**Features:**
- Dual transport (stdio + HTTP)
- OAuth 2.1 authentication
- 12+ memory management tools
- WebSocket real-time events
- Tool examples and documentation

**Tools Provided:**
- `add_memory` - Store memories
- `search_memory` - Semantic search
- `get_memory` - Retrieve by ID
- `delete_memory` - Remove memories
- `list_memories` - List with filters
- `get_memory_stats` - Get statistics
- `add_entity` - Create knowledge entities
- `add_relation` - Create relationships
- `query_graph` - Query knowledge graph

### Dashboard Package (React)

**Tech Stack:**
- Next.js 15 App Router
- React 19 with Server Components
- Zustand for state management
- ECharts for visualizations
- Tailwind CSS v4

**Features:**
- Memory browser with search
- Knowledge graph visualization
- Real-time updates
- Analytics dashboard
- Multi-tenant management

---

## Architecture

### System Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Engram-AiMemory Python FastAPI Service (Port 8000)     │
│  3-Tier Memory System with Weaviate & Redis           │
├──────────────┬──────────────┬───────────────────────────┤
│  FastAPI     │  Memory      │   Knowledge Graph         │
│  Routes      │  Operations  │   Operations              │
│  (1899 lines)│  (system.py) │   (client.py)             │
├──────────────┴──────────────┴───────────────────────────┤
│  Weaviate (8080) │ Redis (6379) │ ChromaDB │ LM Studio │
└──────────────────┴─────────────────┴──────────┴─────────┘
```

### Data Flow

1. **Memory Creation**:
   - Content → Embedding → Store in appropriate tier
   - Cache embedding vectors
   - Update search indexes

2. **Memory Retrieval**:
   - Query → Semantic search → Weaviate → Cache → Results
   - Apply tier filters and permissions
   - Update access statistics

3. **Memory Consolidation**:
   - Analyze patterns → LLM review → Merge similar memories
   - Update importance scores
   - Handle contradictions

### Multi-Tier Architecture

#### Tier 1: Project Memory
- **Isolation**: Per-project namespace
- **Content**: Code insights, decisions, patterns
- **Access**: Project members only
- **Retention**: 2 years (configurable)

#### Tier 2: General Memory
- **Scope**: User-specific, cross-project
- **Content**: Preferences, workflows, personal insights
- **Access**: Individual user
- **Retention**: 5 years

#### Tier 3: Global Memory
- **Scope**: Shared across all users
- **Content**: Best practices, documentation, common knowledge
- **Access**: Public (read-only)
- **Retention**: Permanent

### Security Model

1. **Authentication**:
   - JWT tokens for API access
   - API keys for machine-to-machine
   - OAuth 2.1 for MCP clients

2. **Authorization**:
   - Tenant isolation
   - Project-level permissions
   - Tier-based access control

3. **Rate Limiting**:
   - Per-endpoint limits
   - User-based quotas
   - API key limits

### Performance Optimizations

1. **Caching**:
   - Redis for embeddings and search results
   - Memory TTL management
   - Query result caching

2. **Indexing**:
   - Weaviate vector indexes
   - HNSW for fast similarity search
   - Hybrid search (vector + keyword)

3. **Batch Operations**:
   - Bulk memory operations
   - Batch entity creation
   - Asynchronous processing

### Monitoring & Observability

1. **Health Checks**:
   - Service connectivity
   - Performance metrics
   - Error rates

2. **Logging**:
   - Structured JSON logs
   - Request tracing
   - Error context

3. **Metrics**:
   - Prometheus integration
   - Memory usage tracking
   - Response time monitoring

---

## Deployment

### Docker Support

```bash
# Development
docker compose -f docker/docker-compose.yml up -d

# Production
docker compose -f docker/docker-compose.prod.yml up -d
```

### Service Configuration

- **API Server**: FastAPI with Uvicorn
- **Workers**: APScheduler for background tasks
- **Monitoring**: Health check endpoints
- **Scaling**: Horizontal scaling supported

### Environment-Specific Config

- **Development**: Local services, debug logging
- **Staging**: Shared services, test data
- **Production**: High availability, monitoring

---

## Summary

The Engram-AiMemory Python FastAPI service is a comprehensive 3-tier memory system with:

- **50+ API Endpoints** covering memory operations, analytics, and graph queries
- **3-Tier Architecture** with project, general, and global memory isolation
- **Multiple Embedding Providers** including OpenAI, Nomic, DeepInfra, and Ollama
- **Comprehensive Test Suite** with 80%+ coverage
- **npm Workspace Packages** for CLI, MCP server, and dashboard
- **Production-Ready** with Docker, monitoring, and error handling
- **Security Features** JWT auth, API keys, rate limiting, and tenant isolation

The system provides a robust foundation for AI applications needing persistent memory with semantic search capabilities, knowledge graph relationships, and real-time updates.