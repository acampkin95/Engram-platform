# Engram Platform - Defect Register

**Generated**: 2026-03-29
**Loop**: 1 - Baseline Mapping and Surface Discovery
**Status**: Active

---

## Summary

| Severity | Count | Status |
|---|---|---|
| **Critical** | 0 | - |
| **High** | 3 | 3 Fixed, 0 Open |
| **Medium** | 5 | 5 Fixed, 0 Open |
| **Low** | 4 | 0 Fixed, 4 Open |
| **Total** | 12 | 8 Fixed, 4 Open (all low) |

---

## Fixed Issues (Loop 1)

### F001: Python 3.9 UTC Import Error
**Status**: ✅ Fixed
**Severity**: High
**Component**: Engram-AiCrawler
**Location**: `app/_compat.py` + 33 files

**Description**:
- AiCrawler code used `from datetime import UTC` (Python 3.11+ only)
- Python 3.9 doesn't have `datetime.UTC`
- Caused ImportError on Python 3.9 systems

**Fix**:
- Created `app/_compat.py` compatibility module
- Provides UTC fallback using `timezone.utc` for Python < 3.11
- Updated 33 files to import from `app._compat`

**Verified**: Tests passing (2393)

---

### F002: Python 3.9 StrEnum Import Error
**Status**: ✅ Fixed
**Severity**: High
**Component**: Engram-AiCrawler
**Location**: 22 model files

**Description**:
- Code used `from enum import StrEnum` (Python 3.11+ only)
- Python 3.9 doesn't have `enum.StrEnum`

**Fix**:
- Added StrEnum compatibility shim in `app/_compat.py`
- For Python < 3.11: simple str subclass
- Updated 22 files to import from `app._compat`

**Verified**: Tests passing (2393)

---

### F003: Test File Trailing Comma Syntax Error
**Status**: ✅ Fixed
**Severity**: Medium
**Component**: Engram-AiCrawler Tests
**Location**: `tests/test_api_scheduler.py` + 9 files

**Description**:
- Import fix left trailing comma: `from datetime import datetime, `
- Caused SyntaxError during test collection
- Also had duplicate try/except block in test_api_scheduler.py

**Fix**:
- Fixed trailing commas in 10 test files
- Cleaned up duplicate try/except block

**Verified**: All tests collecting and passing

---

### F004: Test File UTC Import Missing
**Status**: ✅ Fixed
**Severity**: Medium
**Component**: Engram-AiCrawler Tests
**Location**: 10 test files

**Description**:
- Test files also had direct UTC imports from datetime
- Needed same compatibility fix as app code

**Fix**:
- Updated 10 test files to use `from app._compat import UTC`

**Verified**: All tests passing

---

## Open Issues

### H001: Pydantic Config Class Deprecation ✅ FIXED (Loop 3)
**Status**: ✅ Fixed
**Severity**: Medium
**Component**: Engram-AiCrawler
**Location**: `app/models/scheduler.py:40`, `app/models/extraction_template.py:32`

**Description**: Pydantic V2 Config class deprecated

**Fix**: Migrated to `ConfigDict` model

**Verified**: Tests passing (2393)

---

### H002: Pydantic min_items Deprecation ✅ FIXED (Loop 3)
**Status**: ✅ Fixed
**Severity**: Medium
**Component**: Engram-AiCrawler
**Location**: `app/api/darkweb.py:77`

**Description**: Pydantic V2 min_items deprecated

**Fix**: Changed `min_items=1` to `min_length=1`

**Verified**: Tests passing (2393)

---

### H003: Field Name Shadowing Warning
**Status**: ⚠️ Open
**Severity**: Low
**Component**: Engram-AiCrawler
**Location**: `app/api/extraction.py:144`

**Description**:
```
UserWarning: Field name "schema" in "PreviewRequest" shadows an attribute
in parent "BaseModel"
```

