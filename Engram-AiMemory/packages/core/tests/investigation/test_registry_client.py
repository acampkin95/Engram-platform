"""Tests for registry_client.py - GlobalRegistryClient."""

import json
from datetime import date, datetime
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from memory_system.compat import UTC
from memory_system.config import SUBJECT_ORGANISATION, SUBJECT_PERSON
from memory_system.investigation.models import (
    SubjectOrgCreate,
    SubjectOrgResponse,
    SubjectPersonCreate,
    SubjectPersonResponse,
)
from memory_system.investigation.registry_client import GlobalRegistryClient


class MockMetadata:
    def __init__(self, certainty=0.0):
        self.certainty = certainty


class MockObject:
    def __init__(self, uuid_str, properties, certainty=0.0):
        self.uuid = uuid_str
        self.properties = properties
        self.metadata = MockMetadata(certainty)


class MockQuery:
    def __init__(self):
        self._objects = []

    def near_text(self, query=None, limit=None, return_metadata=None, filters=None):
        return MagicMock(objects=self._objects[:limit] if limit else self._objects)

    def fetch_objects(self, filters=None, limit=None):
        return MagicMock(objects=self._objects[:limit] if limit else self._objects)

    def fetch_object_by_id(self, uuid):
        for obj in self._objects:
            if str(obj.uuid) == uuid:
                return obj
        return None

    def set_objects(self, objects):
        self._objects = objects


class MockData:
    def __init__(self):
        self._inserted = {}
        self._updated = {}

    def insert(self, uuid, properties):
        self._inserted[uuid] = properties

    def update(self, uuid, properties):
        self._updated[uuid] = properties


class MockCollection:
    def __init__(self, name):
        self._name = name
        self._query = MockQuery()
        self._data = MockData()

    @property
    def query(self):
        return self._query

    @property
    def data(self):
        return self._data


class MockCollections:
    def __init__(self):
        self._collections = {}

    def get(self, name):
        if name not in self._collections:
            self._collections[name] = MockCollection(name)
        return self._collections[name]


class MockWeaviateClient:
    def __init__(self):
        self._collections = MockCollections()

    @property
    def collections(self):
        return self._collections


def _make_mock_client():
    return MockWeaviateClient()


def _make_person_create(name="John Smith", matter_ids=None):
    return SubjectPersonCreate(
        canonical_name=name,
        matter_ids=matter_ids or ["CASE-001"],
        aliases=["Johnny"],
    )


def _make_org_create(name="Acme Corp", matter_ids=None):
    return SubjectOrgCreate(
        canonical_name=name,
        matter_ids=matter_ids or ["CASE-001"],
        aliases=["Acme"],
    )


class TestGlobalRegistryClientInit:
    def test_init_stores_weaviate_client(self):
        mock_weaviate = MagicMock()
        client = GlobalRegistryClient(mock_weaviate)
        assert client._client is mock_weaviate


