# Changelog - Unified Operations Dashboard & Deployment Console

Date: 2026-03-17

## Completed

### Interactive Unified Deployment Script (v2.0.0)
- Rewrote `scripts/deploy-unified.sh` from 465 lines to ~750 lines with comprehensive interactive management.
- Added ASCII art banner with version display.
- Added interactive menu system (run with no arguments for full TUI).
- Added progress bars with animated fill for build/startup wait.
- Added spinner animation for background operations.
- Added colour-coded output with check/cross/warning indicators.

#### New Commands
- `requirements` — Full system prerequisite check (Docker, Compose, RAM, disk, Python, Node, curl, git) with pass/fail scoring.
- `status` — Resource usage dashboard showing CPU/memory/network per container, volume usage.
- `maintenance [action]` — Interactive maintenance menu or direct action (decay, consolidate, cleanup, confidence-maintenance, Docker prune, log rotation).
- `backup [quick|full|list]` — Quick backup (Redis snapshots + Weaviate schema + env) or full backup (all volumes + config).
- `prune` — Remove unused Docker images and build cache.
- `deploy --monitoring` — Include Prometheus/Grafana stack via compose profiles.
- `deploy --releases` — Include MinIO release store via compose profiles.
- `deploy --full` — Include all optional services.

#### Interactive Menu (12 Options)
1. First-Time Install — full guided setup with requirements check, env wizard, build, health verify
2. Configure Environment — 6-step wizard with tooltips (auth, embeddings, LLM, LM Studio, network, tokens)
3. Deploy / Update Stack — build, start, progress bar, health check
4. Deploy (Dry Run) — validate without changes
5. Health Check — test all 7 service endpoints (Memory API, Crawler API, MCP, Weaviate, Platform, Redis x2)
6. System Status — resource usage dashboard (CPU/mem/net per container)
7. Service Control — interactive service selector with start/stop/restart/logs per service
8. View Logs — tail service output with optional service filter
9. Maintenance — interactive menu for memory operations, Docker prune, log rotation
10. Backup — quick or full backup with size reporting
11. System Requirements — prerequisite check with pass/fail scoring
12. Stop Stack — graceful shutdown with confirmation

#### Enhanced Environment Wizard
- 6-step configuration flow with clear section headers
- Tooltips for every configuration field explaining purpose and where to get values
- Provider-specific follow-up prompts (DeepInfra, OpenAI, Ollama, Nomic, LM Studio)
- Auto-generation of JWT_SECRET, MCP_AUTH_TOKEN, MEMORY_API_KEY with secure random values
- Existing values preserved and displayed (secrets partially masked)
- LM Studio model recommendations for 16GB RAM systems

#### Enhanced Health Checks
- Now checks 7 endpoints: Memory API, Crawler API, MCP Server, Weaviate, Platform, Crawler Redis, Memory Redis
- Redis health via `docker exec redis-cli ping`
- Container status table after health results
- Pass/fail summary with count

#### Enhanced Pre-flight
- Docker daemon check, Compose availability, .env existence, required secrets validation, compose config validation, disk space check
- Clear error messages with actionable fix instructions

#### Backup System
- Quick backup: Redis RDB snapshots, Weaviate schema JSON, .env copy
- Full backup: all of quick + Docker volume tar.gz archives (weaviate_data, redis x2)
- Backup listing with sizes and dates
- Backup directory at `backups/` in monorepo root

### Specification and Project Plan
- Wrote comprehensive unified operations spec to `plans/2026-03-17-unified-ops-dashboard-spec.md`.
- Covers: Prometheus/Grafana monitoring, MinIO release store, enhanced dashboard, interactive installer, user management, 12 new chart components.
- 7-phase project plan with 50+ tasks across 8 weeks.

## Verification
- `deploy-unified.sh --help` — displays full usage with all commands
- `deploy-unified.sh requirements` — correctly detects Docker daemon status, RAM, disk, Python, Node, curl, git
- `deploy-unified.sh deploy --dry-run` — runs preflight checks and reports failures clearly
- All commands exit cleanly with appropriate error codes
- Script is executable (`chmod +x` applied)

## Notes
- All pre-existing LSP errors in AiMemory and AiCrawler are unrelated to this work
- Docker daemon was not running during verification (expected on dev Mac) — requirements check correctly reports this
- The interactive menu launches when the script is run with no arguments
- Legacy commands (deploy:production, deploy:devnode, deploy:memory) are preserved for backward compatibility
