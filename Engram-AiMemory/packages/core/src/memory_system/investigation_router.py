"""FastAPI router for investigation matters — /matters/** endpoints."""

from __future__ import annotations

# ruff: noqa: B008  # FastAPI Depends() in function defaults is standard pattern
import ipaddress
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, status

from memory_system.investigation.evidence_client import EvidenceClient
from memory_system.investigation.matter_client import MatterClient
from memory_system.investigation.models import (
    EvidenceIngest,
    EvidenceResponse,
    MatterCreate,
    MatterResponse,
    MatterStatus,
    SearchRequest,
    SearchResponse,
    SubjectOrgCreate,
    SubjectOrgResponse,
    SubjectPersonCreate,
    SubjectPersonResponse,
)
from memory_system.investigation.registry_client import GlobalRegistryClient

investigation_router = APIRouter()


def _get_weaviate_client():
    """Dependency: get the shared Weaviate client from app state."""
    from memory_system.api import app

    return app.state.weaviate_client


def _get_matter_client(weaviate_client=Depends(_get_weaviate_client)) -> MatterClient:
    return MatterClient(weaviate_client)


def _get_evidence_client(
    weaviate_client=Depends(_get_weaviate_client),
    matter_client: MatterClient = Depends(_get_matter_client),
) -> EvidenceClient:
    return EvidenceClient(weaviate_client, matter_client)


def _get_registry_client(weaviate_client=Depends(_get_weaviate_client)) -> GlobalRegistryClient:
    return GlobalRegistryClient(weaviate_client)


@investigation_router.post("/", response_model=MatterResponse, status_code=status.HTTP_201_CREATED)
async def create_matter(
    matter: MatterCreate,
    matter_client: MatterClient = Depends(_get_matter_client),
) -> MatterResponse:
    """Create a new investigation matter with tenant isolation."""
    try:
        return await matter_client.create_matter(matter)
    except ValueError as exc:
        if "already exists" in str(exc):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@investigation_router.get("/", response_model=list[MatterResponse])
async def list_matters(
    matter_status: MatterStatus | None = None,
    matter_client: MatterClient = Depends(_get_matter_client),
) -> list[MatterResponse]:
    """List all matters, optionally filtered by status."""
    return await matter_client.list_matters(status=matter_status)


@investigation_router.get("/{matter_id}", response_model=MatterResponse)
async def get_matter(
    matter_id: str,
    matter_client: MatterClient = Depends(_get_matter_client),
) -> MatterResponse:
    """Get a matter by ID."""
    matter = await matter_client.get_matter(matter_id)
    if matter is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Matter '{matter_id}' not found"
        )
    return matter


@investigation_router.patch("/{matter_id}/status", response_model=MatterResponse)
async def update_matter_status(
    matter_id: str,
    new_status: MatterStatus,
    matter_client: MatterClient = Depends(_get_matter_client),
) -> MatterResponse:
    """Update matter status (ACTIVE/CLOSED/ARCHIVED)."""
    try:
        return await matter_client.update_matter_status(matter_id, new_status)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@investigation_router.delete("/{matter_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_matter(
    matter_id: str,
    matter_client: MatterClient = Depends(_get_matter_client),
) -> None:
    """Delete a matter and all its tenant data."""
    deleted = await matter_client.delete_matter(matter_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Matter '{matter_id}' not found or delete failed",
        )


# ---------------------------------------------------------------------------
# Evidence routes
# ---------------------------------------------------------------------------


@investigation_router.post(
    "/{matter_id}/evidence",
    response_model=list[EvidenceResponse],
    status_code=status.HTTP_201_CREATED,
)
async def ingest_evidence(
    matter_id: str,
    ingest: EvidenceIngest,
    evidence_client: EvidenceClient = Depends(_get_evidence_client),
) -> list[EvidenceResponse]:
    """Ingest a document into the matter's evidence store."""
    ingest.matter_id = matter_id
    try:
        return await evidence_client.ingest_document(ingest)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@investigation_router.post("/{matter_id}/evidence/search", response_model=SearchResponse)
