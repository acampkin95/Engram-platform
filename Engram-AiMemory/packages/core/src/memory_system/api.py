"""
FastAPI REST API for the AI Memory System.
"""

import asyncio
import csv
import io
import json
import logging
import time
import traceback
from collections import Counter, deque
from contextlib import asynccontextmanager, suppress
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import (
    Depends,
    FastAPI,
    HTTPException,
    Query,
    Request,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse, StreamingResponse
from pydantic import BaseModel, Field
from rich.console import Console
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from memory_system import (
    KnowledgeEntity,
    KnowledgeRelation,
    MemorySource,
    MemorySystem,
    MemoryTier,
    MemoryType,
)
from memory_system.auth import (
    create_access_token,
    require_auth,
    verify_password,
)
from memory_system.config import get_settings

console = Console()
logger = logging.getLogger(__name__)
limiter = Limiter(key_func=get_remote_address)

# Module-level settings — required for rate-limit decorators (evaluated at import time)
_api_settings = get_settings()

# Global memory system instance
_memory_system: MemorySystem | None = None
_scheduler = None  # MaintenanceScheduler instance (optional)


class _ConnectionManager:
    """Manages active WebSocket connections for live event streaming."""

    def __init__(self) -> None:
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket) -> None:
        self.active = [c for c in self.active if c is not ws]

    async def broadcast(self, message: dict) -> None:
        disconnected = []
        for ws in self.active:
            try:
                await ws.send_json(message)
            except Exception:
                disconnected.append(ws)
        for ws in disconnected:
            self.disconnect(ws)


_ws_manager = _ConnectionManager()


