import sys

content = open("packages/core/src/memory_system/api.py").read()

bad_search_req = """class SearchRequest(BaseModel):
    \"\"\"Request to search memories.\"\"\"

    query: str = Field(..., min_length=1, max_length=10000, description="Search query")
    tier: int | None = Field(default=None, ge=1, le=3, description="Filter by tier")
    project_id: str | None = Field(default=None, description="Filter by project")
    user_id: str | None = Field(default=None, description="Filter by user")
    tenant_id: str | None = Field(default=None, description="Filter by tenant")
    tags: list[str] | None = Field(default=None, description="Filter by tags")
    min_importance: float | None = Field(default=None, ge=0.0, le=1.0)
    limit: int = Field(default=10, ge=1, le=100)"""

good_search_req = """class SearchRequest(BaseModel):
    \"\"\"Request to search memories.\"\"\"

    query: str = Field(..., min_length=1, max_length=10000, description="Search query")
    tier: int | None = Field(default=None, ge=1, le=3, description="Filter by tier")
    project_id: str | None = Field(default=None, description="Filter by project")
    user_id: str | None = Field(default=None, description="Filter by user")
    tenant_id: str | None = Field(default=None, description="Filter by tenant")
    tags: list[str] | None = Field(default=None, description="Filter by tags")
    min_importance: float | None = Field(default=None, ge=0.0, le=1.0)
    limit: int = Field(default=10, ge=1, le=100)
    event_only: bool = Field(default=False, description="Only return event memories")
    start_date: str | None = Field(default=None, description="ISO format start date filter")
    end_date: str | None = Field(default=None, description="ISO format end date filter")"""

content = content.replace(bad_search_req, good_search_req)

bad_search_call = """    results = await _memory_system.search(
        query=request.query,
        tier=tier,
        project_id=request.project_id,
        user_id=request.user_id,
        tenant_id=request.tenant_id,
        tags=request.tags,
        min_importance=request.min_importance,
        limit=request.limit,
    )"""

good_search_call = """    start_dt = None
    end_dt = None
    if request.start_date:
        from datetime import datetime
        try: start_dt = datetime.fromisoformat(request.start_date.replace('Z', '+00:00'))
        except: pass
    if request.end_date:
        from datetime import datetime
        try: end_dt = datetime.fromisoformat(request.end_date.replace('Z', '+00:00'))
        except: pass

    results = await _memory_system.search(
        query=request.query,
        tier=tier,
        project_id=request.project_id,
        user_id=request.user_id,
        tenant_id=request.tenant_id,
        tags=request.tags,
        min_importance=request.min_importance,
        limit=request.limit,
        event_only=request.event_only,
        start_date=start_dt,
        end_date=end_dt,
    )"""

content = content.replace(bad_search_call, good_search_call)
open("packages/core/src/memory_system/api.py", "w").write(content)
print("Updated api.py with temporal search")

