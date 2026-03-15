"""Live integration tests for Weaviate.

These tests require a running Weaviate instance and test actual
integration with the database.

Run with: pytest tests/test_weaviate_live.py -v --run-live-tests
"""

import os
import pytest
import asyncio
from datetime import datetime, UTC
from uuid import uuid4

os.environ["JWT_SECRET"] = "test-secret-key-for-testing-only"

from memory_system.client import WeaviateMemoryClient
from memory_system.config import Settings, get_settings
from memory_system.memory import Memory, MemoryTier, MemoryType, MemorySource


# Skip all tests in this file unless --run-live-tests is specified
pytestmark = [
    pytest.mark.live,
    pytest.mark.skipif(
        not os.getenv("RUN_LIVE_TESTS"),
        reason="Live tests disabled. Set RUN_LIVE_TESTS=1 to enable."
    ),
    pytest.mark.skipif(
        not os.getenv("WEAVIATE_URL"),
        reason="WEAVIATE_URL not set. Cannot run live tests."
    ),
]


class TestWeaviateConnection:
    """Test basic Weaviate connectivity."""
    
    @pytest.fixture
    async def live_client(self):
        """Create and connect to live Weaviate instance."""
        settings = get_settings()
        client = WeaviateMemoryClient(settings=settings)
        
        try:
            await client.connect()
            yield client
        finally:
            if client._client:
                client._client.close()
    
    @pytest.mark.asyncio
    async def test_weaviate_connection(self, live_client):
        """Test that we can connect to Weaviate."""
        assert live_client._client is not None
        assert live_client.client.is_connected()
    
    @pytest.mark.asyncio
    async def test_weaviate_metadata(self, live_client):
        """Test retrieving Weaviate metadata."""
        meta = live_client.client.get_meta()
        assert "version" in meta
        print(f"\nWeaviate Version: {meta['version']}")


class TestWeaviateSchemaOperations:
    """Test schema creation and management."""
    
    @pytest.fixture
    async def live_client(self):
        """Create connected client with test cleanup."""
        settings = get_settings()
        # Use test-specific collection names
        settings.clean_schema_migration = False
        
        client = WeaviateMemoryClient(settings=settings)
        
        try:
            await client.connect()
            yield client
        finally:
            if client._client:
                # Cleanup test data
                await self._cleanup_test_data(client)
                client._client.close()
    
    async def _cleanup_test_data(self, client):
        """Clean up test data after tests."""
        try:
            collections = client.client.collections.list_all()
            for name in collections:
                if name.startswith("Test"):
                    client.client.collections.delete(name)
        except Exception as e:
            print(f"Cleanup warning: {e}")
    
    @pytest.mark.asyncio
    async def test_collection_creation(self, live_client):
        """Test that collections are created."""
        collections = live_client.client.collections.list_all()
        
        # Check tier collections exist
        from memory_system.config import TIER1_COLLECTION, TIER2_COLLECTION, TIER3_COLLECTION
        assert TIER1_COLLECTION in collections
        assert TIER2_COLLECTION in collections
        assert TIER3_COLLECTION in collections
        
        print(f"\nAvailable collections: {collections}")


class TestWeaviateMemoryCRUD:
    """Test memory CRUD operations against live Weaviate."""
    
    @pytest.fixture
    async def live_client(self):
        """Create connected client."""
        settings = get_settings()
        client = WeaviateMemoryClient(settings=settings)
        
        try:
            await client.connect()
            yield client
        finally:
            if client._client:
                client._client.close()
    
    @pytest.mark.asyncio
    async def test_create_and_retrieve_memory(self, live_client):
        """Test creating and retrieving a memory."""
        memory = Memory(
            content="Test memory for live integration",
            memory_type=MemoryType.FACT,
            tier=MemoryTier.PROJECT,
            project_id="test-project",
            importance=0.8,
            tags=["test", "live"],
        )
        
        # Generate vector
        vector = [0.1] * 768
        
        # Insert
        memory_id = await live_client.add_memory(memory, vector=vector)
        assert memory_id is not None
        
        print(f"\nCreated memory with ID: {memory_id}")
        
        # Retrieve
        retrieved = await live_client.get_memory(memory_id, tier=MemoryTier.PROJECT)
        assert retrieved is not None
        assert retrieved.content == memory.content
        assert retrieved.project_id == memory.project_id
    
    @pytest.mark.asyncio
    async def test_update_memory(self, live_client):
        """Test updating an existing memory."""
        # Create initial memory
        memory = Memory(
            content="Original content",
            memory_type=MemoryType.FACT,
            tier=MemoryTier.PROJECT,
        )
        vector = [0.1] * 768
        memory_id = await live_client.add_memory(memory, vector=vector)
        
        # Update
        memory.content = "Updated content"
        await live_client.update_memory(memory, vector=vector)
        
        # Verify update
        retrieved = await live_client.get_memory(memory_id, tier=MemoryTier.PROJECT)
        assert retrieved.content == "Updated content"
    
    @pytest.mark.asyncio
    async def test_delete_memory(self, live_client):
        """Test deleting a memory."""
        memory = Memory(
            content="To be deleted",
            memory_type=MemoryType.FACT,
            tier=MemoryTier.PROJECT,
        )
        vector = [0.1] * 768
        memory_id = await live_client.add_memory(memory, vector=vector)
        
        # Delete
        await live_client.delete_memory(memory_id, tier=MemoryTier.PROJECT)
        
        # Verify deletion
        retrieved = await live_client.get_memory(memory_id, tier=MemoryTier.PROJECT)
        assert retrieved is None