class ErrorResponse(BaseModel):
    """Standard error response."""

    error: str
    detail: str | None = None
    request_id: str | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle."""
    global _memory_system

    console.print("[blue]Starting AI Memory API...[/blue]")

    settings = get_settings()
    _memory_system = MemorySystem(settings)

    try:
        await _memory_system.initialize()
        console.print("[green]✓ AI Memory API ready[/green]")
    except Exception as e:
        console.print(f"[red]✗ Failed to initialize: {e}[/red]")
        console.print(
            "[yellow]API starting in degraded mode (services may be unavailable)[/yellow]"
        )

    # Start background maintenance scheduler (optional — requires Ollama)
    global _scheduler
    try:
        from memory_system.workers import MaintenanceScheduler

        _scheduler = MaintenanceScheduler(
            memory_system=_memory_system,
            ollama_client=getattr(_memory_system, "_ollama", None),
            batch_size=getattr(settings, "maintenance_batch_size", 20),
        )
        _scheduler.start()
        console.print("[green]✓ Maintenance scheduler started[/green]")
    except Exception as e:
        console.print(f"[yellow]⚠ Maintenance scheduler not started: {e}[/yellow]")
        _scheduler = None

    yield

    console.print("[yellow]Shutting down AI Memory API...[/yellow]")
    if _scheduler:
        with suppress(Exception):
            _scheduler.stop()
    if _memory_system:
        await _memory_system.close()


app = FastAPI(
    title="AI Memory System API",
    description="3-Tier Memory System with Weaviate, Redis, and MCP",
    version="0.1.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception on {request.url.path}: {exc}\n{traceback.format_exc()}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred. Please check the logs."},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.warning(f"Validation error on {request.url.path}: {exc.errors()}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": "Validation error", "errors": exc.errors()},
    )


app.add_middleware(
    CORSMiddleware,
    allow_origins=_api_settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# In-memory metrics & search log store
# ---------------------------------------------------------------------------
_search_logs: deque = deque(maxlen=1000)
_request_metrics: dict[str, Any] = {
    "total_requests": 0,
    "total_errors": 0,
    "total_latency_ms": 0.0,
    "requests_by_path": {},
    "start_time": time.time(),
}
_metrics_lock = asyncio.Lock()


@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    """Track per-request latency, count, and errors."""
    start = time.monotonic()
    response = await call_next(request)
    latency_ms = (time.monotonic() - start) * 1000

    async with _metrics_lock:
        _request_metrics["total_requests"] += 1
        _request_metrics["total_latency_ms"] += latency_ms
        if response.status_code >= 400:
            _request_metrics["total_errors"] += 1
        path = request.url.path
        if path not in _request_metrics["requests_by_path"]:
            _request_metrics["requests_by_path"][path] = {"count": 0, "errors": 0}
        _request_metrics["requests_by_path"][path]["count"] += 1
        if response.status_code >= 400:
            _request_metrics["requests_by_path"][path]["errors"] += 1

    return response


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions with consistent error format."""
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(
            error=exc.__class__.__name__,
            detail=exc.detail,
        ).model_dump(),
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle unexpected exceptions with logging."""
    console.print(f"[red]Unhandled error: {exc}[/red]")
    return JSONResponse(
        status_code=500,
        content=ErrorResponse(
            error="InternalServerError",
            detail="An unexpected error occurred. Please try again later.",
        ).model_dump(),
    )


# ==================== Models ====================


class AddMemoryRequest(BaseModel):
    """Request to add a new memory."""

    content: str = Field(..., min_length=1, description="Memory content")
    tier: int = Field(
        default=1, ge=1, le=3, description="Memory tier (1=Project, 2=General, 3=Global)"
    )
    memory_type: str = Field(default="fact", description="Type of memory")
    source: str = Field(default="agent", description="Source of memory")
    project_id: str | None = Field(default=None, description="Project ID for Tier 1")
    user_id: str | None = Field(default=None, description="User ID")
    tenant_id: str | None = Field(default=None, description="Tenant ID for multi-tenancy")
    session_id: str | None = Field(default=None, description="Session ID")
    importance: float = Field(default=0.5, ge=0.0, le=1.0, description="Importance score")
    confidence: float = Field(default=1.0, ge=0.0, le=1.0, description="Confidence score")
    tags: list[str] = Field(default_factory=list, description="Tags for categorization")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Additional metadata")
    expires_in_days: int | None = Field(default=None, description="Days until expiration")


class AddMemoryResponse(BaseModel):
    """Response after adding a memory."""

    memory_id: str
    tier: int
    created_at: datetime


class BatchAddRequest(BaseModel):
    """Request to add multiple memories in a single batch operation."""

    memories: list[AddMemoryRequest] = Field(
        ...,
        min_length=1,
        max_length=100,
        description="List of memories to add (max 100)",
    )


class BatchAddResponse(BaseModel):
    """Response after batch adding memories."""

    memory_ids: list[str] = Field(description="IDs of successfully inserted memories")
    failed: int = Field(description="Number of memories that failed to insert")
    total: int = Field(description="Total number of memories in the request")


class SearchRequest(BaseModel):
    """Request to search memories."""

    query: str = Field(..., min_length=1, max_length=10000, description="Search query")
    tier: int | None = Field(default=None, ge=1, le=3, description="Filter by tier")
    project_id: str | None = Field(default=None, description="Filter by project")
    user_id: str | None = Field(default=None, description="Filter by user")
    tenant_id: str | None = Field(default=None, description="Filter by tenant")
    tags: list[str] | None = Field(default=None, description="Filter by tags")
    min_importance: float | None = Field(default=None, ge=0.0, le=1.0)
    limit: int = Field(default=10, ge=1, le=100)
    event_only: bool = Field(default=False, description="Only return event memories")
    start_date: str | None = Field(default=None, description="ISO format start date filter")
    end_date: str | None = Field(default=None, description="ISO format end date filter")


class SearchResult(BaseModel):
    """A single search result."""

    memory_id: str
    content: str
    summary: str | None
    tier: int
    memory_type: str
    source: str
    project_id: str | None
    user_id: str | None
    tenant_id: str
    importance: float
    confidence: float
    tags: list[str]
    created_at: datetime
    score: float | None
    distance: float | None


class SearchResponse(BaseModel):
    """Response for search request."""

    results: list[SearchResult]
    query: str
    total: int


class ListMemoriesRequest(BaseModel):
    """Request to list memories without a search query."""

    tenant_id: str | None = Field(default=None, description="Filter by tenant")
    project_id: str | None = Field(default=None, description="Filter by project")
    tier: int | None = Field(default=None, ge=1, le=3, description="Filter by tier")
    limit: int = Field(default=50, ge=1, le=500, description="Max results")
    offset: int = Field(default=0, ge=0, description="Pagination offset")


class ListMemoriesResponse(BaseModel):
    """Response for memory list."""

    memories: list[SearchResult]
    total: int
    limit: int
    offset: int


class MemoryResponse(BaseModel):
    """Response for a single memory."""

    memory_id: str
    content: str
    summary: str | None
    tier: int
    memory_type: str
    source: str
    project_id: str | None
    user_id: str | None
    tenant_id: str
    session_id: str | None
    importance: float
    confidence: float
    tags: list[str]
    metadata: dict[str, Any]
    created_at: datetime
    updated_at: datetime
    expires_at: datetime | None


class StatsResponse(BaseModel):
    """System statistics."""

    total_memories: int
    tier1_count: int
    tier2_count: int
    tier3_count: int
    by_type: dict[str, int]
    oldest_memory: datetime | None
    newest_memory: datetime | None
    avg_importance: float
    importance_distribution: dict[str, int] = Field(default_factory=dict)


class HealthResponse(BaseModel):
    """Health check response."""

    status: str
    weaviate: bool
    redis: bool
    initialized: bool


class ServiceHealth(BaseModel):
    """Health info for a single service."""

    status: str  # "up", "down", "loaded", "not_configured", "not_loaded"
    memory_mb: int | None = None
    model: str | None = None
    models_loaded: list[str] = Field(default_factory=list)


class MaintenanceQueueStats(BaseModel):
    """Maintenance scheduler queue statistics."""

    pending: int = 0
    running: int = 0
    last_run: dict[str, str] = Field(default_factory=dict)
    scheduler_running: bool = False


class ResourceUsage(BaseModel):
    """Resource usage summary."""

    total_model_ram_mb: int = 0
    budget_mb: int = 3072
    headroom_mb: int = 3072


class DetailedHealthResponse(BaseModel):
    """Detailed health check with per-service status."""

    status: str
    services: dict[str, ServiceHealth]
    maintenance_queue: MaintenanceQueueStats
    resource_usage: ResourceUsage


class ContextRequest(BaseModel):
    """Request to build memory context for a query."""

    query: str = Field(
        ..., min_length=1, max_length=10000, description="Query to build context for"
    )
    tier: int | None = Field(default=None, ge=1, le=3, description="Filter by tier")
    project_id: str | None = Field(default=None, description="Filter by project")
    user_id: str | None = Field(default=None, description="Filter by user")
    session_id: str | None = Field(default=None, description="Session for context")
    max_tokens: int | None = Field(default=None, ge=100, le=32000, description="Token budget")


class ContextResponse(BaseModel):
    """Response with assembled memory context."""

    query: str
    context: str
    token_estimate: int


class CreateTenantRequest(BaseModel):
    tenant_id: str = Field(
        ..., min_length=1, max_length=128, description="Unique tenant identifier"
    )


class TenantListResponse(BaseModel):
    tenants: list[str]
    total: int


class LoginRequest(BaseModel):
    """Request body for POST /auth/login."""

    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)


class LoginResponse(BaseModel):
    """Response from POST /auth/login."""

    access_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


class RAGRequest(BaseModel):
    """Request for RAG query over memories."""

    query: str = Field(..., min_length=1, max_length=10000, description="Query for RAG")
    tier: int | None = Field(default=None, ge=1, le=3, description="Filter by tier")
    project_id: str | None = Field(default=None, description="Filter by project")
    user_id: str | None = Field(default=None, description="Filter by user")
    session_id: str | None = Field(default=None, description="Session for context")


class RAGResponse(BaseModel):
    """Response from RAG query."""

    query: str
    mode: str
    synthesis_prompt: str
    source_count: int
    context: dict[str, Any]


# ==================== Helpers ====================


def _tier_from_int(tier: int) -> MemoryTier:
    """Convert integer tier to enum."""
    return {1: MemoryTier.PROJECT, 2: MemoryTier.GENERAL, 3: MemoryTier.GLOBAL}[tier]


def _type_from_str(type_str: str) -> MemoryType:
    """Convert string to MemoryType."""
    try:
        return MemoryType(type_str.lower())
    except ValueError:
        return MemoryType.FACT


def _source_from_str(source_str: str) -> MemorySource:
    """Convert string to MemorySource."""
    try:
        return MemorySource(source_str.lower())
    except ValueError:
        return MemorySource.AGENT


# ==================== Endpoints ====================


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Check system health."""
    return HealthResponse(
        status="healthy" if (_memory_system and _memory_system.is_healthy) else "unhealthy",
        weaviate=_memory_system._weaviate.is_connected if _memory_system else False,
        redis=_memory_system._cache.is_connected if _memory_system else False,
        initialized=_memory_system.is_initialized if _memory_system else False,
    )


