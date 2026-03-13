# Engram-AiMemory Code Quality Audit
**Date:** 2026-03-14  
**Scope:** Python (packages/core) + TypeScript (packages/*)  
**Status:** 116 linting violations found | Test coverage baseline needs refresh

---

## EXECUTIVE SUMMARY

| Category | Status | Impact | Priority |
|----------|--------|--------|----------|
| **Linting** | 116 violations | Medium | HIGH |
| **Test Coverage** | Baseline needs refresh | Medium | HIGH |
| **Build/Config** | Functional, minor issues | Low | MEDIUM |
| **Dead Code** | 15+ unused imports | Low | MEDIUM |
| **Security** | No critical issues | Low | LOW |

**Estimated remediation time:** 4-6 hours (linting + test baseline)

---

## 1. CODE QUALITY ANALYSIS

### 1.1 Python Linting (Ruff)

**Total violations:** 116 errors across 18 files

#### Critical Issues (Must Fix)

| Issue | Count | Files | Impact |
|-------|-------|-------|--------|
| **Bare `except` clauses** | 2 | `api.py` | Masks errors, prevents debugging |
| **Undefined names** | 1 | `workers.py:523` | Runtime crash risk |
| **Duplicate property definitions** | 1 | `cache.py:48,243` | Confusing, one is dead code |
| **Bare `except` + `pass`** | 8 | Multiple | Error masking |

**Files with critical issues:**
- `/packages/core/src/memory_system/api.py` — Lines 779-787 (bare except)
- `/packages/core/src/memory_system/cache.py` — Lines 48, 243 (duplicate `is_connected`)
- `/packages/core/src/memory_system/workers.py` — Line 523 (undefined `TemporalExtractor`)

#### High-Priority Issues (Should Fix)

| Issue | Count | Pattern | Fix Time |
|-------|-------|---------|----------|
| **Unused imports** | 18 | `F401` | 15 min |
| **Whitespace on blank lines** | 12 | `W293` | 5 min |
| **Trailing whitespace** | 2 | `W291` | 2 min |
| **Import organization** | 8 | `I001` | 20 min |
| **Multiple statements on one line** | 2 | `E701` | 5 min |

#### Medium-Priority Issues (Nice to Have)

| Issue | Count | Pattern | Fix Time |
|-------|-------|---------|----------|
| **Simplification opportunities** | 12 | `SIM*` | 30 min |
| **Enum inheritance** | 3 | `UP042` | 10 min |
| **Type annotation cleanup** | 2 | `UP037` | 5 min |

#### Breakdown by File

```
api.py                      — 6 violations (bare except, SIM105)
cache.py                    — 4 violations (duplicate property, SIM103, SIM105)
contradiction.py            — 8 violations (unused imports, whitespace, E701)
investigation/crawler.py    — 8 violations (unused imports, import org, SIM102)
investigation/crawler_service.py — 10 violations (unused imports, F841)
investigation/ingestor.py   — 6 violations (unused imports, whitespace)
investigation/matter_client.py — 2 violations (unused imports, import org)
investigation/models.py     — 5 violations (unused imports, UP042)
investigation/registry_client.py — 8 violations (whitespace, import org)
investigation/workers.py    — 6 violations (import org, F821)
investigation/workers_service.py — 4 violations (import org, F401)
investigation_router.py     — 18 violations (B008 Depends, B904 raise)
memory.py                   — 2 violations (unused import, whitespace)
propagation.py              — 3 violations (unused imports)
temporal.py                 — 8 violations (unused imports, whitespace, W291)
update_weaviate_schema.py   — 2 violations (unused import, SIM115)
workers.py                  — 6 violations (import org, F821)
```

### 1.2 TypeScript Linting (Biome)

**Total violations:** 4 files with import organization issues

**Files affected:**
- `packages/dashboard/app/dashboard/analytics/memories/_PageClient.tsx` — Import sort
- `packages/dashboard/app/dashboard/analytics/search/_PageClient.tsx` — Import sort
- `packages/cli/src/index.ts` — Import sort
- `packages/dashboard/app/dashboard/analytics/system/_PageClient.tsx` — Import sort

**Impact:** Low — purely cosmetic (import ordering)  
**Fix time:** 2 minutes with `biome check --fix`

### 1.3 Code Metrics

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Python LOC | 13,600 | — | ✓ Reasonable |
| TypeScript LOC | 65,481 | — | ✓ Reasonable |
| Python files | 40 | — | ✓ Manageable |
| Debug logging | 189 statements | <50 | ⚠️ High |
| Unused imports | 18 | 0 | ✗ Needs cleanup |

---

## 2. TEST COVERAGE ANALYSIS

### 2.1 Current Status

**Issue:** Test environment setup failure — `ModuleNotFoundError: No module named 'memory_system'`

**Root cause:** Python path not configured for pytest discovery

**Test files present:**
- 21 Python test files in `packages/core/tests/`
- 5 TypeScript test files in `packages/dashboard/`
- Configuration: `.coveragerc` with 79.8% minimum threshold

### 2.2 Coverage Configuration

```ini
[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["packages/core/tests"]
addopts = "--cov=memory_system --cov-report=term-missing --cov-fail-under=79.8"

[tool.coverage.run]
omit = [
    "*/src/memory_system/mcp/*",
    "*/src/memory_system/investigation/crawler.py",
    "*/src/memory_system/investigation/crawler_service.py",
    "*/src/memory_system/investigation/ingestor.py",
    "*/src/memory_system/investigation/workers.py",
    "*/src/memory_system/investigation/workers_service.py",
    "*/src/memory_system/investigation/schemas.py",
    "*/src/memory_system/compat.py",
    "*/src/memory_system/ollama_client.py",
    "*/src/memory_system/ai_provider.py",
]
```

**Issue:** Large omit list (11 files) — indicates untested critical paths

### 2.3 Critical Untested Modules

| Module | LOC | Reason | Risk |
|--------|-----|--------|------|
| `investigation/crawler.py` | ~200 | Omitted | HIGH |
| `investigation/workers.py` | ~600 | Omitted | HIGH |
| `investigation/ingestor.py` | ~300 | Omitted | HIGH |
| `ai_provider.py` | ~400 | Omitted | MEDIUM |
| `ollama_client.py` | ~200 | Omitted | MEDIUM |

**Total untested LOC:** ~1,700 (12.5% of codebase)

---

## 3. BUILD & DEPLOYMENT STATUS

### 3.1 Docker Configuration

**Status:** ✓ Functional

**File:** `docker/docker-compose.yml`

**Services:**
- Weaviate 1.27.0 (vector DB)
- Redis 7-alpine (cache)
- Memory API (FastAPI)
- MCP Server (Node.js)

**Issues found:**
- ✓ Health checks configured
- ✓ Network isolation (memory-network)
- ✓ Volume persistence
- ⚠️ No resource limits specified (should add for production)

### 3.2 Environment Configuration

**Status:** ✓ Well-documented

**File:** `.env.example` (5,216 bytes)

**Coverage:**
- ✓ Weaviate config
- ✓ Redis config
- ✓ Embedding provider selection
- ✓ LLM configuration
- ✓ MCP server settings
- ✓ Dashboard URLs

**Issues:**
- ⚠️ No validation schema (should use Pydantic Settings)
- ⚠️ Hardcoded defaults in code (should centralize)

### 3.3 Makefile

**Status:** ✓ Complete

**Targets:**
- `make install` — Install deps
- `make test` — Run all tests
- `make lint` — Run linters
- `make docker-up/down` — Docker control
- `make deploy` — Deployment script

**Issues:**
- ⚠️ `make lint` doesn't lint all TypeScript (missing `packages/dashboard`)
- ⚠️ No `make lint-fix` for Python (only TS)

---

## 4. QUICK WINS (High Impact, <30 min each)

### 4.1 Fix Bare `except` Clauses (5 min)

**Files:** `api.py:779-787`, `cache.py:110-113`, `cache.py:140-143`

**Current:**
```python
try:
    start_dt = datetime.fromisoformat(request.start_date.replace("Z", "+00:00"))
