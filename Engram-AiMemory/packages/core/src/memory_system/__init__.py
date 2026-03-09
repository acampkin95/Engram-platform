"""
3-Tier AI Memory System
=======================

A persistent memory system for AI agents using Weaviate as the vector database.

Memory Tiers:
- Tier 1 (Project): Per-project isolated memory
- Tier 2 (General): Shared across projects, user-specific
- Tier 3 (Global): Base knowledge available to all users

Usage:
    from memory_system import MemorySystem

    memory = MemorySystem()
    await memory.initialize()

    # Add memory
    memory_id = await memory.add(
        content="Important insight about the project",
        tier=MemoryTier.PROJECT,
        metadata={"source": "conversation", "importance": 0.8}
    )

    # Search memory
    results = await memory.search(
        query="project insights",
        tier=MemoryTier.PROJECT,
        limit=10
    )
"""

__version__ = "0.1.0"
__author__ = "AI Memory Team"

from memory_system.analyzer import MemoryAnalyzer
from memory_system.cache import RedisCache
from memory_system.client import WeaviateMemoryClient
from memory_system.config import Settings, get_settings
from memory_system.context import ContextBuilder, ConversationMemoryManager
from memory_system.decay import MemoryDecay, MemoryReranker
from memory_system.memory import (
    GraphQueryResult,
    KnowledgeEntity,
    KnowledgeRelation,
    Memory,
    MemoryAnalysis,
    MemoryQuery,
    MemorySearchResult,
    MemorySource,
    MemoryStats,
    MemoryTier,
    MemoryType,
)
from memory_system.rag import MemoryRAG
from memory_system.system import MemorySystem

__all__ = [
    "MemorySystem",
    "Memory",
    "MemoryAnalysis",
    "MemoryQuery",
    "MemorySearchResult",
    "MemorySource",
    "MemoryStats",
    "MemoryTier",
    "MemoryType",
    "KnowledgeEntity",
    "KnowledgeRelation",
    "GraphQueryResult",
    "WeaviateMemoryClient",
    "RedisCache",
    "Settings",
    "get_settings",
    "ContextBuilder",
    "ConversationMemoryManager",
    "MemoryDecay",
    "MemoryReranker",
    "MemoryRAG",
    "MemoryAnalyzer",
]
