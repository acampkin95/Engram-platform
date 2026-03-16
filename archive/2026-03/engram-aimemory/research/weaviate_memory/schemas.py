# weaviate_memory/schemas.py
"""
Memory collection schema definitions for Weaviate.
Implements episodic, semantic, procedural, and working memory types.
"""

import weaviate
from weaviate.classes.config import Configure, Property, DataType, Tokenization


def create_memory_collections(
    client: weaviate.WeaviateClient,
    vectorizer_config=None,
    generative_config=None,
    use_ollama: bool = True,
    ollama_endpoint: str = "http://host.docker.internal:11434",
    ollama_model: str = "nomic-embed-text",
    generative_model: str = "llama3.2"
) -> dict:
    """
    Create all memory collections with appropriate schemas.
    
    Args:
        client: Weaviate client instance
        vectorizer_config: Custom vectorizer config (overrides ollama settings)
        generative_config: Custom generative config (overrides ollama settings)
        use_ollama: Whether to use Ollama for embeddings (default True)
        ollama_endpoint: Ollama API endpoint
        ollama_model: Ollama embedding model name
        generative_model: Ollama generative model name
    
    Returns:
        Dict of created collection references
    """
    if vectorizer_config is None and use_ollama:
        vectorizer_config = Configure.Vectorizer.text2vec_ollama(
            api_endpoint=ollama_endpoint,
            model=ollama_model
        )
    
    if generative_config is None and use_ollama:
        generative_config = Configure.Generative.ollama(
            api_endpoint=ollama_endpoint,
            model=generative_model
        )
    
    collections = {}
    
    # Episodic Memory
    if not client.collections.exists("EpisodicMemory"):
        collections["episodic"] = client.collections.create(
            name="EpisodicMemory",
            description="Stores specific events with full spatiotemporal context",
            properties=[
                Property(name="content", data_type=DataType.TEXT),
                Property(name="eventType", data_type=DataType.TEXT, tokenization=Tokenization.FIELD),
                Property(name="timestamp", data_type=DataType.DATE),
                Property(name="sessionId", data_type=DataType.TEXT),
                Property(name="sequenceIndex", data_type=DataType.INT),
                Property(name="actors", data_type=DataType.TEXT_ARRAY),
                Property(name="agentId", data_type=DataType.TEXT),
                Property(name="userId", data_type=DataType.TEXT),
                Property(name="actionsTaken", data_type=DataType.TEXT_ARRAY),
                Property(name="observedOutcomes", data_type=DataType.TEXT_ARRAY),
                Property(name="successScore", data_type=DataType.NUMBER),
                Property(name="contextFactors", data_type=DataType.TEXT_ARRAY),
                Property(name="importanceScore", data_type=DataType.NUMBER),
                Property(name="recencyScore", data_type=DataType.NUMBER),
                Property(name="accessCount", data_type=DataType.INT),
                Property(name="lastAccessedAt", data_type=DataType.DATE),
                Property(name="consolidatedToSemantic", data_type=DataType.BOOL),
                Property(name="consolidationDate", data_type=DataType.DATE),
            ],
            vectorizer_config=vectorizer_config,
            generative_config=generative_config,
        )
    else:
        collections["episodic"] = client.collections.get("EpisodicMemory")
    
    # Semantic Memory
    if not client.collections.exists("SemanticMemory"):
        collections["semantic"] = client.collections.create(
            name="SemanticMemory",
            description="Stores generalized facts and knowledge",
            properties=[
                Property(name="fact", data_type=DataType.TEXT),
                Property(name="factType", data_type=DataType.TEXT, tokenization=Tokenization.FIELD),
                Property(name="domain", data_type=DataType.TEXT),
                Property(name="category", data_type=DataType.TEXT),
                Property(name="tags", data_type=DataType.TEXT_ARRAY),
                Property(name="relatedConcepts", data_type=DataType.TEXT_ARRAY),
                Property(name="applicabilityConditions", data_type=DataType.TEXT),
                Property(name="derivedFromEpisodes", data_type=DataType.TEXT_ARRAY),
                Property(name="confidenceScore", data_type=DataType.NUMBER),
                Property(name="userId", data_type=DataType.TEXT),
                Property(name="agentId", data_type=DataType.TEXT),
                Property(name="createdAt", data_type=DataType.DATE),
                Property(name="lastUpdated", data_type=DataType.DATE),
                Property(name="usageFrequency", data_type=DataType.INT),
                Property(name="importanceScore", data_type=DataType.NUMBER),
                Property(name="version", data_type=DataType.INT),
            ],
            vectorizer_config=vectorizer_config,
            generative_config=generative_config,
        )
    else:
        collections["semantic"] = client.collections.get("SemanticMemory")
    
    # Procedural Memory
    if not client.collections.exists("ProceduralMemory"):
        collections["procedural"] = client.collections.create(
            name="ProceduralMemory",
            description="Stores learned workflows and skill sequences",
            properties=[
                Property(name="workflowName", data_type=DataType.TEXT),
                Property(name="workflowDescription", data_type=DataType.TEXT),
                Property(name="goalType", data_type=DataType.TEXT),
                Property(name="steps", data_type=DataType.TEXT_ARRAY),
                Property(name="prerequisiteStates", data_type=DataType.TEXT_ARRAY),
                Property(name="requiredTools", data_type=DataType.TEXT_ARRAY),
                Property(name="successCriteria", data_type=DataType.TEXT_ARRAY),
                Property(name="applicableContexts", data_type=DataType.TEXT_ARRAY),
                Property(name="successRate", data_type=DataType.NUMBER),
                Property(name="executionCount", data_type=DataType.INT),
                Property(name="lastExecuted", data_type=DataType.DATE),
                Property(name="version", data_type=DataType.INT),
                Property(name="createdAt", data_type=DataType.DATE),
            ],
            vectorizer_config=vectorizer_config,
            generative_config=generative_config,
        )
    else:
        collections["procedural"] = client.collections.get("ProceduralMemory")
    
    # Working Memory
    if not client.collections.exists("WorkingMemory"):
        collections["working"] = client.collections.create(
            name="WorkingMemory",
            description="Active session context - fast access, auto-expires",
            properties=[
                Property(name="content", data_type=DataType.TEXT),
                Property(name="contextType", data_type=DataType.TEXT),
                Property(name="sessionId", data_type=DataType.TEXT),
                Property(name="turnIndex", data_type=DataType.INT),
                Property(name="timestamp", data_type=DataType.DATE),
                Property(name="expiresAt", data_type=DataType.DATE),
                Property(name="promoteToLongTerm", data_type=DataType.BOOL),
                Property(name="agentId", data_type=DataType.TEXT),
                Property(name="userId", data_type=DataType.TEXT),
            ],
            vectorizer_config=vectorizer_config,
            generative_config=generative_config,
        )
    else:
        collections["working"] = client.collections.get("WorkingMemory")
    
    return collections


