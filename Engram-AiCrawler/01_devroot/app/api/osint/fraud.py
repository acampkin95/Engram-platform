"""Fraud Detection & Identity Resolution endpoints — Phase 4 pipeline."""
from __future__ import annotations
import logging
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.fraud_detection import (
    FraudDetectionPipeline,
    FraudDetectionResult,
    IdentityResolver,
    RelationshipMapper,
    RiskScoringEngine,
    ResolvedIdentity,
    FraudPatternReport,
    EntityGraph,
    RiskAssessment,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/osint", tags=["osint"])


class FraudRunRequest(BaseModel):
    profiles: list[dict[str, Any]] = Field(
        ...,
        min_length=1,
        description=(
            "List of entity profile dicts. Each should have any subset of: "
            "entity_id, primary_name, known_names, emails, phones, addresses, "
            "usernames, social_profiles, images, date_of_birth."
        ),
    )
    image_suspicion_score: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Overall image suspicion score from Phase 3 (FakeIdSignals.overall_suspicion_score)",
    )
    phase3_image_evidence: list[str] | None = Field(
        default=None,
        description="Evidence strings from Phase 3 FakeIdSignals for narrative inclusion",
    )
    persist_graph: bool = Field(
        default=True,
        description="Persist the entity relationship graph to disk for later retrieval",
    )


class SingleProfileFraudRequest(BaseModel):
    profile: dict[str, Any] = Field(..., description="Single entity profile dict")
    image_suspicion_score: float = Field(default=0.0, ge=0.0, le=1.0)
    phase3_image_evidence: list[str] | None = None


class ResolveIdentityRequest(BaseModel):
    profiles: list[dict[str, Any]] = Field(..., min_length=1)


class MapRelationshipsRequest(BaseModel):
    profiles: list[dict[str, Any]] = Field(..., min_length=2)
    graph_id: str | None = Field(
        default=None,
        description="Custom graph ID; auto-generated if omitted",
    )
    persist: bool = True


@router.post("/fraud/run", response_model=FraudDetectionResult)
async def run_fraud_detection(request: FraudRunRequest) -> FraudDetectionResult:
    try:
        pipeline = FraudDetectionPipeline()
        result = pipeline.run(
            profiles=request.profiles,
            image_suspicion_score=request.image_suspicion_score,
            phase3_image_evidence=request.phase3_image_evidence,
            persist_graph=request.persist_graph,
        )
        return result
    except Exception as exc:
        logger.exception("Fraud detection pipeline failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Pipeline error: {exc}")


@router.post("/fraud/single", response_model=FraudDetectionResult)
async def run_fraud_detection_single(
    request: SingleProfileFraudRequest,
) -> FraudDetectionResult:
    try:
        pipeline = FraudDetectionPipeline()
        result = pipeline.run_single(
            profile=request.profile,
            image_suspicion_score=request.image_suspicion_score,
            phase3_image_evidence=request.phase3_image_evidence,
        )
        return result
    except Exception as exc:
        logger.exception("Single fraud detection failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Analysis error: {exc}")


@router.post("/fraud/resolve", response_model=ResolvedIdentity)
async def resolve_identity(request: ResolveIdentityRequest) -> ResolvedIdentity:
    try:
        resolver = IdentityResolver()
        return resolver.resolve(request.profiles)
    except Exception as exc:
        logger.exception("Identity resolution failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Resolution error: {exc}")


@router.post("/fraud/map-relationships", response_model=EntityGraph)
async def map_entity_relationships(request: MapRelationshipsRequest) -> EntityGraph:
    try:
        mapper = RelationshipMapper()
        graph = mapper.build_graph(request.profiles, graph_id=request.graph_id)
        if request.persist:
            mapper.persist(graph)
        return graph
    except Exception as exc:
        logger.exception("Relationship mapping failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Mapping error: {exc}")


@router.get("/fraud/graph/{graph_id}", response_model=EntityGraph)
async def get_entity_graph(graph_id: str) -> EntityGraph:
    mapper = RelationshipMapper()
    graph = mapper.load(graph_id)
    if not graph:
        raise HTTPException(
            status_code=404,
            detail=f"Graph '{graph_id}' not found. Build it first via /fraud/map-relationships.",
        )
    return graph


@router.post("/fraud/risk-score", response_model=RiskAssessment)
async def compute_risk_score(
    identity: ResolvedIdentity,
    fraud_report: FraudPatternReport,
    image_score: float = 0.0,
) -> RiskAssessment:
    try:
        engine = RiskScoringEngine()
        return engine.score(identity, fraud_report, image_score=image_score)
    except Exception as exc:
        logger.exception("Risk scoring failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Scoring error: {exc}")
