from __future__ import annotations

from datetime import datetime

from app._compat import StrEnum

from typing import Any

from pydantic import BaseModel, ConfigDict, Field

class StrategyType(StrEnum):
    CSS = "css"
    REGEX = "regex"
    LLM = "llm"
    COSINE = "cosine"

class ExtractionTemplateBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str = ""
    strategy_type: StrategyType
    config: dict[str, Any] = Field(default_factory=dict)

class CreateExtractionTemplate(ExtractionTemplateBase):
    pass

class UpdateExtractionTemplate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    description: str | None = None
    strategy_type: StrategyType | None = None
    config: dict[str, Any] | None = None

class ExtractionTemplate(ExtractionTemplateBase):
    id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
