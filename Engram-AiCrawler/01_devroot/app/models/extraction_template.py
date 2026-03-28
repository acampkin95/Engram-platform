from __future__ import annotations

from datetime import datetime

from enum import StrEnum

from typing import Any

from pydantic import BaseModel, Field

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

    class Config:
        from_attributes = True
