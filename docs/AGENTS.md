<!-- Generated: 2026-03-22 -->

# docs/

## Purpose

Central documentation hub for the Engram Platform. Contains seven comprehensive manuals (>2000 words each), reference sheets, and skill guides. Serves as the single source of truth for deployment, maintenance, architecture, troubleshooting, and administration.

## Key Files

| File | Description |
|------|-------------|
| `00-index.md` | Documentation index and navigation guide — start here |
| `01-deployment-manual.md` | Prerequisites, Docker setup, production hardening, scaling |
| `02-maintenance-manual.md` | Backup procedures, performance tuning, disaster recovery |
| `03-architecture-manual.md` | System diagrams, data flow, component integration |
| `04-troubleshooting-manual.md` | Diagnostic methodology, error reference, emergency procedures |
| `05-mcp-manual.md` | MCP server installation, tool reference, integration |
| `06-admin-manual.md` | User management, tenant setup, security configuration |
| `07-pre-commit-guide.md` | Git hooks, secrets detection, formatting |
| `RELEASE_CHECKLIST.md` | Pre-release verification steps |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `reference/` | Quick reference sheets (env vars, ports, commands) |
| `inject/` | MCP tool injection specs and examples |
| `skills/` | Agent skills for automation (dashboard, diagnosis, scaling) |
| `plans/` | Long-term roadmap, project plans, milestones |

## For AI Agents

### Working In This Directory

1. **Reading Documentation**
   - Always start with `00-index.md` to understand context
   - Use "By Task" and "By Role" navigation tables to find relevant sections
   - Cross-reference related manuals (architecture → troubleshooting)

2. **Updating Documentation**
   - Match the existing manual format: title → overview → detailed sections with code examples
   - Keep 100-char line width for consistency
   - Use 2-space indentation for YAML/JSON examples
   - Include version date (`**Updated:** YYYY-MM-DD`) in header

3. **Adding New Content**
   - Manuals are role-based, not feature-based (DevOps, Backend, Frontend, Admin, Security)
   - Reference existing manuals before creating new docs
   - Link to reference sheets instead of duplicating information
   - Use heading hierarchy consistently (# Manual, ## Section, ### Subsection)

### Testing Requirements

- All code examples must be verified on the target environment
- All shell commands must be tested with `bash -n` (syntax check)
- Docker Compose examples must validate with `docker compose config`
- Environment variable examples must match `.env.example` in Engram-Platform/

### Common Patterns

**Deployment sections:**
```markdown
## Deployment Name
### Prerequisites
(what must be true before starting)
### Steps
1. (ordered steps)
2. (include shell commands)
3. (include curl/API examples for verification)
### Verification
(health checks, logs to tail)
### Rollback
(if deployment failed)
```

**Architecture sections:**
- Use ASCII diagrams or reference external diagrams
- Include data flow direction and message formats
- Call out failure modes and recovery

**Troubleshooting sections:**
- Error code → symptom → root cause → solution
- Include `docker compose logs SERVICE` examples
- Reference debug env var (`DEBUG=1`)

## Dependencies

### Internal
- All manuals reference `Engram-Platform/docker-compose.yml` (master orchestration)
- Deployment manual extends `scripts/deploy-unified.sh` (installation wizard)
- Admin manual extends scripts in `.pre-commit-hooks/` (git integration)
- Troubleshooting manual cross-references `AGENTS.md` (architecture patterns)

### External
- Docker Compose v2.20+
- Bash 4.0+
- Standard Unix utilities (curl, grep, awk, sed)

<!-- MANUAL: This is the docs/ hub. All documentation flows through here. -->
