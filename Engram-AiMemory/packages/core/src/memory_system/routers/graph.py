import logging
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from memory_system import KnowledgeEntity, KnowledgeRelation
from memory_system.auth import require_auth
from memory_system.routers import _state

logger = logging.getLogger(__name__)

graph_router = APIRouter(prefix="/graph", tags=["graph"])


class AddEntityRequest(BaseModel):
    name: str = Field(..., min_length=1, description="Name of the entity")
    entity_type: str = Field(..., description="Type of entity (person, project, concept, etc.)")
    description: str | None = Field(default=None, description="Description of the entity")
    project_id: str | None = Field(default=None, description="Project scope")
    tenant_id: str = Field(default="default", description="Tenant ID for multi-tenancy")
    aliases: list[str] = Field(default_factory=list, description="Alternative names")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Additional metadata")


class AddRelationRequest(BaseModel):
    source_entity_id: str = Field(..., description="UUID of the source entity")
    target_entity_id: str = Field(..., description="UUID of the target entity")
    relation_type: str = Field(..., description="Type of relationship")
    weight: float = Field(default=1.0, ge=0.0, le=1.0, description="Relationship strength")
    project_id: str | None = Field(default=None, description="Project scope")
    tenant_id: str = Field(default="default", description="Tenant ID for multi-tenancy")
    context: str | None = Field(default=None, description="Context for this relation")


class GraphQueryRequest(BaseModel):
    entity_id: str = Field(..., description="UUID of the starting entity")
    depth: int = Field(default=1, ge=1, le=5, description="BFS traversal depth")
    project_id: str | None = Field(default=None, description="Project scope")
    tenant_id: str = Field(default="default", description="Tenant ID for multi-tenancy")


class EntitySummary(BaseModel):
    entity_id: str
    name: str
    entity_type: str
    description: str | None
    project_id: str | None
    created_at: datetime | None


class ListEntitiesResponse(BaseModel):
    entities: list[EntitySummary]
    count: int
    limit: int
    offset: int


def _entity_to_dict(entity: KnowledgeEntity) -> dict[str, Any]:
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


@graph_router.post("/entities", status_code=201, dependencies=[Depends(require_auth)])
async def add_entity(request: AddEntityRequest):
    if not _state.memory_system:
        raise HTTPException(status_code=503, detail="System not initialized")

    entity_id = await _state.memory_system.add_entity(
        name=request.name,
        entity_type=request.entity_type,
        description=request.description,
        project_id=request.project_id,
        tenant_id=request.tenant_id,
        aliases=request.aliases,
        metadata=request.metadata,
    )
    return {"entity_id": str(entity_id)}


@graph_router.get(
    "/entities", response_model=ListEntitiesResponse, dependencies=[Depends(require_auth)]
)
async def list_entities(
    tenant_id: str | None = None,
    project_id: str | None = None,
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    if not _state.memory_system:
        raise HTTPException(status_code=503, detail="System not initialized")

    entities = await _state.memory_system.list_entities(
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


@graph_router.get("/entities/by-name", dependencies=[Depends(require_auth)])
async def find_entity_by_name(
    name: str = Query(..., description="Entity name to search"),
    project_id: str | None = None,
    tenant_id: str = Query(default="default"),
):
    if not _state.memory_system:
        raise HTTPException(status_code=503, detail="System not initialized")

    entity = await _state.memory_system.find_entity_by_name(
        name=name,
        project_id=project_id,
        tenant_id=tenant_id,
    )
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")
    return _entity_to_dict(entity)


@graph_router.get("/entities/{entity_id}", dependencies=[Depends(require_auth)])
async def get_entity(
    entity_id: str,
    tenant_id: str = Query(default="default"),
):
    if not _state.memory_system:
        raise HTTPException(status_code=503, detail="System not initialized")

    entity = await _state.memory_system.get_entity(
        entity_id=entity_id,
        tenant_id=tenant_id,
    )
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")
    return _entity_to_dict(entity)


@graph_router.delete("/entities/{entity_id}", dependencies=[Depends(require_auth)])
async def delete_entity(
    entity_id: str,
    tenant_id: str = Query(default="default"),
):
    if not _state.memory_system:
        raise HTTPException(status_code=503, detail="System not initialized")

    deleted = await _state.memory_system.delete_entity(
        entity_id=entity_id,
        tenant_id=tenant_id,
    )
    return {"deleted": deleted}


@graph_router.post("/relations", status_code=201, dependencies=[Depends(require_auth)])
async def add_relation(request: AddRelationRequest):
    if not _state.memory_system:
        raise HTTPException(status_code=503, detail="System not initialized")

    relation_id = await _state.memory_system.add_relation(
        source_entity_id=request.source_entity_id,
        target_entity_id=request.target_entity_id,
        relation_type=request.relation_type,
        weight=request.weight,
        project_id=request.project_id,
        tenant_id=request.tenant_id,
        context=request.context,
    )
    return {"relation_id": str(relation_id)}


@graph_router.post("/query", dependencies=[Depends(require_auth)])
async def query_graph(request: GraphQueryRequest):
    if not _state.memory_system:
        raise HTTPException(status_code=503, detail="System not initialized")

    result = await _state.memory_system.query_graph(
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
