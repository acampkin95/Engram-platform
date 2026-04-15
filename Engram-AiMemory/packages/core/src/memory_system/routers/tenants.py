import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from memory_system.auth import require_auth
from memory_system.routers import _state

logger = logging.getLogger(__name__)

tenants_router = APIRouter(prefix="/tenants", tags=["tenants"])


class CreateTenantRequest(BaseModel):
    tenant_id: str = Field(
        ..., min_length=1, max_length=128, description="Unique tenant identifier"
    )


class TenantListResponse(BaseModel):
    tenants: list[str]
    total: int


@tenants_router.post("", status_code=201, dependencies=[Depends(require_auth)])
async def create_tenant(request: CreateTenantRequest):
    if not _state.memory_system:
        raise HTTPException(status_code=503, detail="System not initialized")

    success = await _state.memory_system.create_tenant(request.tenant_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to create tenant")

    return {"tenant_id": request.tenant_id, "status": "created"}


@tenants_router.delete("/{tenant_id}", dependencies=[Depends(require_auth)])
async def delete_tenant(tenant_id: str):
    if not _state.memory_system:
        raise HTTPException(status_code=503, detail="System not initialized")

    success = await _state.memory_system.delete_tenant(tenant_id)
    if not success:
        raise HTTPException(status_code=404, detail="Tenant not found or deletion failed")

    return {"tenant_id": tenant_id, "status": "deleted"}


@tenants_router.get("", response_model=TenantListResponse, dependencies=[Depends(require_auth)])
async def list_tenants():
    if not _state.memory_system:
        raise HTTPException(status_code=503, detail="System not initialized")

    tenants = await _state.memory_system.list_tenants()
    return TenantListResponse(tenants=tenants, total=len(tenants))
