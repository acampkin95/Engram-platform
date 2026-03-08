#!/usr/bin/env python3
import subprocess
import sys

test_groups = {
    "Health": ["tests/test_api.py::TestHealthEndpoints"],
    "Crawl API": ["tests/test_api.py::TestCrawlAPI"],
    "Data API": ["tests/test_api.py::TestDataAPI"],
    "Validation": ["tests/test_api.py::TestValidation"],
    "CORS": ["tests/test_api.py::TestCORS"],
    "Async": ["tests/test_api.py::TestAsyncBehavior"],
    "WebSocket": ["tests/test_websocket.py::TestWebSocket"],
    "WebSocket Errors": ["tests/test_websocket.py::TestWebSocketErrorHandling"],
    "WebSocket Topics": ["tests/test_websocket.py::TestWebSocketTopics"],
}

passed = 0
failed = 0
total = 0

for group, tests in test_groups.items():
    print(f"\n{'=' * 60}")
    print(f"Testing: {group}")
    print("=" * 60)

    for test in tests:
        result = subprocess.run(
            ["python3", "-m", "pytest", test, "-v", "--tb=no"],
            capture_output=True,
            text=True,
        )

        lines = result.stdout.split("\n")
        for line in lines:
            if "passed" in line or "failed" in line:
                parts = line.split()
                for i, part in enumerate(parts):
                    if "passed" in part:
                        p = int(parts[i - 1])
                        passed += p
                        total += p
                    elif "failed" in part:
                        f = int(parts[i - 1])
                        failed += f
                        total += f

print(f"\n{'=' * 60}")
print("SUMMARY")
print("=" * 60)
print(f"Total tests: {total}")
print(f"Passed: {passed}")
print(f"Failed: {failed}")
print(f"Success rate: {(passed / total * 100):.1f}%" if total > 0 else "No tests run")

sys.exit(0 if failed == 0 else 1)