except:
    pass
```

**Fixed:**
```python
from contextlib import suppress
from datetime import datetime

with suppress(ValueError):
    start_dt = datetime.fromisoformat(request.start_date.replace("Z", "+00:00"))
```

**Impact:** Prevents silent error masking, improves debuggability

---

### 4.2 Remove Duplicate `is_connected` Property (2 min)

**File:** `cache.py:48, 243`

**Current:**
```python
@property
def is_connected(self) -> bool:
    """Check if Redis is available."""
    return self._client is not None

# ... 195 lines later ...

@property
def is_connected(self) -> bool:
    """Check if client is connected."""
    return self._client is not None
```

**Fixed:** Delete lines 242-245 (second definition)

**Impact:** Removes confusion, prevents accidental override

---

### 4.3 Clean Up Unused Imports (10 min)

**Files:** 18 files with `F401` violations

**Examples:**
- `contradiction.py:1` — `import json` (unused)
- `crawler.py:4` — `import json` (unused)
- `crawler.py:8` — `from urllib.parse import urljoin` (unused)
- `propagation.py:1-4` — All 4 imports unused

**Command:**
```bash
cd Engram-AiMemory
ruff check packages/core/src/memory_system/ --fix
```

**Impact:** Cleaner imports, faster IDE analysis

---

### 4.4 Fix Import Organization (15 min)

**Files:** 8 files with `I001` violations

**Pattern:** Imports not sorted alphabetically

**Command:**
```bash
cd Engram-AiMemory
ruff check packages/core/src/memory_system/ --fix
npx biome check packages/ --fix
```

**Impact:** Consistent code style, easier diffs

---

### 4.5 Remove Whitespace on Blank Lines (5 min)

**Files:** 12 files with `W293` violations

**Pattern:** Blank lines with trailing spaces

**Command:**
```bash
cd Engram-AiMemory
ruff check packages/core/src/memory_system/ --fix
```

**Impact:** Cleaner diffs, passes pre-commit hooks

---

### 4.6 Fix Enum Inheritance (10 min)

**Files:** 3 files with `UP042` violations

**Current:**
```python
class TaskComplexity(str, Enum):
    SIMPLE = "simple"
