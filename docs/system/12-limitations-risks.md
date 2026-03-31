# 12 — Limitations and Risks

> Engram Platform v1.1.0 — Honest assessment of weaknesses, risks, and mitigations.
> Last updated: 2026-03-31
>
> This document is intended for auditors, reviewers, and technical decision-makers.
> Nothing is hidden. Every known limitation is listed with its impact and mitigation status.

---

## Table of Contents

1. [Infrastructure and Availability](#1-infrastructure-and-availability)
2. [Data Storage and Durability](#2-data-storage-and-durability)
3. [Security](#3-security)
4. [External Dependencies](#4-external-dependencies)
5. [Performance](#5-performance)
6. [Operational Gaps](#6-operational-gaps)
7. [Code Quality](#7-code-quality)
8. [Summary Risk Matrix](#8-summary-risk-matrix)

---

## 1. Infrastructure and Availability

### 1.1 Single-Node Deployment — No High Availability

**Limitation**: The entire Engram stack (seven Docker containers, nginx, Weaviate, two Redis instances, Memory API, Crawler API, MCP Server, and the Next.js frontend) runs on a single host.

**Impact**: CRITICAL. Any hardware failure, OS crash, or power outage takes down all services simultaneously. There is no failover, no redundancy, and no load distribution. Estimated recovery time (manual restart) is 5-15 minutes assuming the host survives. Full re-provisioning from backup: 1-4 hours (assuming backups exist; see section 2.4).

**Mitigation**: Docker `restart: unless-stopped` policy ensures automatic container restart after host reboot. Resource limits prevent any single container from consuming all host resources. The `deploy-unified.sh` script provides automated health checks and restart procedures.

**Mitigation gap**: No automated failover to a secondary host. No multi-node orchestration (no Kubernetes, no Docker Swarm). Adding HA would require significant architectural changes.

---

### 1.2 Weaviate — Single Instance, No Replication

**Limitation**: Weaviate runs as a single container instance with `REPLICATION_FACTOR: 1`. There is no clustering, no data replication, and no horizontal scaling.

**Impact**: HIGH. Vector database is a single point of failure for all memory operations. If the Weaviate container crashes or the volume is corrupted, all stored memories are lost until recovered from backup. Search and storage operations cannot be distributed across nodes.

**Mitigation**: Data is persisted to a Docker named volume (`weaviate_data`). The volume survives container restarts and rebuilds. Weaviate's health check runs every 30 seconds with 5 retries.

**Mitigation gap**: No automated backup of the Weaviate volume. No multi-node Weaviate cluster. No read replicas for query scaling.

---

### 1.3 Redis — In-Memory with Limited Persistence

**Limitation**: Both Redis instances (memory-redis and crawler-redis) run with `--appendonly yes` for AOF persistence, but are subject to `maxmemory` limits (256 MB and 384 MB respectively) with `allkeys-lru` eviction. Under memory pressure, Redis will silently evict keys.

**Impact**: MEDIUM. Cache eviction is expected behavior and does not cause data loss for the primary store (Weaviate). However, evicted embedding cache entries require re-computation (API calls to the embedding provider), and evicted crawler cache entries require re-crawling. If Redis is OOM-killed by the Docker runtime, the AOF file may be incomplete.

**Mitigation**: Memory limits are set conservatively. The `allkeys-lru` policy evicts least-recently-used keys first, preserving hot data. AOF provides crash recovery for non-evicted data. Docker resource limits prevent Redis from consuming host memory.

**Mitigation gap**: No Redis Sentinel or Redis Cluster for failover. No monitoring alerts for memory usage approaching the limit. AOF rewrite can briefly double memory usage.

---

## 2. Data Storage and Durability

### 2.1 No Encryption at Rest

**Limitation**: Neither Weaviate nor Redis encrypts data on disk. Docker volumes store data in plaintext on the host filesystem.

**Impact**: HIGH. If the host disk is compromised (physical access, stolen drive, unauthorized SSH), all stored memories, embeddings, API keys (hashed), and cached data are readable. This includes potentially sensitive OSINT data collected by the crawler.

**Mitigation**: Host access is restricted to Tailscale VPN only (no public SSH). Docker containers run with `no-new-privileges` and read-only filesystems where possible. The host should use full-disk encryption (LUKS on Linux, FileVault on macOS).

**Mitigation gap**: The platform does not enforce or verify host-level disk encryption. There is no application-level encryption for stored memories.

---

### 2.2 Embedding Model Lock-in

**Limitation**: Changing the embedding model requires re-embedding all stored data. Vector dimensions are fixed at schema creation time in Weaviate. A model change means: wipe the Weaviate schema, flush the Redis embedding cache, and re-process every memory through the new model.

**Impact**: HIGH. For a production system with thousands of memories, re-embedding is a time-consuming and API-cost-intensive operation. During re-embedding, search quality is degraded or unavailable. There is no incremental migration path.

**Mitigation**: The platform supports multiple embedding providers (OpenAI, DeepInfra, Nomic, Ollama, local) to avoid vendor lock-in at the provider level. The `.env` configuration makes model changes straightforward operationally.

**Mitigation gap**: No dual-index capability to run old and new embeddings simultaneously. No automated re-embedding pipeline. No cost estimation tool for re-embedding operations.

---

### 2.3 Audit Log Retention — Redis Stream with Auto-Pruning

**Limitation**: Audit logs are stored in a Redis Stream with `MAXLEN ~10000`. When the stream exceeds approximately 10,000 entries, older entries are automatically pruned. There is no long-term audit log persistence.

**Impact**: MEDIUM. For compliance or forensic review, audit history beyond the most recent ~10,000 operations is permanently lost. At moderate usage (100 operations/day), this provides roughly 100 days of history. At heavy usage, it could be as few as days.

**Mitigation**: The `MAXLEN` cap prevents Redis memory exhaustion from unbounded audit growth.

**Mitigation gap**: No export or rotation of audit logs to durable storage (e.g., file-based logs, S3, or a database). No configurable retention policy beyond the Redis Stream cap.

---

### 2.4 No Automated Backups — No Disaster Recovery Plan

**Limitation**: There is no automated backup system for any data store. No scheduled volume snapshots, no Weaviate export jobs, no Redis RDB dumps to remote storage. There is no documented disaster recovery procedure.

**Impact**: CRITICAL. Data loss from volume corruption, accidental `docker compose down -v`, host failure, or operator error is permanent and irrecoverable. This applies to all stored memories, crawler data, ChromaDB collections, and Redis state.

**Mitigation**: Docker named volumes persist across container restarts. The `deploy-unified.sh` script includes a backup directory (`backups/`) but no automated backup jobs populate it.

**Mitigation gap**: No cron job for periodic backups. No offsite backup replication. No backup verification or restore testing. No documented RTO/RPO targets.

---

## 3. Security

### 3.1 API Key Management — No Rotation or Expiry

**Limitation**: API keys are stored as SHA-256 hashes. There is no key rotation mechanism, no expiry dates on keys, and no automated key lifecycle management. Compromised keys remain valid until manually removed.

**Impact**: MEDIUM. A leaked API key provides indefinite access to the Memory API until an administrator notices and revokes it. There is no audit trail linking specific operations to specific keys (keys are validated but not individually tracked in audit logs).

**Mitigation**: Keys are hashed (not stored in plaintext). Access is restricted to Tailscale network. CORS limits browser-based access to allowed origins.

**Mitigation gap**: No key expiry. No rotation reminders or enforcement. No per-key rate limiting. No key-level audit trail.

---

### 3.2 Rate Limiting — Nginx-Level Only

**Limitation**: Rate limiting is implemented only at the nginx reverse proxy level using `limit_req_zone`. There is no per-key, per-user, or per-tenant rate limiting at the application level.

**Impact**: MEDIUM. All clients sharing an IP address (e.g., behind a Tailscale exit node or NAT) share the same rate limit bucket. A single misbehaving client can exhaust the rate limit for all clients from that IP. There is no way to set different limits for different API keys or service accounts.

| Zone | Rate | Burst |
|------|------|-------|
| `api` (Memory/Crawler/MCP) | 60 req/s | 50 |
| `general` (Frontend) | 120 req/s | 100 |
| `write` | 20 req/s | (not applied in current config) |

**Mitigation**: The rate limits are generous enough for normal operation. Tailscale network restricts access to authorized devices.

**Mitigation gap**: No application-level rate limiting. No per-key quotas. No rate limit headers returned to clients.

---

### 3.3 Weaviate Anonymous Access

**Limitation**: Weaviate is configured with `AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED: true`. Any client on the Docker network can read and write to Weaviate without authentication.

**Impact**: LOW (within current architecture). Weaviate is not exposed to any external port; it is only accessible within the Docker bridge network. The Memory API is the sole gateway to Weaviate. However, if another container is compromised, it could directly access Weaviate.

**Mitigation**: Weaviate has no port mapping to the host. Only containers on `engram-platform-network` can reach it. The Memory API enforces its own auth layer.

**Mitigation gap**: No Weaviate-level authentication. A compromised container could bypass Memory API auth and access Weaviate directly.

---

### 3.4 SonarQube Security Hotspots — 66 Unreviewed

**Limitation**: SonarQube analysis identified 66 security hotspots across the codebase that have not been reviewed or triaged. These are potential security issues that require human assessment to determine if they are true vulnerabilities or false positives.

**Impact**: UNKNOWN (by definition, unreviewed hotspots have not been assessed). Hotspots may include issues like hardcoded credentials, insecure random number generation, weak cryptography, or injection vulnerabilities. The actual risk cannot be quantified without review.

**Mitigation**: All 0 confirmed vulnerabilities (no critical/high/medium severity vulnerabilities confirmed). The hotspots are flagged for review, not confirmed issues.

**Mitigation gap**: No scheduled review cadence for security hotspots. No assignment of hotspot triage to specific reviewers.

---

## 4. External Dependencies

### 4.1 Clerk — External SaaS Authentication

**Limitation**: Authentication is entirely dependent on Clerk, a third-party SaaS provider. There is no self-hosted authentication option. Clerk handles user management, session tokens, OAuth flows, and sign-in/sign-up UI.

**Impact**: HIGH. If Clerk experiences an outage, no user can sign in to the platform. If Clerk changes pricing, discontinues service, or is acquired, the auth system must be replaced. The frontend JS bundle includes the Clerk SDK (~portion of the 683 KB vendor bundle). Clerk processes user data under its own privacy policy.

**Mitigation**: Clerk has a strong uptime track record (99.9%+ SLA on paid plans). The platform uses Clerk's custom domain feature (`clerk.velocitydigi.com`) to maintain branding. Session tokens, once issued, work for their TTL even if Clerk is briefly unavailable.

**Mitigation gap**: No self-hosted auth fallback. No migration plan to an alternative provider (e.g., Auth.js, Lucia, Keycloak). Session token validation may still call Clerk's JWKS endpoint.

---

### 4.2 Embedding Provider Dependency

**Limitation**: The memory system requires a functioning embedding API to store or search memories. If the configured provider (DeepInfra, OpenAI, etc.) is down or rate-limited, all memory operations fail.

**Impact**: HIGH. No embedding API means no new memories can be stored and no searches can be executed. The Memory API's health check may still pass (it checks Weaviate and Redis, not the embedding provider), masking the issue.

**Mitigation**: Multiple providers are supported. Switching from DeepInfra to OpenAI (or vice versa) requires only an `.env` change and restart (assuming same dimensions). Redis caches embeddings, so repeat queries for the same content work offline.

**Mitigation gap**: No automatic failover between embedding providers. No embedding provider health check. Switching providers with different dimensions requires data migration (see section 2.2).

---

### 4.3 Consolidation LLM Dependency

**Limitation**: Memory consolidation (merging and summarizing related memories) requires an LLM API call, typically to DeepInfra or OpenAI. Without API access, consolidation silently fails.

**Impact**: LOW. Consolidation is a maintenance operation, not a critical path. Memories continue to accumulate but are not merged. Over time, this increases storage usage and may degrade search relevance due to redundant entries.

**Mitigation**: Consolidation can be triggered manually and is not required for normal operation.

**Mitigation gap**: No local LLM fallback for consolidation. No alerting when consolidation fails.

---

### 4.4 OSINT Crawler — Brittle External Dependencies

**Limitation**: The crawler depends on Crawl4AI (with Chromium), LM Studio (local LLM for content review), and ChromaDB. Each is a potential failure point. Crawl4AI requires a working Chromium binary with 2 GB shared memory. LM Studio must be running on the host or a reachable network endpoint.

**Impact**: MEDIUM. Crawler failure does not affect memory or platform operations. However, no new data is ingested into the system. Chromium crashes under memory pressure are common in containerized environments.

**Mitigation**: `shm_size: 2g` is configured for the crawler container. The watchdog process monitors memory and disk usage. Data is tiered (hot/warm/cold/archive) to manage disk consumption.

**Mitigation gap**: No automatic Chromium crash recovery beyond Docker restart. LM Studio availability is not monitored. If LM Studio is down, the AI review stage of the pipeline is skipped or fails silently.

---

## 5. Performance

### 5.1 Frontend Vendor Bundle Size — 683 KB

**Limitation**: The Next.js frontend ships a vendor JavaScript bundle of approximately 683 KB (compressed). Major contributors: Clerk SDK, Radix UI primitives, Framer Motion animations, ECharts, and Recharts.

**Impact**: MEDIUM. Initial page load is slower, especially on mobile or low-bandwidth connections. Time-to-interactive is delayed. This affects Core Web Vitals scores (LCP, FID/INP).

**Mitigation**: Next.js code splitting and dynamic imports reduce the per-page load. Static assets are cached for 1 year with immutable headers via nginx. Gzip compression is enabled (level 5) on all text-based assets.

**Mitigation gap**: No bundle analysis automation in CI. No budget enforcement for JS bundle size. Some dependencies (Framer Motion, dual charting libraries) could potentially be consolidated or lazy-loaded more aggressively.

---

### 5.2 Single-Process Memory API

**Limitation**: The Memory API runs with `UVICORN_WORKERS: 2` behind a single container. There is no horizontal scaling, no load balancer distributing across multiple API instances, and no autoscaling.

**Impact**: LOW under current usage. The 2 uvicorn workers handle moderate concurrent load. Under high concurrency (100+ simultaneous search queries), response times will degrade. The 100-connection limit (`UVICORN_LIMIT_CONN`) provides backpressure but no queuing.

**Mitigation**: The Memory API is IO-bound (waiting on Weaviate and embedding API), not CPU-bound, so 2 workers handle typical loads well. Redis caching reduces redundant Weaviate queries.

**Mitigation gap**: No autoscaling. No horizontal scaling. No load testing baseline established.

---

## 6. Operational Gaps

### 6.1 No Centralized Logging

**Limitation**: Each container logs independently to Docker's `json-file` driver, capped at 10 MB x 3 files per container. There is no centralized log aggregation (no ELK, no Loki, no CloudWatch). Logs are not indexed or searchable across services.

**Impact**: MEDIUM. Debugging cross-service issues requires running `docker compose logs` on each service individually. Log correlation across services (e.g., tracing a request from nginx through memory-api to Weaviate) is manual. When log files rotate, older entries are permanently lost.

**Mitigation**: `docker compose logs -f` provides real-time aggregated output. The `deploy-unified.sh` script writes deployment logs to `/var/log/engram/`.

**Mitigation gap**: No structured log shipping. No log retention beyond the 30 MB cap per service. No distributed tracing (no OpenTelemetry, no Jaeger).

---

### 6.2 No Monitoring or Alerting

**Limitation**: There is no application monitoring, no metrics collection, and no alerting system in production. Docker health checks exist but only restart containers — they do not notify operators.

**Impact**: HIGH. Service degradation or failure may go unnoticed until a user reports an issue. There is no visibility into API latency, error rates, Weaviate query performance, Redis hit ratios, or resource utilization trends.

**Mitigation**: Docker health checks provide basic liveness checking. The `quality-gate.sh` script provides a manual quality check. Sentry integration is available (optional, via `NEXT_PUBLIC_SENTRY_DSN`) for frontend error tracking.

**Mitigation gap**: No Prometheus/Grafana stack (ops01 VM exists but is not integrated). No PagerDuty/OpsGenie alerting. No SLA monitoring. The optional ntfy.sh and Resend email alert variables are defined but not wired to automated triggers.

---

### 6.3 DNS — app.velocitydigi.com A Record Pending

**Limitation**: The `app.velocitydigi.com` DNS A record has not been created in Cloudflare. The platform is accessible via `memory.velocitydigi.com` but the `app` subdomain does not resolve.

**Impact**: LOW. The platform works under `memory.velocitydigi.com`. Any documentation or links referencing `app.velocitydigi.com` will not work.

**Mitigation**: Cloudflare DNS changes require dashboard access (no API keys available). The nginx config does not reference `app.velocitydigi.com`, so no server-side changes are needed.

**Mitigation gap**: No Cloudflare API keys for automated DNS management. DNS changes are a manual process.

---

### 6.4 Turnstile Captcha — Test Key in Use

**Limitation**: Cloudflare Turnstile captcha is configured with a test/development site key, not a production key.

**Impact**: LOW. The captcha widget renders but does not provide real bot protection. Automated form submissions are not blocked.

**Mitigation**: Replacing the test key with a production key from the Cloudflare dashboard is a one-line `.env` change.

**Mitigation gap**: No automation to detect or alert on test keys in production.

---

## 7. Code Quality

### 7.1 mypy Errors — 87 Unresolved in AiMemory

**Limitation**: The AiMemory Python codebase has 87 mypy type checking errors. These are primarily missing type annotations, incompatible type assignments, and unresolved import types.

**Impact**: LOW. mypy errors do not cause runtime failures. They indicate potential type safety issues that could lead to bugs in edge cases. The test suite (985 passing tests) provides functional coverage.

**Mitigation**: ruff linting passes cleanly. Pytest coverage is at 79.8%. The mypy errors are tracked and prioritized as low-severity technical debt.

**Mitigation gap**: No CI enforcement of mypy passing. No scheduled effort to reduce the error count.

---

### 7.2 AiCrawler Low-Severity Warnings — 4 Issues

**Limitation**: The AiCrawler has 4 low-severity warnings: Pydantic field shadowing, pytest configuration warning, multipart import deprecation, and resource warnings in tests.

**Impact**: NEGLIGIBLE. These do not affect functionality. They may cause issues on future dependency upgrades.

**Mitigation**: All 2,393 crawler tests pass. The warnings are documented and tracked.

**Mitigation gap**: No automated suppression or fix scheduled.

---

## 8. Summary Risk Matrix

| # | Risk | Severity | Likelihood | Impact | Mitigation Status |
|---|------|----------|-----------|--------|-------------------|
| 1.1 | Single-node, no HA | CRITICAL | Medium | Total outage | Partial (auto-restart) |
| 2.4 | No automated backups | CRITICAL | Medium | Permanent data loss | None |
| 2.1 | No encryption at rest | HIGH | Low | Data exposure | Partial (Tailscale) |
| 2.2 | Embedding model lock-in | HIGH | Low | Costly migration | Partial (multi-provider) |
| 4.1 | Clerk SaaS dependency | HIGH | Low | Auth outage | Minimal |
| 4.2 | Embedding provider dependency | HIGH | Medium | Memory ops fail | Partial (caching) |
| 6.2 | No monitoring/alerting | HIGH | High | Silent failures | Minimal |
| 3.1 | No API key rotation/expiry | MEDIUM | Low | Unauthorized access | Partial (hashing) |
| 3.2 | Nginx-only rate limiting | MEDIUM | Low | Abuse/DoS | Partial |
| 1.3 | Redis memory pressure | MEDIUM | Medium | Cache eviction | Partial (LRU) |
| 2.3 | Audit log auto-pruning | MEDIUM | Medium | Lost audit history | None |
| 4.4 | Crawler brittleness | MEDIUM | Medium | No new data | Partial (watchdog) |
| 5.1 | 683 KB vendor bundle | MEDIUM | High | Slow page load | Partial (code splitting) |
| 6.1 | No centralized logging | MEDIUM | High | Slow debugging | Minimal |
| 3.4 | 66 unreviewed hotspots | UNKNOWN | Unknown | Unknown | None |
| 7.1 | 87 mypy errors | LOW | Low | Potential bugs | Tracked |
| 6.3 | DNS A record pending | LOW | Certain | Broken links | Manual fix available |
| 6.4 | Turnstile test key | LOW | Certain | No bot protection | Manual fix available |
| 7.2 | 4 crawler warnings | NEGLIGIBLE | Low | None currently | Tracked |

---

### Priority Remediation Recommendations

**Immediate (week 1):**
1. Implement automated Weaviate volume backups (cron + `docker cp` or volume snapshot)
2. Implement automated Redis RDB backups
3. Replace Turnstile test key with production key
4. Create `app.velocitydigi.com` DNS A record

**Short-term (month 1):**
5. Deploy Prometheus + Grafana from ops01 VM for monitoring
6. Implement structured log shipping (Loki or similar)
7. Add embedding provider health check to Memory API `/health` endpoint
8. Triage the 66 SonarQube security hotspots

**Medium-term (quarter 1):**
9. Implement API key expiry and rotation
10. Add per-key rate limiting at application level
11. Evaluate self-hosted auth alternatives (Auth.js, Keycloak)
12. Establish and enforce frontend bundle size budgets
13. Implement Weaviate authentication
14. Document and test disaster recovery procedures
