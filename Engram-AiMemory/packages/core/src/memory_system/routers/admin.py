import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from memory_system.auth import require_auth
from memory_system.routers import _state

logger = logging.getLogger(__name__)

admin_router = APIRouter(prefix="/admin", tags=["admin"])


@admin_router.get("/keys", dependencies=[Depends(require_auth)])
async def list_api_keys():
    if not _state.key_manager:
        raise HTTPException(status_code=503, detail="Key manager not available")
    keys = await _state.key_manager.list_keys()
    return {"keys": keys, "total": len(keys)}


@admin_router.post("/keys", dependencies=[Depends(require_auth)], status_code=201)
async def create_api_key(request: Request):
    if not _state.key_manager:
        raise HTTPException(status_code=503, detail="Key manager not available")
    body = await request.json()
    name = body.get("name", "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Key name is required")
    if len(name) > 100:
        raise HTTPException(status_code=400, detail="Key name must be 100 characters or fewer")
    result = await _state.key_manager.create_key(name=name, created_by="admin")
    return result


@admin_router.patch("/keys/{key_id}", dependencies=[Depends(require_auth)])
async def update_api_key(key_id: str, request: Request):
    if not _state.key_manager:
        raise HTTPException(status_code=503, detail="Key manager not available")
    body = await request.json()
    result = await _state.key_manager.update_key(
        key_id=key_id,
        name=body.get("name"),
        status=body.get("status"),
    )
    if result is None:
        raise HTTPException(status_code=404, detail="Key not found")
    return result


@admin_router.delete("/keys/{key_id}", dependencies=[Depends(require_auth)])
async def revoke_api_key(key_id: str):
    if not _state.key_manager:
        raise HTTPException(status_code=503, detail="Key manager not available")
    success = await _state.key_manager.revoke_key(key_id)
    if not success:
        raise HTTPException(status_code=404, detail="Key not found")
    return {"status": "revoked", "key_id": key_id}


@admin_router.get("/audit-log", dependencies=[Depends(require_auth)])
async def get_audit_log(
    key_id: str | None = Query(default=None),
    path: str | None = Query(default=None),
    method: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    if not _state.audit_logger:
        raise HTTPException(status_code=503, detail="Audit logger not available")
    return await _state.audit_logger.query(
        key_id=key_id, path=path, method=method, limit=limit, offset=offset
    )


@admin_router.get("/audit-log/summary", dependencies=[Depends(require_auth)])
async def get_audit_summary(hours: int = Query(default=24, ge=1, le=720)):
    if not _state.audit_logger:
        raise HTTPException(status_code=503, detail="Audit logger not available")
    return await _state.audit_logger.summary(hours=hours)
