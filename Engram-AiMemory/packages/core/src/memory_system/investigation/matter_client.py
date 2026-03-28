"""Matter lifecycle client — atomic tenant creation with rollback."""
from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from rich.console import Console
from weaviate.classes.tenants import Tenant, TenantActivityStatus

from memory_system.compat import UTC
from memory_system.config import (
    INVESTIGATION_MATTER,
    INVESTIGATION_TENANT_COLLECTIONS,
)
from memory_system.investigation.models import (
    MatterCreate,
    MatterResponse,
    MatterStatus,
)

console = Console()


class MatterClient:
    """Atomic matter tenant lifecycle management."""

    def __init__(self, weaviate_client):
        self._client = weaviate_client

    async def create_matter(self, matter: MatterCreate) -> MatterResponse:
        """Create matter with atomic tenant rollback across all 4 collections.

        Raises ValueError if matter_id already exists (caller should return HTTP 409).
        """
        # 1. Check for duplicate matter_id — query InvestigationMatter for existing record
        existing = await self.get_matter(matter.matter_id)
        if existing is not None:
            raise ValueError(f"Matter '{matter.matter_id}' already exists")

        # 2. Atomic tenant creation with rollback
        self._create_tenants_atomic(matter.matter_id)

        # 3. Insert MatterResponse object into InvestigationMatter collection
        now = datetime.now(UTC)
        props = {
            "matter_id": matter.matter_id,
            "title": matter.title,
            "description": matter.description,
            "status": MatterStatus.ACTIVE.value,
            "created_at": now.isoformat(),
            "tags": matter.tags,
            "lead_investigator": matter.lead_investigator,
        }
        weaviate_id = str(uuid4())
        collection = self._client.collections.get(INVESTIGATION_MATTER)
        collection.with_tenant(matter.matter_id).data.insert(
            uuid=weaviate_id,
            properties=props,
        )

        # 4. Return MatterResponse
        return MatterResponse(
            matter_id=matter.matter_id,
            title=matter.title,
            description=matter.description,
            status=MatterStatus.ACTIVE,
            created_at=now,
            tags=matter.tags,
            lead_investigator=matter.lead_investigator,
            id=weaviate_id,
        )

    def _create_tenants_atomic(self, matter_id: str) -> None:
        """Create tenant in all 4 collections atomically with rollback."""
        created_in: list[str] = []
        try:
            for col_name in INVESTIGATION_TENANT_COLLECTIONS:
                collection = self._client.collections.get(col_name)
                existing = {t.name for t in collection.tenants.get().values()}
                if matter_id not in existing:
                    collection.tenants.create([Tenant(name=matter_id, activity_status=TenantActivityStatus.HOT)])
                    created_in.append(col_name)
        except Exception as exc:
            # Rollback all created tenants
            for col_name in created_in:
                try:
                    self._client.collections.get(col_name).tenants.remove([matter_id])
                except Exception as rollback_exc:
                    console.print(f"[yellow]Rollback warning for {col_name}: {rollback_exc}[/yellow]")
            raise RuntimeError(
                f"Tenant creation failed, rolled back {len(created_in)} collections"
            ) from exc

    async def get_matter(self, matter_id: str) -> MatterResponse | None:
        """Retrieve matter by matter_id. Returns None if not found."""
        from weaviate.classes.query import Filter
        try:
            collection = self._client.collections.get(INVESTIGATION_MATTER)
            # Check if tenant exists first
            existing_tenants = {t.name for t in collection.tenants.get().values()}
            if matter_id not in existing_tenants:
                return None
            self.ensure_tenant_active(matter_id, INVESTIGATION_MATTER)
            results = collection.with_tenant(matter_id).query.fetch_objects(
                filters=Filter.by_property("matter_id").equal(matter_id),
                limit=1,
            )
            if not results.objects:
                return None
            return self._obj_to_matter_response(results.objects[0])
        except Exception as exc:
            console.print(f"[yellow]get_matter warning for {matter_id}: {exc}[/yellow]")
            return None

    async def list_matters(self, status: MatterStatus | None = None) -> list[MatterResponse]:
        """List all matters, optionally filtered by status."""
        from weaviate.classes.query import Filter
        try:
            collection = self._client.collections.get(INVESTIGATION_MATTER)
            all_tenants = list(collection.tenants.get().values())
            matters = []
            for tenant in all_tenants:
                try:
                    self.ensure_tenant_active(tenant.name, INVESTIGATION_MATTER)
                    filters = None
                    if status is not None:
                        filters = Filter.by_property("status").equal(status.value)
                    results = collection.with_tenant(tenant.name).query.fetch_objects(
                        filters=filters, limit=1
                    )
                    for obj in results.objects:
                        matters.append(self._obj_to_matter_response(obj))
                except Exception as exc:
                    console.print(f"[yellow]list_matters warning for tenant {tenant.name}: {exc}[/yellow]")
                    continue
            return matters
        except Exception as exc:
            console.print(f"[red]list_matters failed: {exc}[/red]")
            return []

    async def update_matter_status(self, matter_id: str, status: MatterStatus) -> MatterResponse:
        """Update matter status. Returns updated MatterResponse."""
        from weaviate.classes.query import Filter
        self.ensure_tenant_active(matter_id, INVESTIGATION_MATTER)
        collection = self._client.collections.get(INVESTIGATION_MATTER)
        results = collection.with_tenant(matter_id).query.fetch_objects(
            filters=Filter.by_property("matter_id").equal(matter_id),
            limit=1,
        )
        if not results.objects:
            raise ValueError(f"Matter '{matter_id}' not found")
        obj = results.objects[0]
        collection.with_tenant(matter_id).data.update(
            uuid=str(obj.uuid),
            properties={"status": status.value},
        )
        updated = self._obj_to_matter_response(obj)
        updated.status = status
        return updated

    async def delete_matter(self, matter_id: str) -> bool:
        """Remove all tenants and delete matter record. Returns True if deleted."""
        try:
            for col_name in INVESTIGATION_TENANT_COLLECTIONS:
                collection = self._client.collections.get(col_name)
                existing = {t.name for t in collection.tenants.get().values()}
                if matter_id in existing:
                    collection.tenants.remove([matter_id])
            console.print(f"[cyan]Deleted matter tenant: {matter_id}[/cyan]")
            return True
        except Exception as exc:
            console.print(f"[red]delete_matter failed for {matter_id}: {exc}[/red]")
            return False

    def ensure_tenant_active(self, matter_id: str, collection_name: str) -> None:
        """Guard: ensure tenant is HOT before any query. Raise ValueError if not found."""
        collection = self._client.collections.get(collection_name)
        tenants = collection.tenants.get()
        if matter_id not in {t.name for t in tenants.values()}:
            raise ValueError(f"Matter tenant '{matter_id}' not found in {collection_name}")
        tenant = tenants[matter_id]
        if tenant.activity_status != TenantActivityStatus.HOT:
            collection.tenants.update([Tenant(name=matter_id, activity_status=TenantActivityStatus.HOT)])

    def _obj_to_matter_response(self, obj) -> MatterResponse:
        """Convert Weaviate object to MatterResponse."""
        props = obj.properties
        return MatterResponse(
            matter_id=props.get("matter_id", ""),
            title=props.get("title", ""),
            description=props.get("description", ""),
            status=MatterStatus(props.get("status", MatterStatus.ACTIVE.value)),
            created_at=props.get("created_at") or datetime.now(UTC),
            tags=props.get("tags", []),
            lead_investigator=props.get("lead_investigator", ""),
            id=str(obj.uuid),
        )
