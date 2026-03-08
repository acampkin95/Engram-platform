# Engram Platform — Deployment Checklist

> **See also:** [Full Documentation Index](../../docs/00-index.md) | [Deployment Manual](../../docs/01-deployment-manual.md)

> **Target:** dv-syd-host01 (Tailscale IP: 100.100.42.6, MagicDNS: dv-syd-host01.icefish-discus.ts.net)
> **Domain:** memory.velocitydigi.com / engram.velocitydigi.com
> **Access Method:** Tailscale-only (no public internet exposure)

---

## Pre-Deployment (Local Machine)

### 1. Build & Validate
- [ ] Run `docker compose config` to validate docker-compose.yml syntax
- [ ] Build all images: `docker compose build`
- [ ] Verify no secrets are hardcoded in any committed files
  ```bash
  grep -r "sk_live\|sk-...\|password\|secret" --include="*.yml" --include="*.yaml" --include="*.json" .
  ```

### 2. Environment Configuration
- [ ] Copy `.env.production.example` to `.env` on the target host
- [ ] Fill in all required secrets:
  - [ ] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
  - [ ] `CLERK_SECRET_KEY`
  - [ ] `NEXT_PUBLIC_MEMORY_API_KEY`
  - [ ] `MEMORY_API_KEY`
  - [ ] `JWT_SECRET` (min 32 characters)
  - [ ] `DEEPINFRA_API_KEY` (or `OPENAI_API_KEY`)
  - [ ] `MCP_AUTH_TOKEN`
- [ ] Set `BIND_ADDRESS=100.100.42.6` (Tailscale IP)
- [ ] Verify `CORS_ORIGINS` includes:
  - `https://memory.velocitydigi.com`
  - `https://engram.velocitydigi.com`
  - `https://dv-syd-host01.icefish-discus.ts.net`
  - `https://100.100.42.6`

### 3. Certificate Preparation
- [ ] Generate Tailscale HTTPS certificates OR use self-signed fallback
- [ ] Place certificates in `certs/` directory:
  - `certs/nginx-selfsigned.crt`
  - `certs/nginx-selfsigned.key`

---

## Transfer to Target Host (via Tailscale)

### 4. SFTP Transfer
```bash
# Connect via Tailscale (NEVER use public IP)
sftp alex@100.100.42.6

# Create directory structure
mkdir -p /tmp/engram-deploy

# Transfer files
put -r docker-compose.yml
put -r .env
put -r nginx/
put -r certs/
put -r scripts/
put -r systemd/
put -r config/
```

### 5. Verify File Permissions (on target host)
```bash
ssh alex@100.100.42.6
sudo chown -R root:root /opt/engram
sudo chmod 600 /opt/engram/.env
sudo chmod +x /opt/engram/scripts/*.sh
sudo chmod 644 /opt/engram/nginx/nginx.conf
sudo chmod 644 /opt/engram/certs/*.crt
sudo chmod 600 /opt/engram/certs/*.key
```

---

## On Target Host (dv-syd-host01)

### 6. System Preparation
- [ ] Verify Tailscale is connected:
  ```bash
  tailscale status
  tailscale ip -4  # Should show 100.100.42.6
  ```
- [ ] Verify Docker is installed and running:
  ```bash
  docker --version
  docker info
  ```
- [ ] Verify systemd is available

### 7. Certificate Provisioning (if using Tailscale certs)
```bash
cd /opt/engram
sudo ./scripts/provision-tailscale-certs.sh
```

### 8. System Optimization (Optional but Recommended)
```bash
# Run system optimization for Weaviate/Redis performance
sudo ../Engram-AiMemory/scripts/system-optimize.sh
```

### 9. Deploy the Stack
```bash
cd /opt/engram
sudo ./scripts/deploy-production.sh
```

### 10. Verify Deployment
```bash
# Check all services are running
docker compose ps

# Check logs for errors
docker compose logs -f --tail=50

# Run Tailscale access verification
./scripts/verify-tailscale-access.sh
```

---

## Post-Deployment Verification

### 11. Service Health Checks
- [ ] Nginx: `curl -k https://100.100.42.6/health`
- [ ] Memory API: `curl -k https://100.100.42.6/api/memory/health`
- [ ] Crawler API: `curl -k https://100.100.42.6/api/crawler/`
- [ ] MCP Server: `curl -k https://100.100.42.6/mcp/health`

