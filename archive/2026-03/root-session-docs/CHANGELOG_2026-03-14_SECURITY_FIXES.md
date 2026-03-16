# Security Quick Wins - 2026-03-14

## Summary
Critical security improvements for production deployment, focusing on OAuth token persistence and Docker secrets management.

## Changes

### 1. MCP OAuth Token Persistence via Redis

**Problem:** OAuth tokens stored in memory were lost on restart, requiring all clients to re-authenticate.

**Solution:** Configure MCP server to use Redis for OAuth token storage.

**File:** `Engram-Platform/docker-compose.yml`

**Change:**
```yaml
mcp-server:
  environment:
    - OAUTH_REDIS_URL=redis://memory-redis:6379
    - MCP_SERVER_PORT=3000
    - MCP_AUTH_TOKEN=${MCP_AUTH_TOKEN:-}
```

**Impact:**
- OAuth tokens persist across restarts
- No client re-authentication required after server restart
- Tokens remain valid until natural expiration

### 2. Docker Secrets Management

**Problem:** Sensitive environment variables in plaintext.

**Status:** ⚠️ PARTIAL - Using Docker .env file (not committed to git)

**Recommendation:**
- Use Docker secrets for production (Swarm mode)
- Or use external secrets management (HashiCorp Vault, AWS Secrets Manager)
- Current .env approach is acceptable for development/staging

**No changes made** - documenting current approach for future improvement.

### 3. Playwright Security Update

**Problem:** Potential CVE in Playwright dependency (AiCrawler).

**Status:** ⏳️ NOT STARTED - Requires npm update

**Recommendation:**
```bash
cd Engram-AiCrawler/01_devroot/frontend
npm update playwright
```

**Risk:** Medium - Only affects development/testing, not production runtime.

## Testing

### Verify OAuth Redis Configuration

```bash
# Start services
cd Engram-Platform
docker compose up -d

# Check MCP server logs
docker compose logs mcp-server | grep -i "oauth\|redis"

# Verify Redis connection
docker compose exec memory-redis redis-cli ping
```

### Expected Logs

MCP server should log:
```
OAuth token store initialized with Redis at redis://memory-redis:6379
```

## Security Checklist

- ✅ OAuth tokens use Redis persistence
- ✅ Docker secrets in .env (not in compose file)
- ✅ No hardcoded credentials in code
- ⏳️ Playwright update needed (development only)
- ⏳️ Consider Docker secrets for production
- ⏳️ Add rate limiting to MCP endpoints

## Next Steps

1. **High Priority:**
   - Update Playwright in AiCrawler frontend
   - Add rate limiting to MCP server endpoints
   - Implement request validation middleware

2. **Medium Priority:**
   - Migrate to Docker secrets for production
   - Add API key rotation mechanism
   - Implement audit logging

3. **Low Priority:**
   - Add security headers validation
   - Implement CORS policy review
   - Add input sanitization logging

## Related

- Memory Leak Fixes: `/CHANGELOG_2026-03-14_MEMORY_LEAK_FIXES.md`
- Session Plan: `plans/2026-03-14-evaluation/session-plan.md`
- AGENTS.md: Security Implementation section
