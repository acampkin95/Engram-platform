# Deployment Configuration Fixes - 2026-03-19

## Summary
Fixed deployment configuration issues in Engram-Platform across three key files.

## Changes Made

### 1. `.env.example` - Environment Configuration
- Added production guidance: `# For production: BIND_ADDRESS=100.100.42.6`
- Added REQUIRED comment for Clerk credentials with link to dashboard
- Added REQUIRED comment for JWT_SECRET with generation command: `openssl rand -base64 32`
- Added REQUIRED comment for MCP_AUTH_TOKEN noting it's the bearer token for authentication

### 2. `docker-compose.yml` - Compose Configuration
- **CRITICAL FIX**: Changed `OAUTH_ISSUER` from `https://100.78.187.5` (dev node) to `https://dv-syd-host01.icefish-discus.ts.net` (production server)
  - This ensures MCP OAuth endpoints point to the correct production server
  - Old value was hardcoded to dev infrastructure

### 3. `nginx/nginx.conf` - Nginx Configuration
- Added comprehensive comment explaining self-signed certificate paths with generation command
- Added LetsEncrypt upgrade path documentation for production SSL/TLS migration
- Documented the HTTP ACME challenge endpoint for certbot integration

## Verification
- Docker Compose config validation: PASS (only expected warnings for unset variables like JWT_SECRET)
- All upstream blocks match docker-compose service names
- All cert paths are correct and documented
- OAUTH_ISSUER now points to production Tailscale hostname

## Impact
- Production deployments will now use correct OAuth issuer (dv-syd-host01 production server)
- Environment setup is clearer with REQUIRED annotations
- Certificate management path to LetsEncrypt is documented
- Network binding guidance for production Tailscale deployment is explicit

## Files Modified
- `/Users/alex/Projects/Dev/LIVE/Production/09_EngramPlatform/Engram-Platform/.env.example`
- `/Users/alex/Projects/Dev/LIVE/Production/09_EngramPlatform/Engram-Platform/docker-compose.yml`
- `/Users/alex/Projects/Dev/LIVE/Production/09_EngramPlatform/Engram-Platform/nginx/nginx.conf`