class TestUpsertPerson:
    @pytest.mark.asyncio
    async def test_inserts_new_person(self):
        mock_client = _make_mock_client()
        registry = GlobalRegistryClient(mock_client)

        person = _make_person_create()
        result = await registry.upsert_person(person)

        assert isinstance(result, SubjectPersonResponse)
        assert result.canonical_name == "John Smith"
        assert "CASE-001" in result.matter_ids

    @pytest.mark.asyncio
    async def test_updates_existing_person_above_threshold(self):
        mock_client = _make_mock_client()
        collection = mock_client.collections.get(SUBJECT_PERSON)
        existing_uuid = str(uuid4())
        now = datetime.now(UTC).isoformat()

        collection.query.set_objects(
            [
                MockObject(
                    existing_uuid,
                    {
                        "canonical_name": "John Smith",
                        "aliases": ["J"],
                        "matter_ids": ["CASE-OLD"],
                        "created_at": now,
                        "updated_at": now,
                    },
                    certainty=0.96,
                )
            ]
        )

        registry = GlobalRegistryClient(mock_client)
        person = SubjectPersonCreate(
            canonical_name="John Smith",
            matter_ids=["CASE-NEW"],
            aliases=["Johnny"],
        )
        result = await registry.upsert_person(person)

        assert "CASE-OLD" in result.matter_ids
        assert "CASE-NEW" in result.matter_ids
        assert "J" in result.aliases
        assert "Johnny" in result.aliases

    @pytest.mark.asyncio
    async def test_inserts_new_below_threshold(self):
        mock_client = _make_mock_client()
        collection = mock_client.collections.get(SUBJECT_PERSON)
        existing_uuid = str(uuid4())
        now = datetime.now(UTC).isoformat()

        collection.query.set_objects(
            [
                MockObject(
                    existing_uuid,
                    {
                        "canonical_name": "John Smith",
                        "aliases": ["J"],
                        "matter_ids": ["CASE-OLD"],
                        "created_at": now,
                        "updated_at": now,
                    },
                    certainty=0.80,
                )
            ]
        )

        registry = GlobalRegistryClient(mock_client)
        person = _make_person_create()
        result = await registry.upsert_person(person)

        assert existing_uuid not in collection.data._inserted
        assert result.id != existing_uuid

    @pytest.mark.asyncio
    async def test_handles_search_exception(self):
        mock_client = _make_mock_client()
        collection = mock_client.collections.get(SUBJECT_PERSON)

        def failing_near_text(*args, **kwargs):
            raise RuntimeError("Search failed")

        collection.query.near_text = failing_near_text

        registry = GlobalRegistryClient(mock_client)
        person = _make_person_create()
        result = await registry.upsert_person(person)

        assert isinstance(result, SubjectPersonResponse)

    @pytest.mark.asyncio
    async def test_stores_date_of_birth(self):
        mock_client = _make_mock_client()
        registry = GlobalRegistryClient(mock_client)

        person = SubjectPersonCreate(
            canonical_name="DOB Person",
            matter_ids=["CASE-001"],
            date_of_birth=date(1990, 1, 15),
        )
        await registry.upsert_person(person)

        inserted = list(mock_client.collections.get(SUBJECT_PERSON).data._inserted.values())
        assert len(inserted) == 1
        assert "1990-01-15" in inserted[0]["date_of_birth"]

    @pytest.mark.asyncio
    async def test_stores_identifiers_as_json(self):
        mock_client = _make_mock_client()
        registry = GlobalRegistryClient(mock_client)

        identifiers = {"passport": "A1234567", "tax_id": "TX-999"}
        person = SubjectPersonCreate(
            canonical_name="ID Person",
            matter_ids=["CASE-001"],
            identifiers=identifiers,
        )
        await registry.upsert_person(person)

        inserted = list(mock_client.collections.get(SUBJECT_PERSON).data._inserted.values())
        assert len(inserted) == 1
        assert json.loads(inserted[0]["identifiers"]) == identifiers


class TestUpsertOrganisation:
    @pytest.mark.asyncio
    async def test_inserts_new_organisation(self):
        mock_client = _make_mock_client()
        registry = GlobalRegistryClient(mock_client)

        org = _make_org_create()
        result = await registry.upsert_organisation(org)

        assert isinstance(result, SubjectOrgResponse)
        assert result.canonical_name == "Acme Corp"
        assert "CASE-001" in result.matter_ids

    @pytest.mark.asyncio
    async def test_updates_existing_organisation_above_threshold(self):
        mock_client = _make_mock_client()
        collection = mock_client.collections.get(SUBJECT_ORGANISATION)
        existing_uuid = str(uuid4())
        now = datetime.now(UTC).isoformat()

        collection.query.set_objects(
            [
                MockObject(
                    existing_uuid,
                    {
                        "canonical_name": "Acme Corp",
                        "aliases": ["Acme Inc"],
                        "matter_ids": ["CASE-OLD"],
                        "created_at": now,
                        "updated_at": now,
                    },
                    certainty=0.97,
                )
            ]
        )

        registry = GlobalRegistryClient(mock_client)
        org = SubjectOrgCreate(
            canonical_name="Acme Corp",
            matter_ids=["CASE-NEW"],
            aliases=["Acme"],
        )
        result = await registry.upsert_organisation(org)

        assert "CASE-OLD" in result.matter_ids
        assert "CASE-NEW" in result.matter_ids

    @pytest.mark.asyncio
    async def test_stores_org_fields(self):
        mock_client = _make_mock_client()
        registry = GlobalRegistryClient(mock_client)

        org = SubjectOrgCreate(
            canonical_name="Tech Ltd",
            matter_ids=["CASE-001"],
            registration_number="REG123",
            jurisdiction="AU",
            org_type="PTY_LTD",
        )
        await registry.upsert_organisation(org)

        inserted = list(mock_client.collections.get(SUBJECT_ORGANISATION).data._inserted.values())
        assert len(inserted) == 1
        assert inserted[0]["registration_number"] == "REG123"
        assert inserted[0]["jurisdiction"] == "AU"
        assert inserted[0]["org_type"] == "PTY_LTD"


