# Ports and Network Reference

**Version:** 1.0.0 | **Last Updated:** March 2026

---

## Service Ports

### Application Services

| Service | Container Port | Host Port | Protocol | Access |
|---------|---------------|-----------|----------|--------|
| Memory API | 8000 | 8000 | HTTP | Internal + Tailscale |
| Crawler API | 11235 | 11235 | HTTP | Internal only |
| MCP Server | 3000 | 3000 | HTTP | Internal + Tailscale |
| Platform Frontend | 3000 | 3002 | HTTP | Via Nginx |

### Infrastructure Services

| Service | Container Port | Host Port | Protocol | Access |
|---------|---------------|-----------|----------|--------|
| Weaviate HTTP | 8080 | - | HTTP | Internal only |
| Weaviate gRPC | 50051 | - | gRPC | Internal only |
| Memory Redis | 6379 | - | TCP | Internal only |
| Crawler Redis | 6379 | - | TCP | Internal only |
| MinIO | 9000 | - | HTTP | Internal only |
| MinIO Console | 9001 | - | HTTP | Internal only |

### Proxy Services

| Service | Container Port | Host Port | Protocol | Access |
|---------|---------------|-----------|----------|--------|
| Nginx HTTP | 80 | 80 | HTTP | Public (via Tailscale) |
| Nginx HTTPS | 443 | 443 | HTTPS | Public (via Tailscale) |

---

## Internal Service URLs

### Docker Network (engram-platform-network)

| Service | Internal URL | Description |
|---------|--------------|-------------|
| Memory API | `http://memory-api:8000` | REST API |
| Crawler API | `http://crawler-api:11235` | REST API |
| MCP Server | `http://mcp-server:3000` | HTTP transport |
| Weaviate | `http://weaviate:8080` | Vector DB |
| Weaviate gRPC | `http://weaviate:50051` | gRPC |
| Memory Redis | `redis://memory-redis:6379` | Cache |
| Crawler Redis | `redis://crawler-redis:6379` | Cache |
| Platform Frontend | `http://platform-frontend:3000` | Next.js |

### Host Network (from host machine)

| Service | URL | Description |
|---------|-----|-------------|
| Memory API | `http://localhost:8000` | REST API |
| Crawler API | `http://localhost:11235` | REST API |
| MCP Server | `http://localhost:3000` | HTTP transport |
| Platform Frontend | `http://localhost:3002` | Next.js dev server |
| Nginx | `http://localhost:80` | Reverse proxy |
| Nginx SSL | `https://localhost:443` | SSL proxy |

---

## Tailscale Network

### MagicDNS Hostnames

| Host | FQDN | Tailscale IP | Role |
|------|------|--------------|------|
| acdev-vmi02d | `acdev-vmi02d.tail4da6b7.ts.net` | 100.77.216.28 | Data VPS |
| acdev-node01 | `acdev-node01.tail4da6b7.ts.net` | 100.118.170.115 | Production Node |
| acdev-node02 | `acdev-node02.tail4da6b7.ts.net` | 100.86.129.15 | Production Node |
| acdev-devnode | `acdev-devnode.tail4da6b7.ts.net` | 100.86.129.15 | Dev Server |

### Production URLs (via Tailscale)

| Service | URL | Port |
|---------|-----|------|
| Memory API | `https://memory.velocitydigi.com` | 443 |
| Platform | `https://engram.velocitydigi.com` | 443 |
| Direct Memory API | `http://dv-syd-host01.icefish-discus.ts.net:8000` | 8000 |

---

## Resource Profile Notes

The production Docker Compose profile for the approved i5/16GB/1TB host class intentionally constrains service memory to keep the total stack near 8.5GB. Current targets live in `Engram-Platform/docker-compose.yml` and reduce:

- Chromium shared memory from 3G to 2G
- `crawler-api` to 2G
- `memory-api` to 512M
- `weaviate` to 1536M with `GOMEMLIMIT=1.2GiB`
- `crawler-redis` to 512M with `384mb` maxmemory
- `memory-redis` to 384M with `256mb` maxmemory
- `mcp-server` and `platform-frontend` to 256M each
- `nginx` to 128M

## Port Configuration Details

### Memory API (8000)

```yaml
# docker-compose.yml
memory-api:
  ports:
    - "${MEMORY_API_BIND:-0.0.0.0}:8000:8000"
```

**Access Control:**
- Internal: `http://memory-api:8000`
- External: Via Nginx reverse proxy
- Tailscale: Direct access on port 8000

### Crawler API (11235)

```yaml
# docker-compose.yml
crawler-api:
  # No external port - internal only
```

**Access Control:**
- Internal only via Docker network
- Access through Memory API or Nginx proxy

### Platform Frontend (3002)

```yaml
# docker-compose.yml
platform-frontend:
  # No external port - accessed via Nginx
```

**Access Control:**
- Via Nginx reverse proxy only
- Development: `npm run dev` exposes 3002

---

## Firewall Configuration

### UFW Rules

```bash
# Allow Tailscale traffic
sudo ufw allow from 100.0.0.0/8 to any port 22 comment 'Tailscale SSH'
sudo ufw allow from 100.0.0.0/8 to any port 80 comment 'Tailscale HTTP'
sudo ufw allow from 100.0.0.0/8 to any port 443 comment 'Tailscale HTTPS'
sudo ufw allow from 100.0.0.0/8 to any port 8000 comment 'Tailscale Memory API'

# Default deny
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Enable
sudo ufw enable
```

### Docker and UFW

Docker bypasses UFW by default. To secure:

```bash
# Edit /etc/default/docker
DOCKER_OPTS="--iptables=false"

# Or use Docker's built-in firewall
# See: https://docs.docker.com/network/packet-filtering-firewalls/
```

---

## Network Troubleshooting

### Check Port Availability

```bash
# Check if port is in use
lsof -i :8000
netstat -tlnp | grep 8000
ss -tlnp | grep 8000

# Find process using port
fuser 8000/tcp
```

### Test Connectivity

```bash
# Test internal connectivity
docker compose exec memory-api curl -sf http://weaviate:8080/v1/.well-known/ready

# Test external connectivity
curl -sf https://memory.velocitydigi.com/health

# Test via Tailscale
curl -sf http://100.118.170.115:8000/health
```

### Port Forwarding (if needed)

```bash
# SSH tunnel for local development
ssh -L 8000:localhost:8000 root@acdev-node01.tail4da6b7.ts.net

# Access remote service locally
curl http://localhost:8000/health
```

---

## Quick Reference

```
┌─────────────────────────────────────────────────────────────────┐
│                     PORT SUMMARY                                 │
├─────────────────────────────────────────────────────────────────┤
│  EXTERNAL (via Tailscale)                                       │
│  ├── 80    → Nginx HTTP (redirects to HTTPS)                   │
│  ├── 443   → Nginx HTTPS → Platform Frontend                    │
│  └── 8000  → Memory API (direct access)                         │
│                                                                  │
│  INTERNAL (Docker Network)                                      │
│  ├── 8000  → Memory API                                         │
│  ├── 11235 → Crawler API                                        │
│  ├── 3000  → MCP Server / Platform Frontend (internal)         │
│  ├── 8080  → Weaviate HTTP                                      │
│  ├── 50051 → Weaviate gRPC                                      │
│  ├── 6379  → Redis (memory + crawler)                          │
│  ├── 9000  → MinIO API                                          │
│  └── 9001  → MinIO Console                                      │
└─────────────────────────────────────────────────────────────────┘
```
