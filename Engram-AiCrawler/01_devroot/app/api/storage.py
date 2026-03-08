"""Storage API router for ChromaDB vector store operations."""

from __future__ import annotations
import logging
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.storage.chromadb_client import get_chromadb_client
from app.core.exceptions import StorageError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/storage", tags=["storage"])


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------


class CreateCollectionRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)


class AddDocumentsRequest(BaseModel):
    collection_name: str
    documents: list[str] = Field(..., min_length=1)
    metadatas: list[dict] | None = None


class SearchRequest(BaseModel):
    collection_name: str
    query_texts: list[str] = Field(..., min_length=1)
    n_results: int = Field(default=10, ge=1, le=100)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/collections")
async def create_collection(request: CreateCollectionRequest) -> dict[str, str]:
    try:
        client = get_chromadb_client()
        client.get_or_create_collection(request.name)
        return {"name": request.name, "status": "created"}
    except StorageError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/collections")
async def list_collections() -> dict[str, Any]:
    try:
        client = get_chromadb_client()
        names = client.list_collections()
        return {"collections": names, "count": len(names)}
    except StorageError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/collections/{name}")
async def delete_collection(name: str) -> dict[str, str]:
    try:
        client = get_chromadb_client()
        client.delete_collection(name)
        return {"name": name, "status": "deleted"}
    except StorageError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/documents")
async def add_documents(request: AddDocumentsRequest) -> dict[str, Any]:
    try:
        client = get_chromadb_client()
        ids = client.add_documents(
            collection_name=request.collection_name,
            documents=request.documents,
            metadatas=request.metadatas,
        )
        return {
            "collection": request.collection_name,
            "added": len(ids),
            "ids": ids,
        }
    except StorageError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/search")
async def search_documents(request: SearchRequest) -> dict[str, Any]:
    try:
        client = get_chromadb_client()
        results = client.search(
            collection_name=request.collection_name,
            query_texts=request.query_texts,
            n_results=request.n_results,
        )
        return {"collection": request.collection_name, "results": results}
    except StorageError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/collections/{name}/count")
async def get_collection_count(name: str) -> dict[str, Any]:
    try:
        client = get_chromadb_client()
        total = client.count(name)
        return {"collection": name, "count": total}
    except StorageError as e:
        raise HTTPException(status_code=500, detail=str(e))
