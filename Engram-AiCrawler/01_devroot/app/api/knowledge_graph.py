"""Knowledge Graph API router for OSINT entity and relationship queries."""

from __future__ import annotations
import logging
import os
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Response
from pydantic import BaseModel, Field

from app.osint.semantic_tracker import Entity, Relationship, SemanticTracker
from app.services.lm_studio_bridge import LMStudioBridge, LMStudioError
from app.core.exceptions import ExternalServiceError, StorageError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/knowledge-graph", tags=["knowledge-graph"])


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------


class BuildGraphRequest(BaseModel):
    scan_id: str = Field(..., min_length=1)
    crawl_results: list[dict[str, Any]] = Field(..., min_length=1)
    context: str = ""


class SearchEntitiesRequest(BaseModel):
    scan_id: str = Field(..., min_length=1)
    query: str = Field(..., min_length=1)
    n_results: int = Field(default=10, ge=1, le=100)


class MergeEntitiesRequest(BaseModel):
    source_id: str = Field(..., min_length=1)
    target_id: str = Field(..., min_length=1)


class MergeScanGraphsRequest(BaseModel):
    scan_ids: list[str] = Field(..., min_length=2)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _get_tracker() -> SemanticTracker:
    bridge = LMStudioBridge(
        base_url=os.getenv("LM_STUDIO_URL", "http://host.docker.internal:1234/v1"),
        model=os.getenv("LM_STUDIO_MODEL", "local-model"),
        timeout=int(os.getenv("LM_STUDIO_TIMEOUT", "60")),
        temperature=float(os.getenv("LM_STUDIO_TEMPERATURE", "0.3")),
    )
    return SemanticTracker(lm_bridge=bridge)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/build", status_code=201)
async def build_knowledge_graph(request: BuildGraphRequest) -> dict[str, Any]:
    """Build a knowledge graph from crawl results using LM Studio analysis."""

    try:
        tracker = _get_tracker()
        graph = await tracker.build_graph(
            scan_id=request.scan_id,
            crawl_results=request.crawl_results,
            context=request.context,
        )
        return graph.model_dump()
    except (LMStudioError, ExternalServiceError) as e:
        raise HTTPException(status_code=502, detail=f"LM Studio error: {e}")
    except StorageError as e:
        raise HTTPException(status_code=500, detail=f"Storage error: {e}")
    except Exception as e:
        logger.exception(f"Knowledge graph build failed: {e}")
        raise HTTPException(status_code=500, detail="Internal error building knowledge graph")


@router.post("/search", status_code=201)
async def search_knowledge_graph(request: SearchEntitiesRequest) -> dict[str, Any]:
    """Search entities in a knowledge graph by semantic similarity."""
    try:
        tracker = _get_tracker()
        entities = await tracker.search_entities(
            scan_id=request.scan_id,
            query=request.query,
            n_results=request.n_results,
        )
        return {
            "scan_id": request.scan_id,
            "query": request.query,
            "entities": [e.model_dump() for e in entities],
            "count": len(entities),
        }
    except StorageError as e:
        raise HTTPException(status_code=500, detail=f"Storage error: {e}")
    except Exception as e:
        logger.exception(f"Knowledge graph search failed: {e}")
        raise HTTPException(status_code=500, detail="Internal error searching knowledge graph")


async def _collect_all_graphs(
    tracker: SemanticTracker,
    scan_ids: list[str],
) -> tuple[list[Entity], list[Relationship]]:
    all_entities: list[Entity] = []
    all_relationships: list[Relationship] = []
    for sid in scan_ids:
        graph = await tracker.get_graph(sid)
        if graph is None:
            raise HTTPException(
                status_code=404,
                detail=f"No knowledge graph found for scan {sid}",
            )
        all_entities.extend(graph.entities)
        all_relationships.extend(graph.relationships)
    return all_entities, all_relationships


def _merge_entity_list(
    all_entities: list[Entity],
) -> tuple[dict[tuple, Entity], dict[str, str], set]:
    merged_map: dict[tuple, Entity] = {}
    id_remap: dict[str, str] = {}
    overlap_keys: set = set()
    for entity in all_entities:
        key = (entity.name.lower().strip(), entity.entity_type.lower().strip())
        if key in merged_map:
            canonical = merged_map[key]
            id_remap[entity.id] = canonical.id
            for k, v in entity.attributes.items():
                if k not in canonical.attributes:
                    canonical.attributes[k] = v
            overlap_keys.add(key)
        else:
            merged_map[key] = Entity(
                id=entity.id,
                name=entity.name,
                entity_type=entity.entity_type,
                attributes=dict(entity.attributes),
            )
            id_remap[entity.id] = entity.id
    return merged_map, id_remap, overlap_keys