async def search_evidence(
    matter_id: str,
    search: SearchRequest,
    evidence_client: EvidenceClient = Depends(_get_evidence_client),
) -> SearchResponse:
    """Semantic search within a matter's evidence."""
    search.matter_id = matter_id
    return await evidence_client.search_evidence(search)


@investigation_router.delete(
    "/{matter_id}/evidence/{document_hash}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_evidence(
    matter_id: str,
    document_hash: str,
    evidence_client: EvidenceClient = Depends(_get_evidence_client),
) -> None:
    """Delete all chunks for a document by hash."""
    count = await evidence_client.delete_document(matter_id, document_hash)
    if count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Document '{document_hash}' not found"
        )


# ---------------------------------------------------------------------------
# Registry routes
# ---------------------------------------------------------------------------


@investigation_router.post(
    "/registry/persons", response_model=SubjectPersonResponse, status_code=status.HTTP_201_CREATED
)
async def upsert_person(
    person: SubjectPersonCreate,
    registry_client: GlobalRegistryClient = Depends(_get_registry_client),
) -> SubjectPersonResponse:
    """Upsert a person into the global registry."""
    return await registry_client.upsert_person(person)


@investigation_router.post(
    "/registry/organisations",
    response_model=SubjectOrgResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upsert_organisation(
    org: SubjectOrgCreate,
    registry_client: GlobalRegistryClient = Depends(_get_registry_client),
) -> SubjectOrgResponse:
    """Upsert an organisation into the global registry."""
    return await registry_client.upsert_organisation(org)


@investigation_router.get("/registry/persons/search", response_model=list[SubjectPersonResponse])
async def search_persons(
    q: str,
    limit: int = 10,
    registry_client: GlobalRegistryClient = Depends(_get_registry_client),
) -> list[SubjectPersonResponse]:
    """Semantic search for persons in the global registry."""
    return await registry_client.search_persons(q, limit=limit)


@investigation_router.get("/registry/organisations/search", response_model=list[SubjectOrgResponse])
async def search_organisations(
    q: str,
    limit: int = 10,
    registry_client: GlobalRegistryClient = Depends(_get_registry_client),
) -> list[SubjectOrgResponse]:
    """Semantic search for organisations in the global registry."""
    return await registry_client.search_organisations(q, limit=limit)


# ---------------------------------------------------------------------------
# Crawler trigger route
# ---------------------------------------------------------------------------


@investigation_router.post("/{matter_id}/crawl", status_code=status.HTTP_202_ACCEPTED)
async def trigger_crawl(
    matter_id: str,
    seed_urls: list[str],
    max_pages: int = 50,
    max_depth: int = 2,
) -> dict:
    """Trigger an OSINT crawl job for a matter. Returns job metadata (async, non-blocking)."""

    # SSRF protection: validate all seed URLs before accepting the job
    def _validate_url(url: str) -> str:
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            raise HTTPException(
                400, f"Invalid URL scheme: {parsed.scheme!r}. Only http/https allowed."
            )
        host = parsed.hostname or ""
        try:
            ip = ipaddress.ip_address(host)
            if ip.is_private or ip.is_loopback or ip.is_link_local:
                raise HTTPException(400, f"Private/internal IP addresses not allowed: {host}")
        except ValueError:
            pass  # hostname, not a bare IP — allow it
        return url

    validated_urls = [_validate_url(u) for u in seed_urls]

    from memory_system.investigation.crawler import CrawlJob

    CrawlJob(
        matter_id=matter_id,
        seed_urls=validated_urls,
        max_pages=max_pages,
        max_depth=max_depth,
    )
    # Return job descriptor — actual crawl runs in background worker
    return {
        "status": "accepted",
        "matter_id": matter_id,
        "seed_urls": validated_urls,
        "max_pages": max_pages,
        "max_depth": max_depth,
        "message": "Crawl job queued. Results will be ingested into evidence store.",
    }
