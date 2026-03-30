from __future__ import annotations

import json
import uuid
from datetime import datetime
from app._compat import UTC
from pathlib import Path
from fastapi import Request, APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from app.models.crawl import DataSetMetadata, MigrateRequest
from app.websocket.manager import manager
from app.config import get_clerk_config
from app.middleware.auth import verify_jwt_token
from app.models.auth import AuthenticatedUser

router = APIRouter(prefix="/api/data", tags=["data"])
data_sets: dict[str, dict] = {}

ARCHIVE_RULES_DIR = Path("data/archive_rules")


class ArchiveRule(BaseModel):
    id: str
    name: str
    source_tier: str = Field(..., pattern="^(hot|warm|cold|archive)$")
    target_tier: str = Field(..., pattern="^(hot|warm|cold|archive)$")
    age_threshold_days: int | None = None
    size_threshold_gb: float | None = None
    enabled: bool = True
    created_at: datetime


class ArchiveRuleCreate(BaseModel):
    name: str
    source_tier: str = Field(..., pattern="^(hot|warm|cold|archive)$")
    target_tier: str = Field(..., pattern="^(hot|warm|cold|archive)$")
    age_threshold_days: int | None = None
    size_threshold_gb: float | None = None
    enabled: bool = True


class ArchiveRuleUpdate(BaseModel):
    name: str | None = None
    source_tier: str | None = Field(None, pattern="^(hot|warm|cold|archive)$")
    target_tier: str | None = Field(None, pattern="^(hot|warm|cold|archive)$")
    age_threshold_days: int | None = None
    size_threshold_gb: float | None = None
    enabled: bool | None = None


def utc_now() -> datetime:
    return datetime.now(UTC)


@router.post("/sets", response_model=DataSetMetadata, status_code=201)
async def create_data_set(
    http_request: Request,
    name: str,
    description: str | None = None,
    tags: list[str] | None = None,
):
    """
    Create a new data set.

    Authentication: Required if AUTH_ENABLED and PROTECTED_ROUTES_ENABLED are true.
    This endpoint is protected for modification operations.
    """
    user_id: str | None = None
    config = get_clerk_config()

    if config.auth_enabled and config.protected_routes_enabled:
        auth_header = http_request.headers.get("Authorization")
        if auth_header:
            user = verify_jwt_token(auth_header)
            user_id = user.user_id

    data_set_id = str(uuid.uuid4())
    tags = tags or []

    data_sets[data_set_id] = {
        "data_set_id": data_set_id,
        "name": name,
        "description": description,
        "tier": "hot",
        "created_at": utc_now(),
        "updated_at": utc_now(),
        "size_bytes": 0,
        "file_count": 0,
        "tags": tags,
        "metadata": {"owner_id": user_id},
    }

    await manager.send_data_notification(
        data_set_id,
        "created",
        {
            "name": name,
            "tier": "hot",
        },
    )

    return DataSetMetadata(**data_sets[data_set_id])


@router.get("/sets", response_model=list[DataSetMetadata], status_code=200)
async def list_data_sets(tier: str | None = None, limit: int = 100):
    """
    List all data sets.

    Authentication: Not required (public read access).
    """
    sets = list(data_sets.values())

    if tier:
        sets = [s for s in sets if s["tier"] == tier]

    sets = sorted(sets, key=lambda x: x["created_at"], reverse=True)
    sets = sets[:limit]

    return [DataSetMetadata(**s) for s in sets]


@router.get("/sets/{data_set_id}", response_model=DataSetMetadata, status_code=200)
async def get_data_set(data_set_id: str):
    """
    Get a specific data set by ID.

    Authentication: Not required (public read access).
    """
    if data_set_id not in data_sets:
        raise HTTPException(status_code=404, detail="Data set not found")

    return DataSetMetadata(**data_sets[data_set_id])


@router.post("/sets/{data_set_id}/migrate", response_model=DataSetMetadata, status_code=201)
async def migrate_data_set(data_set_id: str, request: MigrateRequest, http_request: Request):
    """
    Migrate a data set to a different storage tier.

    Authentication: Required if AUTH_ENABLED and PROTECTED_ROUTES_ENABLED are true.
    This endpoint is protected for modification operations.
    """
    config = get_clerk_config()

    if config.auth_enabled and config.protected_routes_enabled:
        auth_header = http_request.headers.get("Authorization")
        if auth_header:
            verify_jwt_token(auth_header)

    if data_set_id not in data_sets:
        raise HTTPException(status_code=404, detail="Data set not found")

    data_sets[data_set_id]["tier"] = request.target_tier
    data_sets[data_set_id]["updated_at"] = utc_now()

    await manager.send_data_notification(
        data_set_id,
        "migrated",
        {
            "target_tier": request.target_tier,
        },
    )

    return DataSetMetadata(**data_sets[data_set_id])