class TestSearchPersons:
    @pytest.mark.asyncio
    async def test_returns_matching_persons(self):
        mock_client = _make_mock_client()
        collection = mock_client.collections.get(SUBJECT_PERSON)
        uuid_str = str(uuid4())
        now = datetime.now(UTC).isoformat()

        collection.query.set_objects(
            [
                MockObject(
                    uuid_str,
                    {
                        "canonical_name": "John Smith",
                        "aliases": [],
                        "matter_ids": ["CASE-001"],
                        "created_at": now,
                        "updated_at": now,
                    },
                )
            ]
        )

        registry = GlobalRegistryClient(mock_client)
        results = await registry.search_persons("John")

        assert len(results) == 1
        assert results[0].canonical_name == "John Smith"

    @pytest.mark.asyncio
    async def test_returns_empty_on_error(self):
        mock_client = _make_mock_client()
        collection = mock_client.collections.get(SUBJECT_PERSON)

        def failing_near_text(*args, **kwargs):
            raise RuntimeError("Search failed")

        collection.query.near_text = failing_near_text

        registry = GlobalRegistryClient(mock_client)
        results = await registry.search_persons("John")

        assert results == []

    @pytest.mark.asyncio
    async def test_respects_limit(self):
        mock_client = _make_mock_client()
        collection = mock_client.collections.get(SUBJECT_PERSON)
        now = datetime.now(UTC).isoformat()

        objects = [
            MockObject(
                str(uuid4()),
                {
                    "canonical_name": f"Person {i}",
                    "aliases": [],
                    "matter_ids": [],
                    "created_at": now,
                    "updated_at": now,
                },
            )
            for i in range(20)
        ]
        collection.query.set_objects(objects)

        registry = GlobalRegistryClient(mock_client)
        results = await registry.search_persons("Person", limit=5)

        assert len(results) == 5


class TestSearchOrganisations:
    @pytest.mark.asyncio
    async def test_returns_matching_orgs(self):
        mock_client = _make_mock_client()
        collection = mock_client.collections.get(SUBJECT_ORGANISATION)
        uuid_str = str(uuid4())
        now = datetime.now(UTC).isoformat()

        collection.query.set_objects(
            [
                MockObject(
                    uuid_str,
                    {
                        "canonical_name": "Acme Corp",
                        "aliases": [],
                        "matter_ids": ["CASE-001"],
                        "created_at": now,
                        "updated_at": now,
                    },
                )
            ]
        )

        registry = GlobalRegistryClient(mock_client)
        results = await registry.search_organisations("Acme")

        assert len(results) == 1
        assert results[0].canonical_name == "Acme Corp"


