# Weaviate Collections & Schema Guide

Practical, code-focused reference for working with Weaviate collections using Python v4 client.

---

## Creating Collections

### Basic Collection with Properties

```python
import weaviate
import weaviate.classes as wvc

client = weaviate.connect_to_local()

articles = client.collections.create(
    name="Articles",
    properties=[
        wvc.config.Property(name="title", data_type=wvc.config.DataType.TEXT),
        wvc.config.Property(name="content", data_type=wvc.config.DataType.TEXT),
        wvc.config.Property(name="author", data_type=wvc.config.DataType.TEXT),
        wvc.config.Property(name="publish_date", data_type=wvc.config.DataType.DATE),
        wvc.config.Property(name="views", data_type=wvc.config.DataType.INT),
        wvc.config.Property(name="rating", data_type=wvc.config.DataType.NUMBER),
    ]
)
```

### Collection with Vectorizer

```python
articles = client.collections.create(
    name="Articles",
    vectorizer_config=wvc.config.Configure.Vectorizer.text2vec_openai(),
    properties=[
        wvc.config.Property(name="title", data_type=wvc.config.DataType.TEXT),
        wvc.config.Property(name="content", data_type=wvc.config.DataType.TEXT),
    ]
)
```

### Access Existing Collection

```python
articles = client.collections.get("Articles")

# Check if exists first
if client.collections.exists("Articles"):
    articles = client.collections.get("Articles")
```

---

## Property Data Types

| Data Type | Python Enum | Use Case |
|-----------|-------------|----------|
| TEXT | `DataType.TEXT` | Standard text fields |
| NUMBER | `DataType.NUMBER` | Floating-point numbers |
| INT | `DataType.INT` | Integer values |
| BOOL | `DataType.BOOL` | Boolean true/false |
| DATE | `DataType.DATE` | ISO 8601 dates |
| UUID | `DataType.UUID` | UUID identifiers |
| GEO_COORDINATES | `DataType.GEO_COORDINATES` | Geographic coordinates |
| BLOB | `DataType.BLOB` | Binary data (base64) |
| OBJECT | `DataType.OBJECT` | Nested objects |
| TEXT_ARRAY | `DataType.TEXT_ARRAY` | Array of texts |
| INT_ARRAY | `DataType.INT_ARRAY` | Array of integers |
| BOOL_ARRAY | `DataType.BOOL_ARRAY` | Array of booleans |
| NUMBER_ARRAY | `DataType.NUMBER_ARRAY` | Array of numbers |
| DATE_ARRAY | `DataType.DATE_ARRAY` | Array of dates |
| UUID_ARRAY | `DataType.UUID_ARRAY` | Array of UUIDs |
| OBJECT_ARRAY | `DataType.OBJECT_ARRAY` | Array of objects |

### Property Configuration Example

```python
properties = [
    wvc.config.Property(name="name", data_type=wvc.config.DataType.TEXT),
    wvc.config.Property(name="price", data_type=wvc.config.DataType.NUMBER),
    wvc.config.Property(name="is_active", data_type=wvc.config.DataType.BOOL),
    wvc.config.Property(name="created_at", data_type=wvc.config.DataType.DATE),
    wvc.config.Property(name="tags", data_type=wvc.config.DataType.TEXT_ARRAY),
    wvc.config.Property(name="metadata", data_type=wvc.config.DataType.OBJECT),
]
```

---

## Vectorizer Configuration

### text2vec-openai

```python
vectorizer_config = wvc.config.Configure.Vectorizer.text2vec_openai(
    model="text-embedding-3-small",
)

collection = client.collections.create(
    name="Documents",
    vectorizer_config=vectorizer_config,
    properties=[...]
)
```

### text2vec-cohere

```python
vectorizer_config = wvc.config.Configure.Vectorizer.text2vec_cohere(
    model="embed-english-v3.0",
)
```

### text2vec-transformers (Local)

```python
vectorizer_config = wvc.config.Configure.Vectorizer.text2vec_transformers()
```

### Multiple Named Vectors

```python
collection = client.collections.create(
    name="MultiVector",
    properties=[...],
    vectorizer_config={
        "text_vector": wvc.config.Configure.Vectorizer.text2vec_openai(),
        "semantic_vector": wvc.config.Configure.Vectorizer.text2vec_cohere(),
    }
)
```

---

## Index Configuration

### HNSW (Default - Best for Large Datasets)

```python
from weaviate.classes.config import Configure, VectorDistances

collection = client.collections.create(
    name="Articles",
    vectorizer_config=wvc.config.Configure.Vectorizer.text2vec_openai(
        vector_index_config=Configure.VectorIndex.hnsw(
            distance_metric=VectorDistances.COSINE,
            ef_construction=256,
            max_connections=32,
            ef=-1,  # Dynamic
            dynamic_ef_min=200,
            dynamic_ef_max=1000,
        )
    ),
    properties=[...]
)
```

### Flat Index (Best for Small Datasets / Multi-Tenant)

```python
collection = client.collections.create(
    name="SmallData",
    vectorizer_config=wvc.config.Configure.Vectorizer.text2vec_openai(
        vector_index_config=Configure.VectorIndex.flat(
            distance_metric=VectorDistances.COSINE,
        )
    ),
    properties=[...]
)
```

### Dynamic Index (Auto-switches)

```python
collection = client.collections.create(
    name="Hybrid",
    vectorizer_config=wvc.config.Configure.Vectorizer.text2vec_openai(
        vector_index_config=Configure.VectorIndex.dynamic(
            threshold=10000,  # Switch to HNSW at 10K objects
        )
    ),
    properties=[...]
)
```

