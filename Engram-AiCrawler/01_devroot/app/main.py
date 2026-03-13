import asyncio
import os
import logging
import time
import uuid
from contextlib import asynccontextmanager
from fastapi import (
    FastAPI,
    Response,
    WebSocket,
    WebSocketDisconnect,
    HTTPException,
    status,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.requests import Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.encoders import jsonable_encoder

from app.api import crawl, chat, data, storage, knowledge_graph, investigations, cases
from app.api import stats, settings, scheduler, extraction, rag, performance, darkweb
from app.api.osint import (
    alias_router,
    image_basic_router,
    scan_router,
    threat_intel_router,
    deep_crawl_router,
    image_intel_router,
    fraud_router,
)
from app.websocket.manager import manager
from app.middleware.rate_limit import check_rate_limit, get_rate_limiter, RateLimitExceeded
from app.core.security import SecurityHeadersMiddleware
from app.middleware.sanitize import InputSanitizationMiddleware
from app.services.cache import close_cache
from app.services.redis_pool import close_redis_pool
from app.services.scheduler_service import start_scheduler, shutdown_scheduler

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Crawl4AI OSINT API...")
    limiter = get_rate_limiter()
    await limiter.initialize()
    start_scheduler()

    # Load and register addons (Engram, darkweb-osint, etc.)
    try:
        from pathlib import Path
        from addons.addon_loader import AddonLoader

        addons_dir = Path(__file__).parent.parent / "addons"
        addon_loader = AddonLoader(addons_dir)
        addon_loader.scan()
        results = addon_loader.register_all(app)
        for name, ok in results.items():
            if ok:
                logger.info("Addon registered: %s", name)
            else:
                logger.warning("Addon failed to register: %s", name)
    except Exception as exc:
        logger.warning("Addon loader failed (non-fatal): %s", exc)

    yield
    logger.info("Shutting down Crawl4AI OSINT API...")
    shutdown_scheduler()
    await close_cache()
    await limiter.close()
    await close_redis_pool()
    # Close shared OSINT HTTP session
    from app.config.osint_providers import close_http_session

    await close_http_session()


app = FastAPI(
    title="Crawl4AI OSINT",
    description="OSINT-focused web crawling and data analysis platform",
    version=os.getenv("APP_VERSION", "0.2.0"),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000,http://localhost:5173,http://host.docker.internal:3000",
    ).split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(InputSanitizationMiddleware)
app.add_middleware(GZipMiddleware, minimum_size=1000)


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    allowed, rate_limit_exc = await check_rate_limit(request)

    if not allowed and rate_limit_exc:
        logger.warning(f"Rate limit exceeded for {request.url.path}: {rate_limit_exc.detail}")
        raise rate_limit_exc

    return await call_next(request)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()

    logger.info(f"Incoming request: {request.method} {request.url.path}")

    try:
        response = await call_next(request)
        process_time = time.time() - start_time

        logger.info(
            f"Request completed: {request.method} {request.url.path} "
            f"- Status: {response.status_code} - Time: {process_time:.3f}s"
        )

        response.headers["X-Process-Time"] = str(process_time)
        return response
    except Exception as e:
        process_time = time.time() - start_time
        logger.error(
            f"Request failed: {request.method} {request.url.path} "
            f"- Error: {str(e)} - Time: {process_time:.3f}s"
        )
        raise


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.warning(f"Validation error on {request.url.path}: {exc.errors()}")
    body = exc.body.decode("utf-8", errors="replace") if isinstance(exc.body, bytes) else exc.body
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=jsonable_encoder({"detail": exc.errors(), "body": body}),
    )


@app.exception_handler(RateLimitExceeded)
async def rate_limit_exception_handler(request: Request, exc: RateLimitExceeded):
    logger.warning(f"Rate limit exceeded for {request.url.path}: {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.detail,
            "retry_after": exc.retry_after,
            "limit_type": (exc.headers or {}).get("X-RateLimit-Type"),
        },
        headers=exc.headers,
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    logger.warning(f"HTTP error on {request.url.path}: {exc.status_code} - {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    correlation_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    logger.error(
        f"Unhandled exception on {request.url.path} [cid={correlation_id}]: {str(exc)}",
        exc_info=True,
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "Internal server error",
            "correlation_id": correlation_id,
        },
    )


