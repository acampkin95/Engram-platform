# Weaviate Vector Indexing Configuration - Python v4 Client Guide

A comprehensive guide to configuring vector indexes in Weaviate using the Python v4 client, covering HNSW, Flat, and Dynamic index types with distance metrics and quantization strategies.

## Table of Contents

1. [Overview](#overview)
2. [HNSW Index Configuration](#hnsw-index-configuration)
3. [Flat Index Configuration](#flat-index-configuration)
4. [Dynamic Index Configuration](#dynamic-index-configuration)
5. [Distance Metrics](#distance-metrics)
6. [Quantization Strategies](#quantization-strategies)
7. [Index Selection Guide](#index-selection-guide)
8. [Performance Tuning](#performance-tuning)

---

## Overview

Weaviate supports three vector index types, each suited for different use cases:

- **HNSW** (Hierarchical Navigable Small World): Default index for large-scale datasets with logarithmic search time complexity
- **Flat**: Simple, memory-efficient index for small datasets with linear search time complexity
- **Dynamic**: Automatically switches from Flat to HNSW as data grows beyond a threshold

### Import Statements

```python
from weaviate.classes.config import Configure, VectorDistances, VectorFilterStrategy
from weaviate.collections.classes.config_vector_index import (
    _VectorIndexConfigHNSWCreate,
    _VectorIndexConfigFlatCreate,
    _VectorIndexConfigDynamicCreate,
)
```

---

## HNSW Index Configuration

### Overview

HNSW is a graph-based index optimized for fast similarity search in high-dimensional spaces. It builds a multi-layer navigable small world graph during indexing and maintains logarithmic query time complexity.

### Key Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `ef` | int | 128 | Size of the dynamic list used during search. Use -1 for dynamic ef. |
| `ef_construction` | int | 128 | Size of the dynamic list used during index construction. |
| `max_connections` | int | 16 | Maximum number of connections per node in the HNSW graph. |
| `distance_metric` | VectorDistances | COSINE | Similarity metric for vector comparison. |
| `dynamic_ef_min` | int | 10 | Minimum threshold for dynamic ef adjustment. |
| `dynamic_ef_max` | int | 500 | Maximum threshold for dynamic ef adjustment. |
| `dynamic_ef_factor` | int | 8 | Multiplier for dynamic ef calculation. |
| `vector_cache_max_objects` | int | 1000000 | Maximum vectors to keep in memory cache. |
| `flat_search_cutoff` | int | 10000 | Switches to flat search for small result sets. |
| `filter_strategy` | VectorFilterStrategy | SWEEPING | Strategy for filtering: SWEEPING or AGGRESSIVE. |
| `cleanup_interval_seconds` | int | 300 | Interval for HNSW graph cleanup operations. |

### Basic HNSW Configuration

```python
from weaviate.classes.config import Configure, Property, DataType

client.collections.create(
    name="Articles",
    vector_config=Configure.Vectors.text2vec_openai(
        name="default",
        source_properties=["title", "body"],
        vector_index_config=Configure.VectorIndex.hnsw(),
    ),
    properties=[
        Property(name="title", data_type=DataType.TEXT),
        Property(name="body", data_type=DataType.TEXT),
    ],
)
```

### HNSW with Distance Metric Configuration

```python
from weaviate.classes.config import Configure, VectorDistances

client.collections.create(
    name="SemanticSearch",
    vector_config=Configure.Vectors.text2vec_cohere(
        name="default",
        vector_index_config=Configure.VectorIndex.hnsw(
            distance_metric=VectorDistances.COSINE,
        ),
    ),
)
```

### HNSW with Performance Tuning

```python
from weaviate.classes.config import (
    Configure,
    VectorDistances,
    VectorFilterStrategy,
)

client.collections.create(
    name="LargeScaleSearch",
    vector_config=Configure.Vectors.text2vec_openai(
        name="default",
        vector_index_config=Configure.VectorIndex.hnsw(
            ef_construction=300,          # Higher = better quality, slower build
            max_connections=32,            # Higher = more memory but better search
            distance_metric=VectorDistances.COSINE,
            dynamic_ef_min=20,             # Start with higher dynamic ef
            dynamic_ef_max=800,            # Allow more exploration during search
            dynamic_ef_factor=10,          # Aggressive dynamic adjustment
            vector_cache_max_objects=2000000,  # Cache more vectors
            filter_strategy=VectorFilterStrategy.SWEEPING,
        ),
    ),
)
```

### HNSW with Binary Quantization

```python
from weaviate.classes.config import Configure

client.collections.create(
    name="CompressedSearch",
    vector_config=Configure.Vectors.text2vec_openai(
        name="default",
        vector_index_config=Configure.VectorIndex.hnsw(
            distance_metric=VectorDistances.COSINE,
            quantizer=Configure.VectorIndex.Quantizer.bq(
                cache=True,
                rescore_limit=1000,
            ),
        ),
    ),
)
```

### HNSW with Product Quantization

```python
from weaviate.classes.config import Configure

client.collections.create(
    name="ProductQuantizedSearch",
    vector_config=Configure.Vectors.text2vec_openai(
        name="default",
        vector_index_config=Configure.VectorIndex.hnsw(
            distance_metric=VectorDistances.DOT,
            quantizer=Configure.VectorIndex.Quantizer.pq(
                bit_compression=True,
                centroids=256,              # Number of centroids
                segments=32,                # Vector segments
                training_limit=100000,      # Training data limit
                encoder_type="kmeans",
                encoder_distribution="best",
            ),
        ),
    ),
)
```

### HNSW with Scalar Quantization

```python
from weaviate.classes.config import Configure

client.collections.create(
    name="ScalarQuantizedSearch",
    vector_config=Configure.Vectors.text2vec_openai(
        name="default",
        vector_index_config=Configure.VectorIndex.hnsw(
            distance_metric=VectorDistances.L2_SQUARED,
            quantizer=Configure.VectorIndex.Quantizer.sq(
                cache=True,
                rescore_limit=500,
                training_limit=10000,
            ),
        ),
    ),
)
```

### Updating HNSW Configuration

```python
from weaviate.collections.classes.config import Reconfigure

# Update existing HNSW index
collection.config.update(
    vector_index_config=Reconfigure.hnsw(
        ef=200,
        dynamic_ef_max=800,
        vector_cache_max_objects=500000,
        quantizer=Reconfigure.quantizer.bq(
            cache=True,
            rescore_limit=1500,
        ),
    )
)
```

---

## Flat Index Configuration

### Overview

The Flat index performs exhaustive search over all vectors, making it ideal for small datasets where memory footprint is critical. It has linear search time complexity but minimal memory overhead.

### Key Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `distance_metric` | VectorDistances | COSINE | Similarity metric for vector comparison. |
| `vector_cache_max_objects` | int | 1000000 | Maximum vectors to keep in memory. |
| `quantizer` | Optional | None | Quantization strategy (BQ, SQ, PQ, RQ). |

### Basic Flat Configuration

```python
from weaviate.classes.config import Configure

client.collections.create(
    name="SmallDataset",
    vector_config=Configure.Vectors.text2vec_openai(
        name="default",
        vector_index_config=Configure.VectorIndex.flat(),
    ),
)
```

### Flat with Distance Metric

```python
from weaviate.classes.config import Configure, VectorDistances

client.collections.create(
    name="SmallSemanticDB",
    vector_config=Configure.Vectors.text2vec_openai(
        name="default",
        vector_index_config=Configure.VectorIndex.flat(
            distance_metric=VectorDistances.COSINE,
            vector_cache_max_objects=50000,
        ),
    ),
)
```

### Flat with Binary Quantization (Recommended for Small Datasets)

```python
from weaviate.classes.config import Configure

client.collections.create(
    name="CompactSmallDataset",
    vector_config=Configure.Vectors.text2vec_openai(
        name="default",
        vector_index_config=Configure.VectorIndex.flat(
            distance_metric=VectorDistances.COSINE,
            quantizer=Configure.VectorIndex.Quantizer.bq(
                cache=True,
                rescore_limit=100,
            ),
        ),
    ),
)
```

### Updating Flat Configuration

```python
from weaviate.collections.classes.config import Reconfigure

collection.config.update(
    vector_index_config=Reconfigure.flat(
        vector_cache_max_objects=100000,
        quantizer=Reconfigure.quantizer.bq(rescore_limit=200),
    )
)
```

---

## Dynamic Index Configuration

### Overview

The Dynamic index automatically switches from Flat to HNSW as the collection grows beyond a defined threshold. This is ideal for multi-tenant scenarios or datasets with unpredictable growth patterns.

### Key Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `threshold` | int | 10000 | Vector count at which to switch from Flat to HNSW. |
| `flat` | _VectorIndexConfigFlatCreate | None | Flat index configuration. |
| `hnsw` | _VectorIndexConfigHNSWCreate | None | HNSW index configuration. |

### Basic Dynamic Configuration

```python
from weaviate.classes.config import Configure

client.collections.create(
    name="AdaptiveIndex",
    vector_config=Configure.Vectors.text2vec_openai(
        name="default",
        vector_index_config=Configure.VectorIndex.dynamic(
            threshold=10000,  # Switch at 10k vectors
        ),
    ),
)
```

### Dynamic with Configured Flat and HNSW

```python
from weaviate.classes.config import Configure, VectorDistances

client.collections.create(
    name="MultiTenantDB",
    vector_config=Configure.Vectors.text2vec_openai(
        name="default",
        vector_index_config=Configure.VectorIndex.dynamic(
            threshold=50000,
            flat=Configure.VectorIndex.flat(
                distance_metric=VectorDistances.COSINE,
                vector_cache_max_objects=10000,
            ),
            hnsw=Configure.VectorIndex.hnsw(
                ef_construction=200,
                max_connections=32,
                distance_metric=VectorDistances.COSINE,
            ),
        ),
    ),
)
```

### Dynamic with Quantization

```python
from weaviate.classes.config import Configure

client.collections.create(
    name="CompressedAdaptiveIndex",
    vector_config=Configure.Vectors.text2vec_openai(
        name="default",
        vector_index_config=Configure.VectorIndex.dynamic(
            threshold=20000,
            flat=Configure.VectorIndex.flat(
                distance_metric=VectorDistances.COSINE,
                quantizer=Configure.VectorIndex.Quantizer.bq(cache=True),
            ),
            hnsw=Configure.VectorIndex.hnsw(
                distance_metric=VectorDistances.COSINE,
                quantizer=Configure.VectorIndex.Quantizer.pq(
                    centroids=256,
                    segments=32,
                ),
            ),
        ),
    ),
)
```

### Updating Dynamic Configuration

```python
from weaviate.collections.classes.config import Reconfigure

collection.config.update(
    vector_index_config=Reconfigure.dynamic(
        threshold=75000,
        hnsw=Reconfigure.hnsw(ef=150),
    )
)
```

---

## Distance Metrics

Distance metrics determine how vector similarity is calculated. Choosing the correct metric is crucial for search quality.

### Supported Metrics

```python
from weaviate.classes.config import VectorDistances

# All available distance metrics
VectorDistances.COSINE        # Cosine similarity (default, normalized vectors)
VectorDistances.DOT           # Dot product (faster, not normalized)
VectorDistances.L2_SQUARED    # Euclidean distance (dimension-aware)
VectorDistances.HAMMING       # Hamming distance (binary vectors)
VectorDistances.MANHATTAN     # Manhattan distance (grid-like spaces)
```

### Metric Selection Guide

| Metric | Use Case | When to Use | Model Examples |
|--------|----------|------------|-----------------|
| **COSINE** | General semantic search | When comparing normalized embeddings | OpenAI, Cohere, HuggingFace |
| **DOT** | Fast semantic search | When vectors are unit-normalized; optimized for speed | Voyage AI, custom normalized models |
| **L2_SQUARED** | Pixel/spatial data | When working with image embeddings or coordinate spaces | CLIP, spatial embeddings |
| **HAMMING** | Binary vectors | When using binarized embeddings | Binary quantization outputs |
| **MANHATTAN** | Grid-like spaces | For city-block distances, rare in ML | Geographic coordinates |

### Metric Configuration Examples

```python
from weaviate.classes.config import Configure, VectorDistances

# Cosine distance (default, most common)
client.collections.create(
    name="CosineSearch",
    vector_config=Configure.Vectors.text2vec_openai(
        name="default",
        vector_index_config=Configure.VectorIndex.hnsw(
            distance_metric=VectorDistances.COSINE,
        ),
    ),
)

# Dot product (faster alternative)
client.collections.create(
    name="DotProductSearch",
    vector_config=Configure.Vectors.voyageai(
        name="default",
        vector_index_config=Configure.VectorIndex.hnsw(
            distance_metric=VectorDistances.DOT,
        ),
    ),
)

# L2 distance for spatial data
client.collections.create(
    name="SpatialSearch",
    vector_config=Configure.Vectors.multi2vec_clip(
        name="default",
        vector_index_config=Configure.VectorIndex.hnsw(
            distance_metric=VectorDistances.L2_SQUARED,
        ),
    ),
)
```

---

## Quantization Strategies

Quantization reduces vector size and memory footprint while maintaining search quality. Essential for large-scale deployments.

### Overview

| Quantization Type | Compression | Use Case | Memory Reduction | Quality Loss |
|-------------------|-------------|----------|-----------------|--------------|
| **BQ** (Binary) | 32x | Memory-critical, fast search | 32x reduction | 2-5% recall loss |
| **SQ** (Scalar) | 8x | Balanced compression | 8x reduction | < 1% recall loss |
| **PQ** (Product) | 4-8x | Large vectors, fine control | 4-8x reduction | Configurable |
| **RQ** (Rotational) | 4x | Best quality without training | 4x reduction | < 1% recall loss |

### Binary Quantization (BQ)

Binary Quantization converts each vector dimension from 32-bit float to 1-bit binary, achieving 32x memory reduction.

**Advantages:**
- Maximum compression (32x)
- Fastest search with binary operations
- No training required

**Disadvantages:**
- Slight accuracy trade-off (2-5% recall loss)
- Best for already-normalized embeddings

```python
from weaviate.classes.config import Configure

# BQ with HNSW
client.collections.create(
    name="BinaryQuantizedHNSW",
    vector_config=Configure.Vectors.text2vec_openai(
        name="default",
        vector_index_config=Configure.VectorIndex.hnsw(
            quantizer=Configure.VectorIndex.Quantizer.bq(
                cache=True,           # Cache full vectors during search
                rescore_limit=1000,   # Rescore top 1000 candidates
            ),
        ),
    ),
)

# BQ with Flat index (recommended for small datasets)
client.collections.create(
    name="CompactSmallDB",
    vector_config=Configure.Vectors.text2vec_openai(
        name="default",
        vector_index_config=Configure.VectorIndex.flat(
            quantizer=Configure.VectorIndex.Quantizer.bq(
                cache=True,
                rescore_limit=100,
            ),
        ),
    ),
)
```

**Configuration Parameters:**
- `cache` (bool): Enable caching of full vectors for rescoring
- `rescore_limit` (int): Number of candidates to rescore with full vectors (10-10000)

### Scalar Quantization (SQ)

Scalar Quantization reduces 32-bit floats to lower precision (typically 8-bit), achieving ~4x compression with minimal accuracy loss.

**Advantages:**
- Good balance between compression and quality
- Minimal training required
- < 1% recall loss

**Disadvantages:**
- Slightly slower than BQ
- Requires training on sample data

```python
from weaviate.classes.config import Configure

client.collections.create(
    name="ScalarQuantized",
    vector_config=Configure.Vectors.text2vec_openai(
        name="default",
        vector_index_config=Configure.VectorIndex.hnsw(
            quantizer=Configure.VectorIndex.Quantizer.sq(
                cache=True,
                rescore_limit=500,
                training_limit=10000,  # Use first 10k vectors for training
            ),
        ),
    ),
)
```

**Configuration Parameters:**
- `cache` (bool): Enable caching of full vectors
- `rescore_limit` (int): Candidates to rescore (100-10000)
- `training_limit` (int): Vectors used for training (1000-100000)

### Product Quantization (PQ)

Product Quantization divides vectors into segments and quantizes each independently, offering fine-grained compression control.

**Advantages:**
- Highly configurable compression
- Asymmetric distance calculation (query vectors remain full precision)
- Good for very large vectors

**Disadvantages:**
- Requires more configuration
- Training phase needed
- Slower than BQ/SQ

```python
from weaviate.classes.config import Configure

client.collections.create(
    name="ProductQuantized",
    vector_config=Configure.Vectors.text2vec_openai(
        name="default",
        vector_index_config=Configure.VectorIndex.hnsw(
            quantizer=Configure.VectorIndex.Quantizer.pq(
                bit_compression=True,      # Further compress centroids
                centroids=256,             # Codebook size (128-512)
                segments=32,               # Vector segments (8-128)
                training_limit=100000,     # Training data
                encoder_type="kmeans",     # Encoding algorithm
                encoder_distribution="best",  # Distribution strategy
            ),
        ),
    ),
)
```

**Configuration Parameters:**
- `bit_compression` (bool): Enable bit compression on centroids
- `centroids` (int): Codebook size (128-512, larger = better quality)
- `segments` (int): Number of segments (8-128, more = better compression)
- `training_limit` (int): Training sample size (10000-1000000)
- `encoder_type` (str): "kmeans" (default) or custom encoder
- `encoder_distribution` (str): "best", "uniform", or "normal"

### Rotational Quantization (RQ)

Rotational Quantization rotates vectors to align with principal components before quantization, achieving good compression without training.

**Advantages:**
- Automatic parameter tuning
- No training required
- Good quality (98-99% recall)
- Works well out-of-the-box

**Disadvantages:**
- Newer technique (limited model support)

```python
from weaviate.classes.config import Configure

client.collections.create(
    name="RotationalQuantized",
    vector_config=Configure.Vectors.text2vec_openai(
        name="default",
        vector_index_config=Configure.VectorIndex.hnsw(
            quantizer=Configure.VectorIndex.Quantizer.rq(
                cache=True,
                bits=8,                # 1, 4, or 8 bits per dimension
                rescore_limit=500,
            ),
        ),
    ),
)
```

**Configuration Parameters:**
- `cache` (bool): Enable caching
- `bits` (int): Bits per dimension (1, 4, or 8)
- `rescore_limit` (int): Candidates to rescore (100-10000)

### Multi-Vector Configuration with Quantization

```python
from weaviate.classes.config import Configure

client.collections.create(
    name="MultiVectorCompressed",
    vector_config=[
        Configure.Vectors.text2vec_openai(
            name="title_vector",
            source_properties=["title"],
            vector_index_config=Configure.VectorIndex.hnsw(
                quantizer=Configure.VectorIndex.Quantizer.bq(cache=True),
            ),
        ),
        Configure.Vectors.text2vec_openai(
            name="body_vector",
            source_properties=["body"],
            vector_index_config=Configure.VectorIndex.hnsw(
                quantizer=Configure.VectorIndex.Quantizer.pq(
                    centroids=256,
                    segments=32,
                ),
            ),
        ),
    ],
)
```

---

## Index Selection Guide

### Decision Tree

```
Start with Dataset Size
↓
Large (>100k vectors)?
├─→ YES: Use HNSW
│   ├─→ Memory critical? → Add Quantization
│   ├─→ Many filters? → Use aggressive filter_strategy
│   └─→ Unpredictable growth? → Consider Dynamic
└─→ NO: Small (<100k vectors)?
    ├─→ YES: Use Flat
    │   ├─→ Memory critical? → Add BQ
    │   └─→ Growth expected? → Use Dynamic
    └─→ Multi-tenant system?
        └─→ Use Dynamic with threshold
```

### Detailed Comparison

#### Use HNSW When:

1. **Large Datasets (>100k vectors)**
   ```python
   # Production semantic search with millions of documents
   client.collections.create(
       name="LargeProductCatalog",
       vector_config=Configure.Vectors.text2vec_openai(
           name="default",
           vector_index_config=Configure.VectorIndex.hnsw(
               ef_construction=200,
               max_connections=32,
               dynamic_ef_min=20,
               dynamic_ef_max=500,
           ),
       ),
   )
   ```

2. **Real-time Search Requirements**
   ```python
   # Fast query latency needed
   client.collections.create(
       name="RealtimeSearch",
       vector_config=Configure.Vectors.text2vec_openai(
           name="default",
           vector_index_config=Configure.VectorIndex.hnsw(
               ef=256,  # Larger ef for better quality
               max_connections=48,  # More connections for better paths
           ),
       ),
   )
   ```

3. **RAG and Semantic Search Applications**
   ```python
   # Retrieval-Augmented Generation at scale
   client.collections.create(
       name="RAGIndex",
       vector_config=Configure.Vectors.text2vec_openai(
           name="default",
           vector_index_config=Configure.VectorIndex.hnsw(
               distance_metric=VectorDistances.COSINE,
               ef_construction=256,
               quantizer=Configure.VectorIndex.Quantizer.pq(
                   centroids=256,
                   segments=32,
               ),
           ),
       ),
   )
   ```

#### Use Flat Index When:

1. **Small Datasets (<10k vectors)**
   ```python
   # Small, focused vector store
   client.collections.create(
       name="SmallMemoryDB",
       vector_config=Configure.Vectors.text2vec_openai(
           name="default",
           vector_index_config=Configure.VectorIndex.flat(
               vector_cache_max_objects=10000,
           ),
       ),
   )
   ```

2. **Memory-Constrained Environments**
   ```python
   # Edge deployment with minimal RAM
   client.collections.create(
       name="EdgeCompute",
       vector_config=Configure.Vectors.text2vec_openai(
           name="default",
           vector_index_config=Configure.VectorIndex.flat(
               quantizer=Configure.VectorIndex.Quantizer.bq(cache=True),
           ),
       ),
   )
   ```

3. **Multi-Tenant Systems with Small Tenants**
   ```python
   # SaaS with per-customer vector stores
   client.collections.create(
       name="TenantVectors",
       vector_config=Configure.Vectors.text2vec_openai(
           name="default",
           vector_index_config=Configure.VectorIndex.flat(
               vector_cache_max_objects=5000,
               quantizer=Configure.VectorIndex.Quantizer.bq(cache=True),
           ),
       ),
   )
   ```

#### Use Dynamic Index When:

1. **Unpredictable Growth Patterns**
   ```python
   # Dataset may grow or shrink
   client.collections.create(
       name="AdaptiveStorage",
       vector_config=Configure.Vectors.text2vec_openai(
           name="default",
           vector_index_config=Configure.VectorIndex.dynamic(
               threshold=50000,
               flat=Configure.VectorIndex.flat(
                   vector_cache_max_objects=10000,
               ),
               hnsw=Configure.VectorIndex.hnsw(
                   ef_construction=200,
                   max_connections=32,
               ),
           ),
       ),
   )
   ```

2. **Multi-Tenant SaaS Platforms**
   ```python
   # Tenants with varying data volume
   client.collections.create(
       name="SaaSVectors",
       vector_config=Configure.Vectors.text2vec_openai(
           name="default",
           vector_index_config=Configure.VectorIndex.dynamic(
               threshold=100000,
               flat=Configure.VectorIndex.flat(
                   quantizer=Configure.VectorIndex.Quantizer.bq(cache=True),
               ),
               hnsw=Configure.VectorIndex.hnsw(
                   quantizer=Configure.VectorIndex.Quantizer.pq(
                       centroids=256,
                       segments=32,
                   ),
               ),
           ),
       ),
   )
   ```

3. **Development to Production Transition**
   ```python
   # Simplifies scaling from dev to prod
   client.collections.create(
       name="DevelopmentVectors",
       vector_config=Configure.Vectors.text2vec_openai(
           name="default",
           vector_index_config=Configure.VectorIndex.dynamic(
               threshold=50000,
           ),
       ),
   )
   ```

---

## Performance Tuning

### HNSW Parameter Tuning Guide

#### ef (Search Efficiency)

Controls the size of the dynamic list during search. Higher values increase recall but slow queries.

```python
# Fast queries (high-traffic applications)
Configure.VectorIndex.hnsw(ef=64)  # Quick but less accurate

# Balanced approach (recommended)
Configure.VectorIndex.hnsw(ef=128)  # Default

# High quality (low-traffic, high-precision)
Configure.VectorIndex.hnsw(ef=512)  # Thorough search

# Dynamic ef (automatic tuning)
Configure.VectorIndex.hnsw(
    ef=-1,  # Enable dynamic ef
    dynamic_ef_min=20,
    dynamic_ef_max=500,
    dynamic_ef_factor=8,
)
```

#### ef_construction (Build Quality)

Controls index quality during construction. Higher values produce better indexes but slower builds.

```python
# Quick prototyping
Configure.VectorIndex.hnsw(ef_construction=64)

# Production index (balanced)
Configure.VectorIndex.hnsw(ef_construction=200)

# High-quality index (time permitting)
Configure.VectorIndex.hnsw(ef_construction=512)
```

#### max_connections (Graph Connectivity)

Controls node connections in HNSW graph. More connections enable better paths but use more memory.

```python
# Memory-constrained
Configure.VectorIndex.hnsw(max_connections=8)

# Balanced (recommended)
Configure.VectorIndex.hnsw(max_connections=16)

# High connectivity (large vectors or complex space)
Configure.VectorIndex.hnsw(max_connections=64)
```

### Memory Optimization Strategies

#### Strategy 1: Binary Quantization for Large Datasets

```python
# Reduces memory by 32x
client.collections.create(
    name="LargeScaleCompressed",
    vector_config=Configure.Vectors.text2vec_openai(
        name="default",
        vector_index_config=Configure.VectorIndex.hnsw(
            max_connections=16,
            ef_construction=128,
            quantizer=Configure.VectorIndex.Quantizer.bq(
                cache=True,
                rescore_limit=1000,
            ),
        ),
    ),
)
```

#### Strategy 2: Scalar Quantization for Balanced Compression

```python
# Reduces memory by 4x with minimal quality loss
client.collections.create(
    name="BalancedCompression",
    vector_config=Configure.Vectors.text2vec_openai(
        name="default",
        vector_index_config=Configure.VectorIndex.hnsw(
            quantizer=Configure.VectorIndex.Quantizer.sq(
                cache=True,
                rescore_limit=500,
                training_limit=10000,
            ),
        ),
    ),
)
```

#### Strategy 3: Rotational Quantization (Training-Free)

```python
# No training required, 4x compression
client.collections.create(
    name="AutoCompressed",
    vector_config=Configure.Vectors.text2vec_openai(
        name="default",
        vector_index_config=Configure.VectorIndex.hnsw(
            quantizer=Configure.VectorIndex.Quantizer.rq(
                cache=True,
                bits=8,
                rescore_limit=500,
            ),
        ),
    ),
)
```

#### Strategy 4: Vector Cache Tuning

```python
# Tune vector cache for available RAM
client.collections.create(
    name="CacheTuned",
    vector_config=Configure.Vectors.text2vec_openai(
        name="default",
        vector_index_config=Configure.VectorIndex.hnsw(
            vector_cache_max_objects=500000,  # Adjust based on RAM
            ef_construction=200,
        ),
    ),
)
```

### Monitoring and Adjusting Configuration

```python
# Get current collection configuration
collection = client.collections.get("MyCollection")
config = collection.config

# Update HNSW parameters
collection.config.update(
    vector_index_config=Reconfigure.hnsw(
        ef=256,  # Increase for better quality
        vector_cache_max_objects=2000000,  # Increase if memory available
    )
)

# Update quantizer settings
collection.config.update(
    vector_index_config=Reconfigure.hnsw(
        quantizer=Reconfigure.quantizer.bq(
            cache=True,
            rescore_limit=1500,
        ),
    )
)
```

---

## Complete Examples

### Example 1: High-Performance Semantic Search

```python
from weaviate.classes.config import Configure, Property, DataType, VectorDistances

# Large-scale semantic search with performance optimization
client.collections.create(
    name="SemanticArticles",
    vector_config=Configure.Vectors.text2vec_openai(
        name="default",
        source_properties=["title", "body"],
        vector_index_config=Configure.VectorIndex.hnsw(
            distance_metric=VectorDistances.COSINE,
            ef_construction=300,
            max_connections=32,
            ef=256,
            dynamic_ef_min=20,
            dynamic_ef_max=500,
            dynamic_ef_factor=10,
            vector_cache_max_objects=2000000,
            quantizer=Configure.VectorIndex.Quantizer.pq(
                bit_compression=True,
                centroids=256,
                segments=32,
                training_limit=100000,
            ),
        ),
    ),
    properties=[
        Property(name="title", data_type=DataType.TEXT),
        Property(name="body", data_type=DataType.TEXT),
        Property(name="published_date", data_type=DataType.DATE),
    ],
)
```

### Example 2: Memory-Efficient Small Dataset

```python
from weaviate.classes.config import Configure, Property, DataType

# Compact storage for small datasets
client.collections.create(
    name="LocalKnowledgeBase",
    vector_config=Configure.Vectors.text2vec_openai(
        name="default",
        vector_index_config=Configure.VectorIndex.flat(
            distance_metric=VectorDistances.COSINE,
            vector_cache_max_objects=10000,
            quantizer=Configure.VectorIndex.Quantizer.bq(
                cache=True,
                rescore_limit=100,
            ),
        ),
    ),
    properties=[
        Property(name="text", data_type=DataType.TEXT),
        Property(name="category", data_type=DataType.TEXT),
    ],
)
```

### Example 3: Adaptive Multi-Tenant System

```python
from weaviate.classes.config import Configure, Property, DataType

# Auto-scales with tenant data growth
client.collections.create(
    name="TenantEmbeddings",
    vector_config=Configure.Vectors.text2vec_openai(
        name="default",
        vector_index_config=Configure.VectorIndex.dynamic(
            threshold=100000,
            flat=Configure.VectorIndex.flat(
                distance_metric=VectorDistances.COSINE,
                vector_cache_max_objects=20000,
                quantizer=Configure.VectorIndex.Quantizer.bq(cache=True),
            ),
            hnsw=Configure.VectorIndex.hnsw(
                distance_metric=VectorDistances.COSINE,
                ef_construction=200,
                max_connections=24,
                quantizer=Configure.VectorIndex.Quantizer.pq(
                    centroids=256,
                    segments=32,
                ),
            ),
        ),
    ),
    properties=[
        Property(name="tenant_id", data_type=DataType.TEXT),
        Property(name="content", data_type=DataType.TEXT),
    ],
)
```

### Example 4: Multi-Vector with Different Index Types

```python
from weaviate.classes.config import Configure, Property, DataType

# Different index strategies for different vector types
client.collections.create(
    name="MultimodalSearch",
    vector_config=[
        Configure.Vectors.text2vec_openai(
            name="text_vector",
            source_properties=["title", "description"],
            vector_index_config=Configure.VectorIndex.hnsw(
                ef_construction=200,
                quantizer=Configure.VectorIndex.Quantizer.pq(
                    centroids=256,
                    segments=32,
                ),
            ),
        ),
        Configure.Vectors.multi2vec_clip(
            name="image_vector",
            image_fields=["image"],
            text_fields=["title"],
            vector_index_config=Configure.VectorIndex.hnsw(
                distance_metric=VectorDistances.L2_SQUARED,
                ef_construction=150,
                quantizer=Configure.VectorIndex.Quantizer.sq(
                    cache=True,
                    rescore_limit=500,
                ),
            ),
        ),
    ],
    properties=[
        Property(name="title", data_type=DataType.TEXT),
        Property(name="description", data_type=DataType.TEXT),
        Property(name="image", data_type=DataType.BLOB),
    ],
)
```

---

## Key Takeaways

1. **HNSW**: Default choice for large datasets (>100k vectors)
2. **Flat**: Best for small datasets (<10k vectors) with minimal memory footprint
3. **Dynamic**: Ideal for unpredictable growth or multi-tenant systems
4. **Quantization**: Essential for production deployments to reduce memory usage
5. **Distance Metric**: Choose based on embedding model provider recommendations
6. **Tuning**: Balance between search quality, query latency, and memory usage

---

## References

- [Weaviate Vector Index Documentation](https://docs.weaviate.io/weaviate/config-refs/indexing/vector-index)
- [Vector Configuration Guide](https://docs.weaviate.io/weaviate/manage-collections/vector-config)
- [Vector Indexing Deep Dive](https://docs.weaviate.io/weaviate/tutorials/vector-indexing-deep-dive)
- [Compression and Quantization](https://docs.weaviate.io/weaviate/concepts/vector-quantization)
- [Product Quantization (PQ) Configuration](https://docs.weaviate.io/weaviate/configuration/compression/pq-compression)
- [Scalar Quantization (SQ) Configuration](https://docs.weaviate.io/weaviate/configuration/compression/sq-compression)
- [Binary Quantization (BQ) Configuration](https://docs.weaviate.io/weaviate/configuration/compression/bq-compression)
- [Python Client Documentation](https://docs.weaviate.io/weaviate/client-libraries/python)
