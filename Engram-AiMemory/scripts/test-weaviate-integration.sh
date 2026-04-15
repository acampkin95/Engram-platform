#!/bin/bash
# Weaviate Integration Test Runner
# Usage: ./scripts/test-weaviate-integration.sh [unit|live|performance|stability|all]

set -e

cd "$(dirname "$0")/.."
TEST_TYPE="${1:-all}"

echo "=========================================="
echo "Weaviate Integration Tests - ${TEST_TYPE}"
echo "=========================================="

export JWT_SECRET="test-secret-key-for-testing-only"
export PYTHONPATH="packages/core/src"

run_unit_tests() {
    echo ""
    echo "Running unit tests (mocked)..."
    python3.11 -m pytest packages/core/tests/test_weaviate_unit.py -v --tb=short
}

run_live_tests() {
    echo ""
    echo "Running live integration tests..."
    if [ -z "$WEAVIATE_URL" ]; then
        echo "WEAVIATE_URL not set. Starting test containers..."
        docker-compose -f docker-compose.test.yml up -d
        sleep 10
        export WEAVIATE_URL="http://localhost:18080"
        export RUN_LIVE_TESTS=1
    fi
    python3.11 -m pytest packages/core/tests/test_weaviate_live.py -v --tb=short
}

run_performance_tests() {
    echo ""
    echo "Running performance benchmarks..."
    python3.11 -m pytest packages/core/tests/test_weaviate_performance.py -v -m benchmark --tb=short
}

run_stability_tests() {
    echo ""
    echo "Running stability tests..."
    python3.11 -m pytest packages/core/tests/test_weaviate_stability.py -v -m stability --tb=short
}

case $TEST_TYPE in
    unit)
        run_unit_tests
        ;;
    live)
        run_live_tests
        ;;
    performance)
        run_performance_tests
        ;;
    stability)
        run_stability_tests
        ;;
    all)
        run_unit_tests
        run_performance_tests
        run_stability_tests
        echo ""
        echo "Note: Live tests skipped. Set WEAVIATE_URL or use 'live' argument."
        ;;
    *)
        echo "Usage: $0 [unit|live|performance|stability|all]"
        exit 1
        ;;
esac

echo ""
echo "=========================================="
echo "Tests complete!"
echo "=========================================="