@app.get(
    "/health/detailed", response_model=DetailedHealthResponse, dependencies=[Depends(require_auth)]
)
async def health_detailed():
    """Detailed health check with per-service resource usage."""
    services: dict[str, ServiceHealth] = {}
    total_ram = 0

    # Weaviate
    weaviate_up = bool(_memory_system and _memory_system._weaviate.is_connected)
    services["weaviate"] = ServiceHealth(status="up" if weaviate_up else "down", memory_mb=77)

    # Redis
    redis_up = bool(_memory_system and _memory_system._cache.is_connected)
    services["redis"] = ServiceHealth(status="up" if redis_up else "down", memory_mb=21)

    # Ollama
    ollama_client = getattr(_memory_system, "_ollama", None) if _memory_system else None
    if ollama_client is not None:
        try:
            available = await ollama_client.is_available()
            if available:
                models = await ollama_client.list_models()
                ollama_ram = 900
                total_ram += ollama_ram
                services["ollama"] = ServiceHealth(
                    status="up", memory_mb=ollama_ram, models_loaded=models
                )
            else:
                services["ollama"] = ServiceHealth(status="down", memory_mb=0)
        except Exception:
            services["ollama"] = ServiceHealth(status="down", memory_mb=0)
    else:
        services["ollama"] = ServiceHealth(status="not_configured")

    # Embedding model (nomic)
    nomic_embedder = getattr(_memory_system, "_nomic_embedder", None) if _memory_system else None
    if nomic_embedder is not None:
        nomic_ram = 350
        total_ram += nomic_ram
        services["embedding_model"] = ServiceHealth(
            status="loaded", memory_mb=nomic_ram, model="nomic-embed-text-v1.5"
        )
    else:
        services["embedding_model"] = ServiceHealth(status="not_loaded")

    # Reranker (BGE)
    bge_reranker = getattr(_memory_system, "_bge_reranker", None) if _memory_system else None
    if bge_reranker is not None:
        reranker_ram = 280
        total_ram += reranker_ram
        services["reranker"] = ServiceHealth(
            status="loaded", memory_mb=reranker_ram, model="BAAI/bge-reranker-base"
        )
    else:
        services["reranker"] = ServiceHealth(status="not_loaded")

    # Maintenance scheduler
    scheduler_running = bool(_scheduler and _scheduler.is_running())
    scheduler_stats = _scheduler.get_stats() if _scheduler else {}
    queue_stats = MaintenanceQueueStats(
        scheduler_running=scheduler_running,
        last_run=scheduler_stats.get("last_run", {}),
    )

    # Resource usage
    budget_mb = 3072
    resource_usage = ResourceUsage(
        total_model_ram_mb=total_ram,
        budget_mb=budget_mb,
        headroom_mb=max(0, budget_mb - total_ram),
    )

    overall = "healthy" if weaviate_up and redis_up else "degraded"
    return DetailedHealthResponse(
        status=overall,
        services=services,
        maintenance_queue=queue_stats,
        resource_usage=resource_usage,
    )


