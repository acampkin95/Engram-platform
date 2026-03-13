# AGENTS.md — Engram-AiCrawler

**Generated:** 2026-03-02

## OVERVIEW

Python 3.11 FastAPI + React 18 frontend. OSINT web crawler with AI analysis using Crawl4AI.

## STRUCTURE

```
Engram-AiCrawler/
└── 01_devroot/
    ├── app/
    │   ├── main.py         # FastAPI entry (port 11235)
    │   ├── api/            # API routes
    │   ├── services/       # Business logic
    │   ├── osint/          # OSINT pipeline
    │   └── models/         # Pydantic models
    ├── cli/                # CLI tool (c4ai command)
    ├── frontend/           # React 18 + Vite
    │   ├── src/
    │   │   ├── components/ # React components
    │   │   ├── pages/      # Page components
    │   │   ├── hooks/      # Custom hooks
    │   │   └── lib/        # Utilities
    │   └── package.json
    ├── tests/              # Python tests
    └── data/supervisor/    # Supervisord configs
```

## WHERE TO LOOK

| Task | Location |
|------|----------|
| FastAPI app | `01_devroot/app/main.py` |
| OSINT pipeline | `01_devroot/app/osint/` |
| API routes | `01_devroot/app/api/` |
| React components | `01_devroot/frontend/src/components/` |
| CLI entry | `01_devroot/cli/__main__.py` |

## CONVENTIONS

**Python (01_devroot)**
- Line width: 100 chars
- Ruff rules: E,F,W,C90,UP
- MyPy: strict_optional=true, disallow_any_generics=true
- Tests: pytest with autouse fixtures (disable_rate_limit, disable_auth)

**React (01_devroot/frontend)**
- Build tool: Vite
- Linter: ESLint
- Testing: vitest + Playwright
- Styling: Tailwind CSS v3
- State: Zustand v4

## COMMANDS

```bash
cd 01_devroot

# Backend
ruff check app/           # Lint
ruff format app/          # Format
mypy app/                 # Type check
pytest tests/ -v          # Run tests

# Frontend
cd frontend
npm run dev               # Dev server (:3000)
npm run lint              # ESLint
npm run typecheck         # tsc --noEmit
npm run test              # vitest
```

## CI/CD

- Authoritative workflow: `.github/workflows/ci.yml`
- Scope: Python lint/type/test, frontend lint/build/test, Docker build, and Playwright E2E on main pushes

## ANTI-PATTERNS

1. **NEVER set `check_robots_txt=False`** — legal/ethical violation
2. **NEVER use public IPs in production** — Tailscale only
3. Do NOT bypass supervisord in production — manages multi-process lifecycle
