"""
FastAPI REST API for the AI Memory System.

App factory with lifespan management, middleware, and exception handlers.
All endpoint logic lives in the routers/ sub-package.
"""

import asyncio
import logging
import time
import traceback
from contextlib import asynccontextmanager, suppress

from fastapi import (
    FastAPI,
    HTTPException,
    Request,
    status,
)
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from rich.console import Console
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from memory_system import MemorySystem
from memory_system.audit import AuditLogger
from memory_system.config import get_settings
from memory_system.key_manager import KeyManager
from memory_system.routers._state import (
    api_start_time,
    request_metrics,
    search_logs,
    ws_manager,
)

console = Console()
logger = logging.getLogger(__name__)
limiter = Limiter(key_func=get_remote_address)

_api_settings = get_settings()


async def _rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={"detail": "Rate limit exceeded. Please slow down."},
    )


class ErrorResponse(BaseModel):
    error: str
    detail: str | None = None
    request_id: str | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _memory_system, _key_manager, _audit_logger, _scheduler

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

    _key_manager = None
    _audit_logger = None
    try:
        redis_client = _memory_system._cache._client
        if redis_client:
            _key_manager = KeyManager(redis_client)
            _audit_logger = AuditLogger(redis_client)
            migrated = await _key_manager.migrate_env_keys()
            if migrated:
                console.print(f"[green]✓ Migrated {migrated} env API key(s) to Redis[/green]")
            bootstrap = await _key_manager.create_bootstrap_key()
            if bootstrap:
                console.print(f"[yellow]⚠ Bootstrap API key created: {bootstrap['key']}[/yellow]")
                console.print("[yellow]  Save this key — it will not be shown again.[/yellow]")
            console.print("[green]✓ Key manager & audit logger ready[/green]")
    except Exception as e:
        console.print(f"[yellow]⚠ Key manager not started: {e}[/yellow]")

    _scheduler = None
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

    # Populate shared state for routers
    from memory_system.routers import _state

    _state.memory_system = _memory_system
    _state.scheduler = _scheduler
    _state.key_manager = _key_manager
    _state.audit_logger = _audit_logger
    _state.search_logs = search_logs
    _state.request_metrics = request_metrics
    _state.api_start_time = api_start_time
    _state.ws_manager = ws_manager
    _state.console = console

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
    allow_methods=["GET", "POST", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-API-Key", "X-Request-ID"],
)

_metrics_lock = asyncio.Lock()


@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    start = time.monotonic()
    response = await call_next(request)
    latency_ms = (time.monotonic() - start) * 1000

    async with _metrics_lock:
        request_metrics["total_requests"] += 1
        request_metrics["total_latency_ms"] += latency_ms
        if response.status_code >= 400:
            request_metrics["total_errors"] += 1
        path = request.url.path
        if path not in request_metrics["requests_by_path"]:
            request_metrics["requests_by_path"][path] = {"count": 0, "errors": 0}
        request_metrics["requests_by_path"][path]["count"] += 1
        if response.status_code >= 400:
            request_metrics["requests_by_path"][path]["errors"] += 1

    from memory_system.routers import _state as _st

    if _st.audit_logger and path not in (
        "/health",
        "/metrics",
        "/openapi.json",
        "/docs",
        "/redoc",
    ):
        identity = ""
        key_id = ""
        key_name = ""
        api_key_header = request.headers.get("x-api-key", "")
        auth_header = request.headers.get("authorization", "")
        if api_key_header:
            identity = f"apikey:{api_key_header[:4]}..."
        elif auth_header:
            identity = "jwt"
        try:
            await _st.audit_logger.log(
                key_id=key_id,
                key_name=key_name,
                identity=identity,
                method=request.method,
                path=path,
                status_code=response.status_code,
                ip=request.client.host if request.client else "",
                latency_ms=latency_ms,
            )
        except Exception:
            pass

    return response


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(
            error=exc.__class__.__name__,
            detail=exc.detail,
        ).model_dump(),
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    console.print(f"[red]Unhandled error: {exc}[/red]")
    return JSONResponse(
        status_code=500,
        content=ErrorResponse(
            error="InternalServerError",
            detail="An unexpected error occurred. Please try again later.",
        ).model_dump(),
    )


# Include routers
from memory_system.routers import (
    admin_router,
    analytics_router,
    auth_router,
    graph_router,
    health_router,
    memories_router,
    tenants_router,
)

app.include_router(health_router)
app.include_router(auth_router)
app.include_router(memories_router)
app.include_router(tenants_router)
app.include_router(graph_router)
app.include_router(analytics_router)
app.include_router(admin_router)

from memory_system.investigation_router import investigation_router

app.include_router(investigation_router, prefix="/matters", tags=["investigations"])

from memory_system.routers.memories import (
    AddMemoryRequest,
    BatchAddRequest,
    BatchAddResponse,
    ContextRequest,
    ContextResponse,
    ListMemoriesRequest,
    ListMemoriesResponse,
    RAGRequest,
    RAGResponse,
    SearchRequest,
    SearchResult,
    _source_from_str,
    _tier_from_int,
    _type_from_str,
)
from memory_system.routers.health import HealthResponse
from memory_system.routers.auth import LoginRequest, LoginResponse
from memory_system.routers.tenants import CreateTenantRequest, TenantListResponse
from memory_system.routers.graph import (
    AddEntityRequest,
    AddRelationRequest,
    GraphQueryRequest,
    ListEntitiesResponse,
)

__all__ = [
    "AddEntityRequest",
    "AddMemoryRequest",
    "AddRelationRequest",
    "BatchAddRequest",
    "BatchAddResponse",
    "ContextRequest",
    "ContextResponse",
    "CreateTenantRequest",
    "ErrorResponse",
    "GraphQueryRequest",
    "HealthResponse",
    "ListEntitiesResponse",
    "ListMemoriesRequest",
    "ListMemoriesResponse",
    "LoginRequest",
    "LoginResponse",
    "RAGRequest",
    "RAGResponse",
    "SearchRequest",
    "SearchResult",
    "TenantListResponse",
    "_source_from_str",
    "_tier_from_int",
    "_type_from_str",
    "app",
]

if __name__ == "__main__":
    import os

    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "memory_system.api:app",
        host=os.environ.get("HOST", "127.0.0.1"),
        port=int(os.environ.get("PORT", "8000")),
        reload=True,
    )