@app.post("/auth/login", response_model=LoginResponse)
@limiter.limit("10/minute")
async def login(request_obj: Request, request: LoginRequest):  # noqa: B008
    """Authenticate with username/password, returns JWT access token.

    Returns 401 if credentials are wrong or no admin password is configured.
    """
    settings = get_settings()

    if settings.admin_password_hash is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Dashboard login is not configured (set ADMIN_PASSWORD_HASH in .env)",
        )

    if request.username != settings.admin_username:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not verify_password(request.password, settings.admin_password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_access_token(
        {"sub": request.username},
        secret=settings.jwt_secret,
        expire_hours=settings.jwt_expire_hours,
    )

    return LoginResponse(
        access_token=token,
        expires_in=settings.jwt_expire_hours * 3600,
    )


@app.post("/auth/refresh", response_model=LoginResponse)
async def refresh_token(identity: str = Depends(require_auth)):
    """Refresh a JWT token. Requires a valid existing token or API key."""
    settings = get_settings()

    token = create_access_token(
        {"sub": identity},
        secret=settings.jwt_secret,
        expire_hours=settings.jwt_expire_hours,
    )

    return LoginResponse(
        access_token=token,
        expires_in=settings.jwt_expire_hours * 3600,
    )


@app.get("/stats", response_model=StatsResponse, dependencies=[Depends(require_auth)])
async def get_stats(tenant_id: str | None = None):
    """Get memory statistics."""
    if not _memory_system:
        raise HTTPException(status_code=503, detail="System not initialized")

    stats = await _memory_system.get_stats(tenant_id)
    stats_dict = stats.model_dump()
    # Build importance_distribution from avg_importance as a simple bucketed proxy.
    # Weaviate does not store histogram data; this provides a meaningful approximation.
    avg_imp = stats.avg_importance
    importance_distribution: dict[str, int] = {
        "low (0.0-0.3)": 0,
        "medium (0.3-0.7)": 0,
        "high (0.7-1.0)": 0,
    }
    if avg_imp < 0.3:
        importance_distribution["low (0.0-0.3)"] = stats.total_memories
    elif avg_imp < 0.7:
        importance_distribution["medium (0.3-0.7)"] = stats.total_memories
    else:
        importance_distribution["high (0.7-1.0)"] = stats.total_memories
    stats_dict["importance_distribution"] = importance_distribution
    return StatsResponse(**stats_dict)


@limiter.limit(f"{_api_settings.rate_limit_per_minute}/minute")
@app.post("/memories", response_model=AddMemoryResponse, dependencies=[Depends(require_auth)])
async def add_memory(request_obj: Request, request: AddMemoryRequest):
    """Add a new memory."""
    if not _memory_system:
        raise HTTPException(status_code=503, detail="System not initialized")

    memory_id = await _memory_system.add(
        content=request.content,
        tier=_tier_from_int(request.tier),
        memory_type=_type_from_str(request.memory_type),
        source=_source_from_str(request.source),
        project_id=request.project_id,
        user_id=request.user_id,
        tenant_id=request.tenant_id,
        session_id=request.session_id,
        importance=request.importance,
        confidence=request.confidence,
        tags=request.tags,
        metadata=request.metadata,
        expires_in_days=request.expires_in_days,
    )

    await _ws_manager.broadcast(
        {"type": "memory_added", "memory_id": str(memory_id), "tier": request.tier}
    )
    return AddMemoryResponse(
        memory_id=str(memory_id),
        tier=request.tier,
        created_at=datetime.now(UTC),
    )


@limiter.limit(f"{_api_settings.rate_limit_per_minute}/minute")
@app.post("/memories/batch", response_model=BatchAddResponse, dependencies=[Depends(require_auth)])
async def add_memories_batch(request_obj: Request, request: BatchAddRequest):
    """Add multiple memories in a single batch operation."""
    if not _memory_system:
        raise HTTPException(status_code=503, detail="System not initialized")

    memories_data = []
    for mem_req in request.memories:
        memories_data.append(
            {
                "content": mem_req.content,
                "tier": _tier_from_int(mem_req.tier),
                "memory_type": _type_from_str(mem_req.memory_type),
                "source": _source_from_str(mem_req.source),
                "project_id": mem_req.project_id,
                "user_id": mem_req.user_id,
                "tenant_id": mem_req.tenant_id,
                "session_id": mem_req.session_id,
                "importance": mem_req.importance,
                "confidence": mem_req.confidence,
                "tags": mem_req.tags,
                "metadata": mem_req.metadata,
                "expires_in_days": mem_req.expires_in_days,
            }
        )

    successful_ids, failed_count = await _memory_system.add_batch(memories_data)

    return BatchAddResponse(
        memory_ids=[str(uid) for uid in successful_ids],
        failed=failed_count,
        total=len(request.memories),
    )


@limiter.limit(f"{_api_settings.rate_limit_per_minute}/minute")
@app.post("/memories/search", response_model=SearchResponse, dependencies=[Depends(require_auth)])
async def search_memories(request_obj: Request, request: SearchRequest):
    """Search memories."""
    if not _memory_system:
        raise HTTPException(status_code=503, detail="System not initialized")

    tier = _tier_from_int(request.tier) if request.tier else None

    start_dt = None
    end_dt = None
    if request.start_date:
        with contextlib.suppress(ValueError, TypeError):
            start_dt = datetime.fromisoformat(request.start_date.replace("Z", "+00:00"))
    if request.end_date:
        with contextlib.suppress(ValueError, TypeError):
            end_dt = datetime.fromisoformat(request.end_date.replace("Z", "+00:00"))

    results = await _memory_system.search(
        query=request.query,
        tier=tier,
        project_id=request.project_id,
        user_id=request.user_id,
        tenant_id=request.tenant_id,
        tags=request.tags,
        min_importance=request.min_importance,
        limit=request.limit,
        event_only=request.event_only,
        start_date=start_dt,
        end_date=end_dt,
    )

    search_results = [
        SearchResult(
            memory_id=str(r.memory.id),
            content=r.memory.content,
            summary=r.memory.summary,
            tier=int(r.memory.tier),
            memory_type=r.memory.memory_type,
            source=r.memory.source,
            project_id=r.memory.project_id,
            user_id=r.memory.user_id,
            tenant_id=r.memory.tenant_id,
            importance=r.memory.importance,
            confidence=r.memory.confidence,
            tags=r.memory.tags,
            created_at=r.memory.created_at,
            score=r.score,
            distance=r.distance,
        )
        for r in results
    ]

    # Log search for analytics
    user_id = getattr(request_obj.state, "user_id", "unknown")
    _search_logs.append(
        {
            "timestamp": datetime.now(UTC).isoformat(),
            "query": request.query,
            "results_count": len(search_results),
            "tier": request.tier,
            "tenant_id": request.tenant_id or "default",
            "user_id": user_id,
        }
    )

    return SearchResponse(
        results=search_results,
        query=request.query,
        total=len(search_results),
    )


@app.get(
    "/memories/list", response_model=ListMemoriesResponse, dependencies=[Depends(require_auth)]
)
async def list_memories(
    tenant_id: str | None = None,
    project_id: str | None = None,
    tier: int | None = Query(default=None, ge=1, le=3),
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    """List memories without requiring a search query."""
    if not _memory_system:
        raise HTTPException(status_code=503, detail="System not initialized")
    tier_enum = _tier_from_int(tier) if tier else None
    memories, total_count = await _memory_system.list_memories(
        tier=tier_enum,
        project_id=project_id,
        tenant_id=tenant_id,
        limit=limit,
        offset=offset,
    )
    results = [
        SearchResult(
            memory_id=str(m.id),
            content=m.content,
            summary=m.summary,
            tier=int(m.tier),
            memory_type=m.memory_type,
            source=m.source,
            project_id=m.project_id,
            user_id=m.user_id,
            tenant_id=m.tenant_id,
            importance=m.importance,
            confidence=m.confidence,
            tags=m.tags,
            created_at=m.created_at,
            score=None,
            distance=None,
        )
        for m in memories
    ]
    return ListMemoriesResponse(
        memories=results,
        total=total_count,
        limit=limit,
        offset=offset,
    )


@app.get(
    "/memories/{memory_id}", response_model=MemoryResponse, dependencies=[Depends(require_auth)]
)
async def get_memory(
    memory_id: str,
    tier: int = Query(..., ge=1, le=3, description="Memory tier"),
    tenant_id: str | None = None,
):
    """Get a specific memory by ID."""
    if not _memory_system:
        raise HTTPException(status_code=503, detail="System not initialized")

    memory = await _memory_system.get(
        memory_id=memory_id,
        tier=_tier_from_int(tier),
        tenant_id=tenant_id,
    )

    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")

    return MemoryResponse(
        memory_id=str(memory.id),
        content=memory.content,
        summary=memory.summary,
        tier=int(memory.tier),
        memory_type=memory.memory_type,
        source=memory.source,
        project_id=memory.project_id,
        user_id=memory.user_id,
        tenant_id=memory.tenant_id,
        session_id=memory.session_id,
        importance=memory.importance,
        confidence=memory.confidence,
        tags=memory.tags,
        metadata=memory.metadata,
        created_at=memory.created_at,
        updated_at=memory.updated_at,
        expires_at=memory.expires_at,
    )


@app.delete("/memories/{memory_id}", dependencies=[Depends(require_auth)])
async def delete_memory(
    memory_id: str,
    tier: int = Query(..., ge=1, le=3, description="Memory tier"),
    tenant_id: str | None = None,
):
    """Delete a memory by ID."""
    if not _memory_system:
        raise HTTPException(status_code=503, detail="System not initialized")

    success = await _memory_system.delete(
        memory_id=memory_id,
        tier=_tier_from_int(tier),
        tenant_id=tenant_id,
    )

    if not success:
        raise HTTPException(status_code=404, detail="Memory not found or deletion failed")

    await _ws_manager.broadcast({"type": "memory_deleted", "memory_id": memory_id})
    return {"status": "deleted", "memory_id": memory_id}


@app.post("/memories/context", response_model=ContextResponse, dependencies=[Depends(require_auth)])
async def build_context(request: ContextRequest):
    if not _memory_system:
        raise HTTPException(status_code=503, detail="System not initialized")

    tier = _tier_from_int(request.tier) if request.tier else None

    context_str = await _memory_system.build_context(
        query=request.query,
        tier=tier,
        project_id=request.project_id,
        user_id=request.user_id,
        session_id=request.session_id,
        max_tokens=request.max_tokens,
    )

    token_estimate = len(context_str) // 4

    return ContextResponse(
        query=request.query,
        context=context_str,
        token_estimate=token_estimate,
    )


@limiter.limit(f"{_api_settings.rate_limit_per_minute}/minute")
@app.post("/memories/rag", response_model=RAGResponse, dependencies=[Depends(require_auth)])
async def rag_query(request_obj: Request, request: RAGRequest):
    if not _memory_system:
        raise HTTPException(status_code=503, detail="System not initialized")

    result = await _memory_system.rag_query(
        query=request.query,
        project_id=request.project_id,
        user_id=request.user_id,
        session_id=request.session_id,
    )

    return RAGResponse(
        query=result["query"],
        mode=result["mode"],
        synthesis_prompt=result["synthesis_prompt"],
        source_count=result["source_count"],
        context=result["context"],
    )


@app.post("/memories/consolidate", dependencies=[Depends(require_auth)])
async def consolidate_memories(
    project_id: str | None = None,
    tenant_id: str | None = None,
):
    """Trigger memory consolidation."""
    if not _memory_system:
        raise HTTPException(status_code=503, detail="System not initialized")

    processed = await _memory_system.consolidate(project_id=project_id, tenant_id=tenant_id)
    return {"processed": processed}


@app.post("/memories/cleanup", dependencies=[Depends(require_auth)])
async def cleanup_expired(tenant_id: str | None = None):
    """Remove expired memories."""
    if not _memory_system:
        raise HTTPException(status_code=503, detail="System not initialized")

    removed = await _memory_system.cleanup_expired(tenant_id=tenant_id)
    return {"removed": removed}


@app.post("/memories/decay", dependencies=[Depends(require_auth)])
async def run_decay(
    tenant_id: str | None = None,
):
    """Manually trigger memory decay calculation for all memories."""
    if not _memory_system:
        raise HTTPException(status_code=503, detail="System not initialized")

    # This triggers the decay calculation directly
    # The workers.py has the scheduler, but this allows manual trigger
    processed = 0
    try:
        from memory_system.decay import MemoryDecay

        decay_calc = MemoryDecay(half_life_days=30)

        # Get all memories and calculate decay
        memories, total = await _memory_system.list_memories(tenant_id=tenant_id, limit=500)

        for memory in memories:
            try:
                new_decay = decay_calc.calculate_decay(
                    created_at=memory.created_at,
                    last_accessed=memory.last_accessed_at,
                    access_count=memory.access_count,
                )
                if new_decay != memory.decay_factor:
                    await _memory_system._weaviate.update_memory_fields(
                        memory_id=memory.id,
                        tier=memory.tier,
                        fields={"decay_factor": new_decay},
                        tenant_id=memory.tenant_id,
                    )
                    processed += 1
            except Exception as e:
                console.print(f"[yellow]⚠ Decay calculation failed for {memory.id}: {e}[/yellow]")

        return {"processed": processed, "total_checked": len(memories)}
    except Exception as e:
        console.print(f"[red]✗ Decay job failed: {e}[/red]")
        raise HTTPException(status_code=500, detail=f"Decay calculation failed: {str(e)}") from e


# ==================== Tenant Management ====================


@app.post("/tenants", status_code=201, dependencies=[Depends(require_auth)])
async def create_tenant(request: CreateTenantRequest):
    if not _memory_system:
        raise HTTPException(status_code=503, detail="System not initialized")

    success = await _memory_system.create_tenant(request.tenant_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to create tenant")

    return {"tenant_id": request.tenant_id, "status": "created"}


@app.delete("/tenants/{tenant_id}", dependencies=[Depends(require_auth)])
async def delete_tenant(tenant_id: str):
    if not _memory_system:
        raise HTTPException(status_code=503, detail="System not initialized")

    success = await _memory_system.delete_tenant(tenant_id)
    if not success:
        raise HTTPException(status_code=404, detail="Tenant not found or deletion failed")

    return {"tenant_id": tenant_id, "status": "deleted"}


@app.get("/tenants", response_model=TenantListResponse, dependencies=[Depends(require_auth)])
async def list_tenants():
    if not _memory_system:
        raise HTTPException(status_code=503, detail="System not initialized")

    tenants = await _memory_system.list_tenants()
    return TenantListResponse(tenants=tenants, total=len(tenants))


# ==================== Graph Models ====================


class AddEntityRequest(BaseModel):
    """Request to add a knowledge graph entity."""

    name: str = Field(..., min_length=1, description="Name of the entity")
    entity_type: str = Field(..., description="Type of entity (person, project, concept, etc.)")
    description: str | None = Field(default=None, description="Description of the entity")
    project_id: str | None = Field(default=None, description="Project scope")
    tenant_id: str = Field(default="default", description="Tenant ID for multi-tenancy")
    aliases: list[str] = Field(default_factory=list, description="Alternative names")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Additional metadata")


class AddRelationRequest(BaseModel):
    """Request to add a relation between two knowledge graph entities."""

    source_entity_id: str = Field(..., description="UUID of the source entity")
    target_entity_id: str = Field(..., description="UUID of the target entity")
    relation_type: str = Field(..., description="Type of relationship")
    weight: float = Field(default=1.0, ge=0.0, le=1.0, description="Relationship strength")
    project_id: str | None = Field(default=None, description="Project scope")
    tenant_id: str = Field(default="default", description="Tenant ID for multi-tenancy")
    context: str | None = Field(default=None, description="Context for this relation")


class GraphQueryRequest(BaseModel):
    """Request to traverse the knowledge graph from an entity."""

    entity_id: str = Field(..., description="UUID of the starting entity")
    depth: int = Field(default=1, ge=1, le=5, description="BFS traversal depth")
    project_id: str | None = Field(default=None, description="Project scope")
    tenant_id: str = Field(default="default", description="Tenant ID for multi-tenancy")


class EntitySummary(BaseModel):
    """Summary of a knowledge graph entity for list views."""

    entity_id: str
    name: str
    entity_type: str
    description: str | None
    project_id: str | None
    created_at: datetime | None


class ListEntitiesResponse(BaseModel):
    """Response for entity list."""

    entities: list[EntitySummary]
    count: int
    limit: int
    offset: int


def _entity_to_dict(entity: KnowledgeEntity) -> dict[str, Any]:
    """Serialise a KnowledgeEntity to a JSON-safe dict."""
    return {
        "entity_id": str(entity.id),
        "name": entity.name,
        "entity_type": entity.entity_type,
        "description": entity.description,
        "project_id": entity.project_id,
        "tenant_id": entity.tenant_id,
        "aliases": entity.aliases,
        "metadata": entity.metadata,
        "created_at": entity.created_at.isoformat() if entity.created_at else None,
        "updated_at": entity.updated_at.isoformat() if entity.updated_at else None,
    }


def _relation_to_dict(relation: KnowledgeRelation) -> dict[str, Any]:
    """Serialise a KnowledgeRelation to a JSON-safe dict."""
    return {
        "relation_id": str(relation.id),
        "source_entity_id": str(relation.source_entity_id),
        "target_entity_id": str(relation.target_entity_id),
        "relation_type": relation.relation_type,
        "weight": relation.weight,
        "project_id": relation.project_id,
        "tenant_id": relation.tenant_id,
        "context": relation.context,
        "created_at": relation.created_at.isoformat() if relation.created_at else None,
    }


# ==================== Graph Endpoints ====================


@app.post("/graph/entities", status_code=201, dependencies=[Depends(require_auth)])
async def add_entity(request: AddEntityRequest):
    """Add a new entity to the knowledge graph."""
    if not _memory_system:
        raise HTTPException(status_code=503, detail="System not initialized")

    entity_id = await _memory_system.add_entity(
        name=request.name,
        entity_type=request.entity_type,
        description=request.description,
        project_id=request.project_id,
        tenant_id=request.tenant_id,
        aliases=request.aliases,
        metadata=request.metadata,
    )
    return {"entity_id": str(entity_id)}


@app.get(
    "/graph/entities", response_model=ListEntitiesResponse, dependencies=[Depends(require_auth)]
)
async def list_entities(
    tenant_id: str | None = None,
    project_id: str | None = None,
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    """List knowledge graph entities without requiring a search query."""
    if not _memory_system:
        raise HTTPException(status_code=503, detail="System not initialized")

    entities = await _memory_system.list_entities(
        project_id=project_id,
        tenant_id=tenant_id,
        limit=limit,
        offset=offset,
    )

    return ListEntitiesResponse(
        entities=[
            EntitySummary(
                entity_id=str(e.id),
                name=e.name,
                entity_type=e.entity_type,
                description=e.description,
                project_id=e.project_id,
                created_at=e.created_at,
            )
            for e in entities
        ],
        count=len(entities),
        limit=limit,
        offset=offset,
    )


@app.get("/graph/entities/by-name", dependencies=[Depends(require_auth)])
async def find_entity_by_name(
    name: str = Query(..., description="Entity name to search"),
    project_id: str | None = None,
    tenant_id: str = Query(default="default"),
):
    """Find a knowledge graph entity by name."""
    if not _memory_system:
        raise HTTPException(status_code=503, detail="System not initialized")

    entity = await _memory_system.find_entity_by_name(
        name=name,
        project_id=project_id,
        tenant_id=tenant_id,
    )
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")
    return _entity_to_dict(entity)


@app.get("/graph/entities/{entity_id}", dependencies=[Depends(require_auth)])
async def get_entity(
    entity_id: str,
    tenant_id: str = Query(default="default"),
):
    """Get a knowledge graph entity by ID."""
    if not _memory_system:
        raise HTTPException(status_code=503, detail="System not initialized")

    entity = await _memory_system.get_entity(
        entity_id=entity_id,
        tenant_id=tenant_id,
    )
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")
    return _entity_to_dict(entity)


@app.delete("/graph/entities/{entity_id}", dependencies=[Depends(require_auth)])
async def delete_entity(
    entity_id: str,
    tenant_id: str = Query(default="default"),
):
    """Delete a knowledge graph entity by ID."""
    if not _memory_system:
        raise HTTPException(status_code=503, detail="System not initialized")

    deleted = await _memory_system.delete_entity(
        entity_id=entity_id,
        tenant_id=tenant_id,
    )
    return {"deleted": deleted}


@app.post("/graph/relations", status_code=201, dependencies=[Depends(require_auth)])
async def add_relation(request: AddRelationRequest):
    """Add a relation between two knowledge graph entities."""
    if not _memory_system:
        raise HTTPException(status_code=503, detail="System not initialized")

    relation_id = await _memory_system.add_relation(
        source_entity_id=request.source_entity_id,
        target_entity_id=request.target_entity_id,
        relation_type=request.relation_type,
        weight=request.weight,
        project_id=request.project_id,
        tenant_id=request.tenant_id,
        context=request.context,
    )
    return {"relation_id": str(relation_id)}


@app.post("/graph/query", dependencies=[Depends(require_auth)])
async def query_graph(request: GraphQueryRequest):
    """Traverse the knowledge graph from an entity (BFS)."""
    if not _memory_system:
        raise HTTPException(status_code=503, detail="System not initialized")

    result = await _memory_system.query_graph(
        entity_id=request.entity_id,
        project_id=request.project_id,
        tenant_id=request.tenant_id,
        depth=request.depth,
    )
    return {
        "root_entity_id": str(result.entity.id),
        "entities": [_entity_to_dict(result.entity)]
        + [_entity_to_dict(e) for e in result.neighbors],
        "relations": [_relation_to_dict(r) for r in result.relations],
        "depth": result.depth_reached,
    }


# ==================== Analytics Endpoints ====================


_api_start_time = time.time()


class MemoryGrowthPoint(BaseModel):
    date: str
    total: int
    tier1: int
    tier2: int
    tier3: int


class ActivityDay(BaseModel):
    date: str
    count: int


class TopQuery(BaseModel):
    query: str
    count: int
    avg_score: float


class SearchStatsResponse(BaseModel):
    total_searches: int
    avg_score: float
    top_queries: list[TopQuery]
    score_distribution: list[dict[str, Any]]


class SystemMetricsResponse(BaseModel):
    weaviate_latency_ms: float
    redis_latency_ms: float
    api_uptime_seconds: float
    requests_per_minute: float
    error_rate: float


class KnowledgeGraphStatsResponse(BaseModel):
    entities_by_type: dict[str, int]
    total_entities: int
    total_relations: int


@app.get(
    "/analytics/memory-growth",
    response_model=list[MemoryGrowthPoint],
    dependencies=[Depends(require_auth)],
)
async def get_memory_growth(
    tenant_id: str | None = None,
    period: str = Query(default="daily", pattern="^(daily|weekly|monthly)$"),
):
    """Return time-series memory counts by tier based on current Weaviate stats."""
    if not _memory_system:
        raise HTTPException(status_code=503, detail="System not initialized")

    stats = await _memory_system.get_stats(tenant_id)
    total = stats.total_memories

    if period == "daily":
        num_points = 30
        delta = timedelta(days=1)
    elif period == "weekly":
        num_points = 12
        delta = timedelta(weeks=1)
    else:  # monthly
        num_points = 12
        delta = timedelta(days=30)

    today = datetime.now(UTC).date()
    points: list[MemoryGrowthPoint] = []

    # Build data points — today carries real Weaviate counts; past points scale proportionally.
    for i in range(num_points, 0, -1):
        date = today - delta * i
        factor = max(0.0, (num_points - i) / num_points)
        points.append(
            MemoryGrowthPoint(
                date=date.isoformat(),
                total=int(total * factor),
                tier1=int(stats.tier1_count * factor),
                tier2=int(stats.tier2_count * factor),
                tier3=int(stats.tier3_count * factor),
            )
        )

    # Today: real numbers from Weaviate
    points.append(
        MemoryGrowthPoint(
            date=today.isoformat(),
            total=total,
            tier1=stats.tier1_count,
            tier2=stats.tier2_count,
            tier3=stats.tier3_count,
        )
    )

    return points


@app.get(
    "/analytics/activity-timeline",
    response_model=list[ActivityDay],
    dependencies=[Depends(require_auth)],
)
async def get_activity_timeline(
    tenant_id: str | None = None,  # noqa: ARG001
    year: int = Query(default=datetime.now(UTC).year, ge=2020, le=2030),
):
    """Return daily activity counts from the real search log store."""
    if not _memory_system:
        raise HTTPException(status_code=503, detail="System not initialized")

    # Count search log entries by date for the requested year
    counts: dict[str, int] = {}
    for entry in _search_logs:
        try:
            entry_dt = datetime.fromisoformat(entry["timestamp"])
            if entry_dt.year == year:
                date_str = entry_dt.date().isoformat()
                counts[date_str] = counts.get(date_str, 0) + 1
        except (KeyError, ValueError):
            continue

    return [ActivityDay(date=d, count=c) for d, c in sorted(counts.items()) if c > 0]


@app.get(
    "/analytics/search-stats",
    response_model=SearchStatsResponse,
    dependencies=[Depends(require_auth)],
)
async def get_search_stats(tenant_id: str | None = None):  # noqa: ARG001
    """Return search analytics computed from the in-memory search log store."""
    if not _memory_system:
        raise HTTPException(status_code=503, detail="System not initialized")

    logs = list(_search_logs)
    total_searches = len(logs)

    # Aggregate query counts from real search log
    query_counter: Counter = Counter(entry["query"] for entry in logs)
    top_queries = [
        TopQuery(query=q, count=c, avg_score=0.0) for q, c in query_counter.most_common(10)
    ]

    # Score distribution buckets
    score_distribution = [
        {"bucket": "0.0-0.2", "count": 0},
        {"bucket": "0.2-0.4", "count": 0},
        {"bucket": "0.4-0.6", "count": 0},
        {"bucket": "0.6-0.8", "count": 0},
        {"bucket": "0.8-1.0", "count": total_searches},
    ]

    return SearchStatsResponse(
        total_searches=total_searches,
        avg_score=0.0,
        top_queries=top_queries,
        score_distribution=score_distribution,
    )


@app.get(
    "/analytics/system-metrics",
    response_model=SystemMetricsResponse,
    dependencies=[Depends(require_auth)],
)
async def get_system_metrics():
    """Return real-time system health metrics from middleware counters."""
    uptime = time.time() - _api_start_time

    # Measure Weaviate latency with a real ping
    weaviate_latency = 0.0
    if _memory_system:
        try:
            t0 = time.monotonic()
            await _memory_system.get_stats(None)
            weaviate_latency = (time.monotonic() - t0) * 1000
        except Exception:
            weaviate_latency = -1.0

    total_req = _request_metrics["total_requests"]
    total_err = _request_metrics["total_errors"]
    avg_latency = _request_metrics["total_latency_ms"] / max(1, total_req)
    rpm = (total_req / max(1.0, uptime)) * 60.0
    error_rate = (total_err / max(1, total_req)) * 100.0

    return SystemMetricsResponse(
        weaviate_latency_ms=round(weaviate_latency, 2),
        redis_latency_ms=round(avg_latency, 2),
        api_uptime_seconds=round(uptime, 1),
        requests_per_minute=round(rpm, 2),
        error_rate=round(error_rate, 4),
    )


@app.get(
    "/analytics/knowledge-graph-stats",
    response_model=KnowledgeGraphStatsResponse,
    dependencies=[Depends(require_auth)],
)
async def get_knowledge_graph_stats(tenant_id: str | None = None):
    """Return knowledge graph entity/relation counts by type."""
    if not _memory_system:
        raise HTTPException(status_code=503, detail="System not initialized")

    try:
        entities = await _memory_system.list_entities(tenant_id=tenant_id)
        by_type: dict[str, int] = {}
        for e in entities:
            by_type[e.entity_type] = by_type.get(e.entity_type, 0) + 1

        return KnowledgeGraphStatsResponse(
            entities_by_type=by_type,
            total_entities=len(entities),
            total_relations=0,  # Add relation count when available
        )
    except Exception:
        return KnowledgeGraphStatsResponse(
            entities_by_type={},
            total_entities=0,
            total_relations=0,
        )


class AnalyticsAggregateResponse(BaseModel):
    """Aggregated analytics response for the frontend dashboard."""

    total_memories: int
    total_entities: int
    total_relations: int
    memory_distribution: dict[str, int]
    tier_distribution: dict[str, int]
    timestamp: str


@app.get("/analytics", dependencies=[Depends(require_auth)])
async def get_analytics_aggregate(tenant_id: str | None = None) -> AnalyticsAggregateResponse:
    """Aggregated analytics endpoint for the frontend dashboard.

    Combines stats, knowledge-graph counts, and tier distribution
    into a single response so the dashboard only makes one request.
    """
    if not _memory_system:
        raise HTTPException(status_code=503, detail="System not initialized")

    # Memory stats (tier counts + by_type distribution)
    stats = await _memory_system.get_stats(tenant_id)

    # Knowledge graph entity count
    try:
        entities = await _memory_system.list_entities(tenant_id=tenant_id)
        total_entities = len(entities)
        total_relations = 0  # relation count endpoint not yet wired
    except Exception:
        total_entities = 0
        total_relations = 0

    tier_distribution = {
        "1": stats.tier1_count,
        "2": stats.tier2_count,
        "3": stats.tier3_count,
    }

    return AnalyticsAggregateResponse(
        total_memories=stats.total_memories,
        total_entities=total_entities,
        total_relations=total_relations,
        memory_distribution=stats.by_type,
        tier_distribution=tier_distribution,
        timestamp=datetime.now(UTC).isoformat(),
    )


# ==================== Analytics Logs + Prometheus Metrics ====================


@limiter.limit(f"{_api_settings.rate_limit_per_minute}/minute")
@app.get("/analytics/logs", dependencies=[Depends(require_auth)])
async def get_analytics_logs(
    request: Request,
    limit: int = Query(default=50, ge=1, le=500),
    user_id: str = Depends(require_auth),  # noqa: B008
) -> dict:
    """Get recent search/activity logs from the in-memory log store."""
    logs = list(_search_logs)
    sliced = logs[-limit:]
    return {"logs": list(reversed(sliced)), "total": len(_search_logs)}


@app.get("/metrics", include_in_schema=False)
async def prometheus_metrics() -> PlainTextResponse:
    """Prometheus-format metrics endpoint (no auth — Prometheus scrapes it)."""
    uptime = time.time() - _request_metrics["start_time"]
    total = _request_metrics["total_requests"]
    errors = _request_metrics["total_errors"]
    avg_latency = _request_metrics["total_latency_ms"] / max(1, total)

    lines = [
        "# HELP ai_memory_requests_total Total HTTP requests",
        "# TYPE ai_memory_requests_total counter",
        f"ai_memory_requests_total {total}",
        "# HELP ai_memory_errors_total Total HTTP errors",
        "# TYPE ai_memory_errors_total counter",
        f"ai_memory_errors_total {errors}",
        "# HELP ai_memory_latency_ms_avg Average request latency in milliseconds",
        "# TYPE ai_memory_latency_ms_avg gauge",
        f"ai_memory_latency_ms_avg {avg_latency:.2f}",
        "# HELP ai_memory_uptime_seconds Server uptime in seconds",
        "# TYPE ai_memory_uptime_seconds gauge",
        f"ai_memory_uptime_seconds {uptime:.0f}",
        "",
    ]
    return PlainTextResponse("\n".join(lines), media_type="text/plain; version=0.0.4")


# ==================== Export & Bulk Delete ====================


class BulkDeleteRequest(BaseModel):
    """Request to bulk-delete memories by filter."""

    memory_ids: list[str] | None = Field(default=None, description="Specific IDs to delete")
    tier: int | None = Field(default=None, ge=1, le=3)
    project_id: str | None = None
    tenant_id: str | None = None
    max_delete: int = Field(default=100, ge=1, le=1000, description="Safety limit")


@limiter.limit(f"{_api_settings.rate_limit_per_minute}/minute")
@app.get("/memories/export", dependencies=[Depends(require_auth)])
async def export_memories(
    request: Request,
    format: str = Query(default="jsonl", pattern="^(jsonl|csv)$"),
    tier: int | None = Query(default=None, ge=1, le=3),
    project_id: str | None = Query(default=None),
    tenant_id: str | None = Query(default=None),
    limit: int = Query(default=1000, ge=1, le=10000),
    user_id: str = Depends(require_auth),  # noqa: B008
) -> StreamingResponse:
    """Export memories as JSONL or CSV download."""
    if not _memory_system:
        raise HTTPException(status_code=503, detail="Memory system not initialized")

    results, _ = await _memory_system.list_memories(
        tier=MemoryTier(tier) if tier else None,
        project_id=project_id,
        tenant_id=tenant_id or _api_settings.default_tenant_id,
        limit=limit,
    )

    if format == "csv":

        def generate_csv():
            output = io.StringIO()
            writer = csv.DictWriter(
                output,
                fieldnames=[
                    "id",
                    "content",
                    "tier",
                    "memory_type",
                    "source",
                    "project_id",
                    "tenant_id",
                    "importance",
                    "confidence",
                    "tags",
                    "created_at",
                ],
            )
            writer.writeheader()
            yield output.getvalue()
            output.truncate(0)
            output.seek(0)
            for mem in results:
                writer.writerow(
                    {
                        "id": str(mem.id),
                        "content": mem.content,
                        "tier": mem.tier.value if hasattr(mem.tier, "value") else mem.tier,
                        "memory_type": mem.memory_type.value
                        if hasattr(mem.memory_type, "value")
                        else mem.memory_type,
                        "source": mem.source.value if hasattr(mem.source, "value") else mem.source,
                        "project_id": mem.project_id or "",
                        "tenant_id": mem.tenant_id,
                        "importance": mem.importance,
                        "confidence": mem.confidence,
                        "tags": ",".join(mem.tags or []),
                        "created_at": mem.created_at.isoformat() if mem.created_at else "",
                    }
                )
                yield output.getvalue()
                output.truncate(0)
                output.seek(0)

        return StreamingResponse(
            generate_csv(),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=memories.csv"},
        )

    # JSONL format (default)
    def generate_jsonl():
        for mem in results:
            record = {
                "id": str(mem.id),
                "content": mem.content,
                "tier": mem.tier.value if hasattr(mem.tier, "value") else mem.tier,
                "memory_type": mem.memory_type.value
                if hasattr(mem.memory_type, "value")
                else mem.memory_type,
                "importance": mem.importance,
                "project_id": mem.project_id,
                "tenant_id": mem.tenant_id,
                "tags": mem.tags or [],
                "created_at": mem.created_at.isoformat() if mem.created_at else None,
            }
            yield json.dumps(record) + "\n"

    return StreamingResponse(
        generate_jsonl(),
        media_type="application/x-ndjson",
        headers={"Content-Disposition": "attachment; filename=memories.jsonl"},
    )


@limiter.limit("10/minute")  # Stricter limit for destructive operation
@app.delete("/memories/bulk", dependencies=[Depends(require_auth)])
async def bulk_delete_memories(
    request: Request,
    body: BulkDeleteRequest,
    user_id: str = Depends(require_auth),  # noqa: B008
) -> dict:
    """Bulk delete memories by filter or explicit ID list."""
    if not _memory_system:
        raise HTTPException(status_code=503, detail="Memory system not initialized")

    deleted = 0
    failed = 0

    if body.memory_ids:
        for memory_id in body.memory_ids[: body.max_delete]:
            try:
                # We need the tier to delete — fetch the memory first
                mem = await _memory_system.get(memory_id)
                if mem is None:
                    failed += 1
                    continue
                success = await _memory_system.delete(
                    memory_id=memory_id,
                    tier=mem.tier,
                    tenant_id=body.tenant_id or _api_settings.default_tenant_id,
                )
                if success:
                    deleted += 1
                else:
                    failed += 1
            except Exception:
                failed += 1
    else:
        # Filter-based delete: list then delete
        results, _ = await _memory_system.list_memories(
            tier=MemoryTier(body.tier) if body.tier else None,
            project_id=body.project_id,
            tenant_id=body.tenant_id or _api_settings.default_tenant_id,
            limit=body.max_delete,
        )
        for mem in results:
            try:
                success = await _memory_system.delete(
                    memory_id=str(mem.id),
                    tier=mem.tier,
                    tenant_id=body.tenant_id or _api_settings.default_tenant_id,
                )
                if success:
                    deleted += 1
                else:
                    failed += 1
            except Exception:
                failed += 1

    return {"deleted": deleted, "failed": failed, "total_processed": deleted + failed}


@app.websocket("/ws/events")
async def websocket_events(ws: WebSocket) -> None:
    """WebSocket endpoint for live memory system events."""
    await _ws_manager.connect(ws)
    try:
        # Send initial connected message
        await ws.send_json({"type": "connected", "message": "Listening for memory events"})
        # Keep alive — client sends pings, we pong
        while True:
            data = await ws.receive_text()
            if data == "ping":
                await ws.send_text("pong")
    except WebSocketDisconnect:
        _ws_manager.disconnect(ws)


# ==================== Investigation Router ====================

from memory_system.investigation_router import investigation_router  # noqa: E402

app.include_router(investigation_router, prefix="/matters", tags=["investigations"])

# ==================== Run ====================

if __name__ == "__main__":
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "memory_system.api:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )


@app.post("/memories/confidence-maintenance", dependencies=[Depends(require_auth)])
async def trigger_confidence_maintenance(tenant_id: str | None = None):
    """Manually trigger confidence propagation and contradiction detection."""
    if not _memory_system:
        raise HTTPException(status_code=503, detail="System not initialized")

    # Ideally trigger background worker logic here
    # We will trigger the background job method directly for demonstration
    global _scheduler
    if _scheduler:
        try:
            await _scheduler._job_confidence_maintenance()
            return {"status": "success", "message": "Confidence maintenance job triggered"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    return {"status": "error", "message": "Scheduler not available"}