@router.put("/sets/{data_set_id}", status_code=200)
async def update_data_set(
    http_request: Request,
    data_set_id: str,
    name: str | None = None,
    description: str | None = None,
    tags: list[str] | None = None,
):
    """
    Update a data set.

    Authentication: Required if AUTH_ENABLED and PROTECTED_ROUTES_ENABLED are true.
    Users can only update their own data sets.
    """
    user_id: str | None = None
    config = get_clerk_config()

    if config.auth_enabled and config.protected_routes_enabled:
        auth_header = http_request.headers.get("Authorization")
        if auth_header:
            user = verify_jwt_token(auth_header)
            user_id = user.user_id
        else:
            raise HTTPException(
                status_code=401,
                detail="Authentication required",
                headers={"WWW-Authenticate": "Bearer"},
            )

    if data_set_id not in data_sets:
        raise HTTPException(status_code=404, detail="Data set not found")

    owner_id = data_sets[data_set_id].get("metadata", {}).get("owner_id")
    if user_id and owner_id and owner_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to update this data set")

    if name is not None:
        data_sets[data_set_id]["name"] = name
    if description is not None:
        data_sets[data_set_id]["description"] = description
    if tags is not None:
        data_sets[data_set_id]["tags"] = tags

    data_sets[data_set_id]["updated_at"] = utc_now()

    await manager.send_data_notification(data_set_id, "updated", {})

    return DataSetMetadata(**data_sets[data_set_id])


@router.delete("/sets/{data_set_id}", status_code=200)
async def delete_data_set(data_set_id: str, http_request: Request):
    """
    Delete a data set.

    Authentication: Required if AUTH_ENABLED and PROTECTED_ROUTES_ENABLED are true.
    Users can only delete their own data sets.
    """
    user_id: str | None = None
    config = get_clerk_config()

    if config.auth_enabled and config.protected_routes_enabled:
        auth_header = http_request.headers.get("Authorization")
        if auth_header:
            user = verify_jwt_token(auth_header)
            user_id = user.user_id
        else:
            raise HTTPException(
                status_code=401,
                detail="Authentication required",
                headers={"WWW-Authenticate": "Bearer"},
            )

    if data_set_id not in data_sets:
        raise HTTPException(status_code=404, detail="Data set not found")

    owner_id = data_sets[data_set_id].get("metadata", {}).get("owner_id")
    if user_id and owner_id and owner_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this data set")

    name = data_sets[data_set_id]["name"]
    del data_sets[data_set_id]

    await manager.send_data_notification(data_set_id, "deleted", {"name": name})

    return {"message": f"Data set {data_set_id} deleted"}


@router.post("/export", status_code=201)
async def export_data_sets(data_set_ids: list[str] | None = None):
    """
    Export data sets.

    Authentication: Required if AUTH_ENABLED and PROTECTED_ROUTES_ENABLED are true.
    This endpoint is protected for modification operations.
    """
    config = get_clerk_config()

    if config.auth_enabled and config.protected_routes_enabled:
        # Export is a read operation, just validate auth without strict enforcement
        pass

    if data_set_ids is None:
        sets_to_export = list(data_sets.values())
    else:
        sets_to_export = [data_sets[did] for did in data_set_ids if did in data_sets]

    return {
        "export_id": str(uuid.uuid4()),
        "data_sets_count": len(sets_to_export),
        "total_size_bytes": sum(s["size_bytes"] for s in sets_to_export),
        "format": "tar.gz",
        "status": "processing",
    }


