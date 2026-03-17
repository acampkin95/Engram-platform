# Engram Platform Readiness and Code Review

## Executive Summary

Engram is a multi-service AI memory and intelligence platform composed of a Next.js dashboard, a Python FastAPI memory service, a Python FastAPI crawler, a TypeScript MCP server, and a shared Python utility package, all orchestrated primarily via Docker Compose under `Engram-Platform`. Documentation, environment templates, and deployment guides are detailed and coherent, which is a strong indicator of operational maturity for a personal project and early-stage production use. However, the platform is explicitly marked as ~65% complete, and current test coverage, hardening, and cleanup level suggest it is not yet ready for mission‑critical multi-tenant production without further work.

Key strengths include: clear architecture and service boundaries, strong documentation, Docker-based deployment, presence of CI-related configurations, and test suites across most services. Key risks include: uneven and sometimes low test coverage (especially in the Platform), presence of many ad‑hoc fix scripts in source roots, some repository clutter, and limited visible production observability and automated deployment checks.


## Architecture Overview

The repository root is an orchestration monorepo that contains four main components: `Engram-AiMemory`, `Engram-AiCrawler`, `Engram-MCP`, and `Engram-Platform`, plus the Python package `engram-shared` and a `docs/` tree. The top-level README clearly explains the purpose of each component, the data flow between crawler → memory → MCP → UI, and exposes the key ports for all services including Weaviate and Redis instances.

The architecture diagram in the README shows the dashboard at the top, three internal services (MCP, crawler, memory) in the middle, and backing stores (Weaviate, Redis) beneath, which matches the directory and deployment structure in `Engram-Platform/docker-compose.yml` and the production guide. This decomposition is appropriate for the problem space, giving you freedom to scale components independently while retaining a relatively simple deployment story via Docker.


## Documentation and Developer Experience

Top-level docs are well organized, with an index, deployment manual, architecture manual, MCP manual, reference docs for environment variables, ports, and commands, and operational runbooks for maintenance, troubleshooting, and administration. Additional project-level docs like `PROJECT_ROADMAP.md` and `MEMORY_FEATURES.md` describe a 12‑week completion plan and the memory feature set, which is valuable for planning and onboarding.

Each major subproject (AiMemory, AiCrawler, MCP, Platform, engram-shared) has its own README and often CHANGELOG and AGENTS files, plus `.env.example` and `.env.production.example` where relevant, which makes per-service development workflows discoverable. The top-level README also includes concise dev commands per subproject (e.g. `make dev` in AiMemory, `uvicorn` in AiCrawler, `npm run dev` in MCP and Platform), and instructions for installing `engram-shared` via `pip install -e ./engram-shared`, which further improves DX.


## Deployment and Operations

The primary deployment method is Docker Compose from within `Engram-Platform`, where `docker-compose.yml` defines services for the frontend, memory API, crawler API, MCP server, Weaviate, multiple Redis instances, and Nginx, with support for profiles such as `mcp`. `PRODUCTION_SETUP.md` documents how to deploy to a production domain (`memory.velocitydigi.com`), configure `NEXT_PUBLIC_APP_URL` and CORS origins, and rely on an external reverse proxy (e.g., Cloudflare or Nginx) for TLS termination.

The production guide suggests using `docker-compose up -d --build` and `docker-compose ps` to manage services and verify health, as well as basic troubleshooting for 502, CORS, and WebSocket issues, which is adequate for a small-scale deployment. There are additional Nginx configs and `systemd` units within `Engram-Platform` and Tailscale setup docs that hint at a real-world deployment on a tailnet, which is promising for real usage but also means production configuration is somewhat bespoke.


## Component-Level Readiness

### Engram-Platform (Next.js dashboard)

The `Engram-Platform` directory contains environment examples, a `docker-compose.yml`, Nginx configuration, shell installation scripts, and a `frontend` folder that hosts the Next.js 15 app. The `frontend` subdirectory has a standard modern Next.js setup (app router, `next.config.ts`, `middleware.ts`, `tsconfig.json`, Vitest config, Playwright configs, Sentry client config, Biome config, components.json, and e2e directory), suggesting a contemporary stack with type checking, linting, and testing hooks.

The top-level README indicates that Platform test coverage is currently ~0% with a target of 80%, confirming that while test tooling is present, actual tests are limited or missing. The presence of multiple helper scripts such as `add_decay_button.js`, `add_decay_to_client.js`, and `fix_perf.js` within `frontend/` also indicates ongoing refactoring and manual code transformations, which is acceptable for a project in flux but should be removed or converted into proper codemods or documented scripts before a v1 release.

### Engram-AiMemory (Memory API)

`Engram-AiMemory` appears as a Python monorepo with a `pyproject.toml`, `Makefile`, `package.json` for TS tooling, `.env` templates, Biome config, Docker definitions, and internal `packages/` and `01_devroot` source roots. The top-level README and CHANGELOG here describe the memory system, including tiered memory, and the root Makefile exposes commands for dev and tests, aligning with the top-level README’s claim of ~70% test coverage.

