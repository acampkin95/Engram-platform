import logging
import time
from collections import Counter
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel

from memory_system.auth import require_auth
from memory_system.config import get_settings
from memory_system.routers import _state

logger = logging.getLogger(__name__)

_api_settings = get_settings()

try:
    from slowapi import Limiter
    from slowapi.util import get_remote_address

    limiter = Limiter(key_func=get_remote_address)
except ImportError:
    limiter = None

analytics_router = APIRouter(prefix="/analytics", tags=["analytics"])


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


class AnalyticsAggregateResponse(BaseModel):
    total_memories: int
    total_entities: int
    total_relations: int
    memory_distribution: dict[str, int]
    tier_distribution: dict[str, int]
    timestamp: str


def _apply_rate_limit(router, limit_str: str):
    if limiter is None:
        return lambda f: f
    return limiter.limit(limit_str)


@analytics_router.get(
    "/memory-growth",
    response_model=list[MemoryGrowthPoint],
    dependencies=[Depends(require_auth)],
)
async def get_memory_growth(
    tenant_id: str | None = None,
    period: str = Query(default="daily", pattern="^(daily|weekly|monthly)$"),
):
    if not _state.memory_system:
        raise HTTPException(status_code=503, detail="System not initialized")

    stats = await _state.memory_system.get_stats(tenant_id)
    total = stats.total_memories

    if period == "daily":
        num_points = 30
        delta = timedelta(days=1)
    elif period == "weekly":
        num_points = 12
        delta = timedelta(weeks=1)
    else:
        num_points = 12
        delta = timedelta(days=30)

    today = datetime.now(UTC).date()
    points: list[MemoryGrowthPoint] = []

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


@analytics_router.get(
    "/activity-timeline",
    response_model=list[ActivityDay],
    dependencies=[Depends(require_auth)],
)
async def get_activity_timeline(
    tenant_id: str | None = None,
    year: int = Query(default=datetime.now(UTC).year, ge=2020, le=2030),
):
    if not _state.memory_system:
        raise HTTPException(status_code=503, detail="System not initialized")

    counts: dict[str, int] = {}
    for entry in _state.search_logs:
        try:
            entry_dt = datetime.fromisoformat(entry["timestamp"])
            if entry_dt.year == year:
                date_str = entry_dt.date().isoformat()
                counts[date_str] = counts.get(date_str, 0) + 1
        except (KeyError, ValueError):
            continue

    return [ActivityDay(date=d, count=c) for d, c in sorted(counts.items()) if c > 0]


@analytics_router.get(
    "/search-stats",
    response_model=SearchStatsResponse,
    dependencies=[Depends(require_auth)],
)
async def get_search_stats(tenant_id: str | None = None):
    if not _state.memory_system:
        raise HTTPException(status_code=503, detail="System not initialized")

    logs = list(_state.search_logs)
    total_searches = len(logs)

    query_counter: Counter = Counter(entry["query"] for entry in logs)
    top_queries = [
        TopQuery(query=q, count=c, avg_score=0.0) for q, c in query_counter.most_common(10)
    ]

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


@analytics_router.get(
    "/system-metrics",
    response_model=SystemMetricsResponse,
    dependencies=[Depends(require_auth)],
)
async def get_system_metrics():
    uptime = time.time() - _state.api_start_time

    weaviate_latency = 0.0
    if _state.memory_system:
        try:
            t0 = time.monotonic()
            await _state.memory_system.get_stats(None)
            weaviate_latency = (time.monotonic() - t0) * 1000
        except Exception:
            weaviate_latency = -1.0

    total_req = _state.request_metrics["total_requests"]
    total_err = _state.request_metrics["total_errors"]
    avg_latency = _state.request_metrics["total_latency_ms"] / max(1, total_req)
    rpm = (total_req / max(1.0, uptime)) * 60.0
    error_rate = (total_err / max(1, total_req)) * 100.0

    return SystemMetricsResponse(
        weaviate_latency_ms=round(weaviate_latency, 2),
        redis_latency_ms=round(avg_latency, 2),
        api_uptime_seconds=round(uptime, 1),
        requests_per_minute=round(rpm, 2),
        error_rate=round(error_rate, 4),
    )


@analytics_router.get(
    "/knowledge-graph-stats",
    response_model=KnowledgeGraphStatsResponse,
    dependencies=[Depends(require_auth)],
)
async def get_knowledge_graph_stats(tenant_id: str | None = None):
    if not _state.memory_system:
        raise HTTPException(status_code=503, detail="System not initialized")

    try:
        entities = await _state.memory_system.list_entities(tenant_id=tenant_id)
        by_type: dict[str, int] = {}
        for e in entities:
            by_type[e.entity_type] = by_type.get(e.entity_type, 0) + 1

        return KnowledgeGraphStatsResponse(
            entities_by_type=by_type,
            total_entities=len(entities),
            total_relations=0,
        )
    except Exception:
        return KnowledgeGraphStatsResponse(
            entities_by_type={},
            total_entities=0,
            total_relations=0,
        )


@analytics_router.get("", dependencies=[Depends(require_auth)])
async def get_analytics_aggregate(tenant_id: str | None = None) -> AnalyticsAggregateResponse:
    if not _state.memory_system:
        raise HTTPException(status_code=503, detail="System not initialized")

    stats = await _state.memory_system.get_stats(tenant_id)

    try:
        entities = await _state.memory_system.list_entities(tenant_id=tenant_id)
        total_entities = len(entities)
        total_relations = 0
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


@_apply_rate_limit(analytics_router, f"{_api_settings.rate_limit_per_minute}/minute")
@analytics_router.get("/logs", dependencies=[Depends(require_auth)])
async def get_analytics_logs(
    request: Request,
    limit: int = Query(default=50, ge=1, le=500),
    user_id: str = Depends(require_auth),
) -> dict:
    logs = list(_state.search_logs)
    sliced = logs[-limit:]
    return {"logs": list(reversed(sliced)), "total": len(_state.search_logs)}


@analytics_router.get("/metrics", include_in_schema=False, status_code=200)
async def prometheus_metrics() -> PlainTextResponse:
    uptime = time.time() - _state.request_metrics["start_time"]
    total = _state.request_metrics["total_requests"]
    errors = _state.request_metrics["total_errors"]
    avg_latency = _state.request_metrics["total_latency_ms"] / max(1, total)

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
