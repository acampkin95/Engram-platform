"""Integration tests for ChromaDB — runs against actual ChromaDB (not mocked).

Each test uses a dedicated tmp directory so tests are fully isolated and
the singleton get_chromadb_client() is NOT used directly here; instead
each test instantiates ChromaDBClient with a tmp_path fixture.
"""

import pytest
from pathlib import Path

from app.storage.chromadb_client import ChromaDBClient, get_chromadb_client


@pytest.fixture()
def client(tmp_path: Path) -> ChromaDBClient:
    return ChromaDBClient(path=str(tmp_path), collection_prefix="test_")


def test_create_collection(client: ChromaDBClient) -> None:
    """Test creating a collection."""
    collection = client.get_or_create_collection("mytest")
    assert collection is not None
    assert collection.name == "test_mytest"


def test_add_documents(client: ChromaDBClient) -> None:
    """Test adding documents to a collection."""
    docs = ["The quick brown fox", "A lazy dog", "Python programming"]
    ids = client.add_documents(collection_name="addtest", documents=docs)

    assert isinstance(ids, list)
    assert len(ids) == 3
    for doc_id in ids:
        assert isinstance(doc_id, str) and len(doc_id) > 0


def test_add_documents_with_metadata(client: ChromaDBClient) -> None:
    docs = ["doc one", "doc two"]
    metas = [{"source": "web", "tag": "osint"}, {"source": "api", "tag": "data"}]

    ids = client.add_documents(collection_name="metacol", documents=docs, metadatas=metas)
    assert len(ids) == 2

    result = client.get_documents("metacol", ids=ids)
    assert result["metadatas"] is not None
    sources = [m["source"] for m in result["metadatas"]]
    assert "web" in sources
    assert "api" in sources


def test_add_documents_with_explicit_ids(client: ChromaDBClient) -> None:
    custom_ids = ["doc-001", "doc-002"]
    returned_ids = client.add_documents(
        collection_name="idcol",
        documents=["first document", "second document"],
        ids=custom_ids,
    )
    assert returned_ids == custom_ids


def test_search_documents(client: ChromaDBClient) -> None:
    """Test semantic search in a collection."""
    docs = [
        "The quick brown fox jumps over the lazy dog",
        "Machine learning and artificial intelligence",
        "Python is an excellent programming language",
        "Web crawling and data extraction for OSINT",
        "Docker containers for application deployment",
    ]
    client.add_documents(collection_name="searchcol", documents=docs)

    results = client.search(
        collection_name="searchcol",
        query_texts=["fast animal leaping"],
        n_results=2,
    )

    assert "documents" in results
    assert "ids" in results
    assert len(results["documents"]) == 1
    assert len(results["documents"][0]) == 2
    assert results["documents"][0][0] == "The quick brown fox jumps over the lazy dog"


def test_search_multiple_queries(client: ChromaDBClient) -> None:
    docs = ["programming in Python", "running Docker containers", "neural networks"]
    client.add_documents(collection_name="multiqcol", documents=docs)

    results = client.search(
        collection_name="multiqcol",
        query_texts=["code development", "infrastructure"],
        n_results=1,
    )

    assert len(results["documents"]) == 2
    assert len(results["documents"][0]) == 1


def test_count_documents(client: ChromaDBClient) -> None:
    assert client.count("countcol") == 0

    client.add_documents("countcol", documents=["a", "b", "c"])
    assert client.count("countcol") == 3

    client.add_documents("countcol", documents=["d", "e"])
    assert client.count("countcol") == 5


def test_list_collections(client: ChromaDBClient) -> None:
    initial = client.list_collections()
    assert isinstance(initial, list)

    client.get_or_create_collection("alpha")
    client.get_or_create_collection("beta")

    names = client.list_collections()
    assert "test_alpha" in names
    assert "test_beta" in names
    assert len(names) == len(initial) + 2


def test_delete_collection(client: ChromaDBClient) -> None:
    """Test deleting a collection."""
    client.get_or_create_collection("todelete")
    assert "test_todelete" in client.list_collections()

    ok = client.delete_collection("todelete")
    assert ok is True
    assert "test_todelete" not in client.list_collections()


def test_get_documents_by_id(client: ChromaDBClient) -> None:
    client.add_documents(
        collection_name="getcol",
        documents=["hello world", "foo bar"],
        ids=["id-a", "id-b"],
    )

    result = client.get_documents("getcol", ids=["id-a"])
    assert result["ids"] == ["id-a"]
    assert result["documents"] == ["hello world"]


def test_end_to_end_workflow(client: ChromaDBClient) -> None:
    """Test: create collection → add 5 documents → search → verify results."""
    # Step 1: create collection
    collection = client.get_or_create_collection("e2e")
    assert collection is not None
    assert collection.name == "test_e2e"

    # Step 2: add 5 documents covering distinct topics
    documents = [
        "OSINT investigation techniques for social media platforms",
        "Web scraping tools and best practices for data collection",
        "Network security analysis and intrusion detection systems",
        "Python asyncio event loop and concurrent programming patterns",
        "Docker and Kubernetes container orchestration at scale",
    ]
    metadatas = [
        {"topic": "osint", "index": 0},
        {"topic": "scraping", "index": 1},
        {"topic": "security", "index": 2},
        {"topic": "python", "index": 3},
        {"topic": "devops", "index": 4},
    ]

    ids = client.add_documents(collection_name="e2e", documents=documents, metadatas=metadatas)
    assert len(ids) == 5

    # Step 3: verify count
    assert client.count("e2e") == 5

    # Step 4: search and verify relevant results are returned
    results = client.search(
        collection_name="e2e",
        query_texts=["intelligence gathering on social networks"],
        n_results=3,
    )

    assert len(results["documents"]) == 1
    top_docs = results["documents"][0]
    assert len(top_docs) == 3
    assert top_docs[0] == documents[0]

    # Step 5: verify metadata is preserved in search results
    top_metas = results["metadatas"][0]
    assert top_metas[0]["topic"] == "osint"

    # Step 6: list confirms collection exists
    assert "test_e2e" in client.list_collections()

    # Step 7: delete and confirm removal
    assert client.delete_collection("e2e") is True
    assert "test_e2e" not in client.list_collections()


def test_singleton_factory_returns_client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """get_chromadb_client() should return a ChromaDBClient instance."""
    import app.storage.chromadb_client as mod

    monkeypatch.setattr(mod, "_client", None)
    monkeypatch.setenv("CHROMADB_PATH", str(tmp_path))
    monkeypatch.setenv("CHROMADB_COLLECTION_PREFIX", "smoke_")

    singleton = get_chromadb_client()
    assert isinstance(singleton, ChromaDBClient)
    assert singleton.path == str(tmp_path)
    assert singleton.collection_prefix == "smoke_"

    assert get_chromadb_client() is singleton

    monkeypatch.setattr(mod, "_client", None)
    monkeypatch.setenv("CHROMADB_PATH", str(tmp_path))
    monkeypatch.setenv("CHROMADB_COLLECTION_PREFIX", "smoke_")

    singleton = get_chromadb_client()
    assert isinstance(singleton, ChromaDBClient)
    assert singleton.path == str(tmp_path)
    assert singleton.collection_prefix == "smoke_"

    # Second call returns same instance
    same = get_chromadb_client()
    assert same is singleton

    # Cleanup singleton so other tests are unaffected
    monkeypatch.setattr(mod, "_client", None)
