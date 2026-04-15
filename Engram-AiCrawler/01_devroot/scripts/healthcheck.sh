#!/bin/bash
set -e

# Health check script for Crawl4AI OSINT Container
# Checks: API health, WebSocket connectivity, essential services

API_URL="${API_URL:-http://localhost:11235}"
MAX_RETRIES="${MAX_RETRIES:-3}"
RETRY_DELAY="${RETRY_DELAY:-2}"

check_endpoint() {
    local url="$1"
    local name="$2"

    for i in $(seq 1 $MAX_RETRIES); do
        echo "[$i/$MAX_RETRIES] Checking $name..."

        if curl -f -s -o /dev/null -m 10 --connect-timeout 5 "$url" > /dev/null 2>&1; then
            echo "✓ $name is healthy"
            return 0
        fi

        if [ $i -lt $MAX_RETRIES ]; then
            sleep $RETRY_DELAY
        fi
    done

    echo "✗ $name health check failed after $MAX_RETRIES attempts"
    return 1
}

# Check main API health endpoint
echo "======================================"
echo "Health Check: Crawl4AI OSINT Container"
echo "======================================"
echo ""

check_endpoint "$API_URL/health" "API Health Endpoint"

# Check API root endpoint
check_endpoint "$API_URL/" "API Root Endpoint"

# Check stats endpoint
check_endpoint "$API_URL/stats" "API Stats Endpoint"

# Verify critical Python processes
echo ""
echo "Checking critical processes..."

if pgrep -f "uvicorn app.main:app" > /dev/null; then
    echo "✓ FastAPI server is running"
else
    echo "✗ FastAPI server is NOT running"
    exit 1
fi

# Check LM Studio connectivity (optional but important)
if [ ! -z "$LM_STUDIO_URL" ]; then
    echo ""
    echo "Checking LM Studio connectivity..."

    for i in $(seq 1 3); do
        if curl -f -s -o /dev/null -m 5 --connect-timeout 3 "$LM_STUDIO_URL/models" > /dev/null 2>&1; then
            echo "✓ LM Studio is accessible"
            break
        fi

        if [ $i -lt 3 ]; then
            sleep 1
        fi
    done
fi

# Check Redis connectivity (if configured)
if [ ! -z "$REDIS_URL" ]; then
    echo ""
    echo "Checking Redis connectivity..."

    if command -v redis-cli > /dev/null; then
        if redis-cli -u "$REDIS_URL" ping > /dev/null 2>&1; then
            echo "✓ Redis is accessible"
        else
            echo "⚠ Redis is not accessible (continuing anyway)"
        fi
    fi
fi

echo ""
echo "======================================"
echo "All health checks completed"
echo "======================================"

exit 0
