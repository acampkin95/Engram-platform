#!/bin/bash
# Block .env files from being committed
if git diff --cached --name-only | grep -E "\.env(\..*)?$"; then
    echo "ERROR: .env files cannot be committed"
    exit 1
fi
