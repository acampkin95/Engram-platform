"""Unit tests for Weaviate client with mocked dependencies.

Tests WeaviateMemoryClient logic without requiring a live Weaviate instance.
"""

import os
import pytest
from datetime import datetime, UTC
from unittest.mock import AsyncMock, MagicMock, patch, Mock
from uuid import UUID, uuid4

os.environ["JWT_SECRET"] = "test-secret-key-for-testing-only"

from memory_system.client import WeaviateMemoryClient
from memory_system.config import Settings, TIER1_COLLECTION, TIER2_COLLECTION, TIER3_COLLECTION
from memory_system.memory import Memory, MemoryTier, MemoryType, MemorySource


class TestWeaviateMemoryClientInitialization:
    """Test WeaviateMemoryClient initialization and configuration."""

    @pytest.fixture
    def mock_settings(self):
        """Create mock settings for testing."""
        settings = MagicMock(spec=Settings)
        settings.weaviate_url = "http://localhost:8080"
        settings.weaviate_grpc_url = "http://localhost:50051"
        settings.weaviate_api_key = None
        settings.clean_schema_migration = False
        settings.multi_tenancy_enabled = True
        return settings

    def test_client_initialization_with_settings(self, mock_settings):
        """Test client initialization with explicit settings."""
        client = WeaviateMemoryClient(settings=mock_settings)
        assert client.settings == mock_settings
        assert client._client is None

    def test_client_initialization_without_settings(self):
        """Test client initialization without settings (uses get_settings)."""
        with patch("memory_system.client.get_settings") as mock_get_settings:
            mock_settings = MagicMock()
            mock_get_settings.return_value = mock_settings
            client = WeaviateMemoryClient()
            assert client.settings == mock_settings

    def test_tier_collection_mapping(self, mock_settings):
        """Test that tier to collection mapping is correct."""
        client = WeaviateMemoryClient(settings=mock_settings)
        assert client.TIER_COLLECTIONS[MemoryTier.PROJECT] == TIER1_COLLECTION
        assert client.TIER_COLLECTIONS[MemoryTier.GENERAL] == TIER2_COLLECTION
        assert client.TIER_COLLECTIONS[MemoryTier.GLOBAL] == TIER3_COLLECTION

    def test_client_property_raises_when_not_connected(self, mock_settings):
        """Test that accessing client property raises when not connected."""
        client = WeaviateMemoryClient(settings=mock_settings)
        with pytest.raises(RuntimeError, match="Weaviate client not connected"):
            _ = client.client


class TestWeaviateMemoryClientSchema:
    """Test schema management and collection operations."""

    @pytest.fixture
    def mock_client(self):
        """Create a mock Weaviate client."""
        mock = MagicMock()
        mock.collections = MagicMock()
        mock.collections.list_all = MagicMock(return_value=[])
        mock.collections.create = MagicMock()
        mock.collections.delete = MagicMock()
        return mock

    @pytest.fixture
    def client_with_mock(self, mock_client):
        """Create WeaviateMemoryClient with mocked internal client."""
        settings = MagicMock()
        settings.clean_schema_migration = False
        settings.multi_tenancy_enabled = True

        client = WeaviateMemoryClient(settings=settings)
        client._client = mock_client
        return client

    @pytest.mark.asyncio
    async def test_ensure_schemas_creates_missing_collections(self, client_with_mock, mock_client):
        """Test that _ensure_schemas creates collections that don't exist."""
        mock_client.collections.list_all.return_value = []

        await client_with_mock._ensure_schemas()

        # Should create 5 collections: 3 tiers + entity + relation
        assert mock_client.collections.create.call_count == 5

    @pytest.mark.asyncio
    async def test_ensure_schemas_skips_existing_collections(self, client_with_mock, mock_client):
        """Test that _ensure_schemas skips collections that already exist."""
        mock_client.collections.list_all.return_value = [
            TIER1_COLLECTION,
            TIER2_COLLECTION,
            TIER3_COLLECTION,
        ]

        await client_with_mock._ensure_schemas()

        # Should only create entity and relation collections
        assert mock_client.collections.create.call_count == 2

    @pytest.mark.asyncio
    async def test_drop_all_collections_deletes_all(self, client_with_mock, mock_client):
        """Test that _drop_all_collections deletes all managed collections."""
        mock_client.collections.list_all.return_value = [
            TIER1_COLLECTION,
            TIER2_COLLECTION,
            TIER3_COLLECTION,
            "OtherCollection",
        ]

        await client_with_mock._drop_all_collections()

        # Should delete 3 tier collections (OtherCollection is not managed)
        assert mock_client.collections.delete.call_count == 3