app.include_router(crawl.router)
app.include_router(chat.router)
app.include_router(data.router)
app.include_router(storage.router)
app.include_router(alias_router)
app.include_router(image_basic_router)
app.include_router(scan_router)
app.include_router(threat_intel_router)
app.include_router(deep_crawl_router)
app.include_router(image_intel_router)
app.include_router(fraud_router)
app.include_router(knowledge_graph.router)
app.include_router(investigations.router)
app.include_router(cases.router)
app.include_router(stats.router)
app.include_router(settings.router)
app.include_router(scheduler.router)
app.include_router(extraction.router)
app.include_router(rag.router)
app.include_router(performance.router)
app.include_router(darkweb.router)


@app.get("/health")
async def health_check():
    # Check Redis connection
    redis_status = "unknown"
    try:
        from app.services.redis_client import get_redis_client

        async with get_redis_client() as redis:
            await redis.ping()
            redis_status = "connected"
    except Exception as e:
        logger.warning(f"Redis health check failed: {e}")
        redis_status = "disconnected"

    # Check ChromaDB
    chromadb_status = "unknown"
    try:
        from app.storage.chromadb_client import get_chromadb_client

        client = get_chromadb_client()
        if client:
            client._client.heartbeat()
            chromadb_status = "connected"
        else:
            chromadb_status = "disconnected"
    except Exception as e:
        logger.warning(f"ChromaDB health check failed: {e}")
        chromadb_status = "disconnected"

    # Check LM Studio (5s timeout — health checks must not block)
    lm_studio_status = "unknown"
    try:
        from app.services.lm_studio_bridge import check_lm_studio_connection

        lm_studio_status = await asyncio.wait_for(check_lm_studio_connection(), timeout=5.0)
    except asyncio.TimeoutError:
        logger.warning("LM Studio health check timed out (5s)")
        lm_studio_status = "disconnected"
    except Exception as e:
        logger.warning(f"LM Studio health check failed: {e}")
        lm_studio_status = "disconnected"

    return {
        "status": "healthy",
        "service": "crawl4ai-osint",
        "version": os.getenv("APP_VERSION", "0.2.0"),
        "websocket_connections": manager.get_connection_count(),
        "redis": redis_status,
        "chromadb": chromadb_status,
        "lm_studio": lm_studio_status,
    }


@app.get("/")
async def root():
    return Response(content="Crawl4AI OSINT Container Running", media_type="text/plain")


@app.get("/stats")
async def get_stats():
    return {
        "active_connections": manager.get_connection_count(),
        "subscriptions": {
            "crawl": manager.get_subscribers_count("crawl:*"),
            "chat": manager.get_subscribers_count("chat:*"),
            "data": manager.get_subscribers_count("data_changes"),
        },
    }


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    client_id = websocket.query_params.get("client_id", f"client_{time.time()}")

    try:
        await manager.connect(websocket, client_id)

        while True:
            data = await websocket.receive_json()

            message_type = data.get("type")
            if message_type == "subscribe":
                topic = data.get("topic")
                if topic:
                    manager.subscribe(client_id, topic)
                    await manager.send_personal_message(
                        {"type": "subscribed", "topic": topic}, client_id
                    )

            elif message_type == "unsubscribe":
                topic = data.get("topic")
                if topic:
                    manager.unsubscribe(client_id, topic)
                    await manager.send_personal_message(
                        {"type": "unsubscribed", "topic": topic}, client_id
                    )

            elif message_type == "ping":
                await manager.send_personal_message({"type": "pong"}, client_id)

    except WebSocketDisconnect:
        manager.disconnect(client_id)
        logger.info(f"WebSocket disconnected: {client_id}")

    except Exception as e:
        logger.error(f"WebSocket error for {client_id}: {str(e)}")
        manager.disconnect(client_id)
