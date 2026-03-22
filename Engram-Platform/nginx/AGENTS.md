<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-22 -->

# nginx

## Purpose

Nginx reverse proxy configuration. Routes requests to backend services (Platform frontend, Memory API, Crawler API, MCP server). Handles SSL/TLS (Tailscale certs), compression, caching, and security headers.

## Key Files

| File | Description |
|------|-------------|
| `nginx.conf` | Main Nginx configuration |

## For AI Agents

### Working In This Directory

1. **Nginx Configuration**
   - Edit `nginx.conf` for routing rules
   - Update upstream service addresses if needed
   - Test syntax: `nginx -t` (requires nginx installed)
   - Reload: `systemctl reload nginx` (on production)

2. **Service Routing**
   - Platform (frontend) on `:3002` → external `:8080`
   - Memory API on `:8000` → internal only
   - Crawler API on `:11235` → internal only
   - MCP Server on `:3000` → internal only (optional)

3. **SSL/TLS**
   - Tailscale certificates in `../certs/`
   - Auto-renewed by Tailscale
   - Configure paths in nginx.conf

### Testing Requirements

- **Syntax:** `nginx -t` (must pass)
- **Routing:** Test all upstream services
- **SSL:** Verify certificate paths
- **Headers:** Check security headers in response

### Common Patterns

1. **Basic Upstream Server**
   ```nginx
   upstream platform_backend {
     server platform:3002;
     keepalive 32;
   }

   server {
     listen 8080 ssl;
     server_name _;

     ssl_certificate /path/to/cert.pem;
     ssl_certificate_key /path/to/key.pem;

     location / {
       proxy_pass http://platform_backend;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
     }
   }
   ```

2. **API Route Proxying**
   ```nginx
   location /api/memory {
     proxy_pass http://memory_api:8000;
     proxy_http_version 1.1;
     proxy_set_header Upgrade $http_upgrade;
     proxy_set_header Connection "upgrade";
   }

   location /api/crawler {
     proxy_pass http://crawler_api:11235;
     proxy_set_header Host $host;
   }
   ```

3. **Compression**
   ```nginx
   gzip on;
   gzip_types text/plain text/css application/json application/javascript;
   gzip_min_length 1024;
   gzip_vary on;
   ```

4. **Caching Headers**
   ```nginx
   location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
     expires 30d;
     add_header Cache-Control "public, immutable";
   }
   ```

5. **Security Headers**
   ```nginx
   add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";
   add_header X-Content-Type-Options "nosniff";
   add_header X-Frame-Options "DENY";
   add_header X-XSS-Protection "1; mode=block";
   add_header Content-Security-Policy "default-src 'self'";
   ```

## Configuration Sections

**Main Configuration (nginx.conf):**

1. **Upstream Definitions**
   - platform_backend (3002)
   - memory_api (8000)
   - crawler_api (11235)
   - mcp_server (3000, optional)

2. **Server Block**
   - Listen on 8080 (external)
   - SSL/TLS configuration
   - Compression settings
   - Security headers

3. **Location Blocks**
   - `/` → Platform frontend
   - `/api/memory/` → Memory API
   - `/api/crawler/` → Crawler API
   - `/api/mcp/` → MCP Server (if enabled)

4. **Error Handling**
   - 404 → Custom error page
   - 503 → Service unavailable

## Port Mapping

| External | Internal | Service |
|----------|----------|---------|
| 8080 | :3002 | Platform (Next.js) |
| 8080/api/memory | :8000 | Memory API (FastAPI) |
| 8080/api/crawler | :11235 | Crawler API (FastAPI) |
| 8080/api/mcp | :3000 | MCP Server (Node.js, optional) |

## SSL/TLS Configuration

**Certificate Paths:**
- Cert: `/certs/tailscale.crt` (Tailscale CA)
- Key: `/certs/tailscale.key` (Private key)

**Renewal:**
- Automatic via Tailscale daemon
- No manual action required

**Testing:**
```bash
openssl x509 -in /certs/tailscale.crt -text -noout
```

## Performance Optimization

1. **HTTP/2:** Reduces latency
   ```nginx
   listen 8080 ssl http2;
   ```

2. **Gzip Compression:** ~70% size reduction
   ```nginx
   gzip on;
   gzip_types text/plain text/css application/json;
   gzip_min_length 1024;
   ```

3. **Upstream Keepalive:**
   ```nginx
   upstream backend {
     server localhost:3002;
     keepalive 32;
   }
   ```

4. **Caching:**
   - Static assets: 30 days
   - HTML: 1 hour
   - API: No caching

## Security Configuration

**Headers:**
- HSTS (HTTP Strict Transport Security): 1 year
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block

**Rate Limiting (Optional):**
```nginx
limit_req_zone $binary_remote_addr zone=general:10m rate=10r/s;
limit_req zone=general burst=20;
```

## Commands

```bash
# Test configuration syntax
nginx -t

# Reload configuration (without restart)
sudo systemctl reload nginx

# Restart service
sudo systemctl restart nginx

# View logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# Test connectivity
curl http://localhost:8080
curl https://localhost:8080 (with SSL)
```

## Known Patterns

1. **Proxy Headers:** Always set Host and IP
   ```nginx
   proxy_set_header Host $host;
   proxy_set_header X-Real-IP $remote_addr;
   proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
   proxy_set_header X-Forwarded-Proto $scheme;
   ```

2. **WebSocket Upgrade:**
   ```nginx
   proxy_http_version 1.1;
   proxy_set_header Upgrade $http_upgrade;
   proxy_set_header Connection "upgrade";
   ```

3. **Buffering:** Disable for streaming
   ```nginx
   proxy_buffering off;
   proxy_request_buffering off;
   ```

4. **Timeout:** Prevent hanging connections
   ```nginx
   proxy_connect_timeout 30s;
   proxy_send_timeout 30s;
   proxy_read_timeout 30s;
   ```

<!-- MANUAL: Update paths and services as deployment changes -->