```

**Fixed:**
```python
from enum import StrEnum

class TaskComplexity(StrEnum):
    SIMPLE = "simple"
```

**Files:**
- `ai_provider.py:72`
- `investigation/models.py:18, 24, 32`
- `compat.py:22`

**Impact:** Uses Python 3.11+ standard library, cleaner code

---

### 4.7 Fix FastAPI Dependency Injection (20 min)

**File:** `investigation_router.py` (18 violations)

**Issue:** `B008` — Function calls in default arguments

**Current:**
```python
def _get_matter_client(weaviate_client=Depends(_get_weaviate_client)) -> MatterClient:
    return MatterClient(weaviate_client)
```

**Fixed:**
```python
def _get_matter_client(weaviate_client: WeaviateClient = Depends(_get_weaviate_client)) -> MatterClient:
    return MatterClient(weaviate_client)
```

**Impact:** Follows FastAPI best practices, improves type safety

---

### 4.8 Fix Exception Chaining (10 min)

**File:** `investigation_router.py` (4 violations)

**Issue:** `B904` — Raise without `from` in except clause

**Current:**
```python
except ValueError as exc:
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
```

**Fixed:**
```python
except ValueError as exc:
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
```

**Impact:** Preserves exception chain for debugging

---

### 4.9 Fix TypeScript Import Sorting (2 min)

**Files:** 4 dashboard files

**Command:**
```bash
cd Engram-AiMemory
npx biome check packages/ --fix
```

**Impact:** Consistent code style

---

### 4.10 Add Resource Limits to Docker Compose (5 min)

**File:** `docker/docker-compose.yml`

**Add to each service:**
```yaml
deploy:
  resources:
    limits:
      cpus: '1.0'
      memory: 1G
    reservations:
      cpus: '0.5'
      memory: 512M
```

**Impact:** Prevents runaway containers, improves stability

---

## 5. MEDIUM-PRIORITY ISSUES

### 5.1 Test Coverage Baseline Refresh

**Status:** ⚠️ Needs investigation

**Issue:** `pytest --cov` fails with `ModuleNotFoundError`

**Root cause:** Python path not configured for test discovery

**Fix:**
```bash
cd Engram-AiMemory
python3.11 -m pip install -e ".[dev]"
python3.11 -m pytest packages/core/tests/ --cov=memory_system --cov-report=term-missing
```

**Expected output:** Coverage report with baseline percentage

---

### 5.2 Expand Test Coverage

**Current omit list:** 11 files (1,700 LOC untested)

**Recommendation:** Gradually move files from omit list to tested

**Priority order:**
1. `investigation/models.py` — Data models (low risk)
2. `ai_provider.py` — LLM routing (medium risk)
3. `investigation/crawler.py` — Web crawling (high risk)
4. `investigation/workers.py` — Background jobs (high risk)

---

### 5.3 Lint All TypeScript

**Current:** Only `packages/mcp-server` and `packages/cli` are linted

**Missing:** `packages/dashboard` (65K LOC)

**Fix Makefile:**
```makefile
lint:
    ruff check packages/core/src/memory_system/
    npx biome check packages/mcp-server/src packages/cli/src packages/dashboard/app packages/dashboard/components packages/dashboard/hooks
    mypy packages/core/src/memory_system/api.py --ignore-missing-imports || true
```

---

### 5.4 Add Python Linting to Makefile

**Current:** Only `ruff check` (no auto-fix)

**Add:**
```makefile
lint-fix:
    ruff check packages/core/src/memory_system/ --fix
    ruff format packages/core/src/memory_system/
    npx biome check packages/ --fix
    npx biome format packages/ --write