class TestAddMatterToSubject:
    @pytest.mark.asyncio
    async def test_appends_matter_id(self):
        mock_client = _make_mock_client()
        collection = mock_client.collections.get(SUBJECT_PERSON)
        uuid_str = str(uuid4())
        now = datetime.now(UTC).isoformat()

        collection.query.set_objects(
            [
                MockObject(
                    uuid_str,
                    {
                        "canonical_name": "John Smith",
                        "matter_ids": ["CASE-001"],
                        "created_at": now,
                        "updated_at": now,
                    },
                )
            ]
        )

        registry = GlobalRegistryClient(mock_client)
        await registry.add_matter_to_subject(uuid_str, "CASE-002", SUBJECT_PERSON)

        assert uuid_str in collection.data._updated
        assert "CASE-002" in collection.data._updated[uuid_str]["matter_ids"]

    @pytest.mark.asyncio
    async def test_does_not_duplicate(self):
        mock_client = _make_mock_client()
        collection = mock_client.collections.get(SUBJECT_PERSON)
        uuid_str = str(uuid4())
        now = datetime.now(UTC).isoformat()

        collection.query.set_objects(
            [
                MockObject(
                    uuid_str,
                    {
                        "canonical_name": "John Smith",
                        "matter_ids": ["CASE-001"],
                        "created_at": now,
                        "updated_at": now,
                    },
                )
            ]
        )

        registry = GlobalRegistryClient(mock_client)
        await registry.add_matter_to_subject(uuid_str, "CASE-001", SUBJECT_PERSON)

        if uuid_str in collection.data._updated:
            matter_ids = collection.data._updated[uuid_str]["matter_ids"]
            assert matter_ids.count("CASE-001") == 1

    @pytest.mark.asyncio
    async def test_handles_missing_subject(self):
        mock_client = _make_mock_client()
        registry = GlobalRegistryClient(mock_client)

        await registry.add_matter_to_subject("nonexistent-uuid", "CASE-001", SUBJECT_PERSON)

    @pytest.mark.asyncio
    async def test_handles_exception(self):
        mock_client = _make_mock_client()
        collection = mock_client.collections.get(SUBJECT_PERSON)

        def failing_fetch(uuid):
            raise RuntimeError("Fetch failed")

        collection.query.fetch_object_by_id = failing_fetch

        registry = GlobalRegistryClient(mock_client)
        await registry.add_matter_to_subject("any-uuid", "CASE-001", SUBJECT_PERSON)


class TestGetPerson:
    @pytest.mark.asyncio
    async def test_returns_person_by_uuid(self):
        mock_client = _make_mock_client()
        collection = mock_client.collections.get(SUBJECT_PERSON)
        uuid_str = str(uuid4())
        now = datetime.now(UTC).isoformat()

        collection.query.set_objects(
            [
                MockObject(
                    uuid_str,
                    {
                        "canonical_name": "John Smith",
                        "aliases": ["J"],
                        "matter_ids": ["CASE-001"],
                        "created_at": now,
                        "updated_at": now,
                    },
                )
            ]
        )

        registry = GlobalRegistryClient(mock_client)
        result = await registry.get_person(uuid_str)

        assert result is not None
        assert result.canonical_name == "John Smith"
        assert "J" in result.aliases

    @pytest.mark.asyncio
    async def test_returns_none_when_not_found(self):
        mock_client = _make_mock_client()
        registry = GlobalRegistryClient(mock_client)

        result = await registry.get_person("nonexistent-uuid")

        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_on_exception(self):
        mock_client = _make_mock_client()
        collection = mock_client.collections.get(SUBJECT_PERSON)

        def failing_fetch(uuid):
            raise RuntimeError("Fetch failed")

        collection.query.fetch_object_by_id = failing_fetch

        registry = GlobalRegistryClient(mock_client)
        result = await registry.get_person("any-uuid")

        assert result is None


class TestGetOrganisation:
    @pytest.mark.asyncio
    async def test_returns_org_by_uuid(self):
        mock_client = _make_mock_client()
        collection = mock_client.collections.get(SUBJECT_ORGANISATION)
        uuid_str = str(uuid4())
        now = datetime.now(UTC).isoformat()

        collection.query.set_objects(
            [
                MockObject(
                    uuid_str,
                    {
                        "canonical_name": "Acme Corp",
                        "aliases": [],
                        "matter_ids": ["CASE-001"],
                        "created_at": now,
                        "updated_at": now,
                    },
                )
            ]
        )

        registry = GlobalRegistryClient(mock_client)
        result = await registry.get_organisation(uuid_str)

        assert result is not None
        assert result.canonical_name == "Acme Corp"

    @pytest.mark.asyncio
    async def test_returns_none_when_not_found(self):
        mock_client = _make_mock_client()
        registry = GlobalRegistryClient(mock_client)

        result = await registry.get_organisation("nonexistent-uuid")

        assert result is None


