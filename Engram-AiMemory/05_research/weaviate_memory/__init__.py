# weaviate_memory/__init__.py
"""
Weaviate Memory System for AI Agents

A comprehensive memory management system implementing:
- Episodic Memory: Specific events with temporal context
- Semantic Memory: Generalized facts and knowledge
- Procedural Memory: Learned workflows and skill sequences
- Working Memory: Active session context

Features:
- Hybrid search (semantic + keyword)
- Exponential decay for recency
- Memory consolidation (episodic → semantic)
- Multi-tenant isolation
- RAG integration
- Context window management
"""

from .schemas import create_memory_collections, create_multi_tenant_collections
from .store import MemoryStore
from .retrieval import MemoryRetrieval
from .decay import MemoryDecay
from .consolidation import MemoryConsolidation
from .context import ContextBuilder, ConversationMemoryManager
from .rag import MemoryAugmentedRAG
from .tenant import TenantMemoryManager, HybridMemoryArchitecture
from .metrics import MemoryMetrics

__all__ = [
    # Schema creation
    "create_memory_collections",
    "create_multi_tenant_collections",
    
    # Core operations
    "MemoryStore",
    "MemoryRetrieval",
    "MemoryDecay",
    "MemoryConsolidation",
    
    # Context management
    "ContextBuilder",
    "ConversationMemoryManager",
    
    # RAG
    "MemoryAugmentedRAG",
    
    # Multi-tenancy
    "TenantMemoryManager",
    "HybridMemoryArchitecture",
    
    # Monitoring
    "MemoryMetrics",
]

__version__ = "1.0.0"