### HNSW vs Flat Decision Guide

| Aspect | HNSW | Flat |
|--------|------|------|
| **Best For** | Large datasets (1M+) | Small datasets (<100K) |
| **Search Speed** | O(log n) | O(n) |
| **Build Time** | Slower | Instant |
| **Memory** | Moderate-High | Low |
| **Accuracy** | Trade-off possible | Perfect (100%) |
| **Use Case** | Production, scaling | Multi-tenant, testing |

### Distance Metrics

```python
from weaviate.classes.config import VectorDistances

# Options:
VectorDistances.COSINE      # Default, recommended
VectorDistances.L2          # Euclidean
VectorDistances.DOT         # Dot product
VectorDistances.MANHATTAN   # Manhattan distance
VectorDistances.HAMMING     # For binary vectors
```

### HNSW Parameter Tuning

| Parameter | Default | Range | Notes |
|-----------|---------|-------|-------|
| `max_connections` | 32 | 4-64 | Higher = more accurate, more memory |
| `ef_construction` | 128 | 64-512 | Higher = better index quality |
| `ef` | -1 | -1 or 64+ | -1 enables dynamic ef |
| `dynamic_ef_min` | 100 | varies | Minimum ef for dynamic queries |
| `dynamic_ef_max` | 500 | varies | Maximum ef for dynamic queries |

---

## Collection CRUD Operations

### Insert Objects

```python
articles = client.collections.get("Articles")

# Single object
uuid = articles.data.insert({
    "title": "AI in 2024",
    "content": "...",
    "author": "Jane Doe",
    "views": 1250,
    "rating": 4.5,
})

# With custom vector
uuid = articles.data.insert(
    properties={"title": "Article", "content": "..."},
    vector=[0.1, 0.2, 0.3, ...]
)
```

### Batch Insert

```python
with articles.batch.dynamic() as batch:
    for item in data:
        batch.add_object({
            "title": item["title"],
            "content": item["content"],
        })
```

### Query Objects

```python
# Fetch all
response = articles.query.fetch_objects(limit=10)

# Vector search
response = articles.query.near_text(
    query="machine learning",
    limit=5
)

# With filter
from weaviate.classes.query import Filter

response = articles.query.fetch_objects(
    where=Filter.by_property("views").greater_than(1000),
    limit=10
)

# Combined filters
response = articles.query.fetch_objects(
    where=(
        Filter.by_property("views").greater_than(1000)
        & Filter.by_property("author").equal("Jane Doe")
    ),
    limit=10
)
```

### Update Objects

```python
# Update specific properties
articles.data.update(
    uuid="550e8400-e29b-41d4-a716-446655440000",
    properties={"views": 5000}
)

# Replace entire object
articles.data.replace(
    uuid="550e8400-e29b-41d4-a716-446655440000",
    properties={
        "title": "Updated Title",
        "content": "Updated content",
        "views": 5000,
    }
)
```

### Delete Objects

```python
# Single object
articles.data.delete_by_id("550e8400-e29b-41d4-a716-446655440000")

# Bulk delete with filter
articles.data.delete_many(
    where=Filter.by_property("views").less_than(10)
)
```

### Delete Collection

```python
client.collections.delete("Articles")

# Safe delete
if client.collections.exists("Articles"):
    client.collections.delete("Articles")
```

---

## Schema Migration Patterns

### Pre-plan Schema (Recommended)

```python
# Define all properties upfront
complete_schema = [
    wvc.config.Property(name="title", data_type=wvc.config.DataType.TEXT),
    wvc.config.Property(name="content", data_type=wvc.config.DataType.TEXT),
    wvc.config.Property(name="author", data_type=wvc.config.DataType.TEXT),
    wvc.config.Property(name="tags", data_type=wvc.config.DataType.TEXT_ARRAY),
    wvc.config.Property(name="metadata", data_type=wvc.config.DataType.OBJECT),
    # Add extra fields even if not immediately used
]

articles = client.collections.create(
    name="Articles",
    properties=complete_schema,
    vectorizer_config=...
)
```

### Data Migration Between Collections

```python
old_articles = client.collections.get("Articles_Old")
new_articles = client.collections.get("Articles_New")

for obj in old_articles.iterator():
    new_properties = {
        "title": obj.properties.get("title"),
        "content": obj.properties.get("content"),
        "tags": obj.properties.get("tags", []),
    }
    new_articles.data.insert(properties=new_properties)
```

### Update Vector Index Config

```python
articles = client.collections.get("Articles")

articles.config.update(
    vector_index_config=wvc.config.Reconfigure.VectorIndex.hnsw(
        ef=300,
        ef_construction=512,
    )
)
```

---

## Best Practices for AI Agents

1. **Pre-plan Your Schema**: Add all fields upfront
2. **Use Named Vectors**: For multi-modal RAG systems
3. **Index Choice**: HNSW for production (>100K), flat for testing
4. **HNSW Tuning**: Start with `max_connections=32, ef_construction=256`
5. **Batch Operations**: Use `batch.dynamic()` for bulk data loading
6. **Error Handling**: Always check if collections exist before operations
7. **Vector Management**: Cache embeddings at application level

---

## References

- [Weaviate Collections Documentation](https://weaviate.io/developers/weaviate/manage-data/collections)
- [Schema Configuration](https://weaviate.io/developers/weaviate/config-refs/schema)
- [Vector Index Configuration](https://weaviate.io/developers/weaviate/config-refs/indexing)