class TestWeaviateMemoryClientMemoryOperations:
    """Test memory CRUD operations."""

    @pytest.fixture
    def mock_collection(self):
        """Create a mock collection object."""
        collection = MagicMock()
        collection.data = MagicMock()
        collection.data.insert = MagicMock()
        collection.data.update = MagicMock()
        collection.data.delete_by_id = MagicMock()
        collection.query = MagicMock()
        return collection

    @pytest.fixture
    def client_with_collection(self, mock_collection):
        """Create client with mocked collection."""
        settings = MagicMock()
        settings.multi_tenancy_enabled = False

        client = WeaviateMemoryClient(settings=settings)
        mock_weaviate = MagicMock()
        mock_weaviate.collections.get.return_value = mock_collection
        client._client = mock_weaviate
        return client, mock_collection

    @pytest.mark.asyncio
    async def test_add_memory_inserts_data(self, client_with_collection):
        """Test that add_memory inserts data into collection."""
        client, mock_collection = client_with_collection

        memory = Memory(
            content="Test content",
            memory_type=MemoryType.FACT,
            tier=MemoryTier.PROJECT,
        )
        memory.vector = [0.1, 0.2, 0.3]

        with patch.object(client, "_memory_to_properties", return_value={"content": "Test"}):
            result = await client.add_memory(memory)

        mock_collection.data.insert.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_memory_metadata(self, client_with_collection):
        """Test that update_memory_metadata updates existing memory metadata."""
        client, mock_collection = client_with_collection

        memory_id = uuid4()
        metadata = {"importance": 0.9, "tags": ["updated"]}

        await client.update_memory_metadata(memory_id, tier=MemoryTier.PROJECT, metadata=metadata)

        mock_collection.data.update.assert_called_once()

    @pytest.mark.asyncio
    async def test_delete_memory_deletes_by_id(self, client_with_collection):
        """Test that delete_memory deletes by UUID."""
        client, mock_collection = client_with_collection

        memory_id = uuid4()
        await client.delete_memory(memory_id, tier=MemoryTier.PROJECT)

        mock_collection.data.delete_by_id.assert_called_once()


class TestWeaviateMemoryClientSearch:
    """Test search and query operations."""

    @pytest.fixture
    def mock_query_result(self):
        """Create a mock query result."""
        result = MagicMock()
        result.objects = []
        return result

    @pytest.mark.asyncio
    async def test_search_memories_with_vector(self):
        """Test vector-based memory search."""
        settings = MagicMock()
        settings.multi_tenancy_enabled = False  # Disable multi-tenancy to avoid tenant mock issues
        settings.search_retrieval_mode = "vector"  # Use near_vector mode
        client = WeaviateMemoryClient(settings=settings)
        mock_weaviate = MagicMock()

        from memory_system.memory import MemoryQuery

        # Mock query response
        mock_response = MagicMock()
        mock_response.objects = []

        mock_collection = MagicMock()
        mock_collection.query.near_vector.return_value = mock_response
        mock_weaviate.collections.get.return_value = mock_collection
        client._client = mock_weaviate

        query = MemoryQuery(query="test", tier=MemoryTier.PROJECT, limit=5)
        results = await client.search(query=query, query_vector=[0.1, 0.2, 0.3])

        mock_collection.query.near_vector.assert_called_once()
        assert isinstance(results, list)

    @pytest.mark.asyncio
    async def test_search_memories_with_filters(self):
        """Test search with metadata filters."""
        settings = MagicMock()
        settings.multi_tenancy_enabled = False  # Disable multi-tenancy to avoid tenant mock issues
        settings.search_retrieval_mode = "vector"  # Use near_vector mode
        client = WeaviateMemoryClient(settings=settings)
        mock_weaviate = MagicMock()

        from memory_system.memory import MemoryQuery

        mock_response = MagicMock()
        mock_response.objects = []

        mock_collection = MagicMock()
        mock_collection.query.near_vector.return_value = mock_response
        mock_weaviate.collections.get.return_value = mock_collection
        client._client = mock_weaviate

        query = MemoryQuery(
            query="test",
            tier=MemoryTier.PROJECT,
            project_id="proj-123",
            limit=5,
        )
        results = await client.search(query=query, query_vector=[0.1, 0.2, 0.3])

        mock_collection.query.near_vector.assert_called_once()