```

---

## 6. SECURITY FINDINGS

### 6.1 No Critical Issues

✓ No hardcoded credentials  
✓ No SQL injection vectors (using Weaviate client)  
✓ No XXE vulnerabilities  
✓ No unsafe deserialization  

### 6.2 Minor Concerns

| Issue | Severity | Location | Mitigation |
|-------|----------|----------|-----------|
| Bare `except` clauses | Low | `api.py`, `cache.py` | Use specific exceptions |
| No input validation | Low | `investigation_router.py` | Add Pydantic validators |
| Untyped function args | Low | Multiple | Enable mypy strict mode |

---

## 7. PERFORMANCE FINDINGS

### 7.1 Debug Logging

**Count:** 189 logging statements

**Concern:** High volume may impact performance under load

**Recommendation:** Audit and consolidate to critical paths only

### 7.2 Unused Code

**Identified:**
- `update_weaviate_schema.py` — Appears to be a one-off script
- `compat.py` — Backport for Python < 3.11 (no longer needed)
- `propagation.py` — Unused imports, unclear purpose

**Recommendation:** Review and remove if not actively used

---

## 8. REMEDIATION ROADMAP

### Phase 1: Critical Fixes (1 hour)

- [ ] Fix bare `except` clauses (5 min)
- [ ] Remove duplicate `is_connected` (2 min)
- [ ] Fix undefined `TemporalExtractor` (5 min)
- [ ] Clean up unused imports (10 min)
- [ ] Fix import organization (15 min)
- [ ] Remove whitespace on blank lines (5 min)
- [ ] Fix enum inheritance (10 min)

**Total:** ~52 minutes

### Phase 2: High-Priority Fixes (1.5 hours)

- [ ] Fix FastAPI dependency injection (20 min)
- [ ] Fix exception chaining (10 min)
- [ ] Fix TypeScript imports (2 min)
- [ ] Add Docker resource limits (5 min)
- [ ] Refresh test coverage baseline (15 min)
- [ ] Update Makefile lint targets (10 min)

**Total:** ~62 minutes

### Phase 3: Medium-Priority Improvements (2-3 hours)

- [ ] Expand test coverage (move files from omit list)
- [ ] Audit and consolidate logging
- [ ] Review and remove unused modules
- [ ] Enable mypy strict mode (gradual)
- [ ] Add pre-commit hooks

**Total:** 2-3 hours

---

## 9. RECOMMENDATIONS

### 9.1 Immediate Actions

1. **Run linting fixes:**
   ```bash
   cd Engram-AiMemory
   ruff check packages/core/src/memory_system/ --fix
   npx biome check packages/ --fix
   ```

2. **Refresh test coverage baseline:**
   ```bash
   python3.11 -m pip install -e ".[dev]"
   python3.11 -m pytest packages/core/tests/ --cov=memory_system --cov-report=term-missing
   ```

3. **Update Makefile:**
   - Add `lint-fix` target
   - Extend `lint` to include `packages/dashboard`

### 9.2 Short-Term (This Sprint)

- [ ] Move 2-3 files from coverage omit list to tested
- [ ] Audit and consolidate logging statements
- [ ] Review unused modules (`compat.py`, `propagation.py`, `update_weaviate_schema.py`)
- [ ] Add pre-commit hooks for linting

### 9.3 Long-Term (Next Quarter)

- [ ] Enable mypy strict mode (gradual rollout)
- [ ] Achieve 85%+ test coverage
- [ ] Implement comprehensive error handling
- [ ] Add observability (structured logging, tracing)

---

## 10. APPENDIX: VIOLATION SUMMARY

### By Category

| Category | Count | Severity |
|----------|-------|----------|
| Unused imports (F401) | 18 | Low |
| Whitespace issues (W293, W291) | 14 | Low |
| Import organization (I001) | 8 | Low |
| Simplification (SIM*) | 12 | Low |
| Bare except (E722) | 2 | Medium |
| Undefined names (F821) | 1 | High |
| Duplicate definitions (F811) | 1 | Medium |
| FastAPI issues (B008) | 18 | Medium |
| Exception chaining (B904) | 4 | Low |
| Enum inheritance (UP042) | 3 | Low |
| Other | 16 | Low |

### By File

| File | Violations | Priority |
|------|-----------|----------|
| `investigation_router.py` | 18 | HIGH |
| `investigation/crawler_service.py` | 10 | MEDIUM |
| `contradiction.py` | 8 | MEDIUM |
| `investigation/crawler.py` | 8 | MEDIUM |
| `investigation/registry_client.py` | 8 | MEDIUM |
| `temporal.py` | 8 | MEDIUM |
| `api.py` | 6 | HIGH |
| `investigation/ingestor.py` | 6 | MEDIUM |
| `investigation/workers.py` | 6 | MEDIUM |
| Others | 20 | LOW |

---

**Generated:** 2026-03-14  
**Auditor:** Code Quality Audit Tool  
**Next review:** After Phase 1 remediation