def _merge_relationship_list(
    all_relationships: list[Relationship],
    id_remap: dict[str, str],
) -> list[Relationship]:
    seen_rels: set = set()
    merged: list[Relationship] = []
    for rel in all_relationships:
        src = id_remap.get(rel.source_id, rel.source_id)
        tgt = id_remap.get(rel.target_id, rel.target_id)
        rel_key = (src, tgt, rel.relation_type)
        if rel_key not in seen_rels:
            seen_rels.add(rel_key)
            merged.append(
                Relationship(
                    source_id=src,
                    target_id=tgt,
                    relation_type=rel.relation_type,
                    confidence=rel.confidence,
                    evidence=rel.evidence,
                )
            )
    return merged


@router.post("/merge-scans", status_code=201)
async def merge_scan_graphs(request: MergeScanGraphsRequest) -> dict[str, Any]:
    try:
        tracker = _get_tracker()
        all_entities, all_relationships = await _collect_all_graphs(tracker, request.scan_ids)
        merged_map, id_remap, overlap_keys = _merge_entity_list(all_entities)
        merged_relationships = _merge_relationship_list(all_relationships, id_remap)
        merged_entities = list(merged_map.values())
        return {
            "scan_ids": request.scan_ids,
            "entities": [e.model_dump() for e in merged_entities],
            "relationships": [r.model_dump() for r in merged_relationships],
            "entity_count": len(merged_entities),
            "relationship_count": len(merged_relationships),
            "overlap_count": len(overlap_keys),
        }
    except HTTPException:
        raise
    except StorageError as e:
        raise HTTPException(status_code=500, detail=f"Storage error: {e}")
    except Exception as e:
        logger.exception(f"Cross-scan merge failed: {e}")
        raise HTTPException(status_code=500, detail="Internal error merging scan graphs")


@router.get("/{scan_id}/types", status_code=200)
async def list_entity_types(scan_id: str) -> dict[str, Any]:
    """List all entity types present in the graph with their counts."""
    try:
        tracker = _get_tracker()
        counts = await tracker.list_entity_types(scan_id)
        if not counts:
            raise HTTPException(
                status_code=404,
                detail=f"No knowledge graph found for scan {scan_id}",
            )
        return {
            "scan_id": scan_id,
            "types": counts,
            "total_entities": sum(counts.values()),
        }
    except HTTPException:
        raise
    except StorageError as e:
        raise HTTPException(status_code=500, detail=f"Storage error: {e}")
    except Exception as e:
        logger.exception(f"Entity type listing failed for {scan_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal error listing entity types")


@router.get("/{scan_id}/search", status_code=200)
async def search_entities_in_scan(
    scan_id: str,
    query: str = Query(..., min_length=1),
    entity_type: str | None = Query(default=None),
    n_results: int = Query(default=10, ge=1, le=100),
) -> dict[str, Any]:
    """Search entities by name/attributes with optional entity-type filter."""
    try:
        tracker = _get_tracker()
        entities = await tracker.search_entities(
            scan_id=scan_id,
            query=query,
            n_results=n_results,
            entity_type=entity_type,
        )
        return {
            "scan_id": scan_id,
            "query": query,
            "entity_type": entity_type,
            "entities": [e.model_dump() for e in entities],
            "count": len(entities),
        }
    except StorageError as e:
        raise HTTPException(status_code=500, detail=f"Storage error: {e}")
    except Exception as e:
        logger.exception(f"Entity search failed for {scan_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal error searching entities")


@router.get("/{scan_id}/entities/{entity_id}", status_code=200)
async def get_entity_detail(scan_id: str, entity_id: str) -> dict[str, Any]:
    """Get an entity together with all its relationships (as source or target)."""
    try:
        tracker = _get_tracker()
        entity = await tracker.get_entity(scan_id, entity_id)
        if entity is None:
            raise HTTPException(
                status_code=404,
                detail=f"Entity {entity_id!r} not found in scan {scan_id!r}",
            )
        relationships = await tracker.get_entity_relationships(scan_id, entity_id)
        return {
            "scan_id": scan_id,
            "entity": entity.model_dump(),
            "relationships": [r.model_dump() for r in relationships],
            "relationship_count": len(relationships),
        }
    except HTTPException:
        raise
    except StorageError as e:
        raise HTTPException(status_code=500, detail=f"Storage error: {e}")
    except Exception as e:
        logger.exception(f"Entity detail failed for {entity_id} in {scan_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal error fetching entity detail")


@router.get("/{scan_id}/expand/{entity_id}", status_code=200)
async def expand_node(
    scan_id: str,
    entity_id: str,
    depth: int = Query(default=1, ge=1, le=5),
) -> dict[str, Any]:
    """Expand a node to reveal all entities and relationships within *depth* hops."""
    try:
        tracker = _get_tracker()
        seed = await tracker.get_entity(scan_id, entity_id)
        if seed is None:
            raise HTTPException(
                status_code=404,
                detail=f"Entity {entity_id!r} not found in scan {scan_id!r}",
            )
        entities, relationships = await tracker.get_connected_entities(
            scan_id, entity_id, depth=depth
        )
        return {
            "scan_id": scan_id,
            "seed_entity_id": entity_id,
            "depth": depth,
            "entities": [e.model_dump() for e in entities],
            "relationships": [r.model_dump() for r in relationships],
            "entity_count": len(entities),
            "relationship_count": len(relationships),
        }
    except HTTPException:
        raise
    except StorageError as e:
        raise HTTPException(status_code=500, detail=f"Storage error: {e}")
    except Exception as e:
        logger.exception(f"Node expansion failed for {entity_id} in {scan_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal error expanding node")


