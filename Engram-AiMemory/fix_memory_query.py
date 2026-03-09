import sys

content = open("packages/core/src/memory_system/memory.py").read()

bad_block = """    min_importance: float | None = Field(default=None, ge=0.0, le=1.0)
    limit: int = Field(default=10, ge=1, le=100)
    offset: int = Field(default=0, ge=0)
    include_expired: bool = Field(default=False)"""

good_block = """    min_importance: float | None = Field(default=None, ge=0.0, le=1.0)
    limit: int = Field(default=10, ge=1, le=100)
    offset: int = Field(default=0, ge=0)
    include_expired: bool = Field(default=False)
    # Temporal filters
    event_only: bool = Field(default=False)
    start_date: datetime | None = None
    end_date: datetime | None = None"""

content = content.replace(bad_block, good_block)
open("packages/core/src/memory_system/memory.py", "w").write(content)
print("Updated MemoryQuery")