A significant number of `fix_*` scripts (e.g., `fix_api_search_temporal.py`, `fix_fastapi_exception_handlers.py`, various worker syntax fix scripts) suggest that several large refactors have been performed using one-off scripts checked into the repo, which can be useful for history but also adds noise and raises questions about whether all generated changes are covered by tests. The presence of `.github` and `docs/` inside AiMemory hint at CI and internal documentation, but those were not inspected in depth here.

### Engram-AiCrawler (Crawler API)

`Engram-AiCrawler` hosts the crawler service with `.github`, `.gitignore`, `01_devroot` for FastAPI backend and React frontend, and its own README, CHANGELOG, and branding folders. The README in the root describes runtime (FastAPI, Chromium, Crawl4AI) and the docs in 01_devroot show how to run the API and the associated UI, matching the top-level README’s instructions.

Like AiMemory, AiCrawler is reported to have moderate but incomplete test coverage (~58%, target 85%) and appears to be mid‑maturity: the presence of `.github` suggests CI workflows exist, but there is no guarantee of full coverage or integration tests for all crawling scenarios. Operationally, the crawler participates in Docker Compose via the Crawler API service on port 11235, with Redis backing and likely supervisord inside the container as referenced in the README and docs.

### Engram-MCP (MCP server)

`Engram-MCP` is a TypeScript Node 20 service with `.env.example`, `.github`, `package.json`, Biome config, Docker files, `src`, `tests`, and `templates`, which collectively describe a fairly mature MCP implementation with protocol-aware templates and a substantial automated test suite. The top-level README notes that MCP has 161 tests passing and roughly 80% overall completion, which is corroborated by the existence of a dedicated `tests/` directory and TypeScript tooling.

As with other services, there are multiple `fix_mcp_*` scripts in the root (e.g., for clients, search, tools, and schema), which indicates substantial iterative refactoring or one-off data/CodeMod runs; these should ideally be moved to a `scripts/` subdirectory or removed once no longer needed. The presence of `mcp-install.json` in AiMemory and install scripts in MCP suggests the MCP server is designed to be discoverable and installed as a toolset for AI clients, aligning with production ambitions.

### engram-shared (Shared utilities)

The `engram-shared` package is a small, focused Python library with its own `pyproject.toml`, `README`, index and quickstart docs, and `src/` tree that is intended to be installed editable into service venvs. Keeping shared logic in this separate package is a strong architectural choice that reduces duplication between memory and crawler services while allowing independent versioning.

There is no explicit test directory visible at the top level of `engram-shared`, so either tests live within `src` or in another repo; if absent, this is a gap for stability, given the centrality of these utilities to multiple services.


## Testing and Quality Tooling

The main README provides explicit commands for running tests across all components: `make test` in AiMemory, `pytest` in AiCrawler, `npm run test && npm run smoke` in MCP, and `npm run test:run && npm run test:e2e` in the Platform frontend. It also summarizes current coverage per component: AiMemory ~70% (target 95%), AiCrawler ~58% (target 85%), MCP 161 tests (approx 80%), Platform ~0% (target 80%), making the testing maturity and gaps very transparent.

Within the Platform frontend there are Vitest and Playwright configs, and a `test-results` directory plus `test-output.txt`, suggesting tests have been run and outputs captured, even though overall coverage remains low. Across AiMemory, AiCrawler, and MCP there are `.github` directories, Biome configs, and Makefiles, which strongly imply linting, formatting, and CI workflows exist, but the absence of visible repo-level GitHub Actions in the root means CI is likely defined per-service rather than centrally.


## Security, Configuration, and Secrets

Environment variable handling is well-structured: each major service has `.env.example` and often `.env.production.example` files, and the docs include a consolidated `docs/reference/environment-variables.md` plus explanations in the main README. This includes explicit variables for Clerk auth keys, JWT secrets, embedding providers, service URLs (Weaviate, Redis), and LM Studio for local models.

The production setup guide and README consistently instruct users to copy examples to `.env` and fill in secrets manually, but do not prescribe secret management solutions like Vault, SOPS, or environment-specific overlays, which is acceptable for a self‑hosted, single‑tenant deployment but may need to be revisited for multi-tenant or managed offerings. No hard-coded secrets were visible in the inspected top-level files, although `.DS_Store` artifacts and one-character files (`1`, `=3.15.0`) in some directories indicate some local artifacts have been committed, which should be cleaned for a polished release.


## Codebase Hygiene and Repository Layout

The repository is generally well-structured, but there is notable clutter: multiple `.DS_Store` files, stray single-character files named `1` at different levels, and an odd `=3.15.0` file in AiMemory, which appear to be editor or tooling artifacts accidentally committed. The large number of `fix_*` and `patch_*` scripts in AiMemory, AiCrawler, Platform, and MCP roots are also useful but noisy, and risk confusing contributors about the canonical code paths and whether these scripts must be run as part of setup or migrations.