@router.get("/{scan_id}", status_code=200)
async def get_knowledge_graph(scan_id: str) -> dict[str, Any]:
    """Retrieve a stored knowledge graph by scan ID."""
    try:
        tracker = _get_tracker()
        graph = await tracker.get_graph(scan_id)
        if graph is None:
            raise HTTPException(
                status_code=404, detail=f"No knowledge graph found for scan {scan_id}"
            )
        return graph.model_dump()
    except HTTPException:
        raise
    except StorageError as e:
        raise HTTPException(status_code=500, detail=f"Storage error: {e}")
    except Exception as e:
        logger.exception(f"Knowledge graph retrieval failed: {e}")
        raise HTTPException(status_code=500, detail="Internal error retrieving knowledge graph")


@router.post("/{scan_id}/merge", status_code=201)
async def merge_entities(scan_id: str, request: MergeEntitiesRequest) -> dict[str, Any]:
    """Merge two entities: move all relationships from source to target, then delete source."""
    if request.source_id == request.target_id:
        raise HTTPException(
            status_code=400,
            detail="source_id and target_id must be different",
        )
    try:
        tracker = _get_tracker()
        success = await tracker.merge_entities(
            scan_id=scan_id,
            source_id=request.source_id,
            target_id=request.target_id,
        )
        if not success:
            raise HTTPException(
                status_code=404,
                detail=(
                    f"One or both entities not found: "
                    f"source={request.source_id!r}, target={request.target_id!r}"
                ),
            )
        return {
            "scan_id": scan_id,
            "merged": True,
            "source_id": request.source_id,
            "target_id": request.target_id,
        }
    except HTTPException:
        raise
    except StorageError as e:
        raise HTTPException(status_code=500, detail=f"Storage error: {e}")
    except Exception as e:
        logger.exception(f"Entity merge failed in {scan_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal error merging entities")


@router.get("/{scan_id}/export", status_code=200)
async def export_knowledge_graph(
    scan_id: str,
    format: str = Query("json", pattern="^(json|csv|graphml)$"),
) -> Response:
    """Export a knowledge graph in json, csv, or graphml format."""
    tracker = _get_tracker()
    try:
        graph = await tracker.get_graph(scan_id)
    except Exception as exc:
        raise HTTPException(status_code=404, detail=f"Graph not found: {exc}") from exc

    if not graph:
        raise HTTPException(status_code=404, detail=f"No graph data for scan {scan_id!r}")

    entities = [e.model_dump() for e in graph.entities]
    relationships = [r.model_dump() for r in graph.relationships]

    if format == "json":
        import json as _json

        content = _json.dumps(
            {"scan_id": scan_id, "entities": entities, "relationships": relationships},
            indent=2,
            default=str,
        )
        return Response(
            content=content,
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="graph_{scan_id}.json"'},
        )

    elif format == "csv":
        import csv
        import io

        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(["type", "id", "label", "properties"])
        for e in entities:
            writer.writerow(
                [
                    "entity",
                    e.get("id", ""),
                    e.get("name", ""),
                    str(e.get("attributes", {})),
                ]
            )
        for r in relationships:
            writer.writerow(
                [
                    "relationship",
                    f"{r.get('source_id', '')}\u2192{r.get('target_id', '')}",
                    r.get("relation_type", ""),
                    str(r.get("evidence", "")),
                ]
            )
        return Response(
            content=buf.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="graph_{scan_id}.csv"'},
        )

    else:  # graphml
        lines = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<graphml xmlns="http://graphml.graphdrawing.org/graphml">',
            '<graph id="G" edgedefault="directed">',
        ]
        for e in entities:
            eid = str(e.get("id", "")).replace('"', "&quot;")
            label = str(e.get("name", "")).replace('"', "&quot;")
            lines.append(f'  <node id="{eid}"><data key="label">{label}</data></node>')
        for i, r in enumerate(relationships):
            src = str(r.get("source_id", "")).replace('"', "&quot;")
            tgt = str(r.get("target_id", "")).replace('"', "&quot;")
            rtype = str(r.get("relation_type", "")).replace('"', "&quot;")
            lines.append(
                f'  <edge id="e{i}" source="{src}" target="{tgt}"><data key="type">{rtype}</data></edge>'
            )
        lines += ["</graph>", "</graphml>"]
        content = "\n".join(lines)
        return Response(
            content=content,
            media_type="application/xml",
            headers={"Content-Disposition": f'attachment; filename="graph_{scan_id}.graphml"'},
        )
