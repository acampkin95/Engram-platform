"""
Analysis API endpoints.

Provides:
- POST /api/darkweb/analyze - Analyze content
- GET /api/darkweb/report/{id} - Get analysis report
"""

import logging
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from crawl4ai_darkweb_osint.config import get_config
from crawl4ai_darkweb_osint.analysis.presets import (
    AnalysisPreset,
    get_preset_prompt,
    get_preset_description,
    list_presets,
    get_user_prompt,
)
from crawl4ai_darkweb_osint.analysis.artifacts import (
    ArtifactType,
    extract_artifacts,
    summarize_artifacts,
)
from crawl4ai_darkweb_osint.analysis.report import (
    generate_report,
)
from crawl4ai_darkweb_osint.llm_providers import get_llm_client

logger = logging.getLogger(__name__)

router = APIRouter()


# Request/Response Models
class AnalyzeRequest(BaseModel):
    """Request model for analysis."""

    content: str = Field(..., description="Content to analyze", min_length=10)
    preset: str = Field(
        default="threat_intel",
        description="Analysis preset (threat_intel, ransomware_malware, personal_identity, corporate_espionage)",
    )
    extract_artifacts: bool = Field(default=True, description="Extract artifacts from content")
    generate_report: bool = Field(default=True, description="Generate full report")


class ArtifactModel(BaseModel):
    """Artifact model for API."""

    type: str
    value: str
    context: Optional[str] = None
    confidence: float


class AnalyzeResponse(BaseModel):
    """Response model for analysis."""

    success: bool
    analysis_id: str
    preset: str
    analysis: str
    artifacts: list[ArtifactModel]
    report_markdown: Optional[str] = None
    timestamp: str


class ReportResponse(BaseModel):
    """Response model for report."""

    analysis_id: str
    title: str
    preset: str
    summary: str
    key_findings: list[str]
    artifacts_summary: dict
    insights: str
    recommendations: list[str]
    markdown: str
    timestamp: str


class PresetInfo(BaseModel):
    """Information about an analysis preset."""

    name: str
    description: str


class PresetsResponse(BaseModel):
    """Response model for presets list."""

    presets: list[PresetInfo]


# Storage for analysis results (in-memory for now)
_analysis_results: dict = {}


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_content(request: AnalyzeRequest) -> AnalyzeResponse:
    """
    Analyze dark web content.

    Uses LLM to analyze content based on selected preset.
    Optionally extracts artifacts and generates full report.
    """
    config = get_config()
    analysis_id = str(uuid.uuid4())

    # Validate preset
    try:
        preset_enum = AnalysisPreset(request.preset)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid preset. Available: {[p.value for p in AnalysisPreset]}",
        )

    # Extract artifacts
    artifacts = []
    artifact_models = []

    if request.extract_artifacts:
        artifacts = extract_artifacts(request.content)
        artifact_models = [
            ArtifactModel(
                type=a.type.value,
                value=a.value,
                context=a.context[:100] if a.context else None,
                confidence=a.confidence,
            )
            for a in artifacts
        ]

    # Perform LLM analysis
    try:
        client = get_llm_client(config.llm)

        system_prompt = get_preset_prompt(request.preset)
        user_prompt = get_user_prompt(request.preset, request.content[:8000])

        analysis = await client.generate_with_system(
            prompt=user_prompt,
            system=system_prompt,
        )

        if hasattr(client, "close"):
            await client.close()

    except Exception as e:
        logger.error(f"LLM analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

    # Generate report if requested
    report_markdown = None
    if request.generate_report:
        try:
            report = await generate_report(
                content=request.content,
                preset=request.preset,
                artifacts=artifacts,
                llm_insights=analysis,
            )
            report_markdown = report.to_markdown()

            # Store for retrieval
            _analysis_results[analysis_id] = report

        except Exception as e:
            logger.warning(f"Report generation failed: {e}")

    return AnalyzeResponse(
        success=True,
        analysis_id=analysis_id,
        preset=request.preset,
        analysis=analysis,
        artifacts=artifact_models,
        report_markdown=report_markdown,
        timestamp=datetime.utcnow().isoformat(),
    )


@router.get("/report/{analysis_id}", response_model=ReportResponse)
async def get_report(analysis_id: str) -> ReportResponse:
    """
    Get a previously generated analysis report.
    """
    if analysis_id not in _analysis_results:
        raise HTTPException(status_code=404, detail="Report not found")

    report = _analysis_results[analysis_id]

    return ReportResponse(
        analysis_id=analysis_id,
        title=report.title,
        preset=report.preset,
        summary=report.summary,
        key_findings=report.key_findings,
        artifacts_summary=summarize_artifacts(report.artifacts),
        insights=report.insights,
        recommendations=report.recommendations,
        markdown=report.to_markdown(),
        timestamp=report.timestamp,
    )


@router.get("/presets", response_model=PresetsResponse)
async def get_presets() -> PresetsResponse:
    """
    Get list of available analysis presets.
    """
    presets = [
        PresetInfo(
            name=p["name"],
            description=get_preset_description(p["name"]),
        )
        for p in list_presets()
    ]

    return PresetsResponse(presets=presets)


@router.post("/artifacts/extract")
async def extract_artifacts_only(
    content: str = Field(..., description="Content to extract from"),
    types: Optional[list[str]] = None,
) -> dict:
    """
    Extract artifacts from content without full analysis.

    Args:
        content: Content to extract from
        types: Specific artifact types to extract (optional)
    """
    artifact_types = None
    if types:
        valid_types = [t.value for t in ArtifactType]
        artifact_types = [ArtifactType(t) for t in types if t in valid_types]

    artifacts = extract_artifacts(content, artifact_types=artifact_types)

    return {
        "total": len(artifacts),
        "summary": summarize_artifacts(artifacts),
        "artifacts": [a.to_dict() for a in artifacts],
    }


@router.get("/health")
async def analysis_health() -> dict:
    """Check analysis module health."""
    config = get_config()

    return {
        "status": "healthy",
        "default_preset": config.analysis.preset,
        "artifact_extraction": config.analysis.extract_artifacts,
        "report_generation": config.analysis.generate_report,
    }
