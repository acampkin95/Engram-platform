# Weaviate Python v4 Client Module Configuration Guide

Comprehensive documentation for configuring vectorizer, reranker, and multi2vec modules in the Weaviate Python v4 client. This guide covers the `Configure` API patterns, module-specific options, and API key configuration.

---

## Table of Contents

1. [Overview](#overview)
2. [Text2Vec Modules](#text2vec-modules)
   - [OpenAI](#openai-text2vec)
   - [Cohere](#cohere-text2vec)
   - [HuggingFace](#huggingface-text2vec)
   - [Transformers](#transformers-text2vec)
   - [Ollama](#ollama-text2vec)
3. [Reranker Modules](#reranker-modules)
   - [Cohere Reranker](#cohere-reranker)
   - [Transformers Reranker](#transformers-reranker)
4. [Multi2Vec Modules](#multi2vec-modules)
   - [Multi2Vec-CLIP](#multi2vec-clip)
   - [Multi2Vec-BIND](#multi2vec-bind)
5. [API Key Configuration](#api-key-configuration)
6. [Module-Specific Options](#module-specific-options)
7. [Advanced Configuration Patterns](#advanced-configuration-patterns)

---

## Overview

The Weaviate Python v4 client uses the `Configure` class from `weaviate.classes.config` to define vectorizer, reranker, and vector index configurations when creating collections.

### Key Changes in v4.16.0+

Starting with Weaviate Python client v4.16.0:

- `.vectorizer_config` has been replaced with `.vector_config`
- `Configure.NamedVectors` has been replaced with `Configure.Vectors` and `Configure.MultiVectors`
- `Configure.NamedVectors.none()` and `Configure.Vectorizer.none()` have been replaced with `Configure.Vectors.self_provided()` and `Configure.MultiVectors.self_provided()`

### Basic Collection Creation Pattern

```python
from weaviate.classes.config import Configure, Property, DataType
import weaviate.classes.config as wvc

client = weaviate.connect_to_local()

client.collections.create(
    name="CollectionName",
    vector_config=Configure.Vectors.text2vec_openai(),  # or other vectorizer
    properties=[
        Property(name="title", data_type=DataType.TEXT),
        Property(name="content", data_type=DataType.TEXT),
    ]
)
```

---

## Text2Vec Modules

Text2vec modules automatically vectorize text data using external APIs or local models during import and CRUD operations.

### OpenAI (text2vec-openai)

The OpenAI text2vec module uses OpenAI's embedding models to generate vector representations of text.

#### Basic Configuration

```python
from weaviate.classes.config import Configure

vector_config = Configure.Vectors.text2vec_openai()
```

#### Advanced Configuration

```python
from weaviate.classes.config import (
    Configure, Property, DataType, VectorDistances, VectorFilterStrategy
)

client.collections.create(
    name="Article",
    vector_config=Configure.Vectors.text2vec_openai(
        name="default",
        source_properties=["title", "content"],
        model="text-embedding-3-small",  # or text-embedding-3-large
        vectorize_collection_name=False,
        vector_index_config=Configure.VectorIndex.hnsw(
            ef_construction=300,
            distance_metric=VectorDistances.COSINE,
            filter_strategy=VectorFilterStrategy.SWEEPING,
        ),
    ),
    properties=[
        Property(name="title", data_type=DataType.TEXT),
        Property(name="content", data_type=DataType.TEXT),
    ]
)
```

#### Configuration Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `name` | str | "default" | Name of the vector configuration |
| `source_properties` | list[str] | All TEXT properties | Properties to vectorize |
| `model` | str | - | OpenAI model (e.g., "text-embedding-3-small") |
| `vectorize_collection_name` | bool | False | Include collection name in vectorization |
| `base_url` | str | - | Custom OpenAI endpoint URL |
| `dimensions` | int | - | Vector dimensions (for models supporting dimension specification) |

#### API Key Configuration

Set the `OPENAI_APIKEY` environment variable or pass via headers:

```python
import os
import weaviate

client = weaviate.connect_to_local(
    headers={
        "X-OpenAI-Api-Key": os.getenv("OPENAI_APIKEY")
    }
)
```

---

### Cohere (text2vec-cohere)

The Cohere text2vec module uses Cohere's embedding API for text vectorization with support for multilingual models.

#### Basic Configuration

```python
from weaviate.classes.config import Configure

vector_config = Configure.Vectors.text2vec_cohere(
    model="embed-english-v3.0"
)
```

#### Advanced Configuration

```python
from weaviate.classes.config import Configure, VectorDistances

client.collections.create(
    name="Article",
    vector_config=Configure.Vectors.text2vec_cohere(
        name="default",
        source_properties=["title", "content"],
        model="embed-multilingual-v2.0",  # or embed-english-v3.0
        truncate="END",
        vectorize_collection_name=True,  # Note: default changed to True in recent versions
        vector_index_config=Configure.VectorIndex.hnsw(
            distance_metric=VectorDistances.COSINE,
            ef_construction=300,
        ),
    ),
    properties=[
        Property(name="title", data_type=DataType.TEXT),
        Property(name="content", data_type=DataType.TEXT),
    ]
)
```

#### Configuration Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `name` | str | "default" | Name of the vector configuration |
| `source_properties` | list[str] | All TEXT properties | Properties to vectorize |
| `model` | str | "embed-english-v3.0" | Cohere model ID |
| `truncate` | str | "END" | Truncation mode: "NONE", "START", "END" |
| `vectorize_collection_name` | bool | True | Include collection name in vectorization |
| `base_url` | str | - | Custom Cohere endpoint URL |

#### API Key Configuration

```python
import os
import weaviate

client = weaviate.connect_to_local(
    headers={
        "X-Cohere-Api-Key": os.getenv("COHERE_APIKEY")
    }
)
```

#### Supported Models

- `embed-english-v3.0` - English-only, optimized for English text
- `embed-english-light-v3.0` - Lightweight English model
- `embed-multilingual-v2.0` - Supports 100+ languages
- `embed-multilingual-light-v2.0` - Lightweight multilingual model

---

### HuggingFace (text2vec-huggingface)

The HuggingFace text2vec module provides access to embedding models through the HuggingFace Inference API.

#### Basic Configuration

```python
from weaviate.classes.config import Configure

vector_config = Configure.Vectors.text2vec_huggingface(
    model="sentence-transformers/all-MiniLM-L6-v2"
)
```

#### Advanced Configuration

```python
from weaviate.classes.config import Configure

# Using HuggingFace Inference API (cloud-hosted)
client.collections.create(
    name="Article",
    vector_config=Configure.Vectors.text2vec_huggingface(
        name="default",
        source_properties=["title", "content"],
        model="sentence-transformers/all-MiniLM-L6-v2",
        vectorize_collection_name=False,
    ),
    properties=[
        Property(name="title", data_type=DataType.TEXT),
        Property(name="content", data_type=DataType.TEXT),
    ]
)

# Using custom HuggingFace endpoint
client.collections.create(
    name="Article",
    vector_config=Configure.Vectors.text2vec_huggingface(
        name="default",
        source_properties=["title", "content"],
        endpoint_url="https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2",
        vectorize_collection_name=False,
    ),
    properties=[
        Property(name="title", data_type=DataType.TEXT),
        Property(name="content", data_type=DataType.TEXT),
    ]
)
```

#### Configuration Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `name` | str | "default" | Name of the vector configuration |
| `source_properties` | list[str] | All TEXT properties | Properties to vectorize |
| `model` | str | - | HuggingFace model ID (e.g., "sentence-transformers/all-MiniLM-L6-v2") |
| `endpoint_url` | str | - | Custom endpoint URL for self-hosted models |
| `vectorize_collection_name` | bool | False | Include collection name in vectorization |

#### API Key Configuration

```python
import os
import weaviate

client = weaviate.connect_to_local(
    headers={
        "X-HuggingFace-Api-Key": os.getenv("HUGGINGFACE_APIKEY")
    }
)
```

#### Popular Models

- `sentence-transformers/all-MiniLM-L6-v2` - Fast, lightweight (384 dimensions)
- `sentence-transformers/all-mpnet-base-v2` - High quality (768 dimensions)
- `sentence-transformers/multilingual-MiniLM-L12-v2` - Multilingual (384 dimensions)
- `sentence-transformers/paraphrase-multilingual-mpnet-base-v2` - Multilingual, high quality (768 dimensions)

---

### Transformers (text2vec-transformers)

The Transformers text2vec module uses locally hosted HuggingFace transformer models through a containerized inference API.

#### Configuration

```python
from weaviate.classes.config import Configure

client.collections.create(
    name="Article",
    vector_config=Configure.Vectors.text2vec_transformers(
        name="default",
        source_properties=["title", "content"],
        vectorize_collection_name=False,
    ),
    properties=[
        Property(name="title", data_type=DataType.TEXT),
        Property(name="content", data_type=DataType.TEXT),
    ]
)
```

#### Environment Configuration

To use the Transformers module, set the environment variable:

```bash
# Required: Inference API endpoint
TRANSFORMERS_INFERENCE_API=http://text2vec-transformers:8080

# Optional: Enable CUDA for GPU acceleration
ENABLE_CUDA=1
```

#### Docker Compose Setup

```yaml
version: '3.4'
services:
  weaviate:
    image: semitechnologies/weaviate:latest
    environment:
      QUERY_DEFAULTS_LIMIT: 25
      AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED: 'true'
      PERSISTENCE_DATA_PATH: '/var/lib/weaviate'
      DEFAULT_VECTORIZER_MODULE: 'text2vec-transformers'
      TRANSFORMERS_INFERENCE_API: 'http://text2vec-transformers:8080'
      ENABLE_CUDA: '1'
    ports:
      - 8080:8080
    depends_on:
      - text2vec-transformers

  text2vec-transformers:
    image: semitechnologies/transformers-inference:latest
    environment:
      ENABLE_CUDA: '1'
    ports:
      - 8000:8080
```

#### Configuration Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `name` | str | "default" | Name of the vector configuration |
| `source_properties` | list[str] | All TEXT properties | Properties to vectorize |
| `vectorize_collection_name` | bool | False | Include collection name in vectorization |

#### Available Models

Models are determined by the Docker image tag. Check the [t2v-transformers-models](https://github.com/weaviate/t2v-transformers-models/releases) repository for available versions.

Common models include:
- `distilbert-base-uncased` - Fast, lightweight
- `all-MiniLM-L6-v2` - Recommended for most use cases
- `all-mpnet-base-v2` - High quality, slower

---

### Ollama (text2vec-ollama)

The Ollama text2vec module provides local inference for open-source embedding models.

#### Basic Configuration

```python
from weaviate.classes.config import Configure

client.collections.create(
    name="Article",
    vector_config=Configure.Vectors.text2vec_ollama(
        api_endpoint="http://localhost:11434",
        model="nomic-embed-text"
    ),
    properties=[
        Property(name="title", data_type=DataType.TEXT),
        Property(name="content", data_type=DataType.TEXT),
    ]
)
```

#### Advanced Configuration

```python
from weaviate.classes.config import Configure

client.collections.create(
    name="Article",
    vector_config=Configure.Vectors.text2vec_ollama(
        name="default",
        api_endpoint="http://text2vec-ollama:11434",  # For Docker: host.docker.internal:11434
        model="nomic-embed-text",
        source_properties=["title", "content"],
        vectorize_collection_name=False,
    ),
    properties=[
        Property(name="title", data_type=DataType.TEXT),
        Property(name="content", data_type=DataType.TEXT),
    ]
)
```

#### Configuration Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `api_endpoint` | str | Yes | Ollama API endpoint URL |
| `model` | str | Yes | Ollama model name (e.g., "nomic-embed-text") |
| `name` | str | No | Name of the vector configuration |
| `source_properties` | list[str] | No | Properties to vectorize |
| `vectorize_collection_name` | bool | No | Include collection name in vectorization |

#### Docker Networking

When Weaviate runs in Docker and Ollama is on the host machine:

```python
# For host.docker.internal networking
api_endpoint="http://host.docker.internal:11434"
```

#### Environment Configuration

```bash
# Enable the Ollama module
ENABLE_MODULES=text2vec-ollama

# API endpoint (if not in collection config)
OLLAMA_API_ENDPOINT=http://localhost:11434
```

#### Supported Models

Popular open-source embedding models:
- `nomic-embed-text` - Fast, efficient (768 dimensions)
- `all-minilm` - Lightweight (384 dimensions)
- `mistral` - General purpose embedding
- `neural-chat` - Conversation embeddings

---

## Reranker Modules

Reranker modules re-order search results based on relevance scoring, improving the quality of vector search results.

### Cohere Reranker

The Cohere reranker module uses Cohere's ranking API to re-rank search results.

#### Collection Configuration

```python
from weaviate.classes.config import Configure, Property, DataType

client.collections.create(
    name="Article",
    vector_config=Configure.Vectors.text2vec_openai(),
    reranker_config=Configure.Reranker.cohere(),
    properties=[
        Property(name="title", data_type=DataType.TEXT),
        Property(name="content", data_type=DataType.TEXT),
    ]
)
```

#### Advanced Configuration

```python
from weaviate.classes.config import Configure

client.collections.create(
    name="Article",
    vector_config=Configure.Vectors.text2vec_openai(),
    reranker_config=Configure.Reranker.cohere(
        model="rerank-english-v2.0"
    ),
    properties=[
        Property(name="title", data_type=DataType.TEXT),
        Property(name="content", data_type=DataType.TEXT),
    ]
)
```

#### Configuration Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `model` | str | "rerank-english-v2.0" | Cohere rerank model ID |

#### Supported Models

- `rerank-english-v2.0` - English-specific reranker
- `rerank-multilingual-v2.0` - Multilingual reranker

#### API Key Configuration

```python
import os
import weaviate

client = weaviate.connect_to_local(
    headers={
        "X-Cohere-Api-Key": os.getenv("COHERE_APIKEY")
    }
)
```

#### Using Reranking in Queries

```python
from weaviate.classes.query import Rerank, MetadataQuery

collection = client.collections.use("Article")

response = collection.query.near_text(
    query="machine learning algorithms",
    limit=10,
    rerank=Rerank(
        prop="content",
        query="supervised learning"
    ),
    return_metadata=MetadataQuery(score=True)
)

for obj in response.objects:
    print(f"Rerank score: {obj.metadata.score}")
```

---

### Transformers Reranker

The Transformers reranker module uses locally hosted HuggingFace reranking models through a containerized inference API.

#### Collection Configuration

```python
from weaviate.classes.config import Configure, Property, DataType

client.collections.create(
    name="Article",
    vector_config=Configure.Vectors.text2vec_openai(),
    reranker_config=Configure.Reranker.transformers(),
    properties=[
        Property(name="title", data_type=DataType.TEXT),
        Property(name="content", data_type=DataType.TEXT),
    ]
)
```

#### Environment Configuration

```bash
# Required: Inference API endpoint
RERANKER_INFERENCE_API=http://reranker-transformers:8080

# Module enablement
ENABLE_MODULES=reranker-transformers
```

#### Docker Compose Setup

```yaml
services:
  weaviate:
    image: semitechnologies/weaviate:latest
    environment:
      RERANKER_INFERENCE_API: 'http://reranker-transformers:8080'
      ENABLE_MODULES: 'text2vec-transformers,reranker-transformers'
    ports:
      - 8080:8080
    depends_on:
      - text2vec-transformers
      - reranker-transformers

  reranker-transformers:
    image: semitechnologies/reranker-transformers:latest
    environment:
      ENABLE_CUDA: '1'
    ports:
      - 8001:8080
```

#### Using Reranking in Queries

```python
from weaviate.classes.query import Rerank, MetadataQuery

collection = client.collections.use("Article")

response = collection.query.near_text(
    query="climate change impact",
    limit=20,
    rerank=Rerank(
        prop="content",
        query="environmental effects"
    ),
    return_metadata=MetadataQuery(score=True)
)

for obj in response.objects:
    print(f"Rerank score: {obj.metadata.score}")
```

#### Configuration Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `name` | str | "default" | Name of the reranker configuration |

---

## Multi2Vec Modules

Multi2vec modules handle multimodal data (images, text, audio, etc.), generating a single vector from multiple data types.

### Multi2Vec-CLIP

The Multi2Vec-CLIP module vectorizes images and text using OpenAI's CLIP model, creating a shared embedding space.

#### Collection Configuration

```python
from weaviate.classes.config import Configure, Property, DataType, Multi2VecField
import weaviate.classes.config as wvc

client.collections.create(
    name="MovieMM",
    vector_config=wvc.Configure.Vectors.multi2vec_clip(
        image_fields=[wvc.Multi2VecField(name="poster", weight=0.9)],
        text_fields=[wvc.Multi2VecField(name="title", weight=0.1)],
    ),
    properties=[
        Property(name="title", data_type=DataType.TEXT),
        Property(name="description", data_type=DataType.TEXT),
        Property(name="poster", data_type=DataType.BLOB),
        Property(name="release_year", data_type=DataType.INT),
    ]
)
```

#### Advanced Configuration

```python
from weaviate.classes.config import Configure, Multi2VecField
import weaviate.classes.config as wvc

client.collections.create(
    name="MovieMM",
    vector_config=wvc.Configure.Vectors.multi2vec_clip(
        name="default",
        image_fields=[
            wvc.Multi2VecField(name="poster", weight=0.9),
            wvc.Multi2VecField(name="thumbnail", weight=0.5),
        ],
        text_fields=[
            wvc.Multi2VecField(name="title", weight=0.1),
            wvc.Multi2VecField(name="description", weight=0.2),
        ],
        weights={"imageFields": 0.6, "textFields": 0.4},
    ),
    properties=[
        Property(name="title", data_type=DataType.TEXT),
        Property(name="description", data_type=DataType.TEXT),
        Property(name="poster", data_type=DataType.BLOB),
        Property(name="thumbnail", data_type=DataType.BLOB),
        Property(name="release_year", data_type=DataType.INT),
    ]
)
```

#### Configuration Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | str | Name of the vector configuration |
| `image_fields` | list[Multi2VecField] | Image properties with weights (0.0-1.0) |
| `text_fields` | list[Multi2VecField] | Text properties with weights (0.0-1.0) |
| `weights` | dict | Balance between image and text: `{"imageFields": 0.6, "textFields": 0.4}` |

#### Multi2VecField Parameters

```python
wvc.Multi2VecField(
    name="poster",        # Property name
    weight=0.9           # Importance weight (0.0-1.0)
)
```

#### Environment Configuration

```bash
# Required: Inference API endpoint
CLIP_INFERENCE_API=http://multi2vec-clip:8080

# GPU acceleration
ENABLE_CUDA=1
```

#### Docker Compose Setup

```yaml
version: '3.4'
services:
  weaviate:
    image: semitechnologies/weaviate:latest
    environment:
      CLIP_INFERENCE_API: 'http://multi2vec-clip:8080'
      ENABLE_CUDA: '1'
    ports:
      - 8080:8080
    depends_on:
      - multi2vec-clip

  multi2vec-clip:
    image: semitechnologies/multi2vec-clip:latest
    environment:
      ENABLE_CUDA: '1'
    ports:
      - 8000:8080
```

#### Inserting Data with CLIP

```python
from base64 import b64encode
from PIL import Image
import io

collection = client.collections.use("MovieMM")

# Prepare image data (encode as base64)
with open("poster.jpg", "rb") as img_file:
    img_data = b64encode(img_file.read()).decode("utf-8")

# Add object
collection.data.insert(
    properties={
        "title": "Inception",
        "description": "A mind-bending thriller about dreams",
        "poster": img_data,
        "release_year": 2010,
    }
)
```

#### Searching with CLIP

```python
# Search by image
response = collection.query.near_image(
    near_image=img_data,
    limit=5,
)

# Search by text
response = collection.query.near_text(
    query="action movie",
    limit=5,
)
```

---

### Multi2Vec-BIND

The Multi2Vec-BIND module uses Meta's ImageBind model to vectorize multiple modalities: images, text, audio, depth, IMU, thermal, and video in a shared embedding space.

#### Collection Configuration

```python
from weaviate.classes.config import Configure, Property, DataType, Multi2VecField
import weaviate.classes.config as wvc

client.collections.create(
    name="ContentMM",
    vector_config=wvc.Configure.Vectors.multi2vec_bind(
        image_fields=[wvc.Multi2VecField(name="image", weight=0.6)],
        text_fields=[wvc.Multi2VecField(name="description", weight=0.3)],
        audio_fields=[wvc.Multi2VecField(name="audio", weight=0.1)],
    ),
    properties=[
        Property(name="image", data_type=DataType.BLOB),
        Property(name="description", data_type=DataType.TEXT),
        Property(name="audio", data_type=DataType.BLOB),
        Property(name="title", data_type=DataType.TEXT),
    ]
)
```

#### Advanced Configuration with All Modalities

```python
from weaviate.classes.config import Configure, Property, DataType, Multi2VecField
import weaviate.classes.config as wvc

client.collections.create(
    name="MultimodalData",
    vector_config=wvc.Configure.Vectors.multi2vec_bind(
        name="default",
        image_fields=[wvc.Multi2VecField(name="image", weight=0.5)],
        text_fields=[wvc.Multi2VecField(name="text", weight=0.2)],
        audio_fields=[wvc.Multi2VecField(name="audio", weight=0.1)],
        video_fields=[wvc.Multi2VecField(name="video", weight=0.1)],
        depth_fields=[wvc.Multi2VecField(name="depth", weight=0.05)],
        thermal_fields=[wvc.Multi2VecField(name="thermal", weight=0.05)],
        imu_fields=[wvc.Multi2VecField(name="imu", weight=0.0)],
    ),
    properties=[
        Property(name="image", data_type=DataType.BLOB),
        Property(name="text", data_type=DataType.TEXT),
        Property(name="audio", data_type=DataType.BLOB),
        Property(name="video", data_type=DataType.BLOB),
        Property(name="depth", data_type=DataType.BLOB),
        Property(name="thermal", data_type=DataType.BLOB),
        Property(name="imu", data_type=DataType.BLOB),
    ]
)
```

#### Configuration Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | str | Name of the vector configuration |
| `image_fields` | list[Multi2VecField] | Image properties with weights |
| `text_fields` | list[Multi2VecField] | Text properties with weights |
| `audio_fields` | list[Multi2VecField] | Audio properties with weights |
| `video_fields` | list[Multi2VecField] | Video properties with weights |
| `depth_fields` | list[Multi2VecField] | Depth data properties with weights |
| `thermal_fields` | list[Multi2VecField] | Thermal data properties with weights |
| `imu_fields` | list[Multi2VecField] | IMU sensor properties with weights |

#### Environment Configuration

```bash
# Required: Inference API endpoint (with 12GB+ memory)
BIND_INFERENCE_API=http://multi2vec-bind:8080

# GPU acceleration (recommended)
ENABLE_CUDA=1

# Module enablement
ENABLE_MODULES=multi2vec-bind
```

#### Docker Compose Setup

```yaml
version: '3.4'
services:
  weaviate:
    image: semitechnologies/weaviate:latest
    environment:
      BIND_INFERENCE_API: 'http://multi2vec-bind:8080'
      ENABLE_CUDA: '1'
      ENABLE_MODULES: 'multi2vec-bind'
    ports:
      - 8080:8080
    depends_on:
      - multi2vec-bind

  multi2vec-bind:
    image: semitechnologies/multi2vec-bind:latest
    environment:
      ENABLE_CUDA: '1'
    ports:
      - 8001:8080
    deploy:
      resources:
        limits:
          memory: 12G
        reservations:
          memory: 12G
```

#### Important Notes

- **Memory Requirements**: The BIND module requires at least 12GB of memory for the container. Insufficient memory will cause inference failures.
- **GPU Recommended**: CUDA support is strongly recommended for practical performance.
- **Auto-Schema Incompatibility**: Cannot be used with auto-schema; collections must be defined manually.

#### Inserting Multimodal Data

```python
from base64 import b64encode

collection = client.collections.use("ContentMM")

# Encode media files as base64
with open("image.jpg", "rb") as f:
    image_data = b64encode(f.read()).decode("utf-8")

with open("audio.wav", "rb") as f:
    audio_data = b64encode(f.read()).decode("utf-8")

# Insert object with multiple modalities
collection.data.insert(
    properties={
        "image": image_data,
        "description": "A beautiful sunset over mountains",
        "audio": audio_data,
        "title": "Nature Scene",
    }
)
```

#### Cross-Modal Search

```python
# Search by image
response = collection.query.near_image(
    near_image=image_data,
    limit=5,
)

# Search by text (will find similar images/audio/video)
response = collection.query.near_text(
    query="sunset landscape",
    limit=5,
)

# Search by audio
response = collection.query.near_audio(
    near_audio=audio_data,
    limit=5,
)
```

---

## API Key Configuration

### Environment Variables

All external API services use environment variables for credentials. Weaviate can read these from the environment when starting.

#### Common Environment Variables

```bash
# OpenAI
export OPENAI_APIKEY=sk-...

# Cohere
export COHERE_APIKEY=...

# HuggingFace
export HUGGINGFACE_APIKEY=hf_...

# Ollama
export OLLAMA_APIKEY=...  # if needed
```

### Python Client Header Configuration

Pass API keys via the `headers` parameter when connecting to Weaviate:

```python
import os
import weaviate

client = weaviate.connect_to_local(
    headers={
        "X-OpenAI-Api-Key": os.getenv("OPENAI_APIKEY"),
        "X-Cohere-Api-Key": os.getenv("COHERE_APIKEY"),
        "X-HuggingFace-Api-Key": os.getenv("HUGGINGFACE_APIKEY"),
    }
)
```

### Header Names by Provider

| Provider | Header Name | Environment Variable |
|----------|------------|----------------------|
| OpenAI | `X-OpenAI-Api-Key` | `OPENAI_APIKEY` |
| Cohere | `X-Cohere-Api-Key` | `COHERE_APIKEY` |
| HuggingFace | `X-HuggingFace-Api-Key` | `HUGGINGFACE_APIKEY` |
| Google PaLM | `X-Palm-Api-Key` | `PALM_APIKEY` |

### Best Practices

```python
import os
from dotenv import load_dotenv
import weaviate

# Load environment variables from .env file
load_dotenv()

# Create client with credentials
client = weaviate.connect_to_local(
    headers={
        "X-OpenAI-Api-Key": os.getenv("OPENAI_APIKEY"),
    }
)

# Never hardcode API keys!
# ❌ WRONG: client = weaviate.connect_to_local(
#               headers={"X-OpenAI-Api-Key": "sk-..."}
#           )

# ✅ RIGHT: Use environment variables
```

### Cloud Connection with Credentials

```python
import os
import weaviate

client = weaviate.connect_to_wcs(
    cluster_url=os.getenv("WEAVIATE_URL"),
    auth_credentials=weaviate.Auth.api_key(os.getenv("WEAVIATE_APIKEY")),
    headers={
        "X-OpenAI-Api-Key": os.getenv("OPENAI_APIKEY"),
    }
)
```

---

## Module-Specific Options

### Vectorizer Options Common to All Modules

```python
from weaviate.classes.config import Configure, VectorDistances, VectorFilterStrategy

config = Configure.Vectors.text2vec_openai(
    # Common parameters
    name="default",                    # Vector config name
    source_properties=["title"],       # Properties to vectorize
    vectorize_collection_name=False,   # Include collection name in vectorization

    # Vector index configuration
    vector_index_config=Configure.VectorIndex.hnsw(
        ef_construction=300,           # Construction time / quality tradeoff
        ef=64,                         # Query-time efficiency
        max_connections=32,            # Max connections per node
        skip_list_factor=1.0,          # Skip list factor
        distance_metric=VectorDistances.COSINE,  # COSINE, DOT, MANHATTAN, HAMMING
        flatten_search_cutoff=40000,   # Switch to flat search threshold
        filter_strategy=VectorFilterStrategy.SWEEPING,  # SWEEPING or ACORN
    ),
)
```

### Text2Vec Module-Specific Options

#### OpenAI-Specific

```python
Configure.Vectors.text2vec_openai(
    model="text-embedding-3-small",    # Model selection
    dimensions=1536,                   # Output vector dimensions (optional)
    base_url="https://api.openai.com/v1",  # Custom endpoint
)
```

#### Cohere-Specific

```python
Configure.Vectors.text2vec_cohere(
    model="embed-english-v3.0",
    truncate="END",                    # NONE, START, or END
    base_url="https://api.cohere.com", # Custom endpoint
)
```

#### HuggingFace-Specific

```python
Configure.Vectors.text2vec_huggingface(
    model="sentence-transformers/all-MiniLM-L6-v2",
    endpoint_url="https://api-inference.huggingface.co/models/...",  # Optional
)
```

#### Transformers-Specific

No module-specific options beyond standard vectorizer options. Configuration is entirely via environment variables.

#### Ollama-Specific

```python
Configure.Vectors.text2vec_ollama(
    api_endpoint="http://localhost:11434",  # Ollama server endpoint
    model="nomic-embed-text",              # Model name in Ollama
)
```

### Reranker Module-Specific Options

#### Cohere Reranker-Specific

```python
Configure.Reranker.cohere(
    model="rerank-english-v2.0",  # Model selection
)
```

#### Transformers Reranker-Specific

```python
Configure.Reranker.transformers()
# No model-specific options; configured via environment variables
```

### Multi2Vec Module-Specific Options

#### CLIP-Specific

```python
wvc.Configure.Vectors.multi2vec_clip(
    image_fields=[wvc.Multi2VecField(name="poster", weight=0.9)],
    text_fields=[wvc.Multi2VecField(name="title", weight=0.1)],
    weights={"imageFields": 0.6, "textFields": 0.4},  # Balance between modalities
)
```

#### BIND-Specific

```python
wvc.Configure.Vectors.multi2vec_bind(
    image_fields=[wvc.Multi2VecField(name="image", weight=0.5)],
    text_fields=[wvc.Multi2VecField(name="text", weight=0.3)],
    audio_fields=[wvc.Multi2VecField(name="audio", weight=0.2)],
    # ... other modality fields
)
```

---

## Advanced Configuration Patterns

### Creating Collections with Custom Vector Index Settings

```python
from weaviate.classes.config import (
    Configure, Property, DataType, VectorDistances, VectorFilterStrategy
)

client.collections.create(
    name="HighPerformanceCollection",
    vector_config=Configure.Vectors.text2vec_openai(
        name="default",
        source_properties=["title", "content"],
        vector_index_config=Configure.VectorIndex.hnsw(
            ef_construction=512,  # Higher = better quality, slower build
            ef=256,               # Higher = more accurate, slower queries
            max_connections=64,   # Higher = denser graph, more memory
            distance_metric=VectorDistances.COSINE,
            filter_strategy=VectorFilterStrategy.ACORN,  # Better filtering
        ),
    ),
    properties=[
        Property(name="title", data_type=DataType.TEXT),
        Property(name="content", data_type=DataType.TEXT),
    ]
)
```

### Using Multiple Vectorizers (Named Vectors)

As of Python client v4.16.0+, named vectors are configured differently. Here's the pattern:

```python
from weaviate.classes.config import Configure, Property, DataType
import weaviate.classes.config as wvc

# For multiple vectors, use Configure.Vectors (not Configure.NamedVectors)
client.collections.create(
    name="MultiVector",
    vector_config=wvc.Configure.Vectors(
        vector_configs=[
            wvc.Configure.Vectors.text2vec_openai(
                name="openai_vector",
                source_properties=["title"],
            ),
            wvc.Configure.Vectors.text2vec_cohere(
                name="cohere_vector",
                source_properties=["content"],
            ),
        ]
    ),
    properties=[
        Property(name="title", data_type=DataType.TEXT),
        Property(name="content", data_type=DataType.TEXT),
    ]
)
```

### Self-Provided Vectors (Custom Embeddings)

For bringing your own vectors:

```python
from weaviate.classes.config import Configure, Property, DataType

client.collections.create(
    name="CustomVectors",
    vector_config=Configure.Vectors.self_provided(),  # No vectorizer
    properties=[
        Property(name="title", data_type=DataType.TEXT),
        Property(name="content", data_type=DataType.TEXT),
    ]
)

# Insert with custom vectors
collection = client.collections.use("CustomVectors")
collection.data.insert(
    properties={
        "title": "Example",
        "content": "Content here",
    },
    vector=[0.1, 0.2, 0.3, ...]  # Your custom vector
)
```

### Updating Vectorizer Configuration

Update an existing collection's vectorizer (as of Weaviate v1.25.23+):

```python
from weaviate.classes.config import Reconfigure

# Update the vectorizer
client.collections.update(
    "Article",
    vectorizer_config=Reconfigure.Vectorizer.text2vec_cohere(
        model="embed-multilingual-v2.0"
    )
)

# Update the reranker
client.collections.update(
    "Article",
    reranker_config=Reconfigure.Reranker.cohere()
)
```

### Complete Collection Setup Example

```python
import os
from dotenv import load_dotenv
import weaviate
from weaviate.classes.config import (
    Configure, Property, DataType, VectorDistances
)

load_dotenv()

# Connect with API keys
client = weaviate.connect_to_local(
    headers={
        "X-OpenAI-Api-Key": os.getenv("OPENAI_APIKEY"),
    }
)

# Create collection with vectorizer and reranker
client.collections.create(
    name="Articles",
    vector_config=Configure.Vectors.text2vec_openai(
        name="default",
        source_properties=["title", "content"],
        vector_index_config=Configure.VectorIndex.hnsw(
            ef_construction=300,
            distance_metric=VectorDistances.COSINE,
        ),
    ),
    reranker_config=Configure.Reranker.cohere(),
    properties=[
        Property(name="title", data_type=DataType.TEXT),
        Property(name="content", data_type=DataType.TEXT),
        Property(name="publication_date", data_type=DataType.DATE),
        Property(name="author", data_type=DataType.TEXT),
    ]
)

# Use the collection
collection = client.collections.use("Articles")

# Insert data
collection.data.insert(
    properties={
        "title": "Advances in AI",
        "content": "Recent developments in machine learning...",
        "publication_date": "2024-01-15",
        "author": "Dr. Smith",
    }
)

# Search with reranking
from weaviate.classes.query import Rerank, MetadataQuery

results = collection.query.near_text(
    query="machine learning",
    limit=10,
    rerank=Rerank(
        prop="content",
        query="neural networks"
    ),
    return_metadata=MetadataQuery(score=True, rerank_score=True)
)

for obj in results.objects:
    print(f"Title: {obj.properties['title']}")
    print(f"Score: {obj.metadata.score}")
    print(f"Rerank Score: {obj.metadata.rerank_score}")
```

---

## Troubleshooting

### API Key Issues

**Problem**: "API key not found" or "Unauthorized" errors

**Solutions**:
```python
# 1. Verify environment variable is set
import os
print(os.getenv("OPENAI_APIKEY"))

# 2. Check headers are passed correctly
client = weaviate.connect_to_local(
    headers={
        "X-OpenAI-Api-Key": os.getenv("OPENAI_APIKEY")
    }
)

# 3. Ensure key format is correct (no spaces, valid format)
api_key = os.getenv("OPENAI_APIKEY").strip()
```

### Module Not Enabled

**Problem**: "Module not enabled" error

**Solutions**:
```bash
# Set ENABLE_MODULES environment variable
export ENABLE_MODULES=text2vec-openai,text2vec-cohere,reranker-transformers

# For Embedded Weaviate
embedded_options = weaviate.EmbeddedOptions(
    additional_env_vars={
        "ENABLE_MODULES": "text2vec-transformers"
    }
)
```

### Vectorization Timeout

**Problem**: Vectorization takes too long or times out

**Solutions**:
- For self-hosted modules (Transformers, BIND), increase container resource limits
- For cloud APIs (OpenAI, Cohere), check API rate limits
- Use `batch_size` parameter when importing large amounts of data

### Docker Networking (Weaviate in Container)

**Problem**: "Cannot reach Ollama/Transformers API from Weaviate container"

**Solution**:
```python
# Use host.docker.internal to access host machine services
Configure.Vectors.text2vec_ollama(
    api_endpoint="http://host.docker.internal:11434",
    model="nomic-embed-text"
)
```

---

## References

- [Weaviate Python Client Documentation](https://docs.weaviate.io/weaviate/client-libraries/python)
- [Module Configuration Guide](https://docs.weaviate.io/weaviate/manage-collections/vector-config)
- [Text2Vec Modules](https://docs.weaviate.io/weaviate/modules/retriever-vectorizer-modules)
- [Reranker Modules](https://docs.weaviate.io/weaviate/model-providers/transformers/reranker)
- [Multi2Vec-CLIP Documentation](https://weaviate.io/developers/weaviate/modules/retriever-vectorizer-modules/multi2vec-clip)
- [Multi2Vec-BIND Documentation](https://weaviate.io/developers/weaviate/modules/retriever-vectorizer-modules/multi2vec-bind)
- [Python Client on ReadTheDocs](https://weaviate-python-client.readthedocs.io/en/stable/)
- [Weaviate OpenAI Integration](https://docs.weaviate.io/weaviate/model-providers/openai-azure/embeddings)
- [Weaviate Cohere Integration](https://docs.cohere.com/v2/docs/weaviate-and-cohere)
- [Ollama Embeddings Guide](https://docs.weaviate.io/weaviate/model-providers/ollama/embeddings)
