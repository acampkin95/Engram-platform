# Engram Tailscale Setup Guide

This guide describes how to configure Engram to be accessible over a Tailscale network.

## Prerequisites

- A working Tailscale network.
- Engram installed and running on a machine joined to your Tailscale network.

## Configuration Steps

### 1. Identify your Tailscale Address

Find the IP address or MagicDNS name of the machine hosting Engram.

- You can find this in the Tailscale admin console or by running `tailscale ip` on the machine.
- Example: `100.x.y.z` or `engram-host.tail1234.ts.net`

### 2. Configure Environment Variables

Run the interactive setup wizard which will prompt for your Tailscale address:

```bash
./scripts/deploy-unified.sh setup
```

Or edit `Engram-Platform/.env` manually:

```bash
# Bind services to your Tailscale IP (never 0.0.0.0)
BIND_ADDRESS=100.x.y.z

# Tailscale MagicDNS hostname
TAILSCALE_HOSTNAME=engram-host.tail1234.ts.net

# Application URL using your Tailscale address
NEXT_PUBLIC_APP_URL=http://engram-host.tail1234.ts.net:3002

# CORS: include your Tailscale URL
CORS_ORIGINS=http://localhost:3002,http://engram-host.tail1234.ts.net:3002
```

### 3. Rebuild and Restart

```bash
./scripts/deploy-unified.sh up
```

## Verifying Access

1. On another device joined to your Tailscale network, open a web browser.
2. Navigate to `http://<tailscale-ip-or-name>:3002`.
3. You should see the Engram login or dashboard page.

## Service Ports

| Service | Port | URL |
|---------|------|-----|
| Platform UI | 3002 | `http://<tailscale-name>:3002` |
| Memory API | 8000 | `http://<tailscale-name>:8000` |
| MCP Server | 3000 | `http://<tailscale-name>:3000` |
| Weaviate | 8080 | `http://<tailscale-name>:8080` |

## Troubleshooting

- **CORS Errors:** Double-check that you added the exact URL (including `http://` and port) to `CORS_ORIGINS` in the `.env` file and restarted the containers.
- **Connection Refused:** Ensure services are running (`./scripts/deploy-unified.sh ps`) and that the host machine's firewall allows traffic over the Tailscale interface.
- **Clerk Authentication:** Add your Tailscale domain/IP to the Allowed Origins in your Clerk Dashboard settings if strict security is enabled.
- **Binding Issues:** Verify `BIND_ADDRESS` is set to your Tailscale IP, not `127.0.0.1` (which restricts to localhost only).
