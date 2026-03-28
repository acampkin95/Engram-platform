<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-22 -->

# models

## Purpose

Pydantic request/response models for API validation and documentation. Defines data schemas for crawl jobs, OSINT requests, extraction templates, investigations, and settings.

## Key Files

| File | Description |
|------|-------------|
| `__init__.py` | Package marker; exports all models |
| `osint.py` | OSINT request/response models (AliasQuery, ThreatIntelRequest, etc.) |
| `auth.py` | Authentication models (Token, User, Credentials) |
| `settings.py` | Settings models (CrawlerConfig, StorageConfig, etc.) |

## For AI Agents

### Working In This Directory

1. **Adding a new model**: Create class inheriting from `BaseModel` with typed fields.
2. **Validation**: Use Pydantic `Field()` for descriptions, defaults, and validators.
3. **Documentation**: Add docstrings and field descriptions for OpenAPI schema.
4. **Enums**: Use `StrEnum` for closed-set options (e.g., platform names).
5. **Nested models**: Compose models for complex structures (e.g., CrawlConfig with BrowserConfig).

### Testing Requirements

- Models are tested implicitly via endpoint tests (Pydantic validation).
- Add explicit unit tests for complex validators (e.g., regex, range checks).

### Common Patterns

- **Request model**: `class MyRequest(BaseModel): field: str`
- **Field metadata**: `field: str = Field(..., description="...", min_length=1)`
- **Optional fields**: `field: str | None = None`
- **Enum options**: `status: Literal["pending", "running", "done"]` or `class Status(StrEnum): ...`
- **Nested models**: `class Parent(BaseModel): child: ChildModel`

## Dependencies

### Internal
- None (models are self-contained)

### External
- Pydantic v2

<!-- MANUAL: -->