class TestWeaviateMemoryClientBatchOperations:
    """Test batch operations for performance."""

    @pytest.mark.asyncio
    async def test_add_memories_batch(self):
        """Test batch insertion of multiple memories."""
        settings = MagicMock()
        settings.multi_tenancy_enabled = False  # Disable multi-tenancy to simplify mocking
        client = WeaviateMemoryClient(settings=settings)
        mock_weaviate = MagicMock()

        mock_collection = MagicMock()
        mock_collection.data.insert = MagicMock()  # For add_memory calls
        mock_weaviate.collections.get.return_value = mock_collection
        client._client = mock_weaviate

        memories = [
            Memory(content=f"Memory {i}", memory_type=MemoryType.FACT, tier=MemoryTier.PROJECT)
            for i in range(10)
        ]
        for m in memories:
            m.vector = [0.1, 0.2, 0.3]

        with patch.object(client, "_memory_to_properties", return_value={"content": "Test"}):
            result = await client.add_memories_batch(memories)

        # add_memories_batch calls add_memory for each memory
        assert mock_collection.data.insert.call_count == 10
        assert len(result[0]) == 10  # successful_ids
        assert len(result[1]) == 0  # failed_objects


class TestWeaviateMemoryClientErrorHandling:
    """Test error handling and edge cases."""

    @pytest.mark.asyncio
    async def test_add_memory_handles_validation_error(self):
        """Test handling of validation errors during insert."""
        settings = MagicMock()
        settings.multi_tenancy_enabled = False  # Disable multi-tenancy to simplify mocking
        client = WeaviateMemoryClient(settings=settings)
        mock_weaviate = MagicMock()

        mock_collection = MagicMock()
        mock_collection.data.insert.side_effect = Exception("Validation failed")
        mock_weaviate.collections.get.return_value = mock_collection
        client._client = mock_weaviate

        memory = Memory(content="Test", memory_type=MemoryType.FACT, tier=MemoryTier.PROJECT)
        memory.vector = [0.1, 0.2, 0.3]

        with patch.object(client, "_memory_to_properties", return_value={"content": "Test"}):
            with pytest.raises(Exception, match="Validation failed"):
                await client.add_memory(memory)

    @pytest.mark.asyncio
    async def test_search_with_invalid_vector(self):
        """Test search with invalid vector format."""
        settings = MagicMock()
        settings.multi_tenancy_enabled = False  # Disable multi-tenancy to simplify mocking
        settings.search_retrieval_mode = "vector"  # Use near_vector mode
        client = WeaviateMemoryClient(settings=settings)
        mock_weaviate = MagicMock()
        client._client = mock_weaviate

        from memory_system.memory import MemoryQuery

        # Empty vector should raise or return empty results - depends on Weaviate behavior
        # The current implementation passes empty vector to near_vector which may fail
        mock_collection = MagicMock()
        mock_response = MagicMock()
        mock_response.objects = []
        mock_collection.query.near_vector.return_value = mock_response
        mock_weaviate.collections.get.return_value = mock_collection

        query = MemoryQuery(query="test", tier=MemoryTier.PROJECT, limit=5)
        # Empty vector - Weaviate might accept it or raise; we handle gracefully
        results = await client.search(query=query, query_vector=[])

        # Should handle gracefully and return a list (empty in this case)
        assert isinstance(results, list)


class TestWeaviateMemoryClientTenantSupport:
    """Test multi-tenancy support."""

    @pytest.mark.asyncio
    async def test_add_memory_with_tenant(self):
        """Test adding memory with tenant isolation."""
        settings = MagicMock()
        settings.multi_tenancy_enabled = True
        client = WeaviateMemoryClient(settings=settings)
        mock_weaviate = MagicMock()

        mock_collection = MagicMock()
        mock_collection.with_tenant.return_value = mock_collection
        mock_collection.data.insert = MagicMock()
        mock_weaviate.collections.get.return_value = mock_collection
        client._client = mock_weaviate

        memory = Memory(
            content="Test",
            memory_type=MemoryType.FACT,
            tier=MemoryTier.PROJECT,
            tenant_id="tenant-123",
        )
        memory.vector = [0.1, 0.2, 0.3]

        with patch.object(client, "_memory_to_properties", return_value={"content": "Test"}):
            await client.add_memory(memory)

        mock_collection.with_tenant.assert_called_once_with("tenant-123")
        mock_collection.data.insert.assert_called_once()

        mock_collection.with_tenant.assert_called_with("tenant-123")