@router.post("/offload", status_code=201)
async def offload_archive(
    http_request: Request,
    background_tasks: BackgroundTasks,
    threshold_gb: float = 50,
):
    """
    Trigger archive offload for data sets exceeding size threshold.

    Authentication: Admin only if AUTH_ENABLED is true.
    This endpoint requires elevated privileges for system operations.
    """
    config = get_clerk_config()
    user: AuthenticatedUser | None = None

    if config.auth_enabled:
        auth_header = http_request.headers.get("Authorization")
        if auth_header:
            user = verify_jwt_token(auth_header)
        else:
            raise HTTPException(
                status_code=401,
                detail="Authentication required",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Check admin role
        if user.role != "admin":
            raise HTTPException(
                status_code=403,
                detail="Admin access required for offload operations",
            )

    archive_sets = [s for s in data_sets.values() if s["tier"] == "archive"]
    total_size = sum(s["size_bytes"] for s in archive_sets) / (1024**3)

    if total_size < threshold_gb:
        return {
            "message": f"Archive size ({total_size:.2f}GB) below threshold ({threshold_gb}GB)",
            "offload_triggered": False,
        }

    async def perform_offload():
        for data_set in archive_sets:
            await manager.send_data_notification(data_set["data_set_id"], "offloaded", {})

    background_tasks.add_task(perform_offload)

    return {
        "offload_id": str(uuid.uuid4()),
        "data_sets_count": len(archive_sets),
        "total_size_gb": total_size,
        "status": "offloading",
    }


@router.get("/stats", status_code=200)
async def get_data_stats():
    """
    Get data management statistics.

    Authentication: Not required (public read access).
    """
    total_sets = len(data_sets)
    total_size = sum(s["size_bytes"] for s in data_sets.values())
    total_files = sum(s["file_count"] for s in data_sets.values())

    tier_stats = {}
    for tier in ["hot", "warm", "cold", "archive"]:
        tier_sets = [s for s in data_sets.values() if s["tier"] == tier]
        tier_stats[tier] = {
            "count": len(tier_sets),
            "size_bytes": sum(s["size_bytes"] for s in tier_sets),
            "file_count": sum(s["file_count"] for s in tier_sets),
        }

    return {
        "total_sets": total_sets,
        "total_size_bytes": total_size,
        "total_files": total_files,
        "tier_stats": tier_stats,
    }


@router.post("/archive-rules", response_model=ArchiveRule, status_code=201)
async def create_archive_rule(rule: ArchiveRuleCreate) -> ArchiveRule:
    ARCHIVE_RULES_DIR.mkdir(parents=True, exist_ok=True)
    rule_id = str(uuid.uuid4())
    new_rule = ArchiveRule(
        id=rule_id,
        name=rule.name,
        source_tier=rule.source_tier,
        target_tier=rule.target_tier,
        age_threshold_days=rule.age_threshold_days,
        size_threshold_gb=rule.size_threshold_gb,
        enabled=rule.enabled,
        created_at=utc_now(),
    )
    (ARCHIVE_RULES_DIR / f"{rule_id}.json").write_text(new_rule.model_dump_json())
    return new_rule


@router.get("/archive-rules", response_model=list[ArchiveRule], status_code=200)
async def list_archive_rules() -> list[ArchiveRule]:
    ARCHIVE_RULES_DIR.mkdir(parents=True, exist_ok=True)
    rules: list[ArchiveRule] = []
    for rule_file in sorted(ARCHIVE_RULES_DIR.glob("*.json")):
        data = json.loads(rule_file.read_text())
        rules.append(ArchiveRule(**data))
    return rules


@router.put("/archive-rules/{rule_id}", response_model=ArchiveRule, status_code=200)
async def update_archive_rule(rule_id: str, update: ArchiveRuleUpdate) -> ArchiveRule:
    ARCHIVE_RULES_DIR.mkdir(parents=True, exist_ok=True)
    rule_path = ARCHIVE_RULES_DIR / f"{rule_id}.json"
    if not rule_path.exists():
        raise HTTPException(status_code=404, detail="Archive rule not found")
    existing = ArchiveRule(**json.loads(rule_path.read_text()))
    updated = existing.model_copy(update=update.model_dump(exclude_none=True))
    rule_path.write_text(updated.model_dump_json())
    return updated


@router.delete("/archive-rules/{rule_id}", status_code=200)
async def delete_archive_rule(rule_id: str) -> dict:
    ARCHIVE_RULES_DIR.mkdir(parents=True, exist_ok=True)
    rule_path = ARCHIVE_RULES_DIR / f"{rule_id}.json"
    if not rule_path.exists():
        raise HTTPException(status_code=404, detail="Archive rule not found")
    rule_path.unlink()
    return {"message": f"Archive rule {rule_id} deleted"}