def create_multi_tenant_collections(
    client: weaviate.WeaviateClient,
    vectorizer_config=None,
    use_ollama: bool = True,
    ollama_endpoint: str = "http://host.docker.internal:11434",
    ollama_model: str = "nomic-embed-text"
) -> dict:
    """Create multi-tenant memory collections for per-agent/user isolation."""
    
    if vectorizer_config is None and use_ollama:
        vectorizer_config = Configure.Vectorizer.text2vec_ollama(
            api_endpoint=ollama_endpoint,
            model=ollama_model
        )
    
    collections = {}
    
    # Multi-tenant Episodic
    if not client.collections.exists("EpisodicMemoryMT"):
        collections["episodic_mt"] = client.collections.create(
            name="EpisodicMemoryMT",
            multi_tenancy_config=Configure.multi_tenancy(
                enabled=True,
                auto_tenant_creation=True,
                auto_tenant_activation=True
            ),
            properties=[
                Property(name="content", data_type=DataType.TEXT),
                Property(name="eventType", data_type=DataType.TEXT),
                Property(name="timestamp", data_type=DataType.DATE),
                Property(name="importanceScore", data_type=DataType.NUMBER),
                Property(name="recencyScore", data_type=DataType.NUMBER),
                Property(name="accessCount", data_type=DataType.INT),
            ],
            vectorizer_config=vectorizer_config,
        )
    else:
        collections["episodic_mt"] = client.collections.get("EpisodicMemoryMT")
    
    # Multi-tenant Semantic
    if not client.collections.exists("SemanticMemoryMT"):
        collections["semantic_mt"] = client.collections.create(
            name="SemanticMemoryMT",
            multi_tenancy_config=Configure.multi_tenancy(
                enabled=True,
                auto_tenant_creation=True,
                auto_tenant_activation=True
            ),
            properties=[
                Property(name="fact", data_type=DataType.TEXT),
                Property(name="factType", data_type=DataType.TEXT),
                Property(name="domain", data_type=DataType.TEXT),
                Property(name="confidenceScore", data_type=DataType.NUMBER),
                Property(name="usageFrequency", data_type=DataType.INT),
            ],
            vectorizer_config=vectorizer_config,
        )
    else:
        collections["semantic_mt"] = client.collections.get("SemanticMemoryMT")
    
    return collections
