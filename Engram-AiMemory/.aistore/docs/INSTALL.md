# AI Memory System — Installation & Configuration Guide

> **AI Agent Note:** This document is structured for autonomous execution.
> Every code block is copy-pasteable and idempotent unless marked `⚠ DESTRUCTIVE`.
> Validation commands follow each step. Run them to confirm before continuing.

---

## Table of Contents

1. [System Requirements](#1-system-requirements)
2. [Architecture Overview](#2-architecture-overview)
3. [Pre-Installation Checklist](#3-pre-installation-checklist)
4. [Ubuntu System Preparation](#4-ubuntu-system-preparation)
5. [Docker Installation](#5-docker-installation)
6. [System Optimisation](#6-system-optimisation)
7. [Project Setup](#7-project-setup)
8. [Environment Configuration](#8-environment-configuration)
9. [Service Deployment](#9-service-deployment)
10. [Schema Initialisation](#10-schema-initialisation)
11. [MCP Server Integration](#11-mcp-server-integration)
12. [Production Hardening](#12-production-hardening)
13. [Monitoring & Observability](#13-monitoring--observability)
14. [Backup & Recovery](#14-backup--recovery)
15. [Troubleshooting Reference](#15-troubleshooting-reference)
16. [API Reference](#16-api-reference)
17. [Environment Variable Reference](#17-environment-variable-reference)

---

## 1. System Requirements

### Minimum (development / single user)

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 4 cores | 8+ cores |
| RAM | 8 GB | 16–32 GB |
| Storage | 20 GB SSD | 100 GB NVMe |
| OS | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |
| Docker | 24.x | 27.x |
| Docker Compose | v2.20+ | v2.29+ |
| Node.js | 20 LTS | 20 LTS |
| Python | 3.11 | 3.12 |

### Production (multi-tenant / team)

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 8 cores | 16+ cores (EPYC/Xeon) |
| RAM | 32 GB ECC | 64 GB ECC |
| Storage | 200 GB NVMe | 1 TB RAID-1 NVMe |
| Network | 1 Gbps | 10 Gbps |

### Port Map

| Port | Service | Protocol | Exposure |
|------|---------|----------|----------|
| 8080 | Weaviate HTTP | HTTP/REST | Internal + external (API) |
| 50051 | Weaviate gRPC | gRPC | Internal only |
| 6379 | Redis | TCP | Internal only |
| 8000 | Memory API | HTTP/REST | Internal + external (API) |
| 3000 | MCP Server | stdio / HTTP | Internal (Claude, Cursor) |
| 3001 | Dashboard | HTTP | External (browser) |
| 80/443 | Nginx proxy | HTTP/HTTPS | External (production) |

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    AI Agents / Claude                        │
│              (via MCP stdio or HTTP transport)               │
└──────────────────────────┬──────────────────────────────────┘
                           │ MCP tools
                    ┌──────▼──────┐
                    │ MCP Server  │  TypeScript / Node 20
                    │  :3000      │  tools: add/search/delete
                    └──────┬──────┘
                           │ HTTP
         ┌─────────────────▼──────────────────┐
         │          Memory API                 │
         │       FastAPI / Python 3.11         │
         │            :8000                    │
         │  /memories  /search  /stats  /health│
         └──────┬────────────────┬─────────────┘
                │                │
    ┌───────────▼───┐    ┌───────▼────────┐
    │   Weaviate    │    │     Redis       │
    │  Vector DB    │    │    Cache        │
    │  :8080/:50051 │    │    :6379        │
    │  HNSW + BQ    │    │  session/rate   │
    └───────────────┘    └────────────────┘

                    ┌──────────────┐
                    │  Dashboard   │
                    │  Next.js 15  │
                    │   :3001      │
                    └──────────────┘

    ── All services on bridge network: memory-network ──
```

### Memory Tier Model

```
Tier 1 — Project Memory   (tenant-scoped, per project)
  └─ Code insights, decisions, file references, debug history

Tier 2 — General Memory   (user-scoped, cross-project)
  └─ Preferences, workflows, tool usage patterns

Tier 3 — Global Memory    (shared bootstrap, read-mostly)
  └─ Best practices, documentation, org-wide knowledge
```

---

## 3. Pre-Installation Checklist

Run this block to validate your environment before starting:

```bash
# ── Pre-flight validation ──────────────────────────────────────
echo "=== System ===" && uname -a
echo ""
echo "=== OS ===" && lsb_release -d 2>/dev/null || cat /etc/os-release
echo ""
echo "=== CPU ===" && nproc && grep "model name" /proc/cpuinfo | head -1
echo ""
echo "=== RAM ===" && free -h
echo ""
echo "=== Disk ===" && df -h /
echo ""
echo "=== Network ===" && curl -fsS --max-time 5 https://example.com > /dev/null && echo "✓ Internet reachable" || echo "✗ No internet"
echo ""
echo "=== Docker ===" && (command -v docker &>/dev/null && docker --version || echo "NOT INSTALLED")
echo ""
echo "=== Docker Compose ===" && (docker compose version 2>/dev/null || echo "NOT INSTALLED")
echo ""
echo "=== Python ===" && (python3 --version 2>/dev/null || echo "NOT INSTALLED")
echo ""
echo "=== Node.js ===" && (node --version 2>/dev/null || echo "NOT INSTALLED")
echo ""
echo "=== Sudo ===" && (sudo -n true 2>/dev/null && echo "✓ passwordless sudo" || echo "⚠ sudo requires password")
```

**Expected output — proceed only if:**
- RAM ≥ 8 GB
- Disk ≥ 20 GB free on `/`
- Internet reachable
- Sudo access available

---

## 4. Ubuntu System Preparation

> **Validation after each block:** A `✓` line confirms the step succeeded.

### 4.1 Update system

```bash
sudo apt-get update -q && sudo apt-get upgrade -yq
echo "✓ System updated"
```

### 4.2 Install essential packages

```bash
sudo apt-get install -yq \
  curl wget git build-essential \
  ca-certificates gnupg lsb-release apt-transport-https software-properties-common \
  htop iotop tmux \
  unzip jq \
  python3 python3-pip python3-venv python3-dev \
  net-tools dnsutils openssl \
  fail2ban ufw logrotate

echo "✓ Essential packages installed"
```

### 4.3 Python 3.12 (optional upgrade)

```bash
# Skip if python3 --version already shows 3.12+
sudo add-apt-repository -y ppa:deadsnakes/ppa
sudo apt-get update -q
sudo apt-get install -yq python3.12 python3.12-venv python3.12-dev
python3.12 --version   # → Python 3.12.x
```

### 4.4 Node.js 20 LTS

```bash
# NodeSource setup
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -yq nodejs
node --version    # → v20.x.x
npm --version     # → 10.x.x
```

### 4.5 Service user (production only)

```bash
# Create isolated service user — skip for local dev
sudo useradd -m -s /bin/bash memoryserver
sudo usermod -aG docker memoryserver
sudo usermod -aG sudo memoryserver

# Create data directories owned by service user
sudo mkdir -p /data/{volumes/{weaviate,postgres,redis},backups,configs}
sudo chown -R memoryserver:memoryserver /data
echo "✓ Service user 'memoryserver' created"
```

### Validation — 4

```bash
python3 --version       # Python 3.11+ or 3.12+
node --version          # v20.x.x
npm --version           # 10.x.x
git --version           # git 2.x.x
curl --version | head -1
echo "✓ Phase 4 complete"
```

---

## 5. Docker Installation

### 5.1 Install Docker Engine

```bash
# Remove conflicting packages
sudo apt-get remove -yq docker docker-engine docker.io containerd runc 2>/dev/null || true

# Add Docker's official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add Docker repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install
sudo apt-get update -q
sudo apt-get install -yq \
  docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin

echo "✓ Docker Engine installed"
```

### 5.2 Post-install configuration

```bash
# Add current user to docker group (avoids sudo for docker commands)
sudo usermod -aG docker "${USER}"

# Enable and start Docker
sudo systemctl enable docker --now

# Verify (may need newgrp docker or re-login for non-sudo)
sudo docker --version           # Docker version 27.x.x
sudo docker compose version     # Docker Compose version v2.x.x
sudo docker run --rm hello-world
echo "✓ Docker running"
```

### Validation — 5

```bash
docker info 2>/dev/null | grep "Server Version"   # → Server Version: 27.x.x
docker compose version                             # → Docker Compose version v2.x.x
echo "✓ Phase 5 complete"
```

---

## 6. System Optimisation

> **Why this matters:** Weaviate HNSW requires `vm.max_map_count ≥ 262144`.
> Redis needs THP disabled. BBR improves gRPC stream throughput.

### 6.1 Kernel parameters

```bash
sudo tee /etc/sysctl.d/90-ai-memory.conf > /dev/null << 'EOF'
# Weaviate HNSW / MMAP
vm.max_map_count              = 262144
vm.swappiness                 = 10
vm.dirty_ratio                = 20
vm.dirty_background_ratio     = 5
vm.overcommit_memory          = 1

# Network — TCP BBR + large buffers for gRPC
net.core.default_qdisc        = fq
net.ipv4.tcp_congestion_control = bbr
net.core.rmem_max             = 134217728
net.core.wmem_max             = 134217728
net.core.somaxconn            = 65535
net.ipv4.tcp_max_syn_backlog  = 65535
net.ipv4.tcp_keepalive_time   = 60
net.ipv4.tcp_tw_reuse         = 1
net.ipv4.ip_local_port_range  = 10000 65535

# File system
fs.file-max                   = 2097152
fs.inotify.max_user_watches   = 524288
EOF

sudo sysctl -p /etc/sysctl.d/90-ai-memory.conf
echo "✓ Kernel parameters applied"
```

### 6.2 File descriptor limits

```bash
sudo tee /etc/security/limits.d/90-ai-memory.conf > /dev/null << 'EOF'
*     soft nofile  1048576
*     hard nofile  1048576
root  soft nofile  1048576
root  hard nofile  1048576
*     soft nproc   unlimited
*     hard nproc   unlimited
EOF

sudo mkdir -p /etc/systemd/system.conf.d
sudo tee /etc/systemd/system.conf.d/90-ai-memory.conf > /dev/null << 'EOF'
[Manager]
DefaultLimitNOFILE=1048576
DefaultLimitNPROC=infinity
DefaultTasksMax=infinity
EOF

sudo systemctl daemon-reexec
echo "✓ File descriptor limits: 1,048,576"
```

### 6.3 Disable Transparent Huge Pages (required for Redis + Weaviate)

```bash
# Runtime
echo never | sudo tee /sys/kernel/mm/transparent_hugepage/enabled
echo never | sudo tee /sys/kernel/mm/transparent_hugepage/defrag

# Persist across reboots
sudo tee /etc/systemd/system/disable-thp.service > /dev/null << 'EOF'
[Unit]
Description=Disable Transparent Huge Pages
DefaultDependencies=no
After=sysinit.target local-fs.target
Before=basic.target

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/bin/sh -c 'echo never > /sys/kernel/mm/transparent_hugepage/enabled'
ExecStart=/bin/sh -c 'echo never > /sys/kernel/mm/transparent_hugepage/defrag'

[Install]
WantedBy=basic.target
EOF

sudo systemctl enable --now disable-thp
echo "✓ THP disabled"
```

### 6.4 Docker daemon optimisation

```bash
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json > /dev/null << 'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "100m",
    "max-file": "5",
    "compress": "true"
  },
  "storage-driver": "overlay2",
  "default-ulimits": {
    "nofile": { "Name": "nofile", "Hard": 1048576, "Soft": 1048576 }
  },
  "live-restore": true,
  "metrics-addr": "127.0.0.1:9323"
}
EOF

sudo systemctl restart docker
echo "✓ Docker daemon configured"
```

### 6.5 Swap (if RAM < 32 GB)

```bash
# Only if no swap exists
if ! swapon --show | grep -q .; then
  sudo fallocate -l 8G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
  echo "✓ 8 GB swap created"
else
  echo "✓ Swap already configured: $(free -h | awk '/Swap/{print $2}')"
fi
```

### Validation — 6

```bash
sysctl vm.max_map_count           # → vm.max_map_count = 262144
sysctl vm.swappiness              # → vm.swappiness = 10
cat /sys/kernel/mm/transparent_hugepage/enabled | grep -o '\[never\]'  # → [never]
cat /etc/docker/daemon.json | python3 -m json.tool > /dev/null && echo "✓ daemon.json valid"
echo "✓ Phase 6 complete"
```

---

## 7. Project Setup

### 7.1 Clone repository

```bash
# Replace with your actual repository URL
git clone https://github.com/your-org/ai-memory-system.git
cd ai-memory-system

# Or if working in an existing directory:
cd /path/to/DN0_INT_Weaviate
echo "✓ In project root: $(pwd)"
```

### 7.2 Create directory structure

```bash
mkdir -p \
  data/volumes/weaviate \
  data/volumes/redis \
  data/volumes/postgres \
  data/backups \
  data/configs \
  logs

echo "✓ Directory structure created"
ls -la data/
```

### 7.3 Python virtual environment

```bash
python3 -m venv .venv
source .venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install project with dev deps
pip install -e ".[dev]"

echo "✓ Python venv: $(python --version)"
echo "✓ Packages: $(pip list | wc -l) installed"
```

### 7.4 Node.js dependencies

```bash
npm install

# Verify workspaces
npm ls --workspaces 2>/dev/null | head -20
echo "✓ Node.js packages installed"
```

### 7.5 Build TypeScript packages

```bash
npm run build

echo "✓ TypeScript built"
ls packages/mcp-server/dist/
```

### Validation — 7

```bash
source .venv/bin/activate
python -c "import weaviate, redis, fastapi; print('✓ Python deps OK')"
ls packages/mcp-server/dist/index.js && echo "✓ MCP server built"
echo "✓ Phase 7 complete"
```

---

## 8. Environment Configuration

### 8.1 Create .env from template

```bash
cp .env.example .env
echo "✓ .env created from template"
```

### 8.2 Required values

Edit `.env` and set these values. **All are required for production.**

```bash
# Open in editor — or use the sed commands below for automation
nano .env
```

**Automated configuration (AI agent / CI use):**

```bash
# ── REQUIRED: Set your values here ──────────────────────────────
OPENAI_API_KEY="sk-your-key-here"     # Get from: https://platform.openai.com/api-keys
DB_PASSWORD="$(openssl rand -hex 24)"
JWT_SECRET="$(openssl rand -hex 32)"
API_KEYS="$(openssl rand -hex 16)"
WEAVIATE_API_KEY="$(openssl rand -hex 16)"

# ── Apply to .env ────────────────────────────────────────────────
sed -i "s|OPENAI_API_KEY=.*|OPENAI_API_KEY=${OPENAI_API_KEY}|" .env
sed -i "s|JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET}|" .env
sed -i "s|API_KEYS=.*|API_KEYS=${API_KEYS}|" .env

echo "✓ .env values set"
grep -v "^#\|^$" .env | sed 's/=.*/=***/' # Show keys without values
```

### 8.3 Embedding provider options

| Provider | `EMBEDDING_PROVIDER` | Requires | Notes |
|----------|----------------------|---------|-------|
| OpenAI (default) | `openai` | `OPENAI_API_KEY` | Best quality, costs money |
| Local mock | `local` | Nothing | Zero cost, no semantic search |
| Ollama (self-hosted) | `ollama` | Ollama running | Free, requires GPU or fast CPU |
| Cohere | `cohere` | `COHERE_API_KEY` | Alternative cloud provider |

**For local/offline use (no API key needed):**

```bash
sed -i "s|EMBEDDING_PROVIDER=.*|EMBEDDING_PROVIDER=local|" .env
echo "✓ Set to local embeddings (mock — semantic search disabled)"
```

### 8.4 Full .env reference

```dotenv
# ── Weaviate ─────────────────────────────────────────────────────
WEAVIATE_URL=http://localhost:8080
WEAVIATE_GRPC_URL=http://localhost:50051
WEAVIATE_API_KEY=                        # Leave empty for anonymous access (dev)

# ── Redis ────────────────────────────────────────────────────────
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=                          # Leave empty for no auth (dev)

# ── Embeddings ───────────────────────────────────────────────────
EMBEDDING_PROVIDER=openai                # openai | local | ollama | cohere
OPENAI_API_KEY=sk-...                    # Required if EMBEDDING_PROVIDER=openai
EMBEDDING_MODEL=text-embedding-3-small  # text-embedding-3-small | text-embedding-ada-002
EMBEDDING_DIMENSIONS=1536               # 1536 for text-embedding-3-small

# ── LLM (memory consolidation) ───────────────────────────────────
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o-mini                   # Used for memory deduplication/summarisation

# ── MCP Server ───────────────────────────────────────────────────
MCP_SERVER_NAME=ai-memory-mcp
MCP_SERVER_VERSION=1.0.0
MCP_SERVER_PORT=3000

# ── Dashboard ────────────────────────────────────────────────────
NEXT_PUBLIC_API_URL=http://localhost:8000
DASHBOARD_PORT=3001

# ── Memory Tiers ─────────────────────────────────────────────────
DEFAULT_MEMORY_TIER=1
MAX_MEMORY_SIZE_MB=100
MEMORY_RETENTION_DAYS=90

# ── Multi-tenancy ────────────────────────────────────────────────
MULTI_TENANCY_ENABLED=true
DEFAULT_TENANT_ID=default

# ── Security ─────────────────────────────────────────────────────
JWT_SECRET=                              # Min 32 chars, random
API_KEYS=                                # Comma-separated: key1,key2
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=                     # bcrypt hash — see §12.3

# ── Logging ──────────────────────────────────────────────────────
LOG_LEVEL=INFO                           # DEBUG | INFO | WARNING | ERROR
LOG_FORMAT=json                          # json | text
```

### Validation — 8

```bash
# Check required keys have values
python3 - << 'PYEOF'
import re, sys
env = open('.env').read()
required = ['OPENAI_API_KEY', 'JWT_SECRET', 'API_KEYS']
issues = []
for key in required:
    m = re.search(rf'^{key}=(.+)$', env, re.M)
    if not m or m.group(1).strip() in ('', 'your-key-here', 'sk-your-openai-api-key'):
        issues.append(f'  ✗ {key} — not set')
    else:
        print(f'  ✓ {key} — set ({len(m.group(1))} chars)')
if issues:
    print('\n'.join(issues))
    print('\nSet these values before continuing.')
    sys.exit(1)
print('\n✓ Phase 8 complete')
PYEOF
```

---

## 9. Service Deployment

### 9.1 Start the full stack

```bash
# Load environment
set -a && source .env && set +a

# Start all services (background, remove orphans)
docker compose -f docker/docker-compose.yml up -d --build --remove-orphans

echo "✓ Docker stack started"
docker compose -f docker/docker-compose.yml ps
```

### 9.2 Monitor startup (watch until all healthy)

```bash
# Watch container health — Ctrl+C when all show 'healthy'
watch -n 3 'docker compose -f docker/docker-compose.yml ps'
```

Expected terminal state (all services healthy):

```
NAME           IMAGE                   COMMAND    SERVICE       CREATED    STATUS                   PORTS
dashboard      ai-memory-dashboard     ...        dashboard     ...        Up 2 min (healthy)       0.0.0.0:3001->3000/tcp
memory-api     ai-memory-memory-api    ...        memory-api    ...        Up 2 min (healthy)       0.0.0.0:8000->8000/tcp
mcp-server     ai-memory-mcp-server    ...        mcp-server    ...        Up 2 min                 0.0.0.0:3000->3000/tcp
redis          redis:7-alpine          ...        redis         ...        Up 2 min (healthy)       0.0.0.0:6379->6379/tcp
weaviate       semitechnologies/...    ...        weaviate      ...        Up 2 min (healthy)       0.0.0.0:8080->8080/tcp
```

### 9.3 Wait-for-healthy script (non-interactive)

```bash
wait_for() {
  local name="$1" url="$2" max="${3:-60}"
  local elapsed=0
  printf "  Waiting for %-15s " "${name}:"
  while (( elapsed < max )); do
    if curl -fsS --max-time 2 "$url" &>/dev/null; then
      echo " ✓"
      return 0
    fi
    sleep 3; (( elapsed += 3 ))
    printf "."
  done
  echo " ✗ TIMEOUT"
  return 1
}

wait_for "Weaviate"   "http://localhost:8080/v1/.well-known/ready" 120
wait_for "Memory API" "http://localhost:8000/health"               90
wait_for "Dashboard"  "http://localhost:3001"                      60
echo "✓ All services ready"
```

### 9.4 View logs

```bash
# All services
docker compose -f docker/docker-compose.yml logs -f

# Single service
docker compose -f docker/docker-compose.yml logs -f memory-api
docker compose -f docker/docker-compose.yml logs -f weaviate
```

### Validation — 9

```bash
# Full endpoint validation
ENDPOINTS=(
  "Weaviate ready    http://localhost:8080/v1/.well-known/ready"
  "Weaviate meta     http://localhost:8080/v1/meta"
  "API health        http://localhost:8000/health"
  "API docs          http://localhost:8000/docs"
  "Dashboard         http://localhost:3001"
)

for entry in "${ENDPOINTS[@]}"; do
  name="${entry%%  *}"
  url="${entry##*  }"
  code=$(curl -fsS -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null || echo "000")
  [[ "$code" =~ ^2 ]] && echo "  ✓ ${name}: ${code}" || echo "  ✗ ${name}: ${code} — ${url}"
done

# Redis
docker exec redis redis-cli ping   # → PONG

echo "✓ Phase 9 complete"
```

---

## 10. Schema Initialisation

Weaviate starts empty. Run once after first deployment.

### 10.1 Initialise collections via API

```bash
# Health check first
curl -fsS http://localhost:8000/health | python3 -m json.tool

# Initialise schema (creates Memories, Entities, Relationships collections)
curl -X POST http://localhost:8000/admin/init-schema \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEYS%%,*}" \
  | python3 -m json.tool

echo "✓ Schema initialised"
```

### 10.2 Verify collections created

```bash
curl -fsS http://localhost:8080/v1/schema \
  | python3 -c "
import sys, json
schema = json.load(sys.stdin)
classes = schema.get('classes', schema.get('collections', []))
print(f'Collections: {len(classes)}')
for c in classes:
    name = c.get('class', c.get('name', '?'))
    print(f'  ✓ {name}')
"
```

### 10.3 Create default tenant

```bash
curl -X POST http://localhost:8000/tenants \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEYS%%,*}" \
  -d '{"tenant_id": "default", "name": "Default Tenant"}' \
  | python3 -m json.tool

echo "✓ Default tenant created"
```

### 10.4 Test memory operations

```bash
API_KEY="${API_KEYS%%,*}"

# Add a test memory
MEMORY_ID=$(curl -s -X POST http://localhost:8000/memories \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{
    "content": "The AI Memory System was installed and configured successfully.",
    "memory_type": "episodic",
    "tier": 1,
    "metadata": {"source": "install-test", "project": "ai-memory"}
  }' | python3 -c "import sys,json; print(json.load(sys.stdin).get('id','ERROR'))")

echo "✓ Memory created: ${MEMORY_ID}"

# Search for it
curl -s -X POST http://localhost:8000/memories/search \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{"query": "installation configured successfully", "limit": 3}' \
  | python3 -m json.tool

echo "✓ Memory search working"
```

---

## 11. MCP Server Integration

> **Quick path:** The repo ships two ready-to-use config files — copy the block that matches your setup.
> Full reference: [`mcp-install.json`](../mcp-install.json) at the repo root.

### 11.0 Config files included in this repo

| File | Purpose |
|------|---------|
| `mcp-install.json` | Reference template — all four install modes with comments |
| `.mcp.json` | Claude Code project-level auto-discovery (loaded automatically) |

**Claude Code** picks up `.mcp.json` automatically when you open this project — no manual config needed.
Set `AI_MEMORY_API_KEY` in your shell environment (or `.env`) and the server starts on first tool call.

---

### 11.1 Claude Desktop (local stdio — recommended for local dev)

Config file locations:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Merge this block into your existing config (replace the absolute path):

```json
{
  "mcpServers": {
    "ai-memory": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/DN0_INT_Weaviate/packages/mcp-server/dist/index.js"],
      "env": {
        "MEMORY_API_URL": "http://localhost:8000",
        "AI_MEMORY_API_KEY": "your-api-key-from-API_KEYS-in-.env",
        "MCP_LOG_LEVEL": "warn"
      }
    }
  }
}
```

> **After editing:** Restart Claude Desktop. The 8 memory tools will appear in the tool list.

**Pre-requisites:**
```bash
npm run build -w packages/mcp-server   # build the server once
docker compose -f docker/docker-compose.yml up -d  # start Weaviate + API
```

---

### 11.2 Claude Desktop / Claude Code (remote HTTP — deployed instance)

Use this when connecting to the hosted server instead of running locally:

```json
{
  "mcpServers": {
    "ai-memory": {
      "type": "http",
      "url": "https://memory.velocitydigi.com/mcp",
      "headers": {
        "Authorization": "Bearer your-MCP_AUTH_TOKEN"
      }
    }
  }
}
```

> Set `MCP_AUTH_TOKEN` in `.env` on the server side (§8). Leave it blank to disable auth (dev only).

---

### 11.3 Cursor IDE

Create `.cursor/mcp.json` in your project root (relative paths work here):

```json
{
  "mcpServers": {
    "ai-memory": {
      "command": "node",
      "args": ["packages/mcp-server/dist/index.js"],
      "env": {
        "MEMORY_API_URL": "http://localhost:8000",
        "AI_MEMORY_API_KEY": "your-api-key",
        "MCP_LOG_LEVEL": "warn"
      }
    }
  }
}
```

---

### 11.4 Available MCP tools

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `add_memory` | Store a new memory | `content`, `memory_type`, `tier`, `metadata` |
| `search_memory` | Semantic search | `query`, `limit`, `tier`, `memory_type` |
| `get_memory` | Retrieve by ID | `memory_id` |
| `delete_memory` | Remove a memory | `memory_id` |
| `list_memories` | Stats + listing | `tier`, `memory_type`, `limit` |
| `add_entity` | Knowledge graph entity | `name`, `entity_type`, `description` |
| `add_relation` | Link two entities | `source_id`, `relation_type`, `target_id` |
| `query_graph` | Explore entity graph | `entity_id`, `depth` |

---

### 11.5 Test MCP connection

```bash
# Health check
curl -s http://localhost:3000/health | python3 -m json.tool

# List tools via HTTP MCP endpoint
curl -s -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' \
  | python3 -m json.tool

echo "✓ MCP server responding"
```

### 11.6 MCP via stdio (direct invocation / smoke test)

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' \
  | MEMORY_API_URL=http://localhost:8000 \
    AI_MEMORY_API_KEY=your-api-key \
    node packages/mcp-server/dist/index.js

echo "✓ stdio transport working"
```

---

## 12. Production Hardening

### 12.1 Enable Nginx reverse proxy

```bash
# Start with production profile (enables nginx service)
docker compose -f docker/docker-compose.yml --profile production up -d

echo "✓ Nginx started"
```

### 12.2 SSL/TLS with Let's Encrypt

```bash
# Install certbot
sudo apt-get install -yq certbot

# Obtain certificate (replace with your domain)
sudo certbot certonly --standalone \
  -d memory.yourdomain.com \
  --email admin@yourdomain.com \
  --agree-tos \
  --non-interactive

# Copy certs for Nginx
sudo mkdir -p docker/ssl
sudo cp /etc/letsencrypt/live/memory.yourdomain.com/fullchain.pem docker/ssl/
sudo cp /etc/letsencrypt/live/memory.yourdomain.com/privkey.pem docker/ssl/
sudo chmod 644 docker/ssl/*.pem

# Auto-renew
echo "0 0 */30 * * certbot renew --quiet && docker restart nginx" \
  | sudo tee /etc/cron.d/certbot-renew

echo "✓ SSL configured"
```

### 12.3 Admin password hash

```bash
# Generate bcrypt hash for admin password
source .venv/bin/activate
python3 -c "
from passlib.hash import bcrypt
import getpass
password = getpass.getpass('Admin password: ')
print('ADMIN_PASSWORD_HASH=' + bcrypt.hash(password))
" >> .env

echo "✓ Admin password hash set"
```

### 12.4 Weaviate API key authentication

Update `.env`:

```bash
# Weaviate authentication (disable anonymous access for production)
WEAVIATE_API_KEY="$(openssl rand -hex 24)"
```

Update `docker/docker-compose.yml` weaviate environment:

```yaml
# Add to weaviate service environment:
AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED: "false"
AUTHENTICATION_APIKEY_ENABLED: "true"
AUTHENTICATION_APIKEY_ALLOWED_KEYS: "${WEAVIATE_API_KEY}"
AUTHENTICATION_APIKEY_USERS: "admin"
```

```bash
# Redeploy weaviate with auth
docker compose -f docker/docker-compose.yml up -d weaviate
echo "✓ Weaviate API key auth enabled"
```

### 12.5 Redis password

```bash
REDIS_PASSWORD="$(openssl rand -hex 24)"
sed -i "s|REDIS_PASSWORD=.*|REDIS_PASSWORD=${REDIS_PASSWORD}|" .env

# Update docker-compose.yml redis service
# command: redis-server --appendonly yes --requirepass "${REDIS_PASSWORD}"
echo "✓ Redis password set (update docker-compose.yml command field)"
```

### 12.6 UFW Firewall

```bash
sudo ufw --force reset
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp comment "SSH"
sudo ufw allow 80/tcp comment "HTTP"
sudo ufw allow 443/tcp comment "HTTPS"
# Only expose dashboard/API if not behind nginx
# sudo ufw allow 3001/tcp comment "Dashboard (direct)"
# sudo ufw allow 8000/tcp comment "API (direct)"
sudo ufw --force enable
sudo ufw status verbose
echo "✓ Firewall configured"
```

### 12.7 Systemd auto-start

```bash
sudo tee /etc/systemd/system/ai-memory.service > /dev/null << EOF
[Unit]
Description=AI Memory System
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
User=${USER}
WorkingDirectory=$(pwd)
EnvironmentFile=$(pwd)/.env
ExecStart=/usr/bin/docker compose -f $(pwd)/docker/docker-compose.yml up -d --remove-orphans
ExecStop=/usr/bin/docker compose -f $(pwd)/docker/docker-compose.yml down
TimeoutStartSec=180
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable ai-memory.service
echo "✓ Systemd auto-start configured"
echo "  Start:  sudo systemctl start ai-memory"
echo "  Stop:   sudo systemctl stop ai-memory"
echo "  Status: sudo systemctl status ai-memory"
```

---

## 13. Monitoring & Observability

### 13.1 System stats quick view

```bash
# Container resource usage
docker stats --no-stream \
  --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"
```

### 13.2 API statistics endpoint

```bash
curl -s http://localhost:8000/stats \
  -H "X-API-Key: ${API_KEYS%%,*}" \
  | python3 -m json.tool
```

Expected response:

```json
{
  "total_memories": 42,
  "memories_by_tier": {"1": 30, "2": 10, "3": 2},
  "memories_by_type": {"episodic": 25, "semantic": 17},
  "weaviate_objects": 42,
  "redis_keys": 15,
  "uptime_seconds": 3600
}
```

### 13.3 Weaviate metrics

```bash
# Object count per collection
curl -fsS http://localhost:8080/v1/schema \
  | python3 -c "
import sys, json
schema = json.load(sys.stdin)
for c in schema.get('classes', schema.get('collections', [])):
    print(f\"  {c.get('class', c.get('name'))}\")
"

# Node status
curl -fsS http://localhost:8080/v1/nodes | python3 -m json.tool
```

### 13.4 Redis monitoring

```bash
docker exec redis redis-cli info stats | grep -E "total_commands|total_connections|keyspace"
docker exec redis redis-cli info memory | grep -E "used_memory_human|maxmemory_human"
docker exec redis redis-cli dbsize
```

### 13.5 Prometheus + Grafana (optional)

```bash
# Enable Docker metrics (already in daemon.json: metrics-addr: 127.0.0.1:9323)
curl -fsS http://localhost:9323/metrics | head -20

# Add to docker-compose.yml for full Prometheus/Grafana stack
# See: docker/stacks/monitoring-compose.yml (create separately)
```

### 13.6 Log rotation

```bash
sudo tee /etc/logrotate.d/ai-memory > /dev/null << EOF
$(pwd)/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0640 ${USER} $(id -gn)
}
EOF

echo "✓ Log rotation configured (14 days)"
```

---

## 14. Backup & Recovery

### 14.1 Automated backup script

The backup script is at `scripts/manage.sh backup`. Run it directly:

```bash
# Manual backup
./scripts/manage.sh backup

# Scheduled: add to crontab
crontab -l > /tmp/crontab.bak
echo "0 2 * * * $(pwd)/scripts/manage.sh backup >> $(pwd)/logs/backup.log 2>&1" >> /tmp/crontab.bak
crontab /tmp/crontab.bak
echo "✓ Backup scheduled at 02:00 daily"
```

### 14.2 What gets backed up

| Component | Method | Location | Size (typical) |
|-----------|--------|----------|----------------|
| PostgreSQL | `pg_dump` → gzip | `data/backups/<date>/postgres.sql.gz` | 1–100 MB |
| Weaviate | `tar -czf` of volume | `data/backups/<date>/weaviate.tar.gz` | 10 MB – 10 GB |
| Redis | `BGSAVE` + `docker cp` | `data/backups/<date>/redis.rdb` | < 100 MB |
| `.env` | `cp` | `data/backups/<date>/env.bak` | < 1 KB |

### 14.3 Restore procedure

```bash
# ⚠ DESTRUCTIVE — stops services and overwrites data
./scripts/manage.sh restore data/backups/20260225-020000

# Type 'RESTORE' when prompted
```

### 14.4 Weaviate backup (native API)

```bash
# Weaviate has built-in backup to filesystem or S3
curl -X POST http://localhost:8080/v1/backups/filesystem \
  -H "Content-Type: application/json" \
  -d '{
    "id": "backup-'$(date +%Y%m%d)'",
    "include": ["Memories", "Entities", "Relationships"]
  }' | python3 -m json.tool

echo "✓ Weaviate native backup initiated"
```

---

## 15. Troubleshooting Reference

### 15.1 Service not starting

```bash
# Check container logs
docker compose -f docker/docker-compose.yml logs --tail=50 <service-name>

# Check container exit code
docker inspect <container-name> | python3 -c "
import sys,json; d=json.load(sys.stdin)[0]
state = d['State']
print(f'Status: {state[\"Status\"]}')
print(f'Exit: {state[\"ExitCode\"]}')
print(f'Error: {state.get(\"Error\",\"none\")}')
"
```

### 15.2 Weaviate: vm.max_map_count error

**Symptom:** Weaviate exits with "max virtual memory areas vm.max_map_count [65530] is too low"

```bash
# Fix immediately
sudo sysctl -w vm.max_map_count=262144

# Make permanent
echo 'vm.max_map_count=262144' | sudo tee /etc/sysctl.d/90-weaviate.conf
sudo sysctl -p /etc/sysctl.d/90-weaviate.conf

# Restart Weaviate
docker compose -f docker/docker-compose.yml restart weaviate
```

### 15.3 Redis: WARNING overcommit_memory

**Symptom:** Redis logs "WARNING overcommit_memory is set to 0!"

```bash
sudo sysctl -w vm.overcommit_memory=1
echo 'vm.overcommit_memory=1' | sudo tee -a /etc/sysctl.d/90-ai-memory.conf
```

### 15.4 Redis: THP warning

**Symptom:** "WARNING you have Transparent Huge Pages (THP) support enabled"

```bash
echo never | sudo tee /sys/kernel/mm/transparent_hugepage/enabled
# Then restart Redis
docker compose -f docker/docker-compose.yml restart redis
```

### 15.5 API health check failing

```bash
# Check API is running
docker exec memory-api curl -s http://localhost:8000/health

# Check API can reach Weaviate
docker exec memory-api curl -s http://weaviate:8080/v1/.well-known/ready

# Check API can reach Redis
docker exec memory-api python3 -c "import redis; r = redis.from_url('redis://redis:6379'); print(r.ping())"
```

### 15.6 MCP server not connecting to Claude

```bash
# Check the absolute path in Claude config is correct
ls -la packages/mcp-server/dist/index.js

# Test the MCP server directly
MEMORY_API_URL=http://localhost:8000 \
  node packages/mcp-server/dist/index.js &
sleep 2 && kill %1

# Check API key matches
grep API_KEYS .env
```

### 15.7 Weaviate schema empty after restart

Weaviate persists schema to its volume. If schema is gone:

```bash
# Check volume exists and has data
ls -lh data/volumes/weaviate/ 2>/dev/null || \
  docker volume inspect dn0_int_weaviate_weaviate_data

# Re-init schema
curl -X POST http://localhost:8000/admin/init-schema \
  -H "X-API-Key: ${API_KEYS%%,*}"
```

### 15.8 Out of disk space

```bash
# Check Docker usage
docker system df

# Prune unused images, stopped containers, dangling volumes
docker system prune -f

# Remove old images (keep current)
docker image prune -a --filter "until=24h"
```

### 15.9 High memory usage

```bash
# Per-container memory
docker stats --no-stream --format "{{.Name}}\t{{.MemUsage}}"

# Weaviate memory: tune vectorCacheMaxObjects
# Reduce in docker-compose.yml:
# LIMIT_OBJECTS_COUNT: "1000000"

# Redis memory limit
docker exec redis redis-cli config set maxmemory 2gb
docker exec redis redis-cli config set maxmemory-policy allkeys-lru
```

### 15.10 Port already in use

```bash
# Find what's using the port (e.g., 8080)
sudo ss -tlnp | grep :8080
# or
sudo lsof -i :8080

# Kill the process or change the port in docker-compose.yml
```

---

## 16. API Reference

Base URL: `http://localhost:8000`

### Authentication

All endpoints (except `/health`) require:
```
X-API-Key: <your-api-key>
```

### Memory Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Service health check |
| `GET` | `/stats` | System statistics |
| `POST` | `/memories` | Create a new memory |
| `POST` | `/memories/search` | Semantic search |
| `GET` | `/memories/{id}` | Get memory by ID |
| `DELETE` | `/memories/{id}` | Delete a memory |
| `GET` | `/memories` | List memories (paginated) |

### Memory Schema

```json
{
  "content": "string (required)",
  "memory_type": "episodic | semantic | procedural | declarative",
  "tier": 1,
  "metadata": {
    "project": "string",
    "source": "string",
    "tags": ["string"]
  }
}
```

### Search Schema

```json
{
  "query": "string (required)",
  "limit": 10,
  "tier": null,
  "memory_type": null,
  "min_score": 0.7
}
```

### Quick API test

```bash
API_KEY="${API_KEYS%%,*}"
BASE="http://localhost:8000"

# Health
curl -s "${BASE}/health" | python3 -m json.tool

# Add memory
curl -s -X POST "${BASE}/memories" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{"content":"Test memory","memory_type":"episodic","tier":1}' \
  | python3 -m json.tool

# Search
curl -s -X POST "${BASE}/memories/search" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{"query":"test","limit":5}' \
  | python3 -m json.tool

# Stats
curl -s "${BASE}/stats" -H "X-API-Key: ${API_KEY}" | python3 -m json.tool
```

### Interactive API docs

```
http://localhost:8000/docs      # Swagger UI
http://localhost:8000/redoc     # ReDoc
```

---

## 17. Environment Variable Reference

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `WEAVIATE_URL` | `http://localhost:8080` | Yes | Weaviate HTTP endpoint |
| `WEAVIATE_GRPC_URL` | `http://localhost:50051` | Yes | Weaviate gRPC endpoint |
| `WEAVIATE_API_KEY` | _(empty)_ | Prod | Weaviate API key |
| `REDIS_URL` | `redis://localhost:6379` | Yes | Redis connection URL |
| `REDIS_PASSWORD` | _(empty)_ | Prod | Redis AUTH password |
| `EMBEDDING_PROVIDER` | `openai` | Yes | `openai\|local\|ollama\|cohere` |
| `OPENAI_API_KEY` | _(empty)_ | If OpenAI | OpenAI API key |
| `EMBEDDING_MODEL` | `text-embedding-3-small` | Yes | Embedding model name |
| `EMBEDDING_DIMENSIONS` | `1536` | Yes | Embedding vector size |
| `LLM_PROVIDER` | `openai` | No | LLM for consolidation |
| `LLM_MODEL` | `gpt-4o-mini` | No | LLM model name |
| `MCP_SERVER_NAME` | `ai-memory-mcp` | Yes | MCP server identifier |
| `MCP_SERVER_PORT` | `3000` | Yes | MCP HTTP port |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Yes | Dashboard → API URL |
| `DASHBOARD_PORT` | `3001` | Yes | Dashboard listen port |
| `DEFAULT_MEMORY_TIER` | `1` | No | Default tier for new memories |
| `MAX_MEMORY_SIZE_MB` | `100` | No | Max single memory size |
| `MEMORY_RETENTION_DAYS` | `90` | No | Auto-expiry (0 = never) |
| `MULTI_TENANCY_ENABLED` | `true` | No | Enable tenant isolation |
| `DEFAULT_TENANT_ID` | `default` | Yes | Fallback tenant ID |
| `JWT_SECRET` | _(empty)_ | Prod | JWT signing secret (32+ chars) |
| `API_KEYS` | _(empty)_ | Prod | Comma-separated API keys |
| `ADMIN_USERNAME` | `admin` | No | Dashboard admin username |
| `ADMIN_PASSWORD_HASH` | _(empty)_ | Prod | bcrypt hash of admin password |
| `LOG_LEVEL` | `INFO` | No | `DEBUG\|INFO\|WARNING\|ERROR` |
| `LOG_FORMAT` | `json` | No | `json\|text` |

---

## Quick Reference Card

```bash
# ── Daily operations ─────────────────────────────────────────────
./scripts/manage.sh status        # Service health overview
./scripts/manage.sh logs [svc]    # Tail logs
./scripts/manage.sh restart [svc] # Restart all or one service
./scripts/healthcheck.sh          # Deep health report

# ── Maintenance ──────────────────────────────────────────────────
./scripts/manage.sh backup        # Run backup now
./scripts/manage.sh update        # Pull latest images + redeploy
./scripts/manage.sh stats         # CPU / RAM / IO per container

# ── Deployment ───────────────────────────────────────────────────
./scripts/deploy-full.sh          # Full production deploy
./scripts/ubuntu-install.sh       # Fresh Ubuntu setup
./scripts/system-optimize.sh      # Kernel tuning only

# ── Direct Docker ────────────────────────────────────────────────
docker compose -f docker/docker-compose.yml up -d
docker compose -f docker/docker-compose.yml down
docker compose -f docker/docker-compose.yml ps
docker compose -f docker/docker-compose.yml logs -f
```

---

*Generated for AI Memory System v0.1.0 — Weaviate 1.27 · Redis 7 · FastAPI · Node 20 · Next.js 15*
