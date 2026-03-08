"""Tests for SemanticTracker.

Strategy:
- Pure helper functions (_rels_collection, _entities_collection) tested directly.
- build_graph: LM bridge and ChromaDB are both mocked.
- get_graph / get_entity / get_entity_relationships: ChromaDB mocked.
- get_connected_entities: BFS logic tested with in-memory data (no ChromaDB).
- merge_entities: ChromaDB write operations mocked.
- search_entities / list_entity_types: ChromaDB search mocked.
"""

import json
import pytest
from unittest.mock import AsyncMock, MagicMock

from app.osint.semantic_tracker import (
    SemanticTracker,
    Entity,
    Relationship,
    KnowledgeGraph,
    _rels_collection,
    _entities_collection,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def make_entity(id_: str, name: str, entity_type: str = "person") -> Entity:
    return Entity(id=id_, name=name, entity_type=entity_type)


def make_relationship(source: str, target: str, rel_type: str = "alias_of") -> Relationship:
    return Relationship(source_id=source, target_id=target, relation_type=rel_type, confidence=0.9)


def make_tracker(lm_response=None, chromadb_docs=None):
    """Return a SemanticTracker with mocked LM bridge and ChromaDB."""
    bridge = MagicMock()
    bridge._make_request_with_retry = AsyncMock(
        return_value=lm_response or {"choices": [{"message": {"content": "{}"}}]}
    )

    chroma = MagicMock()
    chroma.add_documents = MagicMock()
    chroma.get_documents = MagicMock(return_value=chromadb_docs or {"documents": []})
    chroma.search = MagicMock(return_value={"documents": [[]]})
    chroma.delete_collection = MagicMock()
    chroma.delete_documents = MagicMock()

    return SemanticTracker(lm_bridge=bridge, chromadb_client=chroma), bridge, chroma


# ---------------------------------------------------------------------------
# Pure helper functions
# ---------------------------------------------------------------------------


class TestCollectionNameHelpers:
    def test_entities_collection_name(self):
        assert _entities_collection("scan123") == "kg_scan123"

    def test_relationships_collection_name(self):
        assert _rels_collection("scan123") == "kg_rels_scan123"

    def test_different_scans_have_different_names(self):
        assert _entities_collection("scan_a") != _entities_collection("scan_b")
        assert _rels_collection("scan_a") != _rels_collection("scan_b")


# ---------------------------------------------------------------------------
# build_graph
# ---------------------------------------------------------------------------


class TestBuildGraph:
    @pytest.mark.asyncio
    async def test_returns_knowledge_graph_with_scan_id(self):
        """build_graph returns a KnowledgeGraph with the correct scan_id."""
        tracker, _, _ = make_tracker()
        graph = await tracker.build_graph("scan_001", [])
        assert isinstance(graph, KnowledgeGraph)
        assert graph.scan_id == "scan_001"

    @pytest.mark.asyncio
    async def test_parses_entities_from_lm_response(self):
        """Entities returned by LM are parsed into Entity objects."""
        lm_json = json.dumps(
            {
                "entities": [
                    {"id": "e1", "name": "Alice", "entity_type": "person", "attributes": {}}
                ],
                "relationships": [],
            }
        )
        tracker, _, _ = make_tracker(lm_response={"choices": [{"message": {"content": lm_json}}]})

        graph = await tracker.build_graph("scan_002", [{"url": "http://x.com", "markdown": "test"}])

        assert len(graph.entities) == 1
        assert graph.entities[0].name == "Alice"
        assert graph.entities[0].entity_type == "person"

    @pytest.mark.asyncio
    async def test_parses_relationships_from_lm_response(self):
        """Relationships returned by LM are parsed into Relationship objects."""
        lm_json = json.dumps(
            {
                "entities": [
                    {"id": "e1", "name": "Alice", "entity_type": "person", "attributes": {}},
                    {"id": "e2", "name": "Bob", "entity_type": "person", "attributes": {}},
                ],
                "relationships": [
                    {
                        "source_id": "e1",
                        "target_id": "e2",
                        "relation_type": "alias_of",
                        "confidence": 0.8,
                        "evidence": "same photo",
                    }
                ],
            }
        )
        tracker, _, _ = make_tracker(lm_response={"choices": [{"message": {"content": lm_json}}]})

        graph = await tracker.build_graph("scan_003", [])

        assert len(graph.relationships) == 1
        assert graph.relationships[0].source_id == "e1"
        assert graph.relationships[0].target_id == "e2"
        assert graph.relationships[0].confidence == 0.8

    @pytest.mark.asyncio
    async def test_returns_empty_graph_on_lm_failure(self):
        """If LM bridge raises an exception, returns graph with empty entities/relationships."""
        tracker, bridge, _ = make_tracker()
        bridge._make_request_with_retry = AsyncMock(side_effect=Exception("LM failure"))

        graph = await tracker.build_graph("scan_004", [])

        assert graph.entities == []
        assert graph.relationships == []

    @pytest.mark.asyncio
    async def test_stores_entities_in_chromadb(self):
        """build_graph calls add_documents for entities."""
        lm_json = json.dumps(
            {
                "entities": [
                    {"id": "e1", "name": "Alice", "entity_type": "person", "attributes": {}}
                ],
                "relationships": [],
            }
        )
        tracker, _, chroma = make_tracker(
            lm_response={"choices": [{"message": {"content": lm_json}}]}
        )

        await tracker.build_graph("scan_005", [])

        chroma.add_documents.assert_called()

    @pytest.mark.asyncio
    async def test_caps_crawl_results_at_10(self):
        """Only first 10 crawl results are included in the LM prompt."""
        tracker, bridge, _ = make_tracker()

        crawl_results = [
            {"url": f"http://example.com/{i}", "markdown": f"content {i}"} for i in range(20)
        ]
        await tracker.build_graph("scan_006", crawl_results)

        # The prompt is built from at most 10 results
        call_args = bridge._make_request_with_retry.call_args
        prompt_content = call_args[1]["messages"][1]["content"]
        # Count URL mentions — should be at most 10
        url_count = prompt_content.count("URL: http://example.com/")
        assert url_count <= 10

    @pytest.mark.asyncio
    async def test_graph_has_timestamps(self):
        """Returned graph has non-empty created_at and updated_at."""
        tracker, _, _ = make_tracker()
        graph = await tracker.build_graph("scan_007", [])
        assert graph.created_at
        assert graph.updated_at
        assert "T" in graph.created_at  # ISO format


# ---------------------------------------------------------------------------
# get_graph
# ---------------------------------------------------------------------------


class TestGetGraph:
    @pytest.mark.asyncio
    async def test_returns_none_when_no_entities_stored(self):
        """Returns None when no entity documents exist for the scan."""
        tracker, _, chroma = make_tracker()
        chroma.get_documents = MagicMock(return_value={"documents": []})

        result = await tracker.get_graph("missing_scan")

        assert result is None

    @pytest.mark.asyncio
    async def test_returns_graph_with_entities(self):
        """Returns a KnowledgeGraph when entity documents exist."""
        entity = Entity(id="e1", name="Alice", entity_type="person")
        entity_json = json.dumps(entity.model_dump())

        tracker, _, chroma = make_tracker()

        def fake_get_documents(collection_name, **kwargs):
            if collection_name.startswith("kg_rels_"):
                return {"documents": []}
            return {"documents": [entity_json]}

        chroma.get_documents = MagicMock(side_effect=fake_get_documents)

        result = await tracker.get_graph("scan_001")

        assert result is not None
        assert len(result.entities) == 1
        assert result.entities[0].name == "Alice"

    @pytest.mark.asyncio
    async def test_returns_relationships_alongside_entities(self):
        """get_graph includes relationships from the rels collection."""
        entity = Entity(id="e1", name="Alice", entity_type="person")
        rel = Relationship(source_id="e1", target_id="e2", relation_type="alias_of", confidence=0.9)

        tracker, _, chroma = make_tracker()

        def fake_get_documents(collection_name, **kwargs):
            if collection_name.startswith("kg_rels_"):
                return {"documents": [json.dumps(rel.model_dump())]}
            return {"documents": [json.dumps(entity.model_dump())]}

        chroma.get_documents = MagicMock(side_effect=fake_get_documents)

        result = await tracker.get_graph("scan_001")

        assert result is not None
        assert len(result.relationships) == 1


# ---------------------------------------------------------------------------
# get_entity
# ---------------------------------------------------------------------------


class TestGetEntity:
    @pytest.mark.asyncio
    async def test_returns_entity_when_found(self):
        """Returns an Entity when the document exists."""
        entity = Entity(id="e1", name="Alice", entity_type="person")
        tracker, _, chroma = make_tracker()
        chroma.get_documents = MagicMock(
            return_value={"documents": [json.dumps(entity.model_dump())]}
        )

        result = await tracker.get_entity("scan_001", "e1")

        assert result is not None
        assert result.id == "e1"
        assert result.name == "Alice"

    @pytest.mark.asyncio
    async def test_returns_none_when_not_found(self):
        """Returns None when no document exists for the entity ID."""
        tracker, _, chroma = make_tracker()
        chroma.get_documents = MagicMock(return_value={"documents": [None]})

        result = await tracker.get_entity("scan_001", "missing")

        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_on_chromadb_exception(self):
        """Returns None when ChromaDB raises an exception."""
        tracker, _, chroma = make_tracker()
        chroma.get_documents = MagicMock(side_effect=Exception("DB error"))

        result = await tracker.get_entity("scan_001", "e1")

        assert result is None


# ---------------------------------------------------------------------------
# get_entity_relationships
# ---------------------------------------------------------------------------


class TestGetEntityRelationships:
    @pytest.mark.asyncio
    async def test_returns_relationships_where_entity_is_source(self):
        """Returns relationships where entity_id is the source."""
        rel = Relationship(source_id="e1", target_id="e2", relation_type="alias_of", confidence=0.9)
        other_rel = Relationship(
            source_id="e3", target_id="e4", relation_type="owns", confidence=0.5
        )

        tracker, _, chroma = make_tracker()
        chroma.get_documents = MagicMock(
            return_value={
                "documents": [json.dumps(rel.model_dump()), json.dumps(other_rel.model_dump())]
            }
        )

        results = await tracker.get_entity_relationships("scan_001", "e1")

        assert len(results) == 1
        assert results[0].source_id == "e1"

    @pytest.mark.asyncio
    async def test_returns_relationships_where_entity_is_target(self):
        """Returns relationships where entity_id is the target."""
        rel = Relationship(
            source_id="e2", target_id="e1", relation_type="linked_to", confidence=0.7
        )

        tracker, _, chroma = make_tracker()
        chroma.get_documents = MagicMock(return_value={"documents": [json.dumps(rel.model_dump())]})

        results = await tracker.get_entity_relationships("scan_001", "e1")

        assert len(results) == 1
        assert results[0].target_id == "e1"

    @pytest.mark.asyncio
    async def test_returns_empty_when_no_relationships(self):
        """Returns empty list when entity has no relationships."""
        tracker, _, chroma = make_tracker()
        chroma.get_documents = MagicMock(return_value={"documents": []})

        results = await tracker.get_entity_relationships("scan_001", "e99")

        assert results == []


# ---------------------------------------------------------------------------
# get_connected_entities (BFS graph traversal)
# ---------------------------------------------------------------------------


class TestGetConnectedEntities:
    @pytest.mark.asyncio
    async def test_returns_seed_entity_at_depth_0(self):
        """Seed entity is always included in the result."""
        e1 = make_entity("e1", "Alice")
        rel = make_relationship("e1", "e2")

        tracker, _, chroma = make_tracker()

        async def fake_get_entities(scan_id):
            return [e1]

        async def fake_get_relationships(scan_id):
            return [rel]

        tracker._get_entities = fake_get_entities
        tracker._get_relationships = fake_get_relationships

        entities, rels = await tracker.get_connected_entities("scan_001", "e1", depth=0)

        assert any(e.id == "e1" for e in entities)

    @pytest.mark.asyncio
    async def test_expands_one_hop_at_depth_1(self):
        """At depth=1, returns directly connected entities."""
        e1 = make_entity("e1", "Alice")
        e2 = make_entity("e2", "Bob")
        rel = make_relationship("e1", "e2")

        tracker, _, chroma = make_tracker()

        async def fake_get_entities(scan_id):
            return [e1, e2]

        async def fake_get_relationships(scan_id):
            return [rel]

        tracker._get_entities = fake_get_entities
        tracker._get_relationships = fake_get_relationships

        entities, rels = await tracker.get_connected_entities("scan_001", "e1", depth=1)

        entity_ids = {e.id for e in entities}
        assert "e1" in entity_ids
        assert "e2" in entity_ids

    @pytest.mark.asyncio
    async def test_does_not_revisit_nodes(self):
        """BFS does not revisit already-visited nodes (no infinite loops)."""
        e1 = make_entity("e1", "Alice")
        e2 = make_entity("e2", "Bob")
        # Bidirectional relationship
        rel_forward = make_relationship("e1", "e2")
        rel_backward = make_relationship("e2", "e1")

        tracker, _, chroma = make_tracker()

        async def fake_get_entities(scan_id):
            return [e1, e2]

        async def fake_get_relationships(scan_id):
            return [rel_forward, rel_backward]

        tracker._get_entities = fake_get_entities
        tracker._get_relationships = fake_get_relationships

        entities, rels = await tracker.get_connected_entities("scan_001", "e1", depth=5)

        # Should not have duplicates
        entity_ids = [e.id for e in entities]
        assert len(entity_ids) == len(set(entity_ids))

    @pytest.mark.asyncio
    async def test_stops_at_specified_depth(self):
        """BFS stops at the specified depth."""
        e1 = make_entity("e1", "Alice")
        e2 = make_entity("e2", "Bob")
        e3 = make_entity("e3", "Carol")
        rel1 = make_relationship("e1", "e2")
        rel2 = make_relationship("e2", "e3")

        tracker, _, chroma = make_tracker()

        async def fake_get_entities(scan_id):
            return [e1, e2, e3]

        async def fake_get_relationships(scan_id):
            return [rel1, rel2]

        tracker._get_entities = fake_get_entities
        tracker._get_relationships = fake_get_relationships

        entities_d1, _ = await tracker.get_connected_entities("scan_001", "e1", depth=1)
        entities_d2, _ = await tracker.get_connected_entities("scan_001", "e1", depth=2)

        ids_d1 = {e.id for e in entities_d1}
        ids_d2 = {e.id for e in entities_d2}

        assert "e3" not in ids_d1
        assert "e3" in ids_d2


# ---------------------------------------------------------------------------
# merge_entities
# ---------------------------------------------------------------------------


class TestMergeEntities:
    @pytest.mark.asyncio
    async def test_returns_false_when_source_not_found(self):
        """Returns False when source entity doesn't exist."""
        tracker, _, chroma = make_tracker()

        async def fake_get_entity(scan_id, entity_id):
            return None  # source not found

        tracker.get_entity = fake_get_entity

        result = await tracker.merge_entities("scan_001", "missing", "e2")

        assert result is False

    @pytest.mark.asyncio
    async def test_returns_false_when_target_not_found(self):
        """Returns False when target entity doesn't exist."""
        tracker, _, chroma = make_tracker()
        source = make_entity("e1", "Alice")

        async def fake_get_entity(scan_id, entity_id):
            if entity_id == "e1":
                return source
            return None  # target not found

        tracker.get_entity = fake_get_entity

        result = await tracker.merge_entities("scan_001", "e1", "missing")

        assert result is False

    @pytest.mark.asyncio
    async def test_returns_true_on_successful_merge(self):
        """Returns True when both entities exist and merge succeeds."""
        source = make_entity("e1", "Alice")
        target = make_entity("e2", "Bob")

        tracker, _, chroma = make_tracker()
        chroma.get_documents = MagicMock(return_value={"documents": []})

        async def fake_get_entity(scan_id, entity_id):
            if entity_id == "e1":
                return source
            return target

        tracker.get_entity = fake_get_entity

        result = await tracker.merge_entities("scan_001", "e1", "e2")

        assert result is True

    @pytest.mark.asyncio
    async def test_source_entity_is_deleted_after_merge(self):
        """The source entity document is deleted from ChromaDB after merge."""
        source = make_entity("e1", "Alice")
        target = make_entity("e2", "Bob")

        tracker, _, chroma = make_tracker()
        chroma.get_documents = MagicMock(return_value={"documents": []})

        async def fake_get_entity(scan_id, entity_id):
            if entity_id == "e1":
                return source
            return target

        tracker.get_entity = fake_get_entity

        await tracker.merge_entities("scan_001", "e1", "e2")

        chroma.delete_documents.assert_called_once()
        call_kwargs = chroma.delete_documents.call_args[1]
        assert call_kwargs["ids"] == ["e1"]


# ---------------------------------------------------------------------------
# list_entity_types
# ---------------------------------------------------------------------------


class TestListEntityTypes:
    @pytest.mark.asyncio
    async def test_counts_by_entity_type(self):
        """Returns correct counts per entity type."""
        entities = [
            make_entity("e1", "Alice", "person"),
            make_entity("e2", "Bob", "person"),
            make_entity("e3", "Acme", "organisation"),
        ]

        tracker, _, chroma = make_tracker()

        async def fake_get_entities(scan_id):
            return entities

        tracker._get_entities = fake_get_entities

        counts = await tracker.list_entity_types("scan_001")

        assert counts["person"] == 2
        assert counts["organisation"] == 1

    @pytest.mark.asyncio
    async def test_returns_empty_dict_for_missing_scan(self):
        """Returns empty dict when no entities exist."""
        tracker, _, chroma = make_tracker()

        async def fake_get_entities(scan_id):
            return []

        tracker._get_entities = fake_get_entities

        counts = await tracker.list_entity_types("scan_999")

        assert counts == {}


# ---------------------------------------------------------------------------
# search_entities
# ---------------------------------------------------------------------------


class TestSearchEntities:
    @pytest.mark.asyncio
    async def test_returns_matching_entities(self):
        """Returns entities from ChromaDB search results."""
        entity = Entity(id="e1", name="Alice", entity_type="person")
        entity_json = json.dumps(entity.model_dump())

        tracker, _, chroma = make_tracker()
        chroma.search = MagicMock(return_value={"documents": [[entity_json]]})

        results = await tracker.search_entities("scan_001", "Alice")

        assert len(results) == 1
        assert results[0].name == "Alice"

    @pytest.mark.asyncio
    async def test_returns_empty_list_on_exception(self):
        """Returns empty list when ChromaDB search raises an exception."""
        tracker, _, chroma = make_tracker()
        chroma.search = MagicMock(side_effect=Exception("DB error"))

        results = await tracker.search_entities("scan_001", "query")

        assert results == []

    @pytest.mark.asyncio
    async def test_passes_entity_type_filter_to_chromadb(self):
        """entity_type filter is passed to ChromaDB search."""
        tracker, _, chroma = make_tracker()
        chroma.search = MagicMock(return_value={"documents": [[]]})

        await tracker.search_entities("scan_001", "Alice", entity_type="person")

        call_kwargs = chroma.search.call_args[1]
        assert call_kwargs.get("where") == {"entity_type": "person"}

    @pytest.mark.asyncio
    async def test_no_filter_when_entity_type_is_none(self):
        """No 'where' filter is passed when entity_type is None."""
        tracker, _, chroma = make_tracker()
        chroma.search = MagicMock(return_value={"documents": [[]]})

        await tracker.search_entities("scan_001", "Alice", entity_type=None)

        call_kwargs = chroma.search.call_args[1]
        assert "where" not in call_kwargs