class TestWeaviateSearchOperations:
    """Test search functionality against live Weaviate."""
    
    @pytest.fixture
    async def live_client_with_data(self):
        """Create client and populate with test data."""
        settings = get_settings()
        client = WeaviateMemoryClient(settings=settings)
        
        test_ids = []
        try:
            await client.connect()
            
            # Insert test memories
            for i in range(5):
                memory = Memory(
                    content=f"Test memory number {i} about artificial intelligence",
                    memory_type=MemoryType.FACT,
                    tier=MemoryTier.PROJECT,
                    project_id="test-search",
                    importance=0.5 + (i * 0.1),
                    tags=["test", "search", f"tag-{i}"],
                )
                # Create simple vector
                vector = [0.1 * (i + 1)] + [0.01] * 767
                memory_id = await client.add_memory(memory, vector=vector)
                test_ids.append(memory_id)
            
            yield client, test_ids
            
        finally:
            if client._client:
                # Cleanup
                for mid in test_ids:
                    try:
                        await client.delete_memory(mid, tier=MemoryTier.PROJECT)
                    except:
                        pass
                client._client.close()
    
    @pytest.mark.asyncio
    async def test_vector_search(self, live_client_with_data):
        """Test vector similarity search."""
        client, test_ids = live_client_with_data
        
        # Search with vector similar to first memory
        query_vector = [0.15] + [0.01] * 767
        results = await client.search_memories(
            vector=query_vector,
            tier=MemoryTier.PROJECT,
            filters={"project_id": "test-search"},
            limit=3
        )
        
        assert len(results) > 0
        print(f"\nVector search returned {len(results)} results")
    
    @pytest.mark.asyncio
    async def test_filtered_search(self, live_client_with_data):
        """Test search with metadata filters."""
        client, test_ids = live_client_with_data
        
        # Search with filter
        query_vector = [0.1] * 768
        results = await client.search_memories(
            vector=query_vector,
            tier=MemoryTier.PROJECT,
            filters={
                "project_id": "test-search",
                "importance": {"$gte": 0.7}
            },
            limit=10
        )
        
        # Should only return memories with importance >= 0.7
        for result in results:
            assert result.memory.importance >= 0.7


class TestWeaviateHealthChecks:
    """Health check tests for live Weaviate."""
    
    @pytest.mark.asyncio
    async def test_weaviate_health_endpoint(self):
        """Test Weaviate health endpoint."""
        settings = get_settings()
        client = WeaviateMemoryClient(settings=settings)
        
        try:
            await client.connect()
            
            # Check if Weaviate is ready
            is_ready = client.client.is_ready()
            assert is_ready, "Weaviate is not ready"
            
            print("\n✓ Weaviate health check passed")
            
        finally:
            if client._client:
                client._client.close()
    
    @pytest.mark.asyncio
    async def test_weaviate_livez_endpoint(self):
        """Test Weaviate liveness endpoint."""
        settings = get_settings()
        client = WeaviateMemoryClient(settings=settings)
        
        try:
            await client.connect()
            
            # Check liveness
            is_live = client.client.is_live()
            assert is_live, "Weaviate is not live"
            
            print("\n✓ Weaviate liveness check passed")
            
        finally:
            if client._client:
                client._client.close()


class TestWeaviateErrorScenarios:
    """Test error handling with live Weaviate."""
    
    @pytest.mark.asyncio
    async def test_invalid_vector_dimension(self):
        """Test handling of invalid vector dimensions."""
        settings = get_settings()
        client = WeaviateMemoryClient(settings=settings)
        
        try:
            await client.connect()
            
            memory = Memory(
                content="Test",
                memory_type=MemoryType.FACT,
                tier=MemoryTier.PROJECT,
            )
            
            # Wrong vector dimension
            invalid_vector = [0.1] * 100  # Should be 768
            
            with pytest.raises(Exception):
                await client.add_memory(memory, vector=invalid_vector)
                
        finally:
            if client._client:
                client._client.close()
    
    @pytest.mark.asyncio
    async def test_nonexistent_memory_retrieval(self):
        """Test retrieving non-existent memory."""
        settings = get_settings()
        client = WeaviateMemoryClient(settings=settings)
        
        try:
            await client.connect()
            
            fake_id = uuid4()
            result = await client.get_memory(fake_id, tier=MemoryTier.PROJECT)
            
            assert result is None
            
        finally:
            if client._client:
                client._client.close()
