from memory_system.routers.health import health_router
from memory_system.routers.auth import auth_router
from memory_system.routers.memories import memories_router
from memory_system.routers.tenants import tenants_router
from memory_system.routers.graph import graph_router
from memory_system.routers.analytics import analytics_router
from memory_system.routers.admin import admin_router

__all__ = [
    "health_router",
    "auth_router",
    "memories_router",
    "tenants_router",
    "graph_router",
    "analytics_router",
    "admin_router",
]
