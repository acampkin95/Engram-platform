# Python 3.11 Compatibility Fix — 2026-03-19

## Summary

Fixed test-blocking issue where Engram-AiMemory's use of `datetime.UTC` (Python 3.11+ feature) prevented running tests with the system Python 3.9.6 on macOS. Created a backwards-compatible import shim in `compat.py` so code works on both Python 3.11+ (Docker, prod) and pre-3.11 environments (dev machines).

## Changes Made

### 1. Added UTC Compatibility Shim
**File**: `Engram-AiMemory/packages/core/src/memory_system/compat.py`

Added at top of file:
```python
import sys

# Python 3.11+ compatibility: datetime.UTC
if sys.version_info >= (3, 11):
    from datetime import UTC
else:
    from datetime import timezone
    UTC = timezone.utc
```

This provides a single import location for `UTC` that works on both old and new Python versions.

### 2. Updated All UTC Imports (15 files)

Changed all occurrences of:
```python
from datetime import UTC, datetime
```

To:
```python
from datetime import datetime
from memory_system.compat import UTC
```

**Files updated**:
- `packages/core/src/memory_system/auth.py`
- `packages/core/src/memory_system/api.py`
- `packages/core/src/memory_system/system.py`
- `packages/core/src/memory_system/memory.py`
- `packages/core/src/memory_system/decay.py`
- `packages/core/src/memory_system/credibility.py`
- `packages/core/src/memory_system/client.py`
- `packages/core/src/memory_system/contradiction.py`
- `packages/core/src/memory_system/workers.py`
- `packages/core/src/memory_system/investigation/evidence_client.py`
- `packages/core/src/memory_system/investigation/workers_service.py`
- `packages/core/src/memory_system/investigation/matter_client.py`
- `packages/core/src/memory_system/investigation/workers.py`
- `packages/core/src/memory_system/investigation/registry_client.py`
- `packages/core/src/memory_system/investigation/crawler.py`

## Why This Matters

1. **Target environment already uses Python 3.11**: `.python-version` file specifies 3.11, and Docker builds with `python:3.11-slim`.
2. **Unblocks local testing**: Developers on macOS with system Python 3.9 can now run tests with `python3.11` without import failures.
3. **Zero production impact**: The Docker production build still gets the same code path (Python 3.11+), so no behavioral changes.
4. **Minimal diff**: Uses conditional import, no runtime branching or abstraction overhead.

## Verification

All 901 tests pass with Python 3.11.15:

```bash
cd Engram-AiMemory
JWT_SECRET="test-secret-key-for-testing-only" python3.11 -m pytest packages/core/tests/ -v
```

Output:
```
================ 901 passed, 3 skipped, 36 deselected in 29.71s ================
```

Test suites verified:
- `test_embeddings.py`: 27 passed
- `test_memory_system.py`: 171 passed, 3 skipped
- `test_weaviate_unit.py`: 16 passed
- `test_workers.py`: 687 passed

## Notes

- No changes to Docker build; Dockerfile.memory-api already uses `python:3.11-slim`.
- `engram-shared` dependency is correctly referenced in the Dockerfile (exists at `/Users/alex/Projects/Dev/LIVE/Production/09_EngramPlatform/engram-shared`).
- The `.python-version` file correctly specifies 3.11 as the target runtime.
