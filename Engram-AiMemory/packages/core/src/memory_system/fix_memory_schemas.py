import sys

content = open("memory.py").read()

new_models = """

class SourceType(StrEnum):
    AI_ASSISTANT = "ai_assistant"
    HUMAN_USER = "human_user"
    DOCUMENT_OCR = "document_ocr"
    API_INGESTION = "api_ingestion"
    SYSTEM_INFERENCE = "system_inference"


class ConfidenceFactors(BaseModel):
    \"\"\"Individual components contributing to overall confidence score.\"\"\"

    source_reliability: float = Field(ge=0.0, le=1.0, default=0.8)
    corroboration_score: float = Field(ge=0.0, le=1.0, default=0.0)
    temporal_freshness: float = Field(ge=0.0, le=1.0, default=1.0)
    semantic_coherence: float = Field(ge=0.0, le=1.0, default=1.0)
    user_feedback_score: float = Field(ge=0.0, le=1.0, default=0.5)


class MemoryModification(BaseModel):
    \"\"\"Record of a modification to a memory.\"\"\"

    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))
    modified_by: str
    modification_type: str
    previous_value: str | None = None
    new_value: str
    confidence_change: float | None = None
    reasoning: str | None = None


class ProvenanceRecord(BaseModel):
    \"\"\"Track the origin and modification history of a memory.\"\"\"

    origin: dict[str, Any] = Field(default_factory=dict)
    source_type: str = Field(default=SourceType.AI_ASSISTANT)
    source_identifier: str = Field(default="system")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))
    confidence_at_origin: float = Field(ge=0.0, le=1.0, default=0.5)
    raw_input: str | None = None

"""

# Insert right before Memory class
idx = content.find("class Memory(BaseModel):")
content = content[:idx] + new_models + "\n" + content[idx:]

# Add new fields to Memory class
memory_class_start = content.find("class Memory(BaseModel):")
memory_class_fields_start = content.find("id: UUID =", memory_class_start)
# We will insert new fields at the end of the Memory class

end_of_memory_class = content.find("class MemorySearchResult", memory_class_start)
memory_class_content = content[memory_class_start:end_of_memory_class]

new_memory_fields = """
    # Advanced Integrity & Confidence Features
    overall_confidence: float = Field(ge=0.0, le=1.0, default=0.5)
    confidence_factors: ConfidenceFactors = Field(default_factory=ConfidenceFactors)
    provenance: ProvenanceRecord = Field(default_factory=ProvenanceRecord)
    modification_history: list[MemoryModification] = Field(default_factory=list)
    
    # Contradiction tracking via Weaviate cross-references (stored as list of IDs initially)
    contradictions: list[str] = Field(default_factory=list)
    contradictions_resolved: bool = Field(default=False)
    is_deprecated: bool = Field(default=False)
    deprecated_by: str | None = None
    
    # Evidence tracking (cross-references)
    supporting_evidence_ids: list[str] = Field(default_factory=list)
    contradicting_evidence_ids: list[str] = Field(default_factory=list)

    # Maintenance state
    last_contradiction_check: datetime | None = None
    last_confidence_update: datetime | None = None
"""

content = content[:end_of_memory_class] + new_memory_fields + "\n\n" + content[end_of_memory_class:]

open("memory.py", "w").write(content)
print("Updated memory.py")