class TestListPersonsForMatter:
    @pytest.mark.asyncio
    async def test_returns_persons_for_matter(self):
        mock_client = _make_mock_client()
        collection = mock_client.collections.get(SUBJECT_PERSON)
        now = datetime.now(UTC).isoformat()

        collection.query.set_objects(
            [
                MockObject(
                    str(uuid4()),
                    {
                        "canonical_name": "Person A",
                        "aliases": [],
                        "matter_ids": ["CASE-001"],
                        "created_at": now,
                        "updated_at": now,
                    },
                )
            ]
        )

        registry = GlobalRegistryClient(mock_client)
        results = await registry.list_persons_for_matter("CASE-001")

        assert len(results) == 1
        assert results[0].canonical_name == "Person A"

    @pytest.mark.asyncio
    async def test_returns_empty_on_error(self):
        mock_client = _make_mock_client()
        collection = mock_client.collections.get(SUBJECT_PERSON)

        def failing_fetch(*args, **kwargs):
            raise RuntimeError("Fetch failed")

        collection.query.fetch_objects = failing_fetch

        registry = GlobalRegistryClient(mock_client)
        results = await registry.list_persons_for_matter("CASE-001")

        assert results == []


class TestListOrganisationsForMatter:
    @pytest.mark.asyncio
    async def test_returns_orgs_for_matter(self):
        mock_client = _make_mock_client()
        collection = mock_client.collections.get(SUBJECT_ORGANISATION)
        now = datetime.now(UTC).isoformat()

        collection.query.set_objects(
            [
                MockObject(
                    str(uuid4()),
                    {
                        "canonical_name": "Org A",
                        "aliases": [],
                        "matter_ids": ["CASE-001"],
                        "created_at": now,
                        "updated_at": now,
                    },
                )
            ]
        )

        registry = GlobalRegistryClient(mock_client)
        results = await registry.list_organisations_for_matter("CASE-001")

        assert len(results) == 1
        assert results[0].canonical_name == "Org A"


class TestObjToPersonResponse:
    def test_converts_object(self):
        mock_client = _make_mock_client()
        registry = GlobalRegistryClient(mock_client)

        now = datetime.now(UTC)
        obj = MockObject(
            str(uuid4()),
            {
                "canonical_name": "Test Person",
                "aliases": ["Alias1"],
                "matter_ids": ["CASE-001"],
                "created_at": now.isoformat(),
                "updated_at": now.isoformat(),
            },
        )

        result = registry._obj_to_person_response(obj)

        assert isinstance(result, SubjectPersonResponse)
        assert result.canonical_name == "Test Person"
        assert "Alias1" in result.aliases

    def test_handles_missing_fields(self):
        mock_client = _make_mock_client()
        registry = GlobalRegistryClient(mock_client)

        obj = MockObject(str(uuid4()), {})

        result = registry._obj_to_person_response(obj)

        assert result.canonical_name == ""
        assert result.aliases == []
        assert result.matter_ids == []


class TestObjToOrgResponse:
    def test_converts_object(self):
        mock_client = _make_mock_client()
        registry = GlobalRegistryClient(mock_client)

        now = datetime.now(UTC)
        obj = MockObject(
            str(uuid4()),
            {
                "canonical_name": "Test Org",
                "aliases": ["Alias1"],
                "matter_ids": ["CASE-001"],
                "created_at": now.isoformat(),
                "updated_at": now.isoformat(),
            },
        )

        result = registry._obj_to_org_response(obj)

        assert isinstance(result, SubjectOrgResponse)
        assert result.canonical_name == "Test Org"
