# Weaviate Python v4 Client Reference

Quick reference guide for AI coding agents working with Weaviate Python v4 client.

## Installation

```bash
pip install weaviate-client
```

Requirements: Python 3.8+, Weaviate 1.23.7+

---

## Client Initialization

### Local Connection

```python
import weaviate

client = weaviate.connect_to_local()
# Alternatively with port specification
client = weaviate.connect_to_local(host="localhost", port=8080)
```

### Weaviate Cloud Connection

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
    skip_init_checks=False
)
client.connect()
```

---

## Authentication Methods

### API Key

```python
from weaviate.classes.init import Auth

auth = Auth.api_key("your-api-key")
client = weaviate.connect_to_weaviate_cloud(
    cluster_url="...",
    auth_credentials=auth
)
```

### Bearer Token

```python
from weaviate.classes.init import Auth

auth = Auth.bearer_token(
    access_token="access-token",
    refresh_token="refresh-token"  # Optional
)
```

### Client Credentials (OAuth 2.0)

```python
from weaviate.classes.init import Auth

auth = Auth.client_credentials(
    client_id="client-id",
    client_secret="client-secret",
    scope="scope"
)
```

### Username & Password (OIDC)

```python
from weaviate.classes.init import Auth

auth = Auth.client_password(
    username="user",
    password="pass"
)
```

---

## Connection Lifecycle

### Context Manager (Recommended)

```python
with weaviate.connect_to_local() as client:
    collection = client.collections.get("MyCollection")
    # Connection automatically closed
```

### Manual Management

```python
client = weaviate.connect_to_local()
try:
    collection = client.collections.get("MyCollection")
finally:
    client.close()
```

---

## Collection Operations

### Create Collection

```python
from weaviate.classes.config import Property, DataType

client.collections.create(
    name="Article",
    properties=[
        Property(name="title", data_type=DataType.TEXT),
        Property(name="content", data_type=DataType.TEXT),
        Property(name="published", data_type=DataType.DATE),
    ],
    vectorizer_config=weaviate.classes.config.Configure.Vectorizer.text2vec_openai(),
)
```

### Get Collection

```python
collection = client.collections.get("Article")
```

### Delete Collection

```python
client.collections.delete("Article")
```

### List Collections

```python
collections = client.collections.list_all()
for col in collections.collections:
    print(col.name)
```

### Check If Exists

```python
if client.collections.exists("Article"):
    collection = client.collections.get("Article")
```

---

## Data Operations

### Insert Single Object

```python
uuid = collection.data.insert({
    "title": "Machine Learning Basics",
    "content": "Introduction to ML concepts...",
    "published": "2024-01-30"
})
```

### Insert with Custom UUID

```python
uuid = collection.data.insert(
    properties={"title": "My Document"},
    uuid="custom-uuid-here"
)
```

### Insert with Vector

```python
uuid = collection.data.insert(
    properties={"content": "Sample text"},
    vector=[0.1, 0.2, 0.3, ...]  # Your embedding
)
```

### Batch Insert (Dynamic)

```python
with collection.batch.dynamic() as batch:
    for item in items:
        batch.add_object({
            "title": item["title"],
            "content": item["content"],
        })
```

### Batch Insert (Fixed Size)

```python
with collection.batch.fixed_size(batch_size=100) as batch:
    for item in items:
        batch.add_object(item)
```

### Batch Insert (Rate Limited)

```python
with collection.batch.rate_limit(requests_per_minute=60) as batch:
    for item in items:
        batch.add_object(item)
```

### Batch Error Handling

```python
with collection.batch.dynamic() as batch:
    for item in items:
        batch.add_object(item)

    if batch.number_errors > 0:
        print(f"Errors: {batch.number_errors}")
        for error in batch.failed_objects:
            print(f"UUID: {error.uuid}, Message: {error.message}")
