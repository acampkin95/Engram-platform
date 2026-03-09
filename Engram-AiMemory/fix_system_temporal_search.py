import sys

content = open("packages/core/src/memory_system/system.py").read()

# I need to add event_only, start_date, end_date to the search signature and memory_query
bad_sig = """    async def search(
        self,
        query: str,
        tier: MemoryTier | None = None,
        project_id: str | None = None,
        user_id: str | None = None,
        tenant_id: str | None = None,
        tags: list[str] | None = None,
        min_importance: float | None = None,
        limit: int = 10,
    ) -> list[MemorySearchResult]:"""

good_sig = """    async def search(
        self,
        query: str,
        tier: MemoryTier | None = None,
        project_id: str | None = None,
        user_id: str | None = None,
        tenant_id: str | None = None,
        tags: list[str] | None = None,
        min_importance: float | None = None,
        limit: int = 10,
        event_only: bool = False,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
    ) -> list[MemorySearchResult]:"""

bad_query = """        memory_query = MemoryQuery(
            query=query,
            tier=tier,
            project_id=project_id,
            user_id=user_id,
            tenant_id=tenant_id or self.settings.default_tenant_id,
            tags=tags,
            min_importance=min_importance,
            limit=limit,
        )"""

good_query = """        memory_query = MemoryQuery(
            query=query,
            tier=tier,
            project_id=project_id,
            user_id=user_id,
            tenant_id=tenant_id or self.settings.default_tenant_id,
            tags=tags,
            min_importance=min_importance,
            limit=limit,
            event_only=event_only,
            start_date=start_date,
            end_date=end_date,
        )"""

content = content.replace(bad_sig, good_sig)
content = content.replace(bad_query, good_query)
open("packages/core/src/memory_system/system.py", "w").write(content)
print("Updated system.py search signature")
