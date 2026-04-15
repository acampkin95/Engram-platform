# Engram Platform — Admin & User Guide

> Quick-start guide for deploying, configuring, and using the Engram AI Memory Platform.
> Version 1.2.0 | Updated 2026-04-03

---

## Page 1: Deployment & Configuration

### Default Credentials

| Field | Value |
|-------|-------|
| Admin Email | `admin@engram.local` |
| Admin Password | `EngramAdmin2026!` |
| Dashboard URL | `https://memory.velocitydigi.com/dashboard` |
| Setup Page | `https://memory.velocitydigi.com/setup` |

> Change defaults via `ENGRAM_ADMIN_EMAIL` and `ENGRAM_ADMIN_PASSWORD` env vars before first deploy.

### Quick Deploy (Docker Compose)

```bash
# 1. Clone and configure
cd /opt/engram/Engram-Platform
cp .env.example .env
# Edit .env — set BETTER_AUTH_SECRET, OPENAI_API_KEY, admin credentials

# 2. Start all services
docker compose up -d

# 3. Verify
docker compose ps          # 9 services running
curl -s http://localhost:8080/api/health | jq .
```

### Services & Ports

| Service | Internal Port | Purpose |
|---------|--------------|---------|
| nginx | 80/443 (exposed: 8080) | Reverse proxy, SSL termination |
| platform-frontend | 3000 | Dashboard (Next.js) |
| memory-api | 8000 | Memory CRUD, search, RAG |
| mcp-server | 3000 | MCP protocol (stdio + HTTP) |
| crawler-api | 11235 | Web crawler + AI analysis |
| weaviate | 8080 | Vector database |
| memory-redis | 6379 | Memory cache |
| crawler-redis | 6379 | Crawler cache |
| engram-landing | 3099 | Marketing site |

### Environment Variables (.env)

```bash
# Auth (required)
BETTER_AUTH_SECRET=<random-64-char-string>
ENGRAM_ADMIN_EMAIL=admin@engram.local
ENGRAM_ADMIN_PASSWORD=EngramAdmin2026!
ENGRAM_ADMIN_EMAILS=admin@engram.local  # comma-separated allowlist

# AI / Embeddings
OPENAI_API_KEY=sk-...                   # or use EMBEDDING_PROVIDER=ollama
EMBEDDING_PROVIDER=openai               # openai | deepinfra | nomic | ollama

# MCP Server
MCP_AUTH_TOKEN=<64-char-hex>            # generate via dashboard or: openssl rand -hex 32

# Optional
NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=false   # enable Google OAuth
GOOGLE_CLIENT_ID=                       # if Google OAuth enabled
GOOGLE_CLIENT_SECRET=
```

### MCP Client Setup (Claude Code / Desktop)

Add to your MCP client config (`~/.claude/settings.json` or Claude Desktop settings):

**Option A: HTTP Transport (remote)**
```json
{
  "mcpServers": {
    "engram": {
      "type": "http",
      "url": "http://100.78.187.5:3000/mcp",
      "headers": {
        "Authorization": "Bearer <MCP_AUTH_TOKEN>"
      }
    }
  }
}
```

**Option B: stdio Transport (local)**
```json
{
  "mcpServers": {
    "engram": {
      "command": "npx",
      "args": ["@engram/mcp", "start"],
      "env": {
        "ENGRAM_API_URL": "http://100.78.187.5:8000",
        "ENGRAM_API_KEY": "<your-api-key>"
      }
    }
  }
}
```

### SSL Certificates

- Wildcard cert: `*.velocitydigi.com` (Let's Encrypt)
- Auto-renewed via `/etc/letsencrypt/renewal-hooks/deploy/engram-nginx.sh`
- Cert path: `/opt/engram/Engram-Platform/certs/velocitydigi.{crt,key}`

---

## Page 2: Dashboard Usage & Administration

### First-Time Setup

1. Navigate to `https://memory.velocitydigi.com/setup`
2. Click **"Create Admin Account"** — creates the default admin
3. Copy the displayed credentials
4. Click **"Go to Sign In"** and log in

### Dashboard Navigation

| Section | Path | Purpose |
|---------|------|---------|
| Home | `/dashboard` | System overview, quick stats |
| Memory Browser | `/dashboard/memory` | Browse, search, manage memories |
| Memory Timeline | `/dashboard/memory/timeline` | Chronological memory view |
| Crawler | `/dashboard/crawler` | Web crawler management |
| Investigations | `/dashboard/crawler/investigations` | OSINT investigation workflows |
| Intelligence | `/dashboard/intelligence` | Knowledge graph, RAG chat |
| System > API Keys | `/dashboard/system/keys` | Manage API keys + MCP token |
| System > Audit Log | `/dashboard/system/audit` | Admin action audit trail |
| System > Settings | `/dashboard/system/settings` | Platform configuration |

### API Key Management

1. Go to **System > API Keys**
2. Click **"Create API Key"** — set name, scope, expiration
3. Copy the key immediately (shown once)
4. Use in API calls: `Authorization: Bearer <key>`

### MCP Token Management

1. Go to **System > API Keys** (MCP Auth Token section)
2. Click **"Generate New"** to create a 64-char token
3. Copy token and add to MCP client config as `MCP_AUTH_TOKEN`
4. Restart your MCP client to pick up the new token

### Memory API Quick Reference

```bash
BASE=https://memory.velocitydigi.com/api

# Health check
curl $BASE/health

# Add a memory
curl -X POST $BASE/memories \
  -H "Authorization: Bearer <key>" \
  -H "Content-Type: application/json" \
  -d '{"content": "Project uses React 19", "tier": 1, "memory_type": "fact"}'

# Search memories
curl "$BASE/memories/search?query=react&limit=5" \
  -H "Authorization: Bearer <key>"

# RAG query
curl -X POST $BASE/rag \
  -H "Authorization: Bearer <key>" \
  -H "Content-Type: application/json" \
  -d '{"query": "What tech stack does the project use?"}'
```

### Maintenance Commands

```bash
# View logs
docker compose logs -f memory-api     # specific service
docker compose logs --tail=100         # all services, last 100 lines

# Restart a service
docker compose restart platform-frontend

# Backup memory data
docker compose exec weaviate \
  curl -s localhost:8080/v1/backups -X POST \
  -d '{"id":"backup-2026-04-03","backend":"filesystem"}'

# Update and redeploy
rsync -avz --exclude node_modules --exclude .next \
  Engram-Platform/ root@100.78.187.5:/opt/engram/Engram-Platform/
ssh root@100.78.187.5 "cd /opt/engram/Engram-Platform && docker compose up -d --build"
```

### Troubleshooting

| Issue | Solution |
|-------|----------|
| Can't sign in | Check `BETTER_AUTH_SECRET` is set; visit `/setup` first |
| MCP connection refused | Verify `MCP_AUTH_TOKEN` matches; check `docker compose ps` |
| Memory search empty | Verify Weaviate is running: `curl http://localhost:8080/v1/.well-known/ready` |
| 502 Bad Gateway | Check service health: `docker compose ps`; restart nginx |
| SSL cert expired | Run `certbot renew` on host; copy certs to `/opt/engram/Engram-Platform/certs/` |

---

**Support:** Check `CHANGELOG.md` for recent changes. All infra accessible via Tailscale only.
