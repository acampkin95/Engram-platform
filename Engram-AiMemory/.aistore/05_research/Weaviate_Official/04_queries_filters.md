# Weaviate Queries & Filters Guide

Practical reference for querying Weaviate using Python v4 client.

---

## Search Types Overview

| Search Type | Use Case | Speed | Accuracy |
|-------------|----------|-------|----------|
| `near_text` | Semantic similarity | Fast | High |
| `near_vector` | Pre-computed embeddings | Fastest | High |
| `bm25` | Keyword matching | Very Fast | Exact |
| `hybrid` | Combined semantic + keyword | Moderate | Best |

---

## Semantic Search (near_text)

### Basic Semantic Search

```python
import weaviate
import weaviate.classes as wvc

client = weaviate.connect_to_local()
collection = client.collections.get("Articles")

response = collection.query.near_text(
    query="machine learning algorithms",
    limit=5
)

for obj in response.objects:
    print(obj.uuid, obj.properties)
```

### With Distance Threshold

```python
response = collection.query.near_text(
    query="artificial intelligence",
    limit=10,
    distance=0.7  # Max distance (lower = more similar)
)
```

### With Certainty Threshold

```python
response = collection.query.near_text(
    query="neural networks",
    limit=10,
    certainty=0.8  # Min certainty (higher = more similar)
)
```

### Return Metadata

```python
from weaviate.classes.query import MetadataQuery

response = collection.query.near_text(
    query="deep learning",
    limit=5,
    return_metadata=MetadataQuery(
        distance=True,
        certainty=True,
        creation_time=True,
        update_time=True,
    )
)

for obj in response.objects:
    print(f"Distance: {obj.metadata.distance}")
    print(f"Certainty: {obj.metadata.certainty}")
```

---

## Vector Search (near_vector)

### Search with Pre-computed Vector

```python
# Use when you have your own embeddings
embedding = [0.1, 0.2, 0.3, ...]  # Your vector

response = collection.query.near_vector(
    near_vector=embedding,
    limit=5
)
```

### Named Vector Search

```python
# For collections with multiple named vectors
response = collection.query.near_vector(
    near_vector=embedding,
    target_vector="text_vector",  # Specify which vector
    limit=5
)
```

---

## Keyword Search (BM25)

### Basic BM25 Search

```python
response = collection.query.bm25(
    query="python programming",
    limit=10
)
```

### Search Specific Properties

```python
response = collection.query.bm25(
    query="machine learning",
    query_properties=["title", "content"],  # Only search these
    limit=10
)
```

### With Score Metadata

```python
response = collection.query.bm25(
    query="data science",
    limit=5,
    return_metadata=MetadataQuery(score=True)
)

for obj in response.objects:
    print(f"BM25 Score: {obj.metadata.score}")
```

---

## Hybrid Search

### Basic Hybrid Search

```python
response = collection.query.hybrid(
    query="neural network optimization",
    limit=10,
    alpha=0.5  # 0=pure BM25, 1=pure vector
)
```

### Weighted Toward Semantic

```python
response = collection.query.hybrid(
    query="AI research papers",
    limit=10,
    alpha=0.75  # Favor vector similarity
)
```

### Weighted Toward Keyword

```python
response = collection.query.hybrid(
    query="specific error message",
    limit=10,
    alpha=0.25  # Favor BM25 keyword matching
)
```

### Hybrid Search Recommendations

| Use Case | Alpha Value |
|----------|-------------|
| General semantic search | 0.7-0.8 |
| Balanced search | 0.5 |
| Exact phrase matching | 0.2-0.3 |
| Technical documentation | 0.4-0.6 |

---

## Filters

### Basic Property Filters

```python
from weaviate.classes.query import Filter

# Equal
response = collection.query.fetch_objects(
    filters=Filter.by_property("category").equal("Technology"),
    limit=10
)

# Not equal
response = collection.query.fetch_objects(
    filters=Filter.by_property("status").not_equal("archived"),
    limit=10
)

# Greater than
response = collection.query.fetch_objects(
    filters=Filter.by_property("views").greater_than(1000),
    limit=10
)

# Less than or equal
response = collection.query.fetch_objects(
    filters=Filter.by_property("rating").less_or_equal(4.5),
    limit=10
)
```

### Filter Operators Reference

| Operator | Method | Example |
|----------|--------|---------|
| Equal | `.equal()` | `Filter.by_property("name").equal("John")` |
| Not Equal | `.not_equal()` | `Filter.by_property("status").not_equal("deleted")` |
| Greater Than | `.greater_than()` | `Filter.by_property("count").greater_than(10)` |
| Greater or Equal | `.greater_or_equal()` | `Filter.by_property("score").greater_or_equal(80)` |
| Less Than | `.less_than()` | `Filter.by_property("age").less_than(30)` |
| Less or Equal | `.less_or_equal()` | `Filter.by_property("price").less_or_equal(100)` |
| Like (Wildcard) | `.like()` | `Filter.by_property("title").like("*AI*")` |
| Contains Any | `.contains_any()` | `Filter.by_property("tags").contains_any(["python"])` |
| Contains All | `.contains_all()` | `Filter.by_property("tags").contains_all(["ml", "ai"])` |
| Is None | `.is_none()` | `Filter.by_property("deleted_at").is_none(True)` |

### Combined Filters (AND)

```python
response = collection.query.fetch_objects(
    filters=(
        Filter.by_property("category").equal("Tech")
        & Filter.by_property("views").greater_than(500)
        & Filter.by_property("published").greater_than("2024-01-01")
    ),
    limit=10
)
```

