<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-22 -->

# tests

## Purpose

Python unit and integration tests for the FastAPI backend. Tests cover API endpoints, services, OSINT pipelines, and orchestrators.

## For AI Agents

### Working In This Directory

1. **Writing tests**: Create test files following `test_*.py` naming convention.
2. **Using fixtures**: Leverage pytest autouse fixtures (e.g., `disable_rate_limit`, `disable_auth`) to mock auth and rate limiting.
3. **Mocking**: Use `unittest.mock.patch` or pytest-mock to mock Redis, LM Studio, external APIs.
4. **Async tests**: Use `@pytest.mark.asyncio` for async test functions.

### Testing Requirements

- All new endpoints must have corresponding tests in `test_api*.py`.
- Services must have unit tests covering happy path + error cases.
- OSINT features need mocked external calls (no live HTTP).
- Coverage threshold: 80% (enforced by `pytest --cov-fail-under=80`).

### Common Patterns

- **Fixture setup**: `@pytest.fixture(autouse=True)` to disable auth/rate limit for tests
- **Async test**: `@pytest.mark.asyncio async def test_something():`
- **Mock context**: `with patch("app.services.redis_client.get_client") as mock_redis:`
- **Assertions**: Use pytest assertions (e.g., `assert response.status_code == 200`)

## Dependencies

### Internal
- `app/` — Application code being tested

### External
- pytest, pytest-asyncio, pytest-mock
- httpx (async HTTP client for testing)

<!-- MANUAL: -->
