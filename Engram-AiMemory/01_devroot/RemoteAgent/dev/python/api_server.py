"""
API Server - FastAPI server exposing the embedding agent to TypeScript orchestrator
"""
import os
import asyncio
from typing import Optional
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from rich.console import Console

from embedding_worker import EmbeddingWorker
from document_processor import DocumentProcessor
from weaviate_client import WeaviateClient
from state_manager import StateManager

load_dotenv()
console = Console()

# Global instances
embedding_worker: Optional[EmbeddingWorker] = None
processor: Optional[DocumentProcessor] = None
weaviate: Optional[WeaviateClient] = None
state: Optional[StateManager] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle"""
    global embedding_worker, processor, weaviate, state
    
    console.print("[blue]Starting API server...[/blue]")
    
    # Initialize components
    embedding_worker = EmbeddingWorker()
    processor = DocumentProcessor()
    weaviate = WeaviateClient()
    state = StateManager()
    
    # Connect
    await embedding_worker.connect()
    weaviate.connect()
    weaviate.ensure_collection()
    
    console.print("[green]✓ API server ready[/green]")
    
    yield
    
    # Cleanup
    await embedding_worker.disconnect()
    weaviate.disconnect()
    console.print("[yellow]API server stopped[/yellow]")


app = FastAPI(
    title="Embedding Agent API",
    description="API for the remote embedding agent",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============== Models ==============

class EmbedTextRequest(BaseModel):
    text: str = Field(..., min_length=1)


class EmbedTextResponse(BaseModel):
    embedding: list[float]
    dimensions: int
    model: str


class EmbedBatchRequest(BaseModel):
    texts: list[str] = Field(..., min_items=1)


class EmbedBatchResponse(BaseModel):
    embeddings: list[list[float]]
    dimensions: int
    model: str
    count: int


class ProcessFileRequest(BaseModel):
    file_path: str


class ProcessFileResponse(BaseModel):
    file_path: str
    success: bool
    chunks_processed: int
    chunks_synced: int
    error: Optional[str] = None


class ProcessDirectoryRequest(BaseModel):
    directory: str
    recursive: bool = True


class ProcessDirectoryResponse(BaseModel):
    directory: str
    files_processed: int
    total_chunks: int
    errors: list[str]


class SearchRequest(BaseModel):
    query: str
    limit: int = Field(default=10, ge=1, le=100)


class SearchResult(BaseModel):
    content: str
    file_path: str
    file_name: str
    file_type: str
    chunk_index: int
    distance: Optional[float]


class SearchResponse(BaseModel):
    results: list[SearchResult]
    query: str


class StatsResponse(BaseModel):
    total_files: int
    synced_files: int
    unsynced_files: int
    total_chunks: int
    weaviate_chunks: int


class HealthResponse(BaseModel):
    status: str
    lm_studio: bool
    weaviate: bool


# ============== Endpoints ==============

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Check health of all components"""
    return HealthResponse(
        status="ok",
        lm_studio=embedding_worker._embedding_model is not None,
        weaviate=weaviate._client is not None and weaviate._client.is_ready()
    )


@app.get("/stats", response_model=StatsResponse)
async def get_stats():
    """Get current statistics"""
    state_stats = state.get_stats()
    weaviate_stats = weaviate.get_stats()
    
    return StatsResponse(
        total_files=state_stats.get("total_files", 0),
        synced_files=state_stats.get("synced_files", 0),
        unsynced_files=state_stats.get("unsynced_files", 0),
        total_chunks=state_stats.get("total_chunks", 0),
        weaviate_chunks=weaviate_stats.get("total_chunks", 0)
    )


@app.post("/embed/text", response_model=EmbedTextResponse)
async def embed_text(request: EmbedTextRequest):
    """Generate embedding for a single text"""
    result = await embedding_worker.embed_text(request.text)
    
    if not result:
        raise HTTPException(status_code=500, detail="Embedding generation failed")
    
    return EmbedTextResponse(
        embedding=result.embedding,
        dimensions=result.dimensions,
        model=result.model
    )


@app.post("/embed/batch", response_model=EmbedBatchResponse)
async def embed_batch(request: EmbedBatchRequest):
    """Generate embeddings for multiple texts"""
    results = await embedding_worker.embed_batch(request.texts)
    
    # Filter out failures
    embeddings = [r.embedding for r in results if r]
    
    if not embeddings:
        raise HTTPException(status_code=500, detail="All embeddings failed")
    
    return EmbedBatchResponse(
        embeddings=embeddings,
        dimensions=len(embeddings[0]),
        model=embedding_worker.model,
        count=len(embeddings)
    )


