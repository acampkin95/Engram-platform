# Engram Production Setup Guide

This guide describes how to configure and deploy Engram for production use at `memory.velocitydigi.com`.

## Prerequisites

- Docker and Docker Compose installed.
- Access to the `Engram-Platform` directory.
- A reverse proxy (e.g., Cloudflare, Nginx, Traefik) handling SSL termination and pointing to this server.

## Configuration Steps

### 1. Configure Environment Variables

1. Navigate to `Engram-Platform`.
2. Copy `.env.example` to `.env`.
3. Ensure the following variables are set for production:

```bash
# Application URLs
NEXT_PUBLIC_APP_URL=https://memory.velocitydigi.com

# CORS Configuration
# Ensure your domain is listed here
CORS_ORIGINS=https://memory.velocitydigi.com,https://engram.velocitydigi.com
```

### 2. Start the Services

Run the following command to build and start the services in detached mode:

```bash
./scripts/deploy-unified.sh up
```

### 3. Verify Deployment

1. Check the status of the containers:

   ```bash
   ./scripts/deploy-unified.sh ps
   ```

   Ensure all services (`engram-nginx`, `engram-platform-frontend`, `engram-memory-api`, `engram-crawler-api`, etc.) are `Up` and `healthy`.

2. Access the application at [https://memory.velocitydigi.com](https://memory.velocitydigi.com).

## Streamlined Updates

To update the application with new code or configuration changes:

```bash
# Pull latest changes (if using git)
# git pull origin main

# Rebuild and restart only changed containers
./scripts/deploy-unified.sh up
```

## Unified Deployment Entry Point

The canonical orchestration surface is `Engram-Platform/docker-compose.yml`.
Use `./scripts/deploy-unified.sh` from the repository root for routine lifecycle commands instead of invoking multiple per-project compose files directly.

## Target Hardware Profile

For the i5/16GB/1TB deployment profile, the Docker Compose stack is tuned to stay near an 8.5GB total memory envelope:

- `crawler-api`: 2G limit, 768M reservation, `shm_size: 2g`
- `memory-api`: 512M limit, 192M reservation
- `weaviate`: 1536M limit, 384M reservation, `GOMEMLIMIT=1.2GiB`, `CACHE_SIZE=384MB`
- `crawler-redis`: 512M limit, `--maxmemory 384mb`
- `memory-redis`: 384M limit, `--maxmemory 256mb`
- `mcp-server`: 256M limit, 96M reservation
- `platform-frontend`: 256M limit, 96M reservation
- `nginx`: 128M limit, 48M reservation

Adjust upward only if real production telemetry shows sustained pressure.

## Troubleshooting

- **502 Bad Gateway:** Ensure the `engram-platform-frontend` container is running and healthy. It may take a minute to start.
- **CORS Errors:** Verify that `CORS_ORIGINS` in your `.env` file matches exactly the domain you are accessing from (protocol + domain).
- **WebSocket Errors:** Ensure your reverse proxy supports WebSocket upgrades (Connection: Upgrade).
