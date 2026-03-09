import sys

content = open("memory.py").read()

new_models = """
class TemporalResolution(StrEnum):
    EXACT = "exact"
    APPROXIMATE = "approximate"
    RELATIVE = "relative"
    UNKNOWN = "unknown"

class TemporalBounds(BaseModel):
    \"\"\"Define the chronological bounds of an event memory.\"\"\"
    start_time: datetime | None = None
    end_time: datetime | None = None
    resolution: str = Field(default=TemporalResolution.UNKNOWN)
    is_ongoing: bool = Field(default=False)
    relative_to: str | None = None  # ID of another memory this is relative to

"""

# Insert right before Memory class
idx = content.find("class Memory(BaseModel):")
content = content[:idx] + new_models + "\n" + content[idx:]

# Add new fields to Memory class
memory_class_start = content.find("class Memory(BaseModel):")
end_of_memory_class = content.find("class MemorySearchResult", memory_class_start)
memory_class_content = content[memory_class_start:end_of_memory_class]

new_memory_fields = """
    # Temporal & Event Modeling Features
    temporal_bounds: TemporalBounds | None = None
    is_event: bool = Field(default=False)
    cause_ids: list[str] = Field(default_factory=list)
    effect_ids: list[str] = Field(default_factory=list)
"""

content = content[:end_of_memory_class] + new_memory_fields + "\n\n" + content[end_of_memory_class:]

open("memory.py", "w").write(content)
print("Updated memory.py with Temporal features")
