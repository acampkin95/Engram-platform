# QA Test Reports - Engram Crawler API

## Latest Report (2026-03-26)

**Status**: ✅ PASSING (84% - 11/13 tests)

### Quick Summary
- **Core API**: Fully functional
- **Containers**: All healthy and responsive
- **HTTPS Proxy**: Working via nginx
- **Redis**: Connected and operational
- **Minor Issues**: 2 (health endpoint method, nginx path routing)

### Files
- `engram-crawler-e2e-2026-03-26.md` - Detailed technical report
- `QA_SUMMARY_2026-03-26.txt` - Executive summary

### Test Results by Category
| Category | Pass Rate | Notes |
|----------|-----------|-------|
| Direct Container | 80% | Health endpoint needs GET method |
| Inter-Container | 100% | All inter-service calls working |
| Dependencies | 100% | Redis, containers, processes verified |
| Nginx Proxy | 67% | Path routing issue with POST |
| **Overall** | **84%** | Ready for deployment with caveats |

### Issues Found
1. **Health Check Endpoint** (LOW severity)
   - Only accepts DELETE, not standard GET
   - Affects: Monitoring tools
   - Fix: Change to accept GET

2. **Nginx POST Path Routing** (LOW severity)
   - POST to `/api/crawler/crawl/start` returns 404
   - Direct `/api/crawl/start` works fine
   - Affects: Clients via nginx proxy
   - Fix: Verify nginx proxy_pass configuration

### Verified Functionality
- ✅ Crawl job creation
- ✅ API documentation (OpenAPI + Swagger)
- ✅ Container health checks
- ✅ Redis backend
- ✅ HTTPS termination
- ✅ Process management

### Commands to Rerun Tests

```bash
# Direct to crawler API
docker exec engram-crawler-api curl -X POST \
  -H 'Content-Type: application/json' \
  -d '{"url": "https://example.com"}' \
  http://localhost:11235/api/crawl/start

# Via nginx (internal)
docker exec engram-nginx curl -X POST \
  -H 'Content-Type: application/json' \
  -d '{"url": "https://example.com"}' \
  http://crawler-api:11235/api/crawl/start

# Via HTTPS proxy
curl -sk --resolve memory.velocitydigi.com:443:100.78.187.5 \
  https://memory.velocitydigi.com/api/crawler/
```

### Recommendations
1. Fix health endpoint before production
2. Test nginx proxy POST handling
3. Configure monitoring for both issues
4. Update client code to use correct paths

---

**Test Environment**: acdev-devnode (100.78.187.5)  
**Last Run**: 2026-03-26 16:59 UTC  
**Duration**: ~2 minutes
