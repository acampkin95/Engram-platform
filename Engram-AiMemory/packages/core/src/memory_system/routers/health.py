import logging

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from memory_system.auth import require_auth
from memory_system.routers import _state

logger = logging.getLogger(__name__)

health_router = APIRouter(prefix="", tags=["health"])


class HealthResponse(BaseModel):
    status: str
    weaviate: bool
    redis: bool
    initialized: bool


class ServiceHealth(BaseModel):
    status: str
    memory_mb: int | None = None
    model: str | None = None
    models_loaded: list[str] = Field(default_factory=list)


class MaintenanceQueueStats(BaseModel):
    pending: int = 0
    running: int = 0
    last_run: dict[str, str] = Field(default_factory=dict)
    scheduler_running: bool = False


class ResourceUsage(BaseModel):
    total_model_ram_mb: int = 0
    budget_mb: int = 3072
    headroom_mb: int = 3072


class DetailedHealthResponse(BaseModel):
    status: str
    services: dict[str, ServiceHealth]
    maintenance_queue: MaintenanceQueueStats
    resource_usage: ResourceUsage


@health_router.get("/health", response_model=HealthResponse, status_code=200)
async def health_check():
    return HealthResponse(
        status="healthy" if (_state.memory_system and _state.memory_system.is_healthy) else "unhealthy",
        weaviate=_state.memory_system._weaviate.is_connected if _state.memory_system else False,
        redis=_state.memory_system._cache.is_connected if _state.memory_system else False,
        initialized=_state.memory_system.is_initialized if _state.memory_system else False,
    )


@health_router.get(
    "/health/detailed",
    response_model=DetailedHealthResponse,
    dependencies=[Depends(require_auth)],
)
async def health_detailed():
    services: dict[str, ServiceHealth] = {}
    total_ram = 0

    weaviate_up = bool(_state.memory_system and _state.memory_system._weaviate.is_connected)
    services["weaviate"] = ServiceHealth(status="up" if weaviate_up else "down", memory_mb=77)

    redis_up = bool(_state.memory_system and _state.memory_system._cache.is_connected)
    services["redis"] = ServiceHealth(status="up" if redis_up else "down", memory_mb=21)

    ollama_client = getattr(_state.memory_system, "_ollama", None) if _state.memory_system else None
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

    nomic_embedder = getattr(_state.memory_system, "_nomic_embedder", None) if _state.memory_system else None
    if nomic_embedder is not None:
        nomic_ram = 350
        total_ram += nomic_ram
        services["embedding_model"] = ServiceHealth(
            status="loaded", memory_mb=nomic_ram, model="nomic-embed-text-v1.5"
        )
    else:
        services["embedding_model"] = ServiceHealth(status="not_loaded")

    bge_reranker = getattr(_state.memory_system, "_bge_reranker", None) if _state.memory_system else None
    if bge_reranker is not None:
        reranker_ram = 280
        total_ram += reranker_ram
        services["reranker"] = ServiceHealth(
            status="loaded", memory_mb=reranker_ram, model="BAAI/bge-reranker-base"
        )
    else:
        services["reranker"] = ServiceHealth(status="not_loaded")

    scheduler_running = bool(_state.scheduler and _state.scheduler.is_running())
    scheduler_stats = _state.scheduler.get_stats() if _state.scheduler else {}
    queue_stats = MaintenanceQueueStats(
        scheduler_running=scheduler_running,
        last_run=scheduler_stats.get("last_run", {}),
    )

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