On the positive side, versioned CHANGELOGs across services, AGENTS docs, and clearly separated `docs/`, `docker/`, `scripts/`, and `systemd/` directories contribute to a professional layout. There are no TODO or FIXME markers indexed in the code search, which likely means you are tracking work items in docs and roadmap instead of inline comments, but it also makes it harder for new contributors to identify technical debt hotspots directly in code.


## Overall Readiness Assessment

Based on the current state and the explicit self-assessment in the README, Engram appears production‑capable for a single-tenant, internal deployment where the operator understands the stack and is comfortable with some manual operations and incomplete UX/feature polish. The presence of real deployment docs, Docker Compose orchestration, systematic environment variable handling, external auth integration (Clerk, JWT), and non-trivial test suites in three of four components all support this view.

However, for broader external or commercial deployment (multi-tenant, many users, non‑technical operators), gaps remain: frontend test coverage is low, observability and metrics are not prominently documented, repository hygiene needs cleanup, and the heavy use of ad‑hoc fix scripts and manually documented flows suggests the system is still under active evolution. It is best described as a strong alpha or early beta: robust enough for serious experimentation and dogfooding, but not yet fully hardened for hands‑off production.


## Key Recommendations (Short Term)

1. **Clean repository artifacts and scripts**  
   Remove `.DS_Store`, single-character files like `1` or `=3.15.0`, and any unused `fix_*` or `patch_*` scripts, or move still‑needed scripts into a dedicated `tools/` or `scripts/maintenance/` folder with a brief README explaining usage.

2. **Raise Platform frontend test coverage**  
   Prioritize bringing Platform test coverage from ~0% toward your 80% target by adding unit tests for key utility modules, component tests for high-value UI components, and Playwright e2e coverage for primary flows (auth, memory search, crawler job management).

3. **Consolidate and document CI workflows**  
   Ensure each subproject’s `.github` workflows run on PRs and main branch pushes with clear gates (lint, unit tests, type checks, and, for the Platform, at least smoke e2e tests), and consider adding a root‑level CI that orchestrates core checks across all services for the full stack.

4. **Harden production observability**  
   Expand production docs to include logging, metrics, and alerting recommendations (e.g., structured logging from FastAPI and MCP, Prometheus exporters, Sentry for backend, log aggregation strategy) so operators can detect and debug issues quickly in production.

5. **Clarify migration and codemod patterns**  
   Where `fix_*` scripts represent idempotent codemods or data migrations, document them centrally (e.g., in `docs/02-maintenance-manual.md` or a dedicated migration doc) and standardize invocation (e.g., `make migrate`), then remove obsolete ones to reduce confusion.


## Key Recommendations (Medium Term)

1. **Complete coverage targets for AiMemory and AiCrawler**  
   Incrementally push AiMemory from ~70% toward 95% coverage and AiCrawler from ~58% toward 85%, focusing on complex query logic, temporal search, crawler orchestration, and error-handling paths that have historically required fix scripts.

2. **Introduce contract tests between services**  
   Define lightweight contract or integration tests that spin up minimal versions of Memory API, Crawler API, and MCP (possibly via Docker Compose in CI) and validate key workflows end-to-end (e.g., crawl → embed → store → query via MCP), reducing risk of regressions across service boundaries.

3. **Standardize configuration and secrets management**  
   For more serious production deployments, introduce a repeatable pattern for secrets (e.g., environment-specific `.env` overlays, SOPS, or Vault/1Password integration) and document it in `PRODUCTION_SETUP.md` and the env reference docs, rather than relying solely on manual `.env` editing.

4. **Improve onboarding for external contributors**  
   Add a top-level `CONTRIBUTING.md` describing how to set up dev envs, run tests, adhere to Biome/formatting rules, and understand the roadmap; link it from the README alongside existing docs and roadmaps.

5. **Plan for versioned releases and stability guarantees**  
   Given that each component already has a CHANGELOG, define a versioning strategy (e.g., semantic versioning per component or for the platform as a whole) and use Git tags plus release notes so that deployments can pin to known-good versions while newer changes are tested.


## Long-Term Evolution Ideas

- **Multi-tenant and role-based access control**: Extend the existing Clerk and JWT auth setup with clearer tenant concepts, roles, and per-tenant resource isolation if Engram is to be offered to multiple organizations.
- **Pluggable vector stores and models**: Abstract Weaviate and embedding provider integration via configuration and adapter interfaces to allow alternative backends (e.g., pgvector, Qdrant) and models without invasive changes.
- **Self-service deployment profiles**: Provide pre-defined Compose or Helm profiles for local-only, internal-team, and internet-facing deployments, each with tuned security and resource defaults, to make it easier for users with differing risk profiles to adopt the platform.
- **UX and analytics improvements**: As the Platform’s testing and robustness improve, invest in UX around memory browsing, temporal search visualization, and crawler job analytics to better showcase the system’s capabilities.