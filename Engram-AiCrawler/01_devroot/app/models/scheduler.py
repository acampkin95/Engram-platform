from __future__ import annotations

from pydantic import BaseModel, Field
from typing import Any
from enum import Enum

try:
    from enum import StrEnum
except ImportError:

    class StrEnum(str, Enum):
        """Backport of StrEnum for Python < 3.11"""

        def __new__(cls, value):
            obj = str.__new__(cls, value)
            obj._value_ = value
            return obj


from datetime import datetime


class ScheduleFrequency(StrEnum):
    ONCE = "once"
    HOURLY = "hourly"
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    CUSTOM = "custom"


class ScheduleStatus(StrEnum):
    PENDING = "pending"
    SUCCESS = "success"
    FAILED = "failed"


class ScheduleBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    crawl_config: dict[str, Any]
    frequency: ScheduleFrequency
    cron_expression: str | None = None
    enabled: bool = True


class CreateSchedule(ScheduleBase):
    pass


class UpdateSchedule(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    crawl_config: dict[str, Any] | None = None
    frequency: ScheduleFrequency | None = None
    cron_expression: str | None = None
    enabled: bool | None = None


class Schedule(ScheduleBase):
    id: str
    next_run: datetime | None = None
    last_run: datetime | None = None
    last_result: ScheduleStatus | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
