#!/bin/bash
# Block hardcoded secrets from being committed
git diff --cached -U0 | grep -E "(api[_-]?key|password|secret|token|auth|credential)" -i && {
    echo "ERROR: Potential hardcoded secret detected"
    exit 1
} || true
