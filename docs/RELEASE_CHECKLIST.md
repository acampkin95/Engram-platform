# Engram v1.0 Release Checklist

## Pre-Release Verification

### Build Health
- [ ] `cd Engram-AiMemory && source .venv/bin/activate && make lint && make test` -- 901+ pass, 0 fail
- [ ] `cd Engram-MCP && npm run build && npm test` -- 382+ pass, 0 fail
- [ ] `cd Engram-MCP && npm run smoke` -- all smoke checks pass
- [ ] `cd Engram-Platform/frontend && npm run lint` -- 0 Biome issues
- [ ] `cd Engram-Platform/frontend && npm run build` -- clean Next.js production build

### Coverage Gates
- [ ] AiMemory Python: 78%+ (baseline: 78%, target: 85%)
- [ ] AiCrawler Python: 75%+ enforced minimum (baseline: 81%)
- [ ] Platform frontend: 79%+ statements (baseline: 79%)
- [ ] MCP: 79%+ lines (baseline: 79.83%)

### Auth Verification
- [ ] MCP OAuth 2.1 metadata endpoint responds at `/.well-known/oauth-authorization-server`
- [ ] MCP Bearer token auth works with `MCP_AUTH_TOKEN`
- [ ] MCP OAuth tokens persist across server restart (Redis-backed)
- [ ] Platform Clerk auth redirects correctly for unauthenticated users
- [ ] Admin routes require `requireAdminAccess()` and return 401/403 appropriately

### Docker Compose
- [ ] `docker compose -f Engram-Platform/docker-compose.yml config` validates without errors
- [ ] All services start: `docker compose up -d`
- [ ] Health checks pass: `./scripts/release-smoke-test.sh http://localhost`
- [ ] Memory budget under 9.5GB (Beta gate) or 8.5GB (RC gate)

## Deployment

### Target Server
- Host: `dv-syd-host01.icefish-discus.ts.net` (100.100.42.6)
- Access: Tailscale only, NEVER public IP
- Profile: Ubuntu, 12 vCPU, 48GB RAM, 500GB NVMe

### Deploy Steps
1. SSH via Tailscale: `ssh dv-syd-host01.icefish-discus.ts.net`
2. Pull latest: `cd /opt/engram && git pull`
3. Setup env: `cd Engram-Platform && ./scripts/setup-env.sh` (interactive guided setup, or `cp .env.example .env` and fill manually)
4. Build and start: `docker compose -f Engram-Platform/docker-compose.yml up -d --build`
5. Run smoke test: `./scripts/release-smoke-test.sh http://localhost`
6. Verify via Tailscale: `./scripts/release-smoke-test.sh http://100.100.42.6`

### Required Environment Variables
See `Engram-Platform/.env.example` for the full list. Critical ones:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY`
- `JWT_SECRET` (min 32 chars)
- `MCP_AUTH_TOKEN`
- `OAUTH_SECRET` (min 32 chars, if OAuth enabled)
- `OAUTH_REDIS_URL` (for persistent OAuth tokens)
- `NEXT_PUBLIC_SENTRY_DSN` + `SENTRY_AUTH_TOKEN` (for error tracking)

## Rollback

### Quick Rollback
```bash
ssh dv-syd-host01.icefish-discus.ts.net
cd /opt/engram
docker compose -f Engram-Platform/docker-compose.yml down
git checkout <previous-tag>
docker compose -f Engram-Platform/docker-compose.yml up -d --build
./scripts/release-smoke-test.sh http://localhost
```

### Data Safety
- Weaviate data persists in Docker volumes (not destroyed by `down`)
- Redis data persists in Docker volumes
- Use `docker compose down -v` ONLY if you want to destroy all data

## Post-Release

- [ ] Monitor Sentry for new errors in first 24 hours
- [ ] Check Docker resource usage: `docker stats`
- [ ] Verify health endpoints remain green: `./scripts/release-smoke-test.sh`
- [ ] Tag release: `git tag v1.0.0 && git push origin v1.0.0`

## Known Limitations (v1.0)

- SonarQube scanner is configured but server is not yet deployed
- MCP pagination is not implemented across all list/search surfaces
- Storybook is not set up for component documentation
- Full NIST security controls are deferred to post-1.0
- Centralized logging (ELK) is deferred to post-1.0
