# Engram System Architecture Skill - Creation Summary

**Created**: 2026-03-22  
**File**: `/Users/alex/.claude/skills/engram-system-architecture/SKILL.md`  
**Size**: 23 KB (784 lines)  
**Status**: ✓ Complete and verified

## What Was Created

A comprehensive Claude Code skill for Engram Platform system architecture documentation. This skill provides authoritative reference material for infrastructure, service topology, networking, data flows, and operational procedures.

## Skill Contents

### 1. Network Topology Section
- Complete server infrastructure (dv-syd-host01, acdev-devnode, vd-syd-fleet, vd-syd-dc-hv01)
- Tailscale IP addresses and access paths
- Network binding configurations

### 2. Service Topology (Docker Compose)
- Full service map with dependencies
- 8 services documented:
  - NGINX (reverse proxy, rate limiting)
  - Crawler API (OSINT, 11235)
  - Memory API (vector memory, 8000)
  - MCP Server (Model Context Protocol, 3000)
  - Platform Frontend (Next.js, 3000 → 3002 user-facing)
  - Weaviate (vector DB, 8080 + gRPC 50051)
  - Crawler Redis (cache, 384MB max)
  - Memory Redis (cache, 256MB max)

### 3. Complete Service Registry
For each service:
- Container name, image, ports
- CPU/memory allocations with limits and reservations
- Health check configuration
- Dependencies and startup order
- Key environment variables
- Build contexts and volumes

### 4. Data Flow Architecture
- Ingest pipeline (crawl → memory → weaviate)
- Query pipeline (frontend → nginx → memory-api → weaviate)
- WebSocket pipeline (live progress streaming)

### 5. Port Registry
- Internal container-to-container mappings
- External Tailscale access points
- All 10 ports mapped and documented

### 6. Storage Architecture
- 9 named volumes with mount paths
- Data lifecycle management (hot → warm → cold → archive)
- Persistence and backup strategies

### 7. Service Dependencies & Startup Order
- Dependency graph visualization
- Exact startup sequence (8 stages)
- Approximate startup time: 2-3 minutes

### 8. Failure Domains & Recovery
- Single-service failure impact analysis
- Multi-service failure scenarios
- Circuit breaker pattern documentation
- Recovery procedures for each failure type

### 9. Scaling Considerations
- Current resource allocation (12 vCPU, 48GB RAM)
- Bottleneck identification (Weaviate memory, Crawler disk, Redis)
- Three horizontal scaling options (sharded crawlers, replicas, tenant sharding)
- Vertical scaling paths

### 10. Environment Configuration
- Essential environment variables table
- File location reference
- Build arguments and runtime configuration

### 11. Health Check & Monitoring
- All 8 health check endpoints documented
- Interval, timeout, retry configuration
- Status check commands

### 12. Debugging Procedures
- Connection refused troubleshooting
- Weaviate slow query diagnosis
- Crawler memory overflow solutions
- Step-by-step diagnostic commands

### 13. Deployment Checklist
- 21-point pre-deployment verification checklist
- Configuration and startup procedures
- Endpoint testing commands
- Log monitoring instructions

## Verification

All information verified against actual configuration files:
- ✓ docker-compose.yml (current production config)
- ✓ nginx.conf (routing and SSL)
- ✓ .env.example (all environment variables)
- ✓ CLAUDE.md (project architecture guide)
- ✓ Tailscale network topology
- ✓ Port numbers and service names (exact)
- ✓ Memory and CPU allocations (from docker-compose resource limits)
- ✓ Health check configuration (from docker-compose healthcheck blocks)

## Usage

This skill automatically triggers when users work on:
- Engram Platform infrastructure
- Service topology understanding
- Cross-service debugging
- Capacity planning
- System onboarding

**Invoke with**: `/oh-my-claudecode:engram-system-architecture`

Or reference explicitly: "Use the engram-system-architecture skill to..."

## Key Characteristics

- **Technically Precise**: All port numbers, IPs, resource limits are from actual configs
- **Operationally Complete**: Includes debugging procedures and deployment checklists
- **Searchable**: Organized by service, function, and domain
- **Reference-Grade**: Functions as authoritative documentation for Engram infrastructure
- **Cross-Referenced**: Links to actual file locations for verification

## Related Documentation

- Main architecture guide: `/Users/alex/Projects/Dev/LIVE/Production/09_EngramPlatform/CLAUDE.md`
- Docker configuration: `/Users/alex/Projects/Dev/LIVE/Production/09_EngramPlatform/Engram-Platform/docker-compose.yml`
- Nginx routing: `/Users/alex/Projects/Dev/LIVE/Production/09_EngramPlatform/Engram-Platform/nginx/nginx.conf`
- Environment template: `/Users/alex/Projects/Dev/LIVE/Production/09_EngramPlatform/Engram-Platform/.env.example`

## Future Enhancements

Documented in skill:
- Prometheus metrics export setup
- MinIO S3 offload procedures
- Let's Encrypt TLS automation
- Disaster recovery procedures
- Performance optimization playbooks

---

**Status**: ✓ Complete  
**Deployed**: Yes — skill is discoverable and ready for use  
**Tested**: Configuration verified against production files