### 12. Security Verification
- [ ] Confirm NO public access:
  ```bash
  # This should timeout or fail
  curl -k --max-time 5 https://46.250.245.181/health
  ```
- [ ] Verify security headers are present:
  ```bash
  curl -k -I https://100.100.42.6/health | grep -i "x-frame-options\|hsts\|csp"
  ```
- [ ] Check container security:
  ```bash
  docker inspect engram-memory-api | jq '.[0].HostConfig.SecurityOpt'
  # Should show: ["no-new-privileges:true"]
  ```

### 13. CORS Verification
- [ ] Test CORS from another Tailscale device:
  ```bash
  curl -k -H "Origin: https://memory.velocitydigi.com" \
       -H "Access-Control-Request-Method: GET" \
       -X OPTIONS \
       https://100.100.42.6/api/memory/health
  ```

### 14. Systemd Integration
- [ ] Verify service is enabled:
  ```bash
  sudo systemctl is-enabled engram-platform
  ```
- [ ] Test service restart:
  ```bash
  sudo systemctl restart engram-platform
  sudo systemctl status engram-platform
  ```

---

## Lighthouse Performance Verification

### 15. Performance Checks
- [ ] Verify HTTP/2 is enabled (via browser dev tools Network tab)
- [ ] Verify gzip compression: `curl -k -I --compressed https://100.100.42.6/`
- [ ] Verify static asset caching headers (1 year for images/JS/CSS)
- [ ] Run Lighthouse audit (via Chrome DevTools or CLI)

---

## Troubleshooting

### Issue: CORS errors in browser
**Solution:** Update `CORS_ORIGINS` in `.env` to include the exact origin (including `https://` and port)

### Issue: Tailscale certificate not provisioning
**Solution:**
1. Enable HTTPS in Tailscale admin console
2. Ensure MagicDNS is enabled
3. Use self-signed fallback:
   ```bash
   openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
     -keyout certs/nginx-selfsigned.key \
     -out certs/nginx-selfsigned.crt \
     -subj '/CN=localhost'
   ```

### Issue: Services not starting
**Solution:**
```bash
# Check logs
sudo journalctl -u engram-platform -n 100

# Validate docker-compose
docker compose config

# Check for port conflicts
sudo ss -tlnp | grep -E ':80|:443'
```

### Issue: Cannot connect via Tailscale IP
**Solution:**
1. Verify Tailscale is connected on both hosts: `tailscale status`
2. Check BIND_ADDRESS is set to Tailscale IP in `.env`
3. Verify no firewall blocking Tailscale interface
4. Check nginx is listening on correct interface: `sudo ss -tlnp | grep nginx`

---

## Maintenance

### Weekly
- [ ] Review logs: `sudo journalctl -u engram-platform -n 1000`
- [ ] Check disk usage: `df -h` and `docker system df`
- [ ] Monitor container resource usage: `docker stats --no-stream`

### Monthly
- [ ] Renew Tailscale certificates: `sudo ./scripts/provision-tailscale-certs.sh`
- [ ] Update Docker images: `docker compose pull`
- [ ] Review and rotate secrets
- [ ] Backup data volumes

### As Needed
- [ ] Scale resources if memory/CPU limits reached
- [ ] Update CORS origins if adding new domains
- [ ] Rotate API keys

---

## Rollback Procedure

If deployment fails:

```bash
cd /opt/engram

# Stop services
sudo docker compose down

# Restore from backup (if available)
sudo cp /var/backups/engram-<timestamp>/docker-compose.yml .
sudo cp /var/backups/engram-<timestamp>/.env .

# Restart with previous version
sudo docker compose up -d
```

---

## Security Checklist

- [ ] No services exposed on 0.0.0.0 (verify with `ss -tlnp`)
- [ ] All containers have `security_opt: no-new-privileges:true`
- [ ] Stateless containers have `read_only: true`
- [ ] `.env` file has permissions 600
- [ ] Certificate files have correct permissions (644 for .crt, 600 for .key)
- [ ] No secrets in docker-compose.yml (all use `${VAR}` interpolation)
- [ ] HSTS header is present on HTTPS responses
- [ ] CSP header is configured
- [ ] X-Frame-Options is set to SAMEORIGIN

---

**Last Updated:** 2026-03-02
**Version:** 1.0