### Combined Filters (OR)

```python
response = collection.query.fetch_objects(
    filters=(
        Filter.by_property("category").equal("AI")
        | Filter.by_property("category").equal("ML")
    ),
    limit=10
)
```

### Complex Filter Logic

```python
response = collection.query.fetch_objects(
    filters=(
        (Filter.by_property("category").equal("Tech")
         | Filter.by_property("category").equal("Science"))
        & Filter.by_property("views").greater_than(1000)
    ),
    limit=10
)
```

### Filters with Search

```python
# Semantic search with filter
response = collection.query.near_text(
    query="machine learning",
    filters=Filter.by_property("author").equal("Jane Doe"),
    limit=5
)

# Hybrid search with filter
response = collection.query.hybrid(
    query="neural networks",
    filters=Filter.by_property("published").greater_than("2024-01-01"),
    alpha=0.5,
    limit=10
)
```

### Filter by UUID

```python
response = collection.query.fetch_objects(
    filters=Filter.by_id().equal("550e8400-e29b-41d4-a716-446655440000"),
    limit=1
)
```

### Filter by Creation Time

```python
from datetime import datetime

response = collection.query.fetch_objects(
    filters=Filter.by_creation_time().greater_than(datetime(2024, 1, 1)),
    limit=10
)
```

---

## Aggregations

### Count Objects

```python
response = collection.aggregate.over_all(total_count=True)
print(f"Total: {response.total_count}")
```

### Count with Filter

```python
response = collection.aggregate.over_all(
    filters=Filter.by_property("category").equal("Tech"),
    total_count=True
)
```

### Property Aggregations

```python
from weaviate.classes.aggregate import Metrics

# Numeric aggregations
response = collection.aggregate.over_all(
    return_metrics=Metrics("views").integer(
        count=True,
        minimum=True,
        maximum=True,
        mean=True,
        sum_=True
    )
)

print(f"Count: {response.properties['views'].count}")
print(f"Mean: {response.properties['views'].mean}")
```

### Text Property Aggregations

```python
response = collection.aggregate.over_all(
    return_metrics=Metrics("category").text(
        top_occurrences_count=True,
        top_occurrences_value=True
    )
)
```

### Grouped Aggregations

```python
response = collection.aggregate.over_all(
    group_by="category",
    total_count=True
)

for group in response.groups:
    print(f"{group.grouped_by.value}: {group.total_count}")
```

---

## Pagination

### Offset-based Pagination

```python
# Page 1
page1 = collection.query.fetch_objects(limit=10, offset=0)

# Page 2
page2 = collection.query.fetch_objects(limit=10, offset=10)

# Page 3
page3 = collection.query.fetch_objects(limit=10, offset=20)
```

### Cursor-based Pagination (Recommended for Large Datasets)

```python
# First page
response = collection.query.fetch_objects(limit=100)
cursor = response.cursor

# Subsequent pages
while cursor:
    response = collection.query.fetch_objects(
        limit=100,
        after=cursor
    )
    cursor = response.cursor if response.objects else None
```

### Iterator Pattern (Memory Efficient)

```python
# Iterate through all objects
for obj in collection.iterator():
    print(obj.uuid, obj.properties)

# With batch size
for obj in collection.iterator(include_vector=False):
    process(obj)
```

---

## Selecting Return Fields

### Return Specific Properties

```python
response = collection.query.fetch_objects(
    limit=10,
    return_properties=["title", "author"]  # Only these fields
)
```

### Exclude Properties

```python
response = collection.query.near_text(
    query="AI",
    limit=5,
    return_properties=["title"]  # Exclude large content field
)
```

### Include Vector

```python
response = collection.query.fetch_objects(
    limit=10,
    include_vector=True
)

for obj in response.objects:
    print(obj.vector)
```

### Include References

```python
from weaviate.classes.query import QueryReference

response = collection.query.fetch_objects(
    limit=10,
    return_references=QueryReference(
        link_on="hasAuthor",
        return_properties=["name", "email"]
    )
)
```

---

## AI Agent Query Patterns

### RAG Context Retrieval

```python
def retrieve_context(collection, query, limit=5):
    """Retrieve relevant context for RAG"""
    response = collection.query.hybrid(
        query=query,
        limit=limit,
        alpha=0.7,
        return_metadata=MetadataQuery(distance=True)
    )

    contexts = []
    for obj in response.objects:
        contexts.append({
            "content": obj.properties.get("content", ""),
            "source": obj.properties.get("source", ""),
            "relevance": 1 - (obj.metadata.distance or 0)
        })

    return contexts
```

### Semantic Deduplication

```python
def find_duplicates(collection, content, threshold=0.1):
    """Find semantically similar documents"""
    response = collection.query.near_text(
        query=content,
        limit=10,
        distance=threshold
    )

    return [obj.uuid for obj in response.objects]
```

### Faceted Search

```python
def faceted_search(collection, query, facets):
    """Search with multiple facet filters"""
    filters = None

    for key, value in facets.items():
        f = Filter.by_property(key).equal(value)
        filters = filters & f if filters else f

    return collection.query.hybrid(
        query=query,
        filters=filters,
        limit=20,
        alpha=0.6
    )
```

---

## References

- [Weaviate Query Documentation](https://weaviate.io/developers/weaviate/search)
- [Filter Reference](https://weaviate.io/developers/weaviate/search/filters)
- [Aggregation Reference](https://weaviate.io/developers/weaviate/search/aggregate)
