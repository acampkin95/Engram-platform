# Engram Tailscale Setup Guide

This guide describes how to configure Engram to be accessible over a Tailscale network.

## Prerequisites

- A working Tailscale network.
- Engram installed and running on a machine joined to your Tailscale network.

## Configuration Steps

### 1. Identify your Tailscale Address

Find the IP address or MagicDNS name of the machine hosting Engram.

- You can find this in the Tailscale admin console or by running `tailscale ip` on the machine.
- Example: `100.x.y.z` or `engram-host`

### 2. Update Environment Variables

You need to update the `.env` file in `Engram-Platform` to include your Tailscale address.

1. Navigate to `Engram-Platform`.
2. Open or create your `.env` file (copy from `.env.example` if needed).
3. Update the `NEXT_PUBLIC_APP_URL` and `CORS_ORIGINS` variables.

```bash
# Engram-Platform/.env

# Application URLs
# Use your Tailscale IP or MagicDNS name (and port 3002)
NEXT_PUBLIC_APP_URL=http://<tailscale-ip-or-name>:3002

# CORS Configuration
# Add your Tailscale URL to the allowed origins list
CORS_ORIGINS=http://localhost:3002,http://localhost:3001,http://<tailscale-ip-or-name>:3002
```

### 3. Rebuild and Restart Containers

After updating the environment variables, you need to rebuild and restart the Docker containers to apply the changes.

```bash
cd Engram-Platform
docker-compose down
docker-compose up -d --build
```

## Verifying Access

1. On another device joined to your Tailscale network, open a web browser.
2. Navigate to `http://<tailscale-ip-or-name>:3002`.
3. You should see the Engram login or dashboard page.

## Troubleshooting

- **CORS Errors:** If you see CORS errors in the browser console, double-check that you added the exact URL (including `http://` and port) to `CORS_ORIGINS` in the `.env` file and restarted the containers.
- **Connection Refused:** Ensure that the Engram services are running (`docker-compose ps`) and that the host machine's firewall allows traffic on port 3002 over the Tailscale interface (Tailscale usually handles this automatically).
- **Clerk Authentication:** If using Clerk for authentication, you may need to add your Tailscale domain/IP to the Allowed Origins in your Clerk Dashboard settings if strict security is enabled.
