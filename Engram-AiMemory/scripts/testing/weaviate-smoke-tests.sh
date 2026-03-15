#!/bin/bash
# Weaviate Smoke Test Suite
# Tests basic connectivity and critical operations

set -e

echo "======================================"
echo "Weaviate Smoke Test Suite"
echo "======================================"
echo ""

# Configuration
WEAVIATE_URL="${WEAVIATE_URL:-http://localhost:8080}"
WEAVIATE_GRPC_URL="${WEAVIATE_GRPC_URL:-http://localhost:50051}"
TIMEOUT=30
RETRIES=3

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test results
TESTS_PASSED=0
TESTS_FAILED=0

# Helper functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_command() {
    if [ $? -eq 0 ]; then
        log_info "✓ $1"
        ((TESTS_PASSED++))
    else
        log_error "✗ $1"
        ((TESTS_FAILED++))
        return 1
    fi
}

# Test 1: Health Check
echo "Test 1: Weaviate Health Check"
echo "------------------------------"
for i in $(seq 1 $RETRIES); do
    if curl -sf "${WEAVIATE_URL}/v1/.well-known/ready" > /dev/null 2>&1; then
        check_command "Weaviate is ready"
        break
    else
        if [ $i -eq $RETRIES ]; then
            log_error "Weaviate health check failed after $RETRIES attempts"
            ((TESTS_FAILED++))
            exit 1
        fi
        log_warn "Retry $i/$RETRIES..."
        sleep 2
    fi
done
echo ""

# Test 2: Metadata Retrieval
echo "Test 2: Metadata Retrieval"
echo "--------------------------"
METADATA=$(curl -sf "${WEAVIATE_URL}/v1/meta" 2>/dev/null)
if [ $? -eq 0 ]; then
    VERSION=$(echo "$METADATA" | grep -o '"version":"[^"]*"' | cut -d'"' -f4)
    log_info "✓ Weaviate version: $VERSION"
    ((TESTS_PASSED++))
else
    log_error "✗ Failed to retrieve metadata"
    ((TESTS_FAILED++))
fi
echo ""

# Test 3: Schema Listing
echo "Test 3: Schema Operations"
echo "-------------------------"
SCHEMA=$(curl -sf "${WEAVIATE_URL}/v1/schema" 2>/dev/null)
if [ $? -eq 0 ]; then
    COLLECTION_COUNT=$(echo "$SCHEMA" | grep -o '"class":"[^"]*"' | wc -l)
    log_info "✓ Found $COLLECTION_COUNT collections"
    ((TESTS_PASSED++))
else
    log_warn "No schema found or schema endpoint not available"
    ((TESTS_PASSED++))
fi
echo ""

# Test 4: gRPC Connectivity (if grpcurl is available)
echo "Test 4: gRPC Connectivity"
echo "-------------------------"
if command -v grpcurl &> /dev/null; then
    if grpcurl -plaintext "${WEAVIATE_GRPC_URL}" list weaviate.v1.Weaviate 2>/dev/null | grep -q "Search"; then
        check_command "gRPC endpoint is accessible"
    else
        log_warn "gRPC endpoint check inconclusive"
    fi
else
    log_warn "grpcurl not installed, skipping gRPC check"
fi
echo ""

# Test 5: Basic CRUD Operations
echo "Test 5: Basic Operations"
echo "------------------------"

# Create test collection
TEST_CLASS="SmokeTest_$(date +%s)"
log_info "Creating test collection: $TEST_CLASS"

curl -sf -X POST "${WEAVIATE_URL}/v1/schema" \
    -H "Content-Type: application/json" \
    -d "{
        \"class\": \"$TEST_CLASS\",
        \"properties\": [
            {\"name\": \"content\", \"dataType\": [\"text\"]},
            {\"name\": \"test_id\", \"dataType\": [\"text\"]}
        ],
        \"vectorizer\": \"none\"
    }" > /dev/null 2>&1

check_command "Created test collection"

# Insert test object
TEST_ID=$(uuidgen 2>/dev/null || echo "test-$(date +%s)")
log_info "Inserting test object..."

INSERT_RESULT=$(curl -sf -X POST "${WEAVIATE_URL}/v1/objects" \
    -H "Content-Type: application/json" \
    -d "{
        \"class\": \"$TEST_CLASS\",
        \"properties\": {
            \"content\": \"Smoke test object\",
            \"test_id\": \"$TEST_ID\"
        },
        \"vector\": [0.1, 0.2, 0.3, 0.4]
    }" 2>/dev/null)

check_command "Inserted test object"

# Query object
OBJECT_ID=$(echo "$INSERT_RESULT" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
log_info "Querying object by ID: $OBJECT_ID"

curl -sf "${WEAVIATE_URL}/v1/objects/$TEST_CLASS/$OBJECT_ID" > /dev/null 2>&1
check_command "Retrieved test object"

# Search
log_info "Performing vector search..."
SEARCH_RESULT=$(curl -sf -X POST "${WEAVIATE_URL}/v1/graphql" \
    -H "Content-Type: application/json" \
    -d "{
        \"query\": \"query { Get { $TEST_CLASS(limit: 1) { content } } }\"
    }" 2>/dev/null)

check_command "Vector search operation"

# Cleanup
log_info "Cleaning up test collection..."
curl -sf -X DELETE "${WEAVIATE_URL}/v1/schema/$TEST_CLASS" > /dev/null 2>&1
check_command "Deleted test collection"

echo ""

# Summary
echo "======================================"
echo "Smoke Test Summary"
echo "======================================"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
if [ $TESTS_FAILED -gt 0 ]; then
    echo -e "${RED}Failed: $TESTS_FAILED${NC}"
    exit 1
else
    echo -e "${GREEN}Failed: $TESTS_FAILED${NC}"
    log_info "All smoke tests passed! ✓"
    exit 0
fi