**Recommended Action**:
- Rename field to avoid shadowing BaseModel.schema
- Target: Loop 4 (Performance, Bundle, UX, and Release Clean-Up)

---

### L001: pytest_asyncio Configuration Warning
**Status**: ⚠️ Open
**Severity**: Low
**Component**: Engram-AiCrawler Tests
**Location**: pytest configuration

**Description**:
```
PytestDeprecationWarning: The configuration option "asyncio_default_fixture_loop_scope"
is unset. Future versions will default to function scope.
```

**Recommended Action**:
- Add `asyncio_default_fixture_loop_scope = "function"` to pytest.ini
- Target: Loop 2

---

### L002: python-multipart Pending Deprecation
**Status**: ⚠️ Open
**Severity**: Low
**Component**: All FastAPI services
**Location**: Dependencies

**Description**:
```
PendingDeprecationWarning: Please use `import python_multipart` instead.
```

**Recommended Action**:
- Update to use `python-multipart` directly
- Target: Loop 4

---

### L003: Resource Warnings in Tests
**Status**: ⚠️ Open
**Severity**: Low
**Component**: Engram-AiCrawler Tests
**Location**: Test execution

**Description**:
```
ResourceWarning: Enable tracemalloc to get traceback where the object was allocated.
```

**Recommended Action**:
- Investigate resource leaks in tests
- Target: Loop 2

---

### L004: Sentry/Rollup Vulnerabilities ✅ FIXED (2026-03-29)
**Status**: ✅ Fixed
**Severity**: High
**Component**: Engram-Platform
**Location**: Frontend dependencies

**Description**:
- Platform had 2 high vulnerability reports in Sentry/rollup
- Required v8 → v10 migration

**Fix**:
- Upgraded @sentry/nextjs from ^8.28.0 to ^10.46.0
- Renamed sentry.client.config.ts → instrumentation-client.ts
- Added v10 hooks: onRouterTransitionStart, onRequestError
- Moved instrumentation.ts to project root
- Updated CHANGELOG.md with migration notes

**Verification**:
- npm audit: 0 vulnerabilities
- All 1,081 tests passing
- Build completes successfully with no warnings
- No deprecated APIs in codebase

**Impact**: Production blocker removed

---

### L005: Mypy Errors in AiMemory
**Status**: ⚠️ Open
**Severity**: Low
**Component**: Engram-AiMemory
**Location**: Python type checking

**Description**:
- 87 mypy errors reported (not blocking tests)

**Recommended Action**:
- Fix type annotations incrementally
- Target: Loop 4

---

## Deferred (Out of Scope)

### D001: Code Splitting Optimization
**Status**: Deferred
**Component**: Engram-Platform
**Description**: Frontend has code splitting configured but could be optimized
**Target**: Loop 4 (Performance optimization)

### D002: Docker Image Size Reduction
**Status**: Deferred
**Component**: All services
**Description**: Docker images could be optimized for smaller size
**Target**: Loop 4

### D003: Nginx Configuration Hardening
**Status**: Deferred
**Component**: Deployment
**Description**: Additional nginx security headers could be added
**Target**: Loop 3

---

## Issues by Component

| Component | Critical | High | Medium | Low | Total |
|---|---|---|---|---|---|
| Engram-Platform | 0 | 1 | 0 | 1 | 2 |
| Engram-AiMemory | 0 | 0 | 0 | 1 | 1 |
| Engram-AiCrawler | 0 | 0 | 3 | 2 | 5 |
| Engram-MCP | 0 | 0 | 0 | 0 | 0 |
| Deployment | 0 | 0 | 0 | 0 | 0 |

---

## Change History

| Date | Issue | Action | Loop |
|---|---|---|---|
| 2026-03-29 | F001-F004 | Fixed Python 3.9 compatibility issues | 1 |
| 2026-03-29 | H001-H003 | Identified Pydantic deprecation warnings | 1 |
| 2026-03-29 | L001-L005 | Identified low-priority warnings | 1 |
