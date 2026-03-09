# Weaviate Quickstart Guide for AI Agents

## Installation

### Docker (Recommended)

```bash
docker run -d \
  --name weaviate \
  -p 8080:8080 \
  -p 50051:50051 \
  -e AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED=true \
  -e PERSISTENCE_DATA_PATH=/var/lib/weaviate \
  -e DEFAULT_VECTORIZER_MODULE=text2vec-openai \
  -e ENABLE_MODULES=text2vec-openai \
  -e OPENAI_APIKEY=$OPENAI_API_KEY \
  cr.weaviate.io/semitechnologies/weaviate:latest
```

### Python Client

```bash
pip install weaviate-client
```

Requirements: Python 3.8+, Weaviate 1.23.7+

---

## Connection Examples

### Local Connection

```python
import weaviate

client = weaviate.connect_to_local()

# With explicit port
client = weaviate.connect_to_local(host="localhost", port=8080)
```

### Weaviate Cloud

```python
import weaviate

client = weaviate.connect_to_weaviate_cloud(
    cluster_url="https://my-cluster.weaviate.cloud",
    auth_credentials=weaviate.classes.init.Auth.api_key("YOUR-API-KEY"),
)
```

### Custom Connection

```python
import weaviate
from weaviate.connect import ConnectionParams
from weaviate.classes.init import Auth, AdditionalConfig, Timeout
import os

client = weaviate.WeaviateClient(
    connection_params=ConnectionParams.from_params(
        http_host="localhost",
        http_port=8080,
        http_secure=False,
        grpc_host="localhost",
        grpc_port=50051,
        grpc_secure=False,
    ),
    auth_credentials=Auth.api_key("secret-key"),
    additional_headers={
        "X-OpenAI-Api-Key": os.getenv("OPENAI_API_KEY")
    },
    additional_config=AdditionalConfig(
        timeout=Timeout(init=30, query=60, insert=120),
    ),
)
client.connect()
```

### Context Manager (Auto-close)

```python
with weaviate.connect_to_local() as client:
    collection = client.collections.get("MyCollection")
    # Use client - auto closes
```

---

## Core Concepts

| Concept | Description |
|---------|-------------|
| **Collection** | Schema definition (like a table) |
| **Object** | Data item with properties and vector |
| **Vector** | Embedding representing semantic meaning |
| **Property** | Data field within an object |
| **UUID** | Unique identifier for each object |

---

## Basic CRUD Operations

### Create Collection

```python
import weaviate.classes as wvc

client.collections.create(
    name="Article",
    properties=[
        wvc.config.Property(name="title", data_type=wvc.config.DataType.TEXT),
        wvc.config.Property(name="content", data_type=wvc.config.DataType.TEXT),
        wvc.config.Property(name="published", data_type=wvc.config.DataType.DATE),
    ],
    vectorizer_config=wvc.config.Configure.Vectorizer.text2vec_openai(),
)
```

### Insert Object

```python
collection = client.collections.get("Article")

uuid = collection.data.insert({
    "title": "Machine Learning Basics",
    "content": "Introduction to ML concepts...",
    "published": "2024-01-30"
})
```

### Batch Insert

```python
with collection.batch.dynamic() as batch:
    for item in items:
        batch.add_object({
            "title": item["title"],
            "content": item["content"],
        })
```

### Vector Search

```python
response = collection.query.near_text(
    query="machine learning algorithms",
    limit=5
)

for obj in response.objects:
    print(obj.properties, obj.metadata.distance)
```

### Hybrid Search

```python
response = collection.query.hybrid(
    query="neural networks",
    limit=10,
    alpha=0.5  # Balance: 0=keyword, 1=vector
)
```

### BM25 Keyword Search

```python
response = collection.query.bm25(
    query="deep learning",
    limit=5
)
```

### Filtered Search

```python
from weaviate.classes.query import Filter

response = collection.query.fetch_objects(
    where=Filter.by_property("published").greater_than("2024-01-01"),
    limit=10
)
```

### Update Object

```python
collection.data.update(
    uuid="object-uuid",
    properties={"title": "Updated Title"}
)
```

### Delete Object

```python
collection.data.delete("object-uuid")
```

### Delete Collection

```python
client.collections.delete("Article")
```

---

## AI Agent Patterns

### Document Ingestion Pipeline

```python
def ingest_documents(client, documents):
    collection = client.collections.get("Documents")

    with collection.batch.dynamic() as batch:
        for doc in documents:
            batch.add_object({
                "title": doc["title"],
                "content": doc["content"],
                "source": doc.get("source", "unknown")
            })

    return batch.number_errors == 0
```

### Semantic Search with Filtering

```python
def search_with_filter(collection, query, filters=None):
    response = collection.query.near_text(
        query=query,
        where=filters,
        limit=10,
        return_metadata=wvc.query.MetadataQuery(distance=True)
    )

    return [
        {"uuid": obj.uuid, "props": obj.properties, "distance": obj.metadata.distance}
        for obj in response.objects
    ]
```

### RAG Pattern

```python
def rag_retrieve(collection, query, limit=5):
    """Retrieve context for RAG"""
    response = collection.query.near_text(
        query=query,
        limit=limit
    )

    context = "\n\n".join([
        f"Title: {obj.properties['title']}\nContent: {obj.properties['content']}"
        for obj in response.objects
    ])

    return context
```

---

## Error Handling

```python
from weaviate.exceptions import WeaviateBaseError

try:
    collection = client.collections.get("NonExistent")
except WeaviateBaseError as e:
    print(f"Error: {e}")
```

---

## Configuration Constants

| Setting | Default | Description |
|---------|---------|-------------|
| HTTP Port | 8080 | REST API |
| gRPC Port | 50051 | Fast queries |
| Init Timeout | 30s | Connection setup |
| Query Timeout | 60s | Search operations |
| Insert Timeout | 120s | Batch imports |

---

## References

- [Weaviate Documentation](https://weaviate.io/developers/weaviate)
- [Python Client Docs](https://weaviate-python-client.readthedocs.io/)
- [GitHub](https://github.com/weaviate/weaviate-python-client)
