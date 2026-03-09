# Weaviate Named Vectors: Comprehensive Guide for Python v4 Client

## Table of Contents
1. [Overview](#overview)
2. [Configuring Multiple Named Vectors](#configuring-multiple-named-vectors)
3. [Using Different Vectorizers](#using-different-vectorizers)
4. [Inserting Objects with Named Vectors](#inserting-objects-with-named-vectors)
5. [Querying Specific Named Vectors](#querying-specific-named-vectors)
6. [Use Cases](#use-cases)
7. [Best Practices](#best-practices)
8. [Common Patterns](#common-patterns)

---

## Overview

Named vectors enable you to store multiple vector embeddings per object in Weaviate, allowing you to represent the same data in different ways. Each named vector can have its own:
- Vectorizer configuration
- Vector index type (HNSW, FLAT)
- Compression algorithm
- Source properties for vectorization

This feature is essential for applications requiring multi-dimensional vector representations such as:
- Title-based vs. content-based searches
- Multilingual embeddings
- Multi-modal representations
- Domain-specific vectorization strategies

### Key Differences from Single Vector Approach

| Aspect | Single Vector | Named Vectors |
|--------|--------------|---------------|
| Configuration Method | Top-level parameters | `vectorConfig` parameter |
| Vector Access | `object.vector["default"]` | `object.vector["vector_name"]` |
| Vectorizer Configuration | One per collection | One per named vector |
| Query Requirement | Optional `target_vector` | **Required** `target_vector` |
| Flexibility | Limited | High - different vectorizers per vector |

---

## Configuring Multiple Named Vectors

### Basic Setup: Collection with Multiple Named Vectors

Named vectors are configured using the `vectorConfig` parameter during collection creation. Each named vector can target different properties for vectorization.

```python
import weaviate
from weaviate.collections import Collection
from weaviate.classes.config import Configure, Property
from weaviate.classes.data import DataObject

# Initialize client
client = weaviate.connect_to_local()

# Define collection with multiple named vectors
try:
    collection = client.collections.create(
        name="Articles",
        # Vector configuration with multiple named vectors
        vector_config=[
            # Named vector for article titles
            Configure.Vectors.text2vec_openai(
                name="title_vector",
                source_properties=["title"],
                vectorizer_config=Configure.Vectorizer.text2vec_openai(
                    model="text-embedding-3-small"
                )
            ),
            # Named vector for article content
            Configure.Vectors.text2vec_openai(
                name="content_vector",
                source_properties=["content"],
                vectorizer_config=Configure.Vectorizer.text2vec_openai(
                    model="text-embedding-3-large"
                )
            ),
            # Named vector combining both title and content
            Configure.Vectors.text2vec_openai(
                name="combined_vector",
                source_properties=["title", "content"],
                vectorizer_config=Configure.Vectorizer.text2vec_openai(
                    model="text-embedding-3-small"
                )
            ),
        ],
        # Define properties
        properties=[
            Property(
                name="title",
                data_type="text",
                skip_vectorization=False  # This property will be vectorized
            ),
            Property(
                name="content",
                data_type="text",
                skip_vectorization=False
            ),
            Property(
                name="author",
                data_type="text",
                skip_vectorization=True  # Skip vectorization for metadata
            ),
            Property(
                name="published_date",
                data_type="date"
            ),
        ]
    )
    print("Collection 'Articles' created successfully")
except Exception as e:
    print(f"Collection creation error: {e}")
    # Collection might already exist
    collection = client.collections.use("Articles")
```

### Advanced Configuration: Index and Compression Settings

Each named vector can have custom indexing and compression settings:

```python
from weaviate.classes.config import Configure, Property, VectorIndexConfig, Vectorizer

collection = client.collections.create(
    name="AdvancedArticles",
    vector_config=[
        Configure.Vectors.text2vec_openai(
            name="title_vector",
            source_properties=["title"],
            # Custom HNSW index configuration
            vector_index_config=VectorIndexConfig(
                name="hnsw",
                ef_construction=256,
                ef=128,
                max_connections=64,
                dynamic_ef_min=100,
                dynamic_ef_max=500,
                skip=False,
                quantizer=Configure.VectorIndex.Quantizer.pq(
                    bit_compression=8
                )
            ),
            vectorizer_config=Configure.Vectorizer.text2vec_openai(
                model="text-embedding-3-small"
            )
        ),
        Configure.Vectors.text2vec_openai(
            name="content_vector",
            source_properties=["content"],
            # Use FLAT index for smaller datasets or exact search
            vector_index_config=VectorIndexConfig(
                name="flat"
            ),
            vectorizer_config=Configure.Vectorizer.text2vec_openai(
                model="text-embedding-3-large"
            )
        ),
    ],
    properties=[
        Property(name="title", data_type="text"),
        Property(name="content", data_type="text"),
    ]
)
```

### Adding Named Vectors to Existing Collections

You can add new named vectors to a collection after creation, but **existing objects won't receive vectors for the new configurations**—only newly created objects will be vectorized automatically.

```python
# Get existing collection
collection = client.collections.use("Articles")

# Add new named vector (if your client version supports it)
# Note: Check your Weaviate version as this capability may vary
try:
    # Update collection with additional vector
    # This is handled via direct GraphQL in some versions
    print("Adding new vector to existing collection")
    # Specific implementation depends on Weaviate server version
except Exception as e:
    print(f"Adding vector to existing collection: {e}")
    print("Consider creating a new collection if modification isn't supported")
```

---

## Using Different Vectorizers

### Multiple Vectorizers in One Collection

Different named vectors can use different vectorization models, allowing you to combine various embedding strategies:

```python
from weaviate.classes.config import Configure, Property

collection = client.collections.create(
    name="MultiVectorizedContent",
    vector_config=[
        # OpenAI embeddings for title
        Configure.Vectors.text2vec_openai(
            name="openai_title",
            source_properties=["title"],
            vectorizer_config=Configure.Vectorizer.text2vec_openai(
                model="text-embedding-3-large"
            )
        ),
        # Cohere embeddings for semantic search
        Configure.Vectors.text2vec_cohere(
            name="cohere_content",
            source_properties=["content"],
            vectorizer_config=Configure.Vectorizer.text2vec_cohere(
                model="embed-english-v3.0"
            )
        ),
        # HuggingFace embeddings for specialized domain
        Configure.Vectors.text2vec_huggingface(
            name="huggingface_tags",
            source_properties=["tags"],
            vectorizer_config=Configure.Vectorizer.text2vec_huggingface(
                model="sentence-transformers/all-MiniLM-L6-v2"
            )
        ),
        # Self-provided vectors (your own embeddings)
        Configure.Vectors.self_provided(
            name="custom_embedding"
        ),
    ],
    properties=[
        Property(name="title", data_type="text"),
        Property(name="content", data_type="text"),
        Property(name="tags", data_type="text[]"),
        Property(name="category", data_type="text", skip_vectorization=True),
    ]
)
```

### Combining Text and Multi-Modal Vectorizers

For applications requiring both text and image embeddings:

```python
from weaviate.classes.config import Configure, Property

collection = client.collections.create(
    name="MultiModalContent",
    vector_config=[
        # Text embedding using CLIP
        Configure.Vectors.multi2vec_clip(
            name="text_embedding",
            text_properties=["title", "description"],
            weights={
                "textProperties": 1.0,
            }
        ),
        # Image embedding using CLIP
        Configure.Vectors.multi2vec_clip(
            name="image_embedding",
            image_properties=["image_url"],
            weights={
                "imageProperties": 1.0,
            }
        ),
        # Combined text and image
        Configure.Vectors.multi2vec_clip(
            name="combined_embedding",
            text_properties=["title"],
            image_properties=["image_url"],
            weights={
                "textProperties": 0.5,
                "imageProperties": 0.5,
            }
        ),
    ],
    properties=[
        Property(name="title", data_type="text"),
        Property(name="description", data_type="text"),
        Property(name="image_url", data_type="text"),
    ]
)
```

### Vectorizer Comparison Table

| Vectorizer | Best For | Configuration |
|-----------|----------|---------------|
| `text2vec_openai` | General purpose, high quality | Requires API key |
| `text2vec_cohere` | Enterprise search | Requires API key |
| `text2vec_huggingface` | Custom domain models | Open source, local or API |
| `text2vec_jinaai` | Multilingual content | Requires API key |
| `multi2vec_clip` | Text + Image | Requires API key |
| `self_provided` | Custom embeddings | Your own vectors |

---

## Inserting Objects with Named Vectors

### Inserting with Automatic Vectorization

When you insert objects into a collection with named vector configurations that have vectorizers, Weaviate automatically generates vectors for the specified properties:

```python
# Get the collection
articles = client.collections.use("Articles")

# Insert object with properties - vectors are generated automatically
article_id = articles.data.insert(
    properties={
        "title": "Introduction to Vector Databases",
        "content": "Vector databases store and search data using embeddings...",
        "author": "Jane Doe",
        "published_date": "2024-01-15",
    }
)
print(f"Inserted article with UUID: {article_id}")

# Insert multiple objects with batch operations
objects_to_insert = [
    {
        "properties": {
            "title": "Advanced Vector Search",
            "content": "Learn about similarity search algorithms...",
            "author": "John Smith",
            "published_date": "2024-01-16",
        }
    },
    {
        "properties": {
            "title": "Semantic Search Explained",
            "content": "Semantic search uses embeddings to find meaning...",
            "author": "Alice Johnson",
            "published_date": "2024-01-17",
        }
    },
]

# Use batch insert for better performance
with articles.batch.dynamic() as batch:
    for obj in objects_to_insert:
        batch.add_object(
            properties=obj["properties"]
        )
```

### Inserting with Custom Vectors

When using self-provided vectorizers, you must supply the vectors explicitly:

```python
# Collection with self-provided vectors
custom_vectors = client.collections.use("CustomVectorCollection")

# Insert object with custom vectors
import numpy as np

embedding1 = np.random.random(1536).tolist()  # OpenAI embedding size
embedding2 = np.random.random(768).tolist()   # Different model

object_id = custom_vectors.data.insert(
    properties={
        "title": "My Article",
        "content": "This is the content...",
    },
    vector={
        "custom_embedding1": embedding1,
        "custom_embedding2": embedding2,
    }
)
```

### Inserting with Mixed Vectorization

Combining automatic and custom vectors:

```python
articles = client.collections.use("MixedVectorArticles")

# Properties will be auto-vectorized for 'title_vector' and 'content_vector'
# But you must provide 'custom_embedding'
article_id = articles.data.insert(
    properties={
        "title": "Hybrid Vectorization",
        "content": "This article uses both automatic and custom vectors...",
    },
    vector={
        "custom_embedding": [0.1, 0.2, 0.3] * 512,  # 1536 dimensions
    }
)
```

### Batch Insertion Best Practices

```python
from weaviate.classes.batch import DataObject

collection = client.collections.use("Articles")

# Prepare batch data
batch_objects = [
    {
        "id": "article-001",
        "properties": {
            "title": f"Article {i}",
            "content": f"Content for article {i}",
            "author": f"Author {i}",
        },
        "vector": {
            # Only include if using self-provided vectors
        }
    }
    for i in range(100)
]

# Insert with context manager for automatic flushing
with collection.batch.dynamic() as batch:
    for obj in batch_objects:
        batch.add_object(
            uuid=obj["id"],
            properties=obj["properties"],
            vector=obj.get("vector") if obj.get("vector") else None
        )

print(f"Successfully inserted {len(batch_objects)} objects")
```

---

## Querying Specific Named Vectors

### Single Named Vector Query

Specify which vector to search against using the `target_vector` parameter:

```python
from weaviate.classes.query import MetadataQuery

articles = client.collections.use("Articles")

# Search using only the title vector
response = articles.query.near_text(
    query="vector database fundamentals",
    limit=5,
    target_vector="title_vector",  # Required for named vectors
    return_metadata=MetadataQuery(distance=True)
)

print("Results using title_vector:")
for obj in response.objects:
    print(f"  Title: {obj.properties['title']}")
    print(f"  Distance: {obj.metadata.distance}")
    print()
```

### Query with Content Vector

```python
# Search using the content vector for deeper understanding
response = articles.query.near_text(
    query="embedding algorithms and vector search",
    limit=5,
    target_vector="content_vector",
    return_metadata=MetadataQuery(distance=True)
)

print("Results using content_vector:")
for obj in response.objects:
    print(f"  Content: {obj.properties['content'][:100]}...")
    print(f"  Distance: {obj.metadata.distance}")
    print()
```

### Multiple Named Vectors Query

Query multiple vectors simultaneously and combine results:

```python
from weaviate.classes.query import TargetVectors, MetadataQuery

collection = client.collections.use("Articles")

# Search using multiple vectors with default join strategy (average)
response = collection.query.near_text(
    query="semantic search",
    limit=10,
    target_vector=["title_vector", "content_vector"],
    return_metadata=MetadataQuery(distance=True)
)

print("Results using combined title and content vectors:")
for obj in response.objects:
    print(f"  Title: {obj.properties['title']}")
    print(f"  Combined Distance: {obj.metadata.distance}")
```

### Multiple Vectors with Join Strategy

Control how results from multiple vectors are combined:

```python
from weaviate.classes.query import TargetVectors, MetadataQuery

collection = client.collections.use("Articles")

# Combine using average (default)
response_avg = collection.query.near_text(
    query="machine learning",
    limit=5,
    target_vector=TargetVectors.average(["title_vector", "content_vector"]),
    return_metadata=MetadataQuery(distance=True)
)

# Combine using sum
response_sum = collection.query.near_text(
    query="machine learning",
    limit=5,
    target_vector=TargetVectors.sum(["title_vector", "content_vector"]),
    return_metadata=MetadataQuery(distance=True)
)

# Combine using minimum (best match from either vector)
response_min = collection.query.near_text(
    query="machine learning",
    limit=5,
    target_vector=TargetVectors.min(["title_vector", "content_vector"]),
    return_metadata=MetadataQuery(distance=True)
)

# Combine using maximum (worst match from either vector)
response_max = collection.query.near_text(
    query="machine learning",
    limit=5,
    target_vector=TargetVectors.max(["title_vector", "content_vector"]),
    return_metadata=MetadataQuery(distance=True)
)

# Weighted combination
response_weighted = collection.query.near_text(
    query="machine learning",
    limit=5,
    target_vector=TargetVectors.sum(
        vectors=["title_vector", "content_vector"],
        weights=[0.7, 0.3]  # 70% title, 30% content
    ),
    return_metadata=MetadataQuery(distance=True)
)
```

### Near Vector Query with Named Vectors

Provide your own vector for similarity search:

```python
import numpy as np
from weaviate.classes.query import MetadataQuery

collection = client.collections.use("Articles")

# Create a query vector (e.g., from an external model)
query_vector = np.random.random(1536).tolist()

# Search using custom vector
response = collection.query.near_vector(
    near_vector=query_vector,
    limit=5,
    target_vector="content_vector",
    return_metadata=MetadataQuery(distance=True)
)

print("Results using custom query vector:")
for obj in response.objects:
    print(f"  {obj.properties['title']}: {obj.metadata.distance}")
```

### Hybrid Search with Named Vectors

Combine vector search with keyword/BM25 search:

```python
from weaviate.classes.query import MetadataQuery

collection = client.collections.use("Articles")

# Hybrid search requires target_vector specification
response = collection.query.hybrid(
    query="vector databases",
    limit=5,
    target_vector="combined_vector",  # Must specify for named vectors
    alpha=0.75,  # Weight: 75% vector search, 25% keyword search
    return_metadata=MetadataQuery(distance=True, score=True)
)

print("Hybrid search results:")
for obj in response.objects:
    print(f"  Title: {obj.properties['title']}")
    print(f"  Vector Distance: {obj.metadata.distance}")
    print(f"  BM25 Score: {obj.metadata.score}")
```

### Generative (RAG) Query with Named Vectors

Use named vectors with generative models:

```python
from weaviate.classes.query import MetadataQuery

collection = client.collections.use("Articles")

# RAG query with specific vector
response = collection.query.near_text(
    query="What are the benefits of vector databases?",
    limit=3,
    target_vector="content_vector",  # Required for named vectors
    return_metadata=MetadataQuery(distance=True),
).generate(
    single_prompt="Explain what you know about this article in one sentence: {content}"
)

print("Generated responses:")
for obj in response.objects:
    print(f"  Title: {obj.properties['title']}")
    print(f"  Generated: {obj.generated}")
```

---

## Use Cases

### 1. Title vs. Content Vectors

Different search strategies for different query types:

```python
# Setup collection with title and content vectors
collection = client.collections.create(
    name="SearchableDocuments",
    vector_config=[
        Configure.Vectors.text2vec_openai(
            name="title_vector",
            source_properties=["title"],
            vectorizer_config=Configure.Vectorizer.text2vec_openai(
                model="text-embedding-3-small"
            )
        ),
        Configure.Vectors.text2vec_openai(
            name="content_vector",
            source_properties=["content"],
            vectorizer_config=Configure.Vectorizer.text2vec_openai(
                model="text-embedding-3-large"
            )
        ),
    ],
    properties=[
        Property(name="title", data_type="text"),
        Property(name="content", data_type="text"),
        Property(name="category", data_type="text"),
    ]
)

# Use case: User searching for specific topics
# Fast search in titles first
def quick_search(query: str):
    """Quick search in titles using smaller embeddings"""
    return collection.query.near_text(
        query=query,
        limit=10,
        target_vector="title_vector"
    )

# Use case: Deep content search
# More thorough search in full content
def deep_search(query: str):
    """Deep search in content using larger embeddings"""
    return collection.query.near_text(
        query=query,
        limit=10,
        target_vector="content_vector"
    )

# Use case: Balanced search
# Search both title and content with weighted combination
def balanced_search(query: str):
    """Search both title and content, giving priority to titles"""
    return collection.query.near_text(
        query=query,
        limit=10,
        target_vector=TargetVectors.sum(
            vectors=["title_vector", "content_vector"],
            weights=[0.6, 0.4]  # 60% title, 40% content
        )
    )
```

### 2. Multilingual Vectors

Support multiple languages with language-specific embeddings:

```python
from weaviate.classes.config import Configure, Property

# Collection with language-specific vectors
collection = client.collections.create(
    name="MultilingualContent",
    vector_config=[
        Configure.Vectors.text2vec_jinaai(
            name="english_vector",
            source_properties=["content_en"],
            vectorizer_config=Configure.Vectorizer.text2vec_jinaai(
                model="jina-embeddings-v2-base-en"  # English-optimized
            )
        ),
        Configure.Vectors.text2vec_jinaai(
            name="spanish_vector",
            source_properties=["content_es"],
            vectorizer_config=Configure.Vectorizer.text2vec_jinaai(
                model="jina-embeddings-v2-base-multilingual"
            )
        ),
        Configure.Vectors.text2vec_jinaai(
            name="french_vector",
            source_properties=["content_fr"],
            vectorizer_config=Configure.Vectorizer.text2vec_jinaai(
                model="jina-embeddings-v2-base-multilingual"
            )
        ),
        # Cross-lingual vector using multilingual model
        Configure.Vectors.text2vec_jinaai(
            name="multilingual_vector",
            source_properties=["content_en", "content_es", "content_fr"],
            vectorizer_config=Configure.Vectorizer.text2vec_jinaai(
                model="jina-embeddings-v2-base-multilingual"
            )
        ),
    ],
    properties=[
        Property(name="content_en", data_type="text"),
        Property(name="content_es", data_type="text"),
        Property(name="content_fr", data_type="text"),
        Property(name="language", data_type="text", skip_vectorization=True),
    ]
)

# Search by language
def search_by_language(query: str, language: str) -> list:
    """Search using language-specific vector"""
    vector_map = {
        "en": "english_vector",
        "es": "spanish_vector",
        "fr": "french_vector",
    }
    return collection.query.near_text(
        query=query,
        limit=10,
        target_vector=vector_map.get(language, "multilingual_vector")
    )

# Cross-lingual search
def cross_lingual_search(query: str):
    """Search across all languages using multilingual vector"""
    return collection.query.near_text(
        query=query,
        limit=10,
        target_vector="multilingual_vector"
    )
```

### 3. Domain-Specific Vectorization

Different embeddings for different domains:

```python
from weaviate.classes.config import Configure, Property

# E-commerce product collection
collection = client.collections.create(
    name="ECommerceProducts",
    vector_config=[
        # General description vector
        Configure.Vectors.text2vec_openai(
            name="description_vector",
            source_properties=["description"],
            vectorizer_config=Configure.Vectorizer.text2vec_openai(
                model="text-embedding-3-large"
            )
        ),
        # Technical specifications vector
        Configure.Vectors.text2vec_openai(
            name="specs_vector",
            source_properties=["technical_specs"],
            vectorizer_config=Configure.Vectorizer.text2vec_openai(
                model="text-embedding-3-small"  # Smaller for technical data
            )
        ),
        # Customer reviews vector
        Configure.Vectors.text2vec_openai(
            name="reviews_vector",
            source_properties=["customer_reviews"],
            vectorizer_config=Configure.Vectorizer.text2vec_openai(
                model="text-embedding-3-large"  # Larger for nuanced sentiment
            )
        ),
        # Image embeddings
        Configure.Vectors.multi2vec_clip(
            name="image_vector",
            image_properties=["product_images"],
        ),
    ],
    properties=[
        Property(name="product_name", data_type="text", skip_vectorization=True),
        Property(name="description", data_type="text"),
        Property(name="technical_specs", data_type="text"),
        Property(name="customer_reviews", data_type="text"),
        Property(name="product_images", data_type="text[]"),
        Property(name="price", data_type="number", skip_vectorization=True),
    ]
)

# Use case: Browse by appearance
def find_by_appearance(image_url: str):
    """Find similar products by image appearance"""
    return collection.query.near_image(
        near_image=image_url,
        limit=10,
        target_vector="image_vector"
    )

# Use case: Find alternatives by description
def find_alternatives(query: str):
    """Find similar products by description"""
    return collection.query.near_text(
        query=query,
        limit=10,
        target_vector="description_vector"
    )

# Use case: Find technical equivalents
def find_technical_alternatives(specs_query: str):
    """Find products with similar technical specifications"""
    return collection.query.near_text(
        query=specs_query,
        limit=10,
        target_vector="specs_vector"
    )

# Use case: Find products with similar reviews
def find_similar_reviews(review_query: str):
    """Find products with similar customer sentiment"""
    return collection.query.near_text(
        query=review_query,
        limit=10,
        target_vector="reviews_vector"
    )
```

### 4. Search Result Fusion

Combine results from multiple search strategies:

```python
def fused_search(query: str):
    """
    Combine results from title and content searches
    using different weightings
    """
    # Get results from title search
    title_results = collection.query.near_text(
        query=query,
        limit=20,
        target_vector="title_vector",
        return_metadata=MetadataQuery(distance=True)
    )

    # Get results from content search
    content_results = collection.query.near_text(
        query=query,
        limit=20,
        target_vector="content_vector",
        return_metadata=MetadataQuery(distance=True)
    )

    # Combine and deduplicate results
    combined = {}
    for obj in title_results.objects:
        obj_id = str(obj.uuid)
        combined[obj_id] = {
            "object": obj,
            "title_score": 1 - obj.metadata.distance,
            "content_score": 0
        }

    for obj in content_results.objects:
        obj_id = str(obj.uuid)
        if obj_id in combined:
            combined[obj_id]["content_score"] = 1 - obj.metadata.distance
        else:
            combined[obj_id] = {
                "object": obj,
                "title_score": 0,
                "content_score": 1 - obj.metadata.distance
            }

    # Score and sort by weighted combination
    for obj_id, data in combined.items():
        data["final_score"] = (
            0.6 * data["title_score"] + 0.4 * data["content_score"]
        )

    # Return sorted results
    return sorted(
        combined.values(),
        key=lambda x: x["final_score"],
        reverse=True
    )[:10]
```

---

## Best Practices

### 1. Vector Size and Model Selection

**Guidance for Different Use Cases:**

```python
# For high-precision, computationally abundant environments
large_embedding_config = Configure.Vectors.text2vec_openai(
    name="high_precision_vector",
    source_properties=["content"],
    vectorizer_config=Configure.Vectorizer.text2vec_openai(
        model="text-embedding-3-large"  # 3072 dimensions
    )
)

# For balanced performance and accuracy
medium_embedding_config = Configure.Vectors.text2vec_openai(
    name="balanced_vector",
    source_properties=["content"],
    vectorizer_config=Configure.Vectorizer.text2vec_openai(
        model="text-embedding-3-small"  # 1536 dimensions
    )
)

# For resource-constrained environments
small_embedding_config = Configure.Vectors.text2vec_huggingface(
    name="lightweight_vector",
    source_properties=["content"],
    vectorizer_config=Configure.Vectorizer.text2vec_huggingface(
        model="sentence-transformers/all-MiniLM-L6-v2"  # 384 dimensions
    )
)
```

### 2. Query Optimization

**Always specify target_vector for named vector collections:**

```python
# CORRECT: Explicit target vector
collection.query.near_text(
    query="example",
    target_vector="content_vector"  # Required!
)

# INCORRECT: This will fail with named vectors
# collection.query.near_text(query="example")
```

**Choose appropriate vectors for query type:**

```python
# For short, keyword-like queries -> use title_vector
response = collection.query.near_text(
    query="python",  # Short query
    target_vector="title_vector",
    limit=5
)

# For long, semantic queries -> use content_vector
response = collection.query.near_text(
    query="I'm looking for articles about how vector databases work internally",
    target_vector="content_vector",
    limit=5
)
```

### 3. Memory Optimization with Quantization

**Use compression for large-scale deployments:**

```python
from weaviate.classes.config import Configure, VectorIndexConfig

collection = client.collections.create(
    name="OptimizedCollection",
    vector_config=[
        Configure.Vectors.text2vec_openai(
            name="compressed_vector",
            source_properties=["content"],
            # Apply Product Quantization
            vector_index_config=VectorIndexConfig(
                name="hnsw",
                quantizer=Configure.VectorIndex.Quantizer.pq(
                    bit_compression=8  # 8-bit compression
                )
            ),
            vectorizer_config=Configure.Vectorizer.text2vec_openai(
                model="text-embedding-3-small"
            )
        ),
    ],
    properties=[
        Property(name="content", data_type="text"),
    ]
)

# Results: ~75% reduction in memory with minimal accuracy loss
```

### 4. Handling Existing Objects When Adding Vectors

**Plan for vector migration:**

```python
# When adding a new named vector to existing collection:
# 1. New objects automatically get vectors for new config
# 2. Existing objects must be re-indexed separately

# Option 1: Re-insert critical objects
collection = client.collections.use("Articles")

# Get existing objects and re-insert them
existing_objects = collection.iterator(
    where=None,  # Get all objects
    include_vector=False
)

# Re-insert in batches to trigger vectorization
with collection.batch.dynamic() as batch:
    for obj in existing_objects:
        batch.add_object(
            uuid=obj.uuid,
            properties=obj.properties
            # Omit vector to trigger automatic generation
        )

# Option 2: Use batching API for bulk updates
# Requires Weaviate server support for updates
```

### 5. Monitoring and Performance

**Track vector storage overhead:**

```python
# Estimate memory usage
def estimate_memory_usage(
    num_objects: int,
    num_vectors: int,
    vector_dimensions: int,
    with_compression: bool = False
) -> str:
    """Estimate memory for vectors"""
    # 4 bytes per float32
    bytes_per_vector = vector_dimensions * 4

    if with_compression:
        # 8-bit compression = 1 byte per value
        bytes_per_vector = vector_dimensions

    total_bytes = num_objects * num_vectors * bytes_per_vector

    # Convert to human-readable format
    for unit in ['B', 'KB', 'MB', 'GB']:
        if total_bytes < 1024:
            return f"{total_bytes:.2f} {unit}"
        total_bytes /= 1024

    return f"{total_bytes:.2f} TB"

# Example: 1M articles, 2 vectors, 1536 dims
print(estimate_memory_usage(1_000_000, 2, 1536))
# Output: ~12.00 GB

# With compression
print(estimate_memory_usage(1_000_000, 2, 1536, with_compression=True))
# Output: ~3.00 GB
```

### 6. Cost Optimization

**Minimize API calls for external vectorizers:**

```python
# INEFFICIENT: Vectorizing with every insert
for item in items:
    articles.data.insert(
        properties=item,
        vector=None  # Triggers vectorization API call
    )

# EFFICIENT: Batch insert to reduce API calls
with articles.batch.dynamic() as batch:
    for item in items:
        batch.add_object(properties=item)

# EFFICIENT: Use self-provided vectors to avoid API costs
# Pre-compute embeddings externally
import requests

def get_embeddings_batch(texts: list[str]) -> list[list[float]]:
    """Get embeddings from API in one batch call"""
    response = requests.post(
        "https://api.openai.com/v1/embeddings",
        json={
            "input": texts,
            "model": "text-embedding-3-small"
        },
        headers={"Authorization": f"Bearer {os.getenv('OPENAI_API_KEY')}""}
    )
    return [item["embedding"] for item in response.json()["data"]]

# Batch embed, then insert
embeddings = get_embeddings_batch(texts)

with articles.batch.dynamic() as batch:
    for i, item in enumerate(items):
        batch.add_object(
            properties=item,
            vector={"custom_embedding": embeddings[i]}
        )
```

---

## Common Patterns

### Pattern 1: Multi-Stage Filtering

Combine multiple named vectors for efficient filtering:

```python
def multi_stage_search(query: str):
    """
    Stage 1: Quick filter using fast vector
    Stage 2: Re-rank using comprehensive vector
    """
    # Stage 1: Quick initial filter
    initial_results = collection.query.near_text(
        query=query,
        limit=50,  # Get more candidates
        target_vector="title_vector"
    )

    # Stage 2: Re-rank top candidates
    candidate_ids = [str(obj.uuid) for obj in initial_results.objects]

    reranked = collection.query.near_text(
        query=query,
        limit=10,
        target_vector="content_vector",
        where={
            "path": ["id"],
            "operator": "ContainsAny",
            "valueText": candidate_ids
        }
    )

    return reranked
```

### Pattern 2: Contextual Search

Switch vectors based on context:

```python
def contextual_search(query: str, context: str):
    """
    Choose vector based on context
    - 'title': Focus on titles
    - 'content': Focus on content
    - 'balanced': Use both
    """
    vector_selection = {
        "title": "title_vector",
        "content": "content_vector",
        "balanced": TargetVectors.average(["title_vector", "content_vector"])
    }

    return collection.query.near_text(
        query=query,
        target_vector=vector_selection.get(context, "title_vector"),
        limit=10
    )
```

### Pattern 3: Vector-Based Recommendations

Use vectors to find related content:

```python
def get_related_articles(article_id: str):
    """Find articles similar to a given article"""
    # Get the target article
    target = collection.query.by_id(article_id)

    if not target:
        return []

    # Use it as a query
    return collection.query.near_vector(
        near_vector=target.objects[0].vector["content_vector"],
        limit=5,
        target_vector="content_vector",
        where={
            "path": ["id"],
            "operator": "NotEqual",
            "valueText": article_id
        }
    )
```

### Pattern 4: Combining Different Vector Spaces

```python
def semantic_and_lexical_search(query: str):
    """
    Combine semantic (vector) and lexical (keyword) search
    """
    # Semantic search
    semantic = collection.query.near_text(
        query=query,
        target_vector="content_vector",
        limit=20,
        return_metadata=MetadataQuery(distance=True)
    )

    # Keyword search
    keyword = collection.query.bm25(
        query=query,
        limit=20,
        return_metadata=MetadataQuery(score=True)
    )

    # Combine and deduplicate
    results = {}
    for obj in semantic.objects:
        results[str(obj.uuid)] = {
            "object": obj,
            "semantic_score": 1 - obj.metadata.distance,
            "keyword_score": 0
        }

    for obj in keyword.objects:
        obj_id = str(obj.uuid)
        if obj_id in results:
            results[obj_id]["keyword_score"] = obj.metadata.score
        else:
            results[obj_id] = {
                "object": obj,
                "semantic_score": 0,
                "keyword_score": obj.metadata.score
            }

    # Score and rank
    for data in results.values():
        data["combined_score"] = (
            0.7 * data["semantic_score"] + 0.3 * data["keyword_score"]
        )

    return sorted(
        results.values(),
        key=lambda x: x["combined_score"],
        reverse=True
    )[:10]
```

---

## Summary Table: Named Vectors Features

| Feature | Configuration | Querying | Notes |
|---------|---------------|----------|-------|
| **Multiple Vectorizers** | Via `vector_config` | Specify `target_vector` | Each vector can use different model |
| **Custom Vectors** | `Configure.Vectors.self_provided()` | Provide in `vector` dict | Full control, no API calls |
| **Vector Indexes** | Custom `VectorIndexConfig` | Automatic | HNSW or FLAT per vector |
| **Compression** | Via `Quantizer` in index config | Transparent | Reduces memory, minimal accuracy loss |
| **Multi-Vector Search** | List of vector names | `TargetVectors.*()` methods | Average, sum, min, max, weighted |
| **Join Strategies** | N/A | `TargetVectors.*()` | average, sum, min, max, weighted |
| **Batch Operations** | Standard batch API | Works with named vectors | Use `batch.dynamic()` |
| **Vector Properties** | Via `source_properties` | Automatic selection | Which properties vectorize |

---

## References

- [Weaviate Named Vectors Documentation](https://docs.weaviate.io/weaviate/manage-collections/vector-config)
- [Multiple Target Vectors](https://docs.weaviate.io/weaviate/search/multi-vector)
- [Python Client API](https://docs.weaviate.io/weaviate/client-libraries/python)
- [Vector Configuration Reference](https://docs.weaviate.io/weaviate/config-refs/schema/multi-vector)
- [Weaviate Academy - Named Vectors](https://docs.weaviate.io/academy/py/named_vectors)
