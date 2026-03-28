"""Global entity registry client — SubjectPerson and SubjectOrganisation (no multi-tenancy)."""
from __future__ import annotations

import json
from datetime import datetime
from uuid import uuid4

from rich.console import Console

from memory_system.compat import UTC
from memory_system.config import SUBJECT_ORGANISATION, SUBJECT_PERSON
from memory_system.investigation.models import (
    SubjectOrgCreate,
    SubjectOrgResponse,
    SubjectPersonCreate,
    SubjectPersonResponse,
)

console = Console()


class GlobalRegistryClient:
    """CRUD + semantic search for SubjectPerson and SubjectOrganisation (no multi-tenancy)."""

    # Similarity threshold for upsert deduplication: certainty > 0.95 (distance < 0.05)
    UPSERT_CERTAINTY_THRESHOLD = 0.95

    def __init__(self, weaviate_client):
        self._client = weaviate_client

    async def upsert_person(self, person: SubjectPersonCreate) -> SubjectPersonResponse:
        """Insert or update person.

        Uses near_text with certainty > 0.95 on canonical_name.
        If result found above threshold: update matter_ids and aliases.
        Otherwise insert new.
        """
        from weaviate.classes.query import MetadataQuery

        collection = self._client.collections.get(SUBJECT_PERSON)

        # Search for existing by canonical_name
        try:
            results = collection.query.near_text(
                query=person.canonical_name,
                limit=1,
                return_metadata=MetadataQuery(certainty=True),
            )
            if results.objects and (results.objects[0].metadata.certainty or 0) >= self.UPSERT_CERTAINTY_THRESHOLD:
                # Update existing
                obj = results.objects[0]
                existing_matter_ids = list(set(obj.properties.get("matter_ids", []) + person.matter_ids))
                existing_aliases = list(set(obj.properties.get("aliases", []) + person.aliases))
                now = datetime.now(UTC)
                collection.data.update(
                    uuid=str(obj.uuid),
                    properties={
                        "matter_ids": existing_matter_ids,
                        "aliases": existing_aliases,
                        "updated_at": now.isoformat(),
                    },
                )
                return SubjectPersonResponse(
                    id=str(obj.uuid),
                    canonical_name=obj.properties.get("canonical_name", person.canonical_name),
                    aliases=existing_aliases,
                    matter_ids=existing_matter_ids,
                    created_at=obj.properties.get("created_at") or now,
                    updated_at=now,
                )
        except Exception:
            pass  # Fall through to insert

        # Insert new
        now = datetime.now(UTC)
        weaviate_id = str(uuid4())
        props = {
            "canonical_name": person.canonical_name,
            "aliases": person.aliases,
            "matter_ids": person.matter_ids,
            "date_of_birth": person.date_of_birth.isoformat() if person.date_of_birth else "",
            "identifiers": json.dumps(person.identifiers),
            "notes": person.notes,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
        }
        collection.data.insert(uuid=weaviate_id, properties=props)
        return SubjectPersonResponse(
            id=weaviate_id,
            canonical_name=person.canonical_name,
            aliases=person.aliases,
            matter_ids=person.matter_ids,
            created_at=now,
            updated_at=now,
        )

    async def upsert_organisation(self, org: SubjectOrgCreate) -> SubjectOrgResponse:
        """Insert or update organisation. Same dedup logic as upsert_person."""
        from weaviate.classes.query import MetadataQuery

        collection = self._client.collections.get(SUBJECT_ORGANISATION)

        try:
            results = collection.query.near_text(
                query=org.canonical_name,
                limit=1,
                return_metadata=MetadataQuery(certainty=True),
            )
            if results.objects and (results.objects[0].metadata.certainty or 0) >= self.UPSERT_CERTAINTY_THRESHOLD:
                obj = results.objects[0]
                existing_matter_ids = list(set(obj.properties.get("matter_ids", []) + org.matter_ids))
                existing_aliases = list(set(obj.properties.get("aliases", []) + org.aliases))
                now = datetime.now(UTC)
                collection.data.update(
                    uuid=str(obj.uuid),
                    properties={
                        "matter_ids": existing_matter_ids,
                        "aliases": existing_aliases,
                        "updated_at": now.isoformat(),
                    },
                )
                return SubjectOrgResponse(
                    id=str(obj.uuid),
                    canonical_name=obj.properties.get("canonical_name", org.canonical_name),
                    aliases=existing_aliases,
                    matter_ids=existing_matter_ids,
                    created_at=obj.properties.get("created_at") or now,
                    updated_at=now,
                )
        except Exception:
            pass

        now = datetime.now(UTC)
        weaviate_id = str(uuid4())
        props = {
            "canonical_name": org.canonical_name,
            "aliases": org.aliases,
            "matter_ids": org.matter_ids,
            "registration_number": org.registration_number,
            "jurisdiction": org.jurisdiction,
            "org_type": org.org_type,
            "identifiers": json.dumps(org.identifiers),
            "notes": org.notes,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
        }
        collection.data.insert(uuid=weaviate_id, properties=props)
        return SubjectOrgResponse(
            id=weaviate_id,
            canonical_name=org.canonical_name,
            aliases=org.aliases,
            matter_ids=org.matter_ids,
            created_at=now,
            updated_at=now,
        )

    async def search_persons(self, query: str, limit: int = 10) -> list[SubjectPersonResponse]:
        """Semantic search across all persons."""
        collection = self._client.collections.get(SUBJECT_PERSON)
        try:
            results = collection.query.near_text(query=query, limit=limit)
            return [self._obj_to_person_response(obj) for obj in results.objects]
        except Exception as exc:
            console.print(f"[yellow]search_persons failed: {exc}[/yellow]")
            return []

    async def search_organisations(self, query: str, limit: int = 10) -> list[SubjectOrgResponse]:
        """Semantic search across all organisations."""
        collection = self._client.collections.get(SUBJECT_ORGANISATION)
        try:
            results = collection.query.near_text(query=query, limit=limit)
            return [self._obj_to_org_response(obj) for obj in results.objects]
        except Exception as exc:
            console.print(f"[yellow]search_organisations failed: {exc}[/yellow]")
            return []

    async def add_matter_to_subject(self, subject_id: str, matter_id: str, collection_name: str) -> None:
        """Append matter_id to subject's matter_ids[] if not already present."""
        collection = self._client.collections.get(collection_name)
        try:
            obj = collection.query.fetch_object_by_id(subject_id)
            if obj is None:
                return
            existing = obj.properties.get("matter_ids", [])
            if matter_id not in existing:
                collection.data.update(
                    uuid=subject_id,
                    properties={"matter_ids": existing + [matter_id]},
                )
        except Exception as exc:
            console.print(f"[yellow]add_matter_to_subject failed: {exc}[/yellow]")

    async def get_person(self, subject_id: str) -> SubjectPersonResponse | None:
        """Get person by Weaviate UUID."""
        collection = self._client.collections.get(SUBJECT_PERSON)
        try:
            obj = collection.query.fetch_object_by_id(subject_id)
            return self._obj_to_person_response(obj) if obj else None
        except Exception:
            return None

    async def get_organisation(self, subject_id: str) -> SubjectOrgResponse | None:
        """Get organisation by Weaviate UUID."""
        collection = self._client.collections.get(SUBJECT_ORGANISATION)
        try:
            obj = collection.query.fetch_object_by_id(subject_id)
            return self._obj_to_org_response(obj) if obj else None
        except Exception:
            return None

    async def list_persons_for_matter(self, matter_id: str) -> list[SubjectPersonResponse]:
        """List all persons associated with a matter."""
        from weaviate.classes.query import Filter
        collection = self._client.collections.get(SUBJECT_PERSON)
        try:
            results = collection.query.fetch_objects(
                filters=Filter.by_property("matter_ids").contains_any([matter_id]),
                limit=1000,
            )
            return [self._obj_to_person_response(obj) for obj in results.objects]
        except Exception:
            return []

    async def list_organisations_for_matter(self, matter_id: str) -> list[SubjectOrgResponse]:
        """List all organisations associated with a matter."""
        from weaviate.classes.query import Filter
        collection = self._client.collections.get(SUBJECT_ORGANISATION)
        try:
            results = collection.query.fetch_objects(
                filters=Filter.by_property("matter_ids").contains_any([matter_id]),
                limit=1000,
            )
            return [self._obj_to_org_response(obj) for obj in results.objects]
        except Exception:
            return []

    def _obj_to_person_response(self, obj) -> SubjectPersonResponse:
        props = obj.properties
        now = datetime.now(UTC)
        return SubjectPersonResponse(
            id=str(obj.uuid),
            canonical_name=props.get("canonical_name", ""),
            aliases=props.get("aliases", []),
            matter_ids=props.get("matter_ids", []),
            created_at=props.get("created_at") or now,
            updated_at=props.get("updated_at") or now,
        )

    def _obj_to_org_response(self, obj) -> SubjectOrgResponse:
        props = obj.properties
        now = datetime.now(UTC)
        return SubjectOrgResponse(
            id=str(obj.uuid),
            canonical_name=props.get("canonical_name", ""),
            aliases=props.get("aliases", []),
            matter_ids=props.get("matter_ids", []),
            created_at=props.get("created_at") or now,
            updated_at=props.get("updated_at") or now,
        )