@app.post("/process/file", response_model=ProcessFileResponse)
async def process_file(request: ProcessFileRequest):
    """Process a single file through the pipeline"""
    path = Path(request.file_path)
    
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    if not processor.is_supported(path):
        raise HTTPException(status_code=400, detail="Unsupported file type")
    
    # Process document
    doc = processor.process(request.file_path)
    
    if doc.error:
        return ProcessFileResponse(
            file_path=request.file_path,
            success=False,
            chunks_processed=0,
            chunks_synced=0,
            error=doc.error
        )
    
    # Check if changed
    if not state.has_changed(request.file_path, doc.file_hash):
        return ProcessFileResponse(
            file_path=request.file_path,
            success=True,
            chunks_processed=0,
            chunks_synced=0,
            error="File unchanged"
        )
    
    # Delete old if re-indexing
    old_state = state.get_state(request.file_path)
    if old_state:
        weaviate.delete_by_file_hash(old_state.file_hash)
    
    # Generate embeddings
    chunk_texts = [chunk.content for chunk in doc.chunks]
    embeddings = await embedding_worker.embed_batch(chunk_texts)
    
    # Prepare Weaviate batch
    weaviate_chunks = []
    for chunk, emb_result in zip(doc.chunks, embeddings):
        if emb_result:
            weaviate_chunks.append({
                "content": chunk.content,
                "embedding": emb_result.embedding,
                "file_path": doc.file_path,
                "file_name": path.name,
                "file_type": doc.file_type.value,
                "file_hash": doc.file_hash,
                "chunk_index": chunk.chunk_index,
                "total_chunks": chunk.total_chunks,
            })
    
    # Insert
    success_count, error_count = weaviate.insert_batch(weaviate_chunks)
    
    # Update state
    state.update_state(
        file_path=request.file_path,
        file_hash=doc.file_hash,
        chunk_count=len(doc.chunks),
        weaviate_synced=(error_count == 0)
    )
    
    return ProcessFileResponse(
        file_path=request.file_path,
        success=error_count == 0,
        chunks_processed=len(doc.chunks),
        chunks_synced=success_count,
        error=f"{error_count} chunks failed" if error_count > 0 else None
    )


@app.post("/process/directory", response_model=ProcessDirectoryResponse)
async def process_directory(
    request: ProcessDirectoryRequest,
    background_tasks: BackgroundTasks
):
    """Process all files in a directory (can run in background)"""
    path = Path(request.directory)
    
    if not path.exists():
        raise HTTPException(status_code=404, detail="Directory not found")
    
    if not path.is_dir():
        raise HTTPException(status_code=400, detail="Path is not a directory")
    
    # Process synchronously for now (could be background task)
    results = []
    errors = []
    total_chunks = 0
    
    for doc in processor.process_directory(request.directory, request.recursive):
        if doc.error:
            errors.append(f"{doc.file_path}: {doc.error}")
            continue
        
        # Check if changed
        if not state.has_changed(doc.file_path, doc.file_hash):
            continue
        
        # Delete old
        old_state = state.get_state(doc.file_path)
        if old_state:
            weaviate.delete_by_file_hash(old_state.file_hash)
        
        # Embed
        chunk_texts = [chunk.content for chunk in doc.chunks]
        embeddings = await embedding_worker.embed_batch(chunk_texts)
        
        # Prepare batch
        weaviate_chunks = []
        for chunk, emb_result in zip(doc.chunks, embeddings):
            if emb_result:
                weaviate_chunks.append({
                    "content": chunk.content,
                    "embedding": emb_result.embedding,
                    "file_path": doc.file_path,
                    "file_name": Path(doc.file_path).name,
                    "file_type": doc.file_type.value,
                    "file_hash": doc.file_hash,
                    "chunk_index": chunk.chunk_index,
                    "total_chunks": chunk.total_chunks,
                })
        
        success_count, error_count = weaviate.insert_batch(weaviate_chunks)
        total_chunks += success_count
        
        state.update_state(
            file_path=doc.file_path,
            file_hash=doc.file_hash,
            chunk_count=len(doc.chunks),
            weaviate_synced=(error_count == 0)
        )
        
        results.append(doc.file_path)
        
        if error_count > 0:
            errors.append(f"{doc.file_path}: {error_count} chunks failed")
    
    return ProcessDirectoryResponse(
        directory=request.directory,
        files_processed=len(results),
        total_chunks=total_chunks,
        errors=errors
    )


@app.post("/search", response_model=SearchResponse)
async def search(request: SearchRequest):
    """Search for similar content"""
    # Generate embedding for query
    query_result = await embedding_worker.embed_text(request.query)
    
    if not query_result:
        raise HTTPException(status_code=500, detail="Failed to embed query")
    
    # Search Weaviate
    results = weaviate.search(query_result.embedding, request.limit)
    
    return SearchResponse(
        results=[
            SearchResult(
                content=r["content"],
                file_path=r["file_path"],
                file_name=r["file_name"],
                file_type=r["file_type"],
                chunk_index=r["chunk_index"],
                distance=r["distance"]
            )
            for r in results
        ],
        query=request.query
    )


@app.delete("/file/{file_path:path}")
async def delete_file(file_path: str):
    """Delete a file from the index"""
    file_state = state.get_state(file_path)
    
    if not file_state:
        raise HTTPException(status_code=404, detail="File not in index")
    
    # Delete from Weaviate
    weaviate.delete_by_file_hash(file_state.file_hash)
    
    # Delete from state
    state.delete_state(file_path)
    
    return {"status": "deleted", "file_path": file_path}


@app.post("/clear")
async def clear_all():
    """Clear all indexed data (use with caution)"""
    # This would need to clear Weaviate collection too
    state.clear_all()
    return {"status": "cleared"}


# ============== Run ==============

if __name__ == "__main__":
    import uvicorn
    
    host = os.getenv("API_HOST", "127.0.0.1")
    port = int(os.getenv("API_PORT", "8765"))
    
    uvicorn.run(app, host=host, port=port)
