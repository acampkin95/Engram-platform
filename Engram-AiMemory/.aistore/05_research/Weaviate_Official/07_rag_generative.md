# Weaviate RAG and Generative Modules - Python v4 Client Guide

Comprehensive documentation for implementing Retrieval-Augmented Generation (RAG) with Weaviate's Python v4 client, covering generative module configuration, single prompt generation, grouped task generation, RAG patterns, prompt templates, and error handling.

## Table of Contents

1. [Overview](#overview)
2. [Installation and Setup](#installation-and-setup)
3. [Generative Module Configuration](#generative-module-configuration)
4. [Single Prompt Generation](#single-prompt-generation)
5. [Grouped Task Generation](#grouped-task-generation)
6. [RAG Patterns and Best Practices](#rag-patterns-and-best-practices)
7. [Prompt Templates](#prompt-templates)
8. [Error Handling](#error-handling)
9. [Advanced Examples](#advanced-examples)

---

## Overview

Weaviate's integrated RAG capabilities combine retrieval and generation into a single query, allowing you to:

- Retrieve relevant data from your vector database
- Prompt an LLM with the retrieved context in the same query
- Generate contextually aware responses based on your data

The RAG approach improves LLM responses by providing up-to-date, truthful data from your Weaviate instance, reducing hallucinations and improving accuracy.

### Key Benefits

- **Integrated Workflow**: Retrieval and generation in a single query
- **Multiple LLM Providers**: OpenAI, Cohere, Anthropic, and more
- **Flexible Prompting**: Single prompt per object or grouped task across objects
- **Type-Safe**: Full Python type hints with v4 client
- **gRPC Performance**: v4 client uses gRPC for faster queries

---

## Installation and Setup

### Install Weaviate Python v4 Client

```bash
pip install weaviate-client>=4.0.0
```

### Connect to Weaviate

```python
import weaviate
from weaviate.auth import Auth

# Connect to Weaviate Cloud
client = weaviate.connect_to_weaviate_cloud(
    cluster_url="https://your-cluster-url.weaviate.network",
    auth_credentials=Auth.api_key("your-api-key"),
    headers={
        "X-OpenAI-Api-Key": "your-openai-api-key",  # For OpenAI
        # OR
        "X-Cohere-Api-Key": "your-cohere-api-key",  # For Cohere
        # OR
        "X-Anthropic-Api-Key": "your-anthropic-api-key",  # For Anthropic
    }
)

# Connect to local Weaviate
client = weaviate.connect_to_local(
    headers={
        "X-OpenAI-Api-Key": "your-openai-api-key"
    }
)
```

### Verify Connection

```python
try:
    ready = client.is_ready()
    print(f"Weaviate is ready: {ready}")
except Exception as e:
    print(f"Failed to connect: {e}")
finally:
    client.close()
```

---

## Generative Module Configuration

### Generative Module Overview

The generative module is configured when creating a collection, specifying which LLM provider and model to use for RAG operations. Configuration can happen at:

1. **Collection creation time** (recommended)
2. **Query time** (for dynamic provider selection)

### OpenAI Configuration

#### Basic Setup

```python
from weaviate.classes.config import Configure

client.collections.create(
    name="Articles",
    generative_config=Configure.Generative.openai()
)
```

#### Advanced Configuration

```python
from weaviate.classes.config import Configure

client.collections.create(
    name="Articles",
    generative_config=Configure.Generative.openai(
        model="gpt-4",
        temperature=0.7,
        max_tokens=500,
        frequency_penalty=0.0,
        presence_penalty=0.0,
        top_p=1.0
    )
)
```

#### OpenAI Parameters

- **model** (str): Model identifier (gpt-4, gpt-3.5-turbo, etc.)
- **temperature** (float): 0.0-2.0, controls randomness
- **max_tokens** (int): Maximum tokens in response
- **frequency_penalty** (float): -2.0-2.0, penalizes token repetition
- **presence_penalty** (float): -2.0-2.0, penalizes new topics
- **top_p** (float): 0.0-1.0, nucleus sampling parameter
- **base_url** (str): Custom OpenAI endpoint
- **api_version** (str): Azure OpenAI API version
- **resource_name** (str): Azure resource name
- **deployment_id** (str): Azure deployment ID

### Cohere Configuration

#### Basic Setup

```python
from weaviate.classes.config import Configure

client.collections.create(
    name="Articles",
    generative_config=Configure.Generative.cohere(
        model="command-r-plus"
    )
)
```

#### Advanced Configuration

```python
from weaviate.classes.config import Configure

client.collections.create(
    name="Articles",
    generative_config=Configure.Generative.cohere(
        model="command-r-plus",
        temperature=0.8,
        max_tokens=300,
        k=0.0,
        p=0.75,
        presence_penalty=0.0,
        frequency_penalty=0.0,
        stop_sequences=["STOP", "END"]
    )
)
```

#### Cohere Parameters

- **model** (str): Model identifier (command-r-plus, command-r, etc.)
- **temperature** (float): 0.0-5.0, controls randomness
- **max_tokens** (int): Maximum tokens in response
- **k** (float): Top-k sampling parameter
- **p** (float): Top-p (nucleus) sampling parameter
- **presence_penalty** (float): Presence penalty
- **frequency_penalty** (float): Frequency penalty
- **stop_sequences** (list): Sequences that trigger response termination
- **base_url** (str): Custom Cohere endpoint

### Anthropic Configuration

#### Basic Setup

```python
from weaviate.classes.config import Configure

client.collections.create(
    name="Articles",
    generative_config=Configure.Generative.anthropic()
)
```

#### Advanced Configuration

```python
from weaviate.classes.config import Configure

client.collections.create(
    name="Articles",
    generative_config=Configure.Generative.anthropic(
        model="claude-3-sonnet-20240229",
        temperature=0.7,
        max_tokens=1000,
        top_k=40,
        top_p=0.9,
        stop_sequences=["</answer>"]
    )
)
```

#### Anthropic Parameters

- **model** (str): Model identifier (claude-3-sonnet, claude-3-opus, etc.)
- **temperature** (float): 0.0-1.0, controls randomness
- **max_tokens** (int): Maximum tokens in response
- **top_k** (int): Top-k sampling
- **top_p** (float): Top-p (nucleus) sampling
- **stop_sequences** (list): Sequences that trigger response termination
- **base_url** (str): Custom Anthropic endpoint

### Runtime Provider Configuration

Override collection config at query time:

```python
from weaviate.classes.config import GenerativeConfig

collection = client.collections.get("Articles")

response = collection.generate.near_text(
    query="climate change",
    limit=3,
    generative_provider=GenerativeConfig.openai(
        model="gpt-4-turbo",
        temperature=0.9
    ),
    single_prompt="Summarize the key points: {title} - {content}"
)
```

---

## Single Prompt Generation

### Overview

Single prompt generation executes the same prompt for each retrieved object. Each object in the results receives personalized generation based on that object's properties.

**Use Cases:**
- Translating each result
- Summarizing individual items
- Extracting specific fields from each object
- Generating variations per result

### Basic Single Prompt

```python
from weaviate.classes.config import Configure

# Create collection with generative config
client.collections.create(
    name="Questions",
    generative_config=Configure.Generative.openai(
        model="gpt-3.5-turbo"
    )
)

collection = client.collections.get("Questions")

# Single prompt query
response = collection.generate.near_text(
    query="biology",
    limit=3,
    single_prompt="Translate to French: {question}"
)

# Access results
for obj in response.objects:
    print(f"Original: {obj.properties['question']}")
    print(f"Generated: {obj.generated}")
    print("---")
```

### Advanced Single Prompt with Multiple Properties

```python
collection = client.collections.get("Articles")

response = collection.generate.near_text(
    query="artificial intelligence",
    limit=5,
    single_prompt="""
Create a social media post for this article:
Title: {title}
Summary: {summary}
Author: {author}

Post (max 280 chars):
""",
    where={
        "path": "published",
        "operator": "GreaterThan",
        "valueDate": "2024-01-01T00:00:00Z"
    }
)

for obj in response.objects:
    print(f"Article: {obj.properties['title']}")
    print(f"Tweet: {obj.generated}\n")
```

### Single Prompt with Search Methods

The single prompt works with all search methods:

```python
collection = client.collections.get("Products")

# Near text
response = collection.generate.near_text(
    query="comfortable shoes",
    limit=3,
    single_prompt="Create a product description: {name} - {features}"
)

# Near vector
response = collection.generate.near_vector(
    vector=[0.1, 0.2, 0.3, ...],
    limit=3,
    single_prompt="Summarize: {description}"
)

# Near object
response = collection.generate.near_object(
    id="product-123",
    limit=3,
    single_prompt="Suggest alternatives to: {name}"
)

# Hybrid search
response = collection.generate.hybrid(
    query="waterproof backpack",
    limit=3,
    single_prompt="Write a review outline for: {name}"
)
```

### Response Structure

```python
from weaviate.classes.data import DataObject

response = collection.generate.near_text(
    query="test",
    limit=2,
    single_prompt="Summary: {content}"
)

# Response attributes
print(response.objects)  # List of DataObject instances
print(response.errors)   # Any error messages

# Each object has:
for obj in response.objects:
    print(obj.properties)   # Original object properties
    print(obj.generated)    # Generated text from single_prompt
    print(obj.metadata)     # Metadata (certainty, distance, etc.)
    print(obj.uuid)         # Object UUID
```

---

## Grouped Task Generation

### Overview

Grouped task generation processes all retrieved objects as a set and generates a single response. The prompt receives context about all results collectively.

**Use Cases:**
- Synthesizing information across multiple items
- Finding common themes
- Creating summaries of result sets
- Answering questions about the collection of results
- Comparative analysis

### Basic Grouped Task

```python
collection = client.collections.get("Questions")

response = collection.generate.near_text(
    query="science",
    limit=5,
    grouped_task="What are the common themes in these questions?"
)

print(response.generated)  # Generated text for the entire group
```

### Combined Single Prompt and Grouped Task

```python
collection = client.collections.get("Documents")

response = collection.generate.near_text(
    query="machine learning",
    limit=5,
    single_prompt="Key takeaway: {abstract}",
    grouped_task="Synthesize these documents into a research summary"
)

# Grouped generation
print("Overall Summary:")
print(response.generated)

# Individual generations
print("\nKey Takeaways:")
for obj in response.objects:
    print(f"- {obj.generated}")
```

### Grouped Task with Metadata

```python
from weaviate.classes.config import Configure

collection = client.collections.get("Articles")

response = collection.generate.near_text(
    query="climate science",
    limit=10,
    grouped_task="""
Analyze these articles and provide:
1. Main consensus
2. Areas of disagreement
3. Most recent findings
4. Recommended next steps for research
""",
    where={
        "path": "peer_reviewed",
        "operator": "Equal",
        "valueBoolean": True
    }
)

print(response.generated)
```

### Grouped Task Response Structure

```python
response = collection.generate.near_text(
    query="test",
    limit=3,
    grouped_task="Analyze this group"
)

# Top-level generated attribute
print(response.generated)  # The grouped task output

# Objects still available
for obj in response.objects:
    print(obj.properties)  # Access individual object properties
```

---

## RAG Patterns and Best Practices

### Pattern 1: Retrieval + Summarization

Retrieve relevant documents and generate a concise summary.

```python
from weaviate.classes.config import Configure

client.collections.create(
    name="Papers",
    generative_config=Configure.Generative.openai(
        model="gpt-3.5-turbo",
        temperature=0.5,
        max_tokens=300
    )
)

collection = client.collections.get("Papers")

def summarize_papers(query: str, num_papers: int = 5) -> str:
    """Summarize top papers matching a query."""
    response = collection.generate.near_text(
        query=query,
        limit=num_papers,
        grouped_task=f"""
Summarize these papers in 3-4 sentences:
- Highlight main findings
- Note methodology differences
- Identify future research directions
"""
    )
    return response.generated

summary = summarize_papers("neural networks optimization")
print(summary)
```

### Pattern 2: Question Answering with Source Attribution

Retrieve documents and generate an answer with source information.

```python
from weaviate.classes.config import Configure

client.collections.create(
    name="KnowledgeBase",
    generative_config=Configure.Generative.openai(
        model="gpt-3.5-turbo"
    )
)

collection = client.collections.get("KnowledgeBase")

def answer_with_sources(question: str) -> dict:
    """Answer a question and cite sources."""
    response = collection.generate.near_text(
        query=question,
        limit=5,
        single_prompt="Fact: {content}\nRelevance: {relevance_score}",
        grouped_task=f"""
Answer the question: "{question}"

Based on these facts, provide:
1. Direct answer
2. Supporting evidence
3. Confidence level
4. Any caveats or limitations
"""
    )

    sources = [obj.properties for obj in response.objects]
    answer = response.generated

    return {
        "answer": answer,
        "sources": sources,
        "num_sources": len(sources)
    }

result = answer_with_sources("How do transformers work in machine learning?")
print(result["answer"])
```

### Pattern 3: Hybrid Search + Semantic Generation

Combine keyword and semantic search, then generate.

```python
collection = client.collections.get("Articles")

def hybrid_rag(query: str, alpha: float = 0.5) -> str:
    """Use hybrid search (keyword + vector) for generation."""
    response = collection.generate.hybrid(
        query=query,
        alpha=alpha,  # Balance between keyword (0) and vector (1)
        limit=5,
        grouped_task=f"""
Synthesize information about: {query}

Provide:
- Definition or explanation
- Historical context
- Current applications
- Future outlook
"""
    )
    return response.generated

result = hybrid_rag("quantum computing")
print(result)
```

### Pattern 4: Filtered RAG with Business Logic

Apply metadata filters before generation.

```python
from weaviate.classes.config import Configure

collection = client.collections.get("Products")

def recent_product_insights(category: str, days: int = 30) -> str:
    """Generate insights from recent products in a category."""
    from datetime import datetime, timedelta

    cutoff_date = (datetime.now() - timedelta(days=days)).isoformat()

    response = collection.generate.near_text(
        query=category,
        limit=10,
        where={
            "operator": "And",
            "operands": [
                {
                    "path": "category",
                    "operator": "Equal",
                    "valueString": category
                },
                {
                    "path": "created_at",
                    "operator": "GreaterThan",
                    "valueDate": cutoff_date
                },
                {
                    "path": "rating",
                    "operator": "GreaterOrEqual",
                    "valueNumber": 4.0
                }
            ]
        },
        grouped_task=f"""
Analyze recent {category} products added in the last {days} days:

Key insights:
- Top features mentioned
- Common price range
- User satisfaction patterns
- Recommended product combinations
"""
    )

    return response.generated

insights = recent_product_insights("smartphones", days=14)
print(insights)
```

### Pattern 5: Multi-Step RAG Pipeline

Chain multiple RAG operations for complex tasks.

```python
class RAGPipeline:
    def __init__(self, client):
        self.client = client
        self.documents = client.collections.get("Documents")
        self.summaries = client.collections.get("Summaries")

    def execute(self, query: str) -> dict:
        """Multi-step RAG pipeline."""

        # Step 1: Initial retrieval and summarization
        initial_response = self.documents.generate.near_text(
            query=query,
            limit=10,
            single_prompt="Summary: {content}",
            grouped_task="Identify key themes"
        )

        themes = initial_response.generated

        # Step 2: Targeted retrieval based on themes
        detailed_response = self.documents.generate.near_text(
            query=themes,
            limit=5,
            grouped_task=f"Expand on these themes: {themes}"
        )

        # Step 3: Generate final synthesis
        final_response = self.documents.generate.near_text(
            query=query,
            limit=3,
            grouped_task=f"""
Final synthesis:
Initial themes: {themes}
Detailed analysis: {detailed_response.generated}

Provide comprehensive answer to: {query}
"""
        )

        return {
            "initial_themes": themes,
            "detailed_analysis": detailed_response.generated,
            "final_answer": final_response.generated
        }

pipeline = RAGPipeline(client)
result = pipeline.execute("What are emerging AI trends?")
```

### Best Practices

#### 1. Chunking Strategy

```python
def chunk_documents(text: str, chunk_size: int = 512, overlap: int = 50) -> list:
    """Split documents into overlapping chunks."""
    chunks = []
    start = 0

    while start < len(text):
        end = min(start + chunk_size, len(text))
        chunks.append(text[start:end])
        start = end - overlap

    return chunks

# Add chunked documents
text = "Your long document text..."
chunks = chunk_documents(text)

for i, chunk in enumerate(chunks):
    collection.data.create(
        properties={
            "content": chunk,
            "chunk_number": i,
            "source": "document.pdf"
        }
    )
```

#### 2. Metadata for Better Retrieval

```python
# Store rich metadata for filtering
collection.data.create(
    properties={
        "title": "Article Title",
        "content": "Article content...",
        "author": "Author Name",
        "published_date": "2024-01-15T10:00:00Z",
        "category": "Technology",
        "word_count": 2500,
        "language": "en",
        "quality_score": 0.95
    }
)
```

#### 3. Temperature Tuning

```python
# For consistent answers (e.g., factual queries)
config = Configure.Generative.openai(
    model="gpt-3.5-turbo",
    temperature=0.2  # Lower = more consistent
)

# For creative responses (e.g., brainstorming)
config = Configure.Generative.openai(
    model="gpt-3.5-turbo",
    temperature=0.8  # Higher = more creative
)
```

#### 4. Context Windows

```python
# Be mindful of token limits
config = Configure.Generative.openai(
    model="gpt-3.5-turbo",
    max_tokens=500  # Leave room for context
)

# For longer responses, use larger models
config = Configure.Generative.openai(
    model="gpt-4",
    max_tokens=2000
)
```

---

## Prompt Templates

### Basic Template Structure

```python
# Simple variable substitution
template = "Translate to French: {text}"

# Multiple properties
template = "Title: {title}\nAuthor: {author}\nSummary: {content}"

# Complex formatting
template = """
Document: {title}
Category: {category}
Create a brief overview of this {category} document
"""
```

### Advanced Template with Instructions

```python
def create_qa_template(context_limit: int = 3) -> str:
    """Create a question-answering template."""
    return f"""
Context documents:
{chr(10).join([f"{{content_{i}}}" for i in range(context_limit)])}

Question: {{question}}

Answer based on the context provided:
"""

# Usage
template = create_qa_template(context_limit=5)
```

### Template with Structured Output

```python
def create_structured_extraction_template() -> str:
    """Create a template for structured data extraction."""
    return """
Article: {title}
Content: {content}

Extract the following in JSON format:
{{
  "main_topic": "...",
  "key_points": ["..."],
  "sentiment": "positive/negative/neutral",
  "confidence": 0.0-1.0
}}
"""

template = create_structured_extraction_template()
```

### Dynamic Template Generation

```python
def build_template(fields: list, task: str) -> str:
    """Build template dynamically from fields."""
    field_section = "\n".join([f"- {field}: {{{field}}}" for field in fields])

    return f"""
Data:
{field_section}

Task: {task}
"""

template = build_template(
    fields=["title", "author", "publication_date", "content"],
    task="Summarize this article for social media"
)
```

### Template Best Practices

```python
# Good: Clear, specific instructions
good_template = """
Article: {title}
Author: {author}

Create a professional summary suitable for a business newsletter:
- 2-3 sentences maximum
- Highlight business impact
- Include key statistics if available
"""

# Avoid: Vague instructions
bad_template = "Summarize: {content}"

# Good: Examples in template
template_with_examples = """
Product: {name}
Price: {price}
Features: {features}

Create a 1-sentence marketing tagline. Examples:
- "Enterprise-grade performance, consumer-friendly price"
- "Security and simplicity, combined"

Tagline:
"""
```

### Template Variables and Escaping

```python
# Single braces for property substitution
template = "Translate: {text}"

# Use raw strings for complex templates
template = r"""
Question: {question}
Retrieve facts from: {facts}

Answer using ONLY the provided facts.
Do not use facts enclosed in {{curly braces}}.
"""

# Escape braces if needed
template = "Response format: {{key: value}}"  # Double braces escape
```

---

## Error Handling

### Common Exceptions

```python
from weaviate.exceptions import (
    WeaviateBaseError,
    WeaviateQueryError,
    WeaviateConnectionError,
    WeaviateInvalidInputError
)
```

### Connection Error Handling

```python
from weaviate.exceptions import WeaviateConnectionError

try:
    client = weaviate.connect_to_weaviate_cloud(
        cluster_url="https://cluster.weaviate.network",
        auth_credentials=Auth.api_key("key")
    )
except WeaviateConnectionError as e:
    print(f"Connection failed: {e}")
    # Retry logic, use fallback server, etc.
except Exception as e:
    print(f"Unexpected error: {e}")
```

### Query Error Handling

```python
from weaviate.exceptions import WeaviateQueryError

collection = client.collections.get("Articles")

try:
    response = collection.generate.near_text(
        query="artificial intelligence",
        limit=5,
        single_prompt="Summary: {content}"
    )
except WeaviateQueryError as e:
    print(f"Query failed: {e}")
    # Log error, retry with different parameters, etc.
except Exception as e:
    print(f"Unexpected error: {e}")
```

### API Key and Rate Limit Handling

```python
import time
from weaviate.exceptions import WeaviateQueryError

def query_with_retry(collection, query_func, max_retries: int = 3):
    """Execute query with exponential backoff."""
    for attempt in range(max_retries):
        try:
            return query_func()
        except WeaviateQueryError as e:
            if "rate limit" in str(e).lower() and attempt < max_retries - 1:
                wait_time = 2 ** attempt  # Exponential backoff
                print(f"Rate limited. Waiting {wait_time}s before retry...")
                time.sleep(wait_time)
            else:
                raise

# Usage
def my_query():
    return collection.generate.near_text(
        query="test",
        limit=5,
        single_prompt="Summary: {content}"
    )

response = query_with_retry(collection, my_query)
```

### Generation-Specific Error Handling

```python
from weaviate.exceptions import WeaviateQueryError

class GenerationError(Exception):
    """Custom error for generation failures."""
    pass

def safe_generate(collection, **kwargs) -> dict:
    """Safely execute generation with error handling."""
    try:
        response = collection.generate.near_text(**kwargs)

        # Check for generation errors
        if not response.generated:
            raise GenerationError("No generation output received")

        # Validate response structure
        if response.objects is None:
            raise GenerationError("No objects in response")

        return {
            "success": True,
            "generated": response.generated,
            "objects": response.objects,
            "error": None
        }

    except WeaviateQueryError as e:
        return {
            "success": False,
            "generated": None,
            "objects": None,
            "error": f"Query error: {str(e)}"
        }
    except Exception as e:
        return {
            "success": False,
            "generated": None,
            "objects": None,
            "error": f"Unexpected error: {str(e)}"
        }

# Usage
result = safe_generate(
    collection,
    query="machine learning",
    limit=3,
    single_prompt="Summary: {content}"
)

if result["success"]:
    print(result["generated"])
else:
    print(f"Generation failed: {result['error']}")
```

### Batch Generation Error Handling

```python
def batch_generate(collection, queries: list, prompt_template: str) -> list:
    """Generate for multiple queries with error handling."""
    results = []

    for query in queries:
        try:
            response = collection.generate.near_text(
                query=query,
                limit=3,
                single_prompt=prompt_template
            )
            results.append({
                "query": query,
                "success": True,
                "generated": response.generated,
                "error": None
            })
        except Exception as e:
            results.append({
                "query": query,
                "success": False,
                "generated": None,
                "error": str(e)
            })

    return results

# Usage
queries = ["AI trends", "machine learning", "deep learning"]
results = batch_generate(
    collection,
    queries,
    "Explain: {topic}"
)

for result in results:
    if result["success"]:
        print(f"✓ {result['query']}: {result['generated'][:50]}...")
    else:
        print(f"✗ {result['query']}: {result['error']}")
```

### Validation and Sanitization

```python
import re

def validate_prompt_template(template: str) -> tuple[bool, str]:
    """Validate prompt template for common issues."""

    # Check for unmatched braces
    brace_count = template.count("{") - template.count("}")
    if brace_count != 0:
        return False, "Unmatched braces in template"

    # Check for reasonable length
    if len(template) > 2000:
        return False, "Template too long (max 2000 chars)"

    # Check for injection patterns
    if re.search(r"__\w+__", template):
        return False, "Template contains suspicious patterns"

    return True, "Valid"

def sanitize_user_input(text: str, max_length: int = 1000) -> str:
    """Sanitize user input for generation."""
    # Remove potential injection attempts
    text = re.sub(r"[{}\[\]<>]", "", text)

    # Truncate to max length
    text = text[:max_length]

    # Remove extra whitespace
    text = " ".join(text.split())

    return text

# Usage
template = "Summarize: {content}"
is_valid, msg = validate_prompt_template(template)

if is_valid:
    user_query = sanitize_user_input("User input...")
else:
    print(f"Invalid template: {msg}")
```

---

## Advanced Examples

### Example 1: Document Classification with RAG

```python
from weaviate.classes.config import Configure

class DocumentClassifier:
    def __init__(self, client):
        self.client = client
        self.create_classifier()

    def create_classifier(self):
        """Create collection with classification prompt."""
        self.client.collections.create(
            name="Documents",
            generative_config=Configure.Generative.openai(
                model="gpt-3.5-turbo",
                temperature=0.3
            )
        )
        self.collection = self.client.collections.get("Documents")

    def classify(self, document_text: str) -> dict:
        """Classify a document based on similar documents."""
        response = self.collection.generate.near_text(
            query=document_text,
            limit=5,
            grouped_task="""
Analyze these similar documents and classify the query document as:
1. Legal Document
2. Financial Report
3. Technical Manual
4. Marketing Material
5. Scientific Paper

Classification:
Confidence (0-100):
Reasoning:
"""
        )

        return {
            "document_text": document_text[:100],
            "classification": response.generated,
            "similar_docs": [obj.properties for obj in response.objects]
        }

classifier = DocumentClassifier(client)
result = classifier.classify("My document text...")
```

### Example 2: Content Generation Pipeline

```python
from weaviate.classes.config import Configure

class ContentGenerator:
    def __init__(self, client):
        self.client = client
        self.setup()

    def setup(self):
        """Setup content generation collection."""
        self.client.collections.create(
            name="Topics",
            generative_config=Configure.Generative.openai(
                model="gpt-4",
                temperature=0.7
            )
        )
        self.collection = self.client.collections.get("Topics")

    def generate_content(self, topic: str, content_type: str) -> str:
        """Generate content based on topic and type."""

        prompts = {
            "blog": "Write a 500-word blog post about: {topic}",
            "social": "Create 3 engaging social media posts about: {topic}",
            "email": "Compose a professional email about: {topic}",
            "ad": "Write an advertising copy for: {topic}"
        }

        if content_type not in prompts:
            raise ValueError(f"Unknown content type: {content_type}")

        response = self.collection.generate.near_text(
            query=topic,
            limit=3,
            grouped_task=prompts[content_type]
        )

        return response.generated

    def batch_generate(self, topics: list, content_type: str) -> dict:
        """Generate content for multiple topics."""
        results = {}

        for topic in topics:
            try:
                content = self.generate_content(topic, content_type)
                results[topic] = {"success": True, "content": content}
            except Exception as e:
                results[topic] = {"success": False, "error": str(e)}

        return results

generator = ContentGenerator(client)
content = generator.generate_content("AI trends", "blog")
batch_results = generator.batch_generate(
    ["AI", "blockchain", "quantum computing"],
    "social"
)
```

### Example 3: Knowledge Graph Question Answering

```python
from weaviate.classes.config import Configure

class KnowledgeGraphQA:
    def __init__(self, client):
        self.client = client
        self.setup()

    def setup(self):
        """Setup KG-based QA system."""
        self.client.collections.create(
            name="Knowledge",
            generative_config=Configure.Generative.openai(
                model="gpt-4",
                temperature=0.2  # Low for factual answers
            )
        )
        self.collection = self.client.collections.get("Knowledge")

    def answer_question(self, question: str, with_sources: bool = True) -> dict:
        """Answer a question with knowledge base."""

        response = self.collection.generate.near_text(
            query=question,
            limit=10,
            single_prompt="Fact: {content}\nSource: {source_url}",
            grouped_task=f"""
Answer the following question using ONLY the provided facts:

Question: {question}

If the answer cannot be determined from the facts provided, respond with "I don't have enough information."

Answer:
"""
        )

        result = {
            "question": question,
            "answer": response.generated,
            "sources": []
        }

        if with_sources:
            result["sources"] = [
                {
                    "content": obj.properties.get("content", ""),
                    "url": obj.properties.get("source_url", "")
                }
                for obj in response.objects
            ]

        return result

qa_system = KnowledgeGraphQA(client)
result = qa_system.answer_question("What is quantum computing?")
print(result["answer"])
for source in result["sources"]:
    print(f"Source: {source['url']}")
```

### Example 4: Multi-Provider Comparison

```python
from weaviate.classes.config import GenerativeConfig

class MultiProviderComparison:
    """Compare generation across different providers."""

    def __init__(self, collection):
        self.collection = collection

    def compare_providers(self, query: str, prompt: str) -> dict:
        """Generate using different providers."""

        providers = {
            "OpenAI GPT-3.5": GenerativeConfig.openai(model="gpt-3.5-turbo"),
            "OpenAI GPT-4": GenerativeConfig.openai(model="gpt-4"),
            "Cohere": GenerativeConfig.cohere(model="command-r-plus"),
            "Anthropic Claude": GenerativeConfig.anthropic(model="claude-3-sonnet-20240229")
        }

        results = {}

        for provider_name, provider_config in providers.items():
            try:
                response = self.collection.generate.near_text(
                    query=query,
                    limit=3,
                    single_prompt=prompt,
                    generative_provider=provider_config
                )

                results[provider_name] = {
                    "success": True,
                    "generated": response.generated,
                    "objects_count": len(response.objects)
                }
            except Exception as e:
                results[provider_name] = {
                    "success": False,
                    "error": str(e)
                }

        return results

comparison = MultiProviderComparison(collection)
results = comparison.compare_providers(
    query="machine learning",
    prompt="Explain: {topic}"
)

for provider, result in results.items():
    if result["success"]:
        print(f"{provider}:\n{result['generated']}\n")
```

### Example 5: Streaming and Large-Scale Generation

```python
import asyncio

class LargeScaleRAG:
    """Handle large-scale generation with batching."""

    def __init__(self, collection):
        self.collection = collection
        self.batch_size = 50

    def batch_generate(self, items: list, template: str, batch_size: int = None):
        """Generate for large number of items with batching."""
        batch_size = batch_size or self.batch_size
        results = []

        for i in range(0, len(items), batch_size):
            batch = items[i:i+batch_size]
            batch_results = self._process_batch(batch, template)
            results.extend(batch_results)

            # Log progress
            print(f"Processed {min(i+batch_size, len(items))}/{len(items)}")

        return results

    def _process_batch(self, items: list, template: str) -> list:
        """Process a single batch."""
        results = []

        for item in items:
            try:
                # Assume item has 'query' and 'content' fields
                response = self.collection.generate.near_text(
                    query=item.get("query"),
                    limit=3,
                    single_prompt=template
                )

                results.append({
                    "item_id": item.get("id"),
                    "success": True,
                    "generated": response.generated
                })
            except Exception as e:
                results.append({
                    "item_id": item.get("id"),
                    "success": False,
                    "error": str(e)
                })

        return results

rag = LargeScaleRAG(collection)
items = [
    {"id": i, "query": f"topic {i}", "content": f"content {i}"}
    for i in range(1000)
]

results = rag.batch_generate(items, "Summarize: {content}")

# Calculate success rate
successes = sum(1 for r in results if r["success"])
print(f"Success rate: {successes}/{len(results)}")
```

---

## Summary and Quick Reference

### Configuration Quick Reference

```python
# OpenAI
Configure.Generative.openai(model="gpt-4", temperature=0.7)

# Cohere
Configure.Generative.cohere(model="command-r-plus", temperature=0.8)

# Anthropic
Configure.Generative.anthropic(model="claude-3-sonnet-20240229", temperature=0.7)
```

### Query Methods

```python
# Single prompt (one output per object)
response = collection.generate.near_text(
    query="search term",
    limit=5,
    single_prompt="Template: {property}"
)

# Grouped task (one output for all objects)
response = collection.generate.near_text(
    query="search term",
    limit=5,
    grouped_task="Task description"
)

# Both together
response = collection.generate.near_text(
    query="search term",
    limit=5,
    single_prompt="Per-object template",
    grouped_task="Group task"
)
```

### Response Access

```python
# Grouped output
response.generated  # String from grouped_task

# Per-object outputs
for obj in response.objects:
    obj.properties    # Original object data
    obj.generated     # Output from single_prompt
    obj.metadata      # Certainty, distance, etc.
```

### Best Practices Checklist

- [ ] Use meaningful metadata for filtering
- [ ] Implement chunking for long documents
- [ ] Set appropriate temperature values
- [ ] Handle errors with try-except blocks
- [ ] Validate prompt templates before use
- [ ] Monitor token usage and API limits
- [ ] Use batch processing for scale
- [ ] Cache results when appropriate
- [ ] Test prompts with different providers
- [ ] Log generation results for quality assurance

---

## Related Resources

For more information about Weaviate's RAG and generative capabilities:

- [Weaviate Documentation - Retrieval Augmented Generation](https://docs.weaviate.io/weaviate/starter-guides/generative)
- [OpenAI Generative AI with Weaviate](https://weaviate.io/developers/weaviate/model-providers/openai/generative)
- [Cohere Generative AI with Weaviate](https://weaviate.io/developers/weaviate/model-providers/cohere/generative)
- [Anthropic Generative AI with Weaviate](https://weaviate.io/developers/weaviate/model-providers/anthropic/generative)
- [Weaviate Python Client Documentation](https://weaviate-python-client.readthedocs.io/)
- [Weaviate Python Client (v4) Release](https://weaviate.io/blog/py-client-v4-release)
- [Weaviate Advanced RAG Techniques](https://weaviate.io/blog/advanced-rag)