```

### Get Object by ID

```python
obj = collection.query.fetch_object_by_id("object-uuid")
print(obj.properties)
```

### Update Object

```python
collection.data.update(
    uuid="object-uuid",
    properties={"title": "Updated Title"}
)
```

### Replace Object

```python
collection.data.replace(
    uuid="object-uuid",
    properties={"title": "New Title", "content": "New content"}
)
```

### Delete Object

```python
collection.data.delete_by_id("object-uuid")
```

---

## Query Operations

### Fetch All Objects

```python
response = collection.query.fetch_objects(limit=100)
for obj in response.objects:
    print(obj.uuid, obj.properties)
```

### Semantic Search (near_text)

```python
response = collection.query.near_text(
    query="machine learning algorithms",
    limit=5
)
for obj in response.objects:
    print(obj.properties, obj.metadata.distance)
```

### Vector Search (near_vector)

```python
response = collection.query.near_vector(
    near_vector=[0.1, 0.2, 0.3, ...],
    limit=5
)
```

### Hybrid Search

```python
response = collection.query.hybrid(
    query="neural networks",
    limit=10,
    alpha=0.5  # 0=keyword, 1=vector
)
```

### BM25 Keyword Search

```python
response = collection.query.bm25(
    query="deep learning",
    limit=5
)
```

### Filter Query

```python
from weaviate.classes.query import Filter

response = collection.query.fetch_objects(
    where=Filter.by_property("published").greater_than("2024-01-01"),
    limit=10
)
```

### Combined Filters

```python
response = collection.query.fetch_objects(
    where=(
        Filter.by_property("category").equal("Tech")
        & Filter.by_property("views").greater_than(1000)
    ),
    limit=10
)
```

### Query with Metadata

```python
response = collection.query.near_text(
    query="AI",
    limit=5,
    return_metadata=weaviate.classes.query.MetadataQuery(
        distance=True,
        certainty=True,
        creation_time=True
    )
)
```

---

## Async Client

```python
import asyncio
import weaviate

async def main():
    async with weaviate.use_async_with_local() as client:
        collection = client.collections.get("Article")
        response = await collection.query.near_text(
            query="AI",
            limit=5
        )
        print(response.objects)

asyncio.run(main())
```

---

## Complete CRUD Workflow

```python
import weaviate
from weaviate.classes.config import Property, DataType

with weaviate.connect_to_local() as client:
    # Create
    client.collections.create(
        name="Documents",
        properties=[Property(name="text", data_type=DataType.TEXT)]
    )

    col = client.collections.get("Documents")

    # Insert
    uuid = col.data.insert({"text": "Sample document"})

    # Query
    results = col.query.near_text(query="sample", limit=5)

    # Update
    col.data.update(uuid=uuid, properties={"text": "Updated"})

    # Delete
    col.data.delete_by_id(uuid)

    # Cleanup
    client.collections.delete("Documents")
```

---

## Configuration Constants

| Setting | Default | Description |
|---------|---------|-------------|
| HTTP Port | 8080 | REST API endpoint |
| gRPC Port | 50051 | Fast query endpoint |
| Init Timeout | 30s | Connection setup |
| Query Timeout | 60s | Search operations |
| Insert Timeout | 120s | Batch imports |
| Batch Modes | dynamic, fixed_size, rate_limit | Import strategies |
| Hybrid Alpha | 0-1 | 0=keyword, 1=vector |

---

## Common Vectorizers

| Vectorizer | Usage |
|------------|-------|
| `text2vec_openai()` | OpenAI embeddings |
| `text2vec_cohere()` | Cohere embeddings |
| `text2vec_huggingface()` | HuggingFace models |
| `text2vec_transformers()` | Local transformers |

---

## References

- [Weaviate Python Client Documentation](https://weaviate-python-client.readthedocs.io/)
- [Weaviate Official Docs](https://weaviate.io/developers/weaviate)
- [GitHub Repository](https://github.com/weaviate/weaviate-python-client)
- [PyPI Package](https://pypi.org/project/weaviate-client/)
