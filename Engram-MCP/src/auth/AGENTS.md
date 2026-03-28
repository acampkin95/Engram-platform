<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-22 -->

# auth

OAuth 2.1 authentication — RFC 7591 dynamic client registration, RFC 8414 metadata, authorization code + PKCE flow, and token endpoints.

## Key Files

| File | Description |
|------|-------------|
| `oauth-server.ts` | OAuth 2.1 endpoints — register, authorize, token, metadata |
| `oauth-middleware.ts` | Bearer token validation middleware for HTTP requests |
| `token-store.ts` | In-memory token and client storage interface |
| `redis-token-store.ts` | Redis backend for token storage (HA-ready) |
| `pkce.ts` | PKCE helper — code challenge/verifier generation and validation |

## For AI Agents

### Working In This Directory

1. **Understanding the Flow**
   - Client calls `/oauth/register` to get credentials
   - Client initiates `/oauth/authorize` with PKCE code challenge
   - Client receives authorization code via callback
   - Client exchanges code + verifier at `/oauth/token`
   - Returns `access_token` and optional `refresh_token`

2. **Adding Token Storage Backend**
   - Implement `TokenStore` interface in new file
   - Export from `oauth-server.ts` alongside `RedisTokenStore`
   - Pass instance to `createOAuthRouter()`

3. **Changing Token Expiration**
   - Edit `oauth-server.ts` line with `expiresIn: ...`
   - Update refresh token TTL in token generation
   - Ensure middleware validates expiry correctly

### Testing Requirements

- Test OAuth endpoints in `tests/oauth-server.test.ts`
- Test PKCE challenge/verifier flow in `tests/pkce.test.ts`
- Test token validation in `tests/oauth-middleware-bootstrap.test.ts`
- Mock Redis calls if using `RedisTokenStore`
- All token manipulations logged for audit

### Common Patterns

- **PKCE**: Always verify code challenge on token exchange
- **Token Format**: Opaque bearer tokens (no embedded claims) for security
- **Storage**: Token metadata (client_id, scopes, expiry) cached in Redis
- **Error Response**: Return RFC 6749 error format (error + error_description)
- **Rate Limiting**: Not implemented — add to `oauth-middleware.ts` if needed

## Dependencies

### Internal
- `../config.ts` — OAuth settings from env
- `../utils/read-body.ts` — Parse POST body
- `../logger.ts` — Audit logging

### External
- `redis` (optional) — For `RedisTokenStore`
- `node:crypto` — PKCE, tokens, random IDs
- `node:http` — HTTP primitives for endpoints

<!-- MANUAL: -->
