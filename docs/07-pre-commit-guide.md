# Pre-Commit Hooks Guide

**Version:** 1.0 | **Last Updated:** March 2026

---

## Overview

The Engram monorepo uses pre-commit hooks to automatically prevent accidental commits of sensitive data and enforce code quality standards. These hooks run automatically before every `git commit`, protecting against:

- **Environment variables** (`.env` files)
- **API keys and secrets** (hardcoded credentials, private keys, tokens)
- **Sensitive data** (passwords, private keys, authentication tokens)
- **Code quality issues** (formatting, linting, invalid syntax)
- **Large files** (binaries and archives exceeding 1MB)

Pre-commit hooks work by intercepting the git commit process—if any hook fails, the commit is blocked and you must fix the issues before trying again.

---

## Setup (One-time)

### Initial Installation

Run the setup script from the monorepo root:

```bash
cd /path/to/Engram
./setup-pre-commit.sh
```

This automated script will:
- Check Python 3.6+ is installed
- Install the `pre-commit` framework via pip
- Install all hook dependencies (Ruff, Biome, yamllint, etc.)
- Register hooks with git in `.git/hooks/pre-commit`
- Run initial checks on all files in the repository

### Verify Installation

```bash
# Check pre-commit is installed
pre-commit --version

# Verify hooks are registered
pre-commit install --check

# List all configured hooks
cat .pre-commit-config.yaml
```

### Manual Installation (if setup script doesn't work)

```bash
# 1. Install pre-commit framework
python3 -m pip install pre-commit

# 2. Register hooks with git
pre-commit install

# 3. Run initial verification
pre-commit run --all-files
```

---

## How Pre-Commit Hooks Work

When you execute `git commit`, the following sequence occurs:

1. **Git triggers pre-commit hook** - Before creating the commit, git calls `.git/hooks/pre-commit`
2. **Pre-commit framework runs all configured hooks** - Each hook is executed in order
3. **Hooks scan staged changes** - Each hook analyzes files you're trying to commit
4. **Hooks report results**:
   - ✅ **PASS** - Hook found no issues, continue
   - ❌ **FAIL** - Hook detected a problem, block the commit
   - 🔧 **AUTO-FIX** - Hook fixed the issue, re-stage the file and retry

5. **If all hooks pass**, your commit is created
6. **If any hook fails**, your commit is blocked and you must:
   - Fix the issues (manually or by re-running the hook)
   - Stage the corrected files
   - Try `git commit` again

### Hook Execution Order

The hooks are configured in `.pre-commit-config.yaml` in this order:

1. **Detect Secrets** - Scans all files for private keys and sensitive data
2. **Block .env Files** - Prevents `.env*` files from being committed
3. **Block Hardcoded Secrets** - Detects hardcoded credentials in code
4. **Check Added Large Files** - Prevents files >1MB from being committed
5. **Check YAML/JSON/TOML Syntax** - Validates configuration file syntax
6. **Ruff (Python)** - Linting and auto-formatting for Python files
7. **Biome (TypeScript/JavaScript)** - Linting and auto-formatting for JS/TS files
8. **yamllint** - Lints YAML files for style and syntax
9. **markdownlint** - Lints Markdown files
10. **Trailing Whitespace** - Removes trailing spaces
11. **End of File Fixer** - Ensures files end with newline
12. **Mixed Line Ending** - Normalizes line endings

---

## Hooks Reference

### Detection & Blocking Hooks

| Hook | Purpose | Scope | Action |
|------|---------|-------|--------|
| **detect-secrets** | Scans for private keys, API keys, and sensitive data | All file types | ❌ BLOCKS commit if secrets detected |
| **block-env-files** | Prevents `.env` files from being committed | `.env`, `.env.*` | ❌ BLOCKS if staged |
| **block-hardcoded-secrets** | Detects hardcoded API keys, passwords, tokens | Source code | ⚠️ WARNS if found |
| **check-added-large-files** | Prevents giant files (>1MB) from being committed | All files | ❌ BLOCKS if exceeds limit |

### File Validation Hooks

| Hook | Purpose | Scope | Action |
|------|---------|-------|--------|
| **check-yaml** | Validates YAML syntax | `.yaml`, `.yml` | ❌ BLOCKS if invalid |
| **check-json** | Validates JSON syntax | `.json` | ❌ BLOCKS if invalid |
| **check-toml** | Validates TOML syntax | `.toml` | ❌ BLOCKS if invalid |

### Code Quality Hooks

| Hook | Purpose | Language | Action |
|------|---------|----------|--------|
| **Ruff** | Fast linting and formatting | Python | 🔧 AUTO-FIX issues, ❌ BLOCK if unfixable |
| **Biome** | Linting and formatting | JavaScript, TypeScript, JSON | 🔧 AUTO-FIX issues, ❌ BLOCK if unfixable |
| **yamllint** | YAML style and syntax checking | YAML | ❌ BLOCKS if issues found |
| **markdownlint** | Markdown style checking | Markdown | 🔧 AUTO-FIX, ❌ BLOCK if unfixable |

### Formatting Hooks

| Hook | Purpose | Action |
|------|---------|--------|
| **trailing-whitespace** | Removes trailing spaces from lines | 🔧 AUTO-FIX |
| **end-of-file-fixer** | Ensures files end with exactly one newline | 🔧 AUTO-FIX |
| **mixed-line-ending** | Normalizes line endings (LF vs CRLF) | 🔧 AUTO-FIX |

---

## Common Scenarios

### Scenario 1: Trying to Commit a .env File

```bash
# Create a test .env file
echo "API_KEY=secret123" > .env

# Try to commit it
git add .env
git commit -m "Add environment config"

# Result: BLOCKED ❌
# ERROR: .env files cannot be committed (hook: block-env-files)
```

**Solution**: Use `.env.example` instead:

```bash
# Create a template with placeholder values
echo "API_KEY=your_api_key_here" > .env.example
echo "DATABASE_URL=postgresql://user:password@localhost/db" >> .env.example

# Commit the example file
git add .env.example
git commit -m "Add .env.example template"

# Developers copy it locally (not committed)
cp .env.example .env
```

### Scenario 2: Hardcoded API Key in Code

```python
# ❌ BAD - Will be blocked by detect-secrets
API_KEY = "sk-1234567890abcdef"
response = requests.get(f"https://api.example.com?key={API_KEY}")
```

**Solution**: Use environment variables:

```python
# ✓ GOOD - Will pass hooks
import os
API_KEY = os.getenv("API_KEY")
response = requests.get(f"https://api.example.com?key={API_KEY}")
```

### Scenario 3: Code Formatting Issues

```bash
# Your Python code has formatting issues (inconsistent spacing, line too long, etc.)
git add src/main.py
git commit -m "Add new feature"

# Result: BLOCKED ❌ by Ruff
# Ruff will auto-fix the formatting issues
# Check the changes
git diff src/main.py

# If satisfied with auto-fixes, re-stage and commit
git add src/main.py
git commit -m "Add new feature"

# Result: PASSED ✅
```

### Scenario 4: Invalid YAML/JSON Syntax

```bash
# Your YAML has syntax errors
git add config.yaml
git commit -m "Update config"

# Result: BLOCKED ❌ by check-yaml
# ERROR: Invalid YAML syntax at line 5
# Fix the YAML syntax manually
vim config.yaml

# Re-stage and commit
git add config.yaml
git commit -m "Update config"

# Result: PASSED ✅
```

### Scenario 5: Large Binary File

```bash
# Try to commit a large binary file (e.g., video, compressed archive)
git add large-video.mp4  # 500MB file
git commit -m "Add demo video"

# Result: BLOCKED ❌ by check-added-large-files
# ERROR: File exceeds maximum size of 1000 KB
# Solution: Use Git LFS for large files, or store externally
```

---

## Quick Reference

### Manual Hook Execution

```bash
# Run ALL hooks on ALL files
pre-commit run --all-files

# Run ALL hooks on STAGED files only (this is what runs on commit)
pre-commit run

# Run SPECIFIC hook on all files
pre-commit run block-env-files --all-files
pre-commit run ruff --all-files
pre-commit run biome-check --all-files

# Run hooks with verbose output to see details
pre-commit run --all-files --verbose
```

### Update Hooks

```bash
# Update all hooks to their latest versions
pre-commit autoupdate

# This updates .pre-commit-config.yaml with the latest hook versions
# Review the changes before committing
git diff .pre-commit-config.yaml

# Commit the updated configuration
git add .pre-commit-config.yaml
git commit -m "chore: update pre-commit hooks"
```

### Reinstall Hooks

```bash
# Reinstall hooks in .git/hooks/
pre-commit install

# Useful if hooks stop running or you've updated .pre-commit-config.yaml
```

### Bypass Hooks (⚠️ NOT RECOMMENDED)

```bash
# Skip ALL pre-commit hooks for this commit only
git commit --no-verify

# This bypasses ALL safety checks - use only if absolutely necessary
# Risks: accidental commits of secrets, formatting issues, etc.
```

### Skip a Specific Hook

If a particular hook is problematic, you can temporarily disable it:

```bash
# 1. Edit .pre-commit-config.yaml
vim .pre-commit-config.yaml

# 2. Add "stages: [manual]" to the hook you want to skip:
# - id: some-hook
#   stages: [manual]    # This hook only runs with: pre-commit run -k some-hook

# 3. Reinstall hooks
pre-commit install

# 4. Now the hook only runs when explicitly requested
pre-commit run some-hook --all-files
```

---

## Troubleshooting

### Issue: "pre-commit: command not found"

The `pre-commit` framework is not installed.

**Solution:**
```bash
python3 -m pip install pre-commit
pre-commit install
```

### Issue: Hooks are not running on commit

Hooks may not be registered with git.

**Solution:**
```bash
# Reinstall hooks
pre-commit install

# Verify they're installed
pre-commit install --check
```

### Issue: "detect-secrets: command not found"

The `detect-secrets` package is not available.

**Solution:**
```bash
python3 -m pip install detect-secrets
pre-commit run detect-secrets --all-files
```

### Issue: Biome hook fails with "command not found"

Biome is not installed globally.

**Solution:**
```bash
# Option A: Install Biome globally
npm install -g @biomejs/biome

# Option B: Run pre-commit which uses bundled Biome
pre-commit run biome-check --all-files
```

### Issue: Hook is too strict and blocking valid code

Some hooks may have strict configurations.

**Solution:**
```bash
# 1. Check the hook configuration in .pre-commit-config.yaml
cat .pre-commit-config.yaml

# 2. Adjust arguments if needed. Example: increase file size limit:
# - id: check-added-large-files
#   args: ['--maxkb=2000']  # Increase from 1000 to 2000 KB

# 3. Reinstall hooks
pre-commit install

# 4. Test the change
pre-commit run --all-files
```

### Issue: Hook auto-fixes conflict with my IDE formatter

Hooks may reformat code differently than your IDE.

**Solution:**
1. **Review hook output** - See what the hook changed:
   ```bash
   git diff
   ```

2. **Update your IDE settings** - Configure your IDE to use the same formatter settings as the hooks (Ruff, Biome, yamllint)

3. **Run hooks before committing** - Prevent conflicts:
   ```bash
   pre-commit run --all-files
   git add .
   git commit -m "Auto-format with pre-commit hooks"
   ```

### Issue: Secrets hook has false positives

Sometimes `detect-secrets` flags legitimate code as secrets.

**Solution:**
```bash
# 1. Let the hook generate a baseline
detect-secrets scan > .secrets.baseline

# 2. Review and approve detected items
detect-secrets audit .secrets.baseline

# 3. Update the hook configuration to use the baseline:
# In .pre-commit-config.yaml, add to detect-secrets hook:
#   args: ['--baseline', '.secrets.baseline']

# 4. Reinstall
pre-commit install
```

---

## Best Practices

### 1. Use `.env.example` for Templates

Never commit actual `.env` files. Instead, create a template:

```bash
# Create a template with placeholder values
cat > .env.example << EOF
# Database Configuration
DATABASE_URL=postgresql://user:password@localhost/db
DATABASE_POOL_SIZE=10

# API Configuration
API_KEY=your_api_key_here
API_SECRET=your_secret_here

# Feature Flags
DEBUG=false
ENABLE_ANALYTICS=true
EOF

# Commit the template
git add .env.example
git commit -m "Add .env.example template"

# Developers copy it locally (not committed)
cp .env.example .env
# Then edit .env with real values
```

### 2. Use Environment Variables in Code

Always use environment variables, never hardcode secrets:

```python
# ✓ GOOD
import os
database_url = os.getenv("DATABASE_URL")
api_key = os.getenv("API_KEY")
```

```javascript
// ✓ GOOD
const databaseUrl = process.env.DATABASE_URL;
const apiKey = process.env.API_KEY;
```

### 3. Use Secrets Management Tools for Production

For production deployments, use proper secrets management:

- **AWS**: AWS Secrets Manager, Parameter Store
- **Azure**: Azure Key Vault
- **GCP**: Google Cloud Secret Manager
- **Local/Self-Hosted**: HashiCorp Vault, 1Password, Bitwarden

### 4. Review Pre-commit Output

Always review what hooks change:

```bash
# See what hooks modified
git diff

# If satisfied, stage and commit
git add .
git commit -m "Your message"

# If not satisfied, revert changes
git checkout -- .
```

### 5. Keep Hooks Updated Quarterly

```bash
# Update all hooks to latest versions
pre-commit autoupdate

# Review changes
git diff .pre-commit-config.yaml

# Commit updates
git add .pre-commit-config.yaml
git commit -m "chore: update pre-commit hooks to latest versions"
```

### 6. Never Bypass Hooks in Production

The `--no-verify` flag bypasses all safety checks. Never use it for production code.

```bash
# ❌ NEVER DO THIS in production
git commit --no-verify

# ✓ Instead, fix the underlying issue
# Then commit normally
git commit -m "your message"
```

---

## For CI/CD Integration

To run pre-commit checks in CI/CD pipelines:

### GitHub Actions

```yaml
name: Pre-commit Checks
on: [push, pull_request]

jobs:
  pre-commit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - uses: pre-commit/action@v3.0.0
```

### GitLab CI

```yaml
pre-commit:
  image: python:3.11
  script:
    - pip install pre-commit
    - pre-commit run --all-files
```

### Local CI Testing

```bash
# Simulate CI by running all hooks on all files
pre-commit run --all-files

# Exit code 0 = all pass, non-zero = failure
```

---

## Configuration Files

### `.pre-commit-config.yaml`

Main configuration file listing all hooks:

```yaml
# Located at: /Engram/.pre-commit-config.yaml
# Edit to add/remove hooks or change hook settings
repos:
  - repo: https://github.com/Yelp/detect-secrets
    # ... hook definitions ...
```

### `.gitignore`

Prevents tracked files from being committed:

```
# Located at: /Engram/.gitignore
# Patterns: *.env, *.env.*, IDE files, build artifacts, etc.
```

### `.pre-commit-hooks/`

Custom hook scripts:

```
/Engram/.pre-commit-hooks/
├── block-env-files.sh      # Blocks .env files
└── block-secrets.sh        # Detects hardcoded secrets
```

---

## Additional Resources

### Official Documentation

- **Pre-commit Framework**: https://pre-commit.com/
- **Detect Secrets**: https://github.com/Yelp/detect-secrets
- **Ruff**: https://github.com/astral-sh/ruff
- **Biome**: https://biomejs.dev/
- **yamllint**: https://github.com/adrienverge/yamllint

### Related Guides

- **Git Basics**: https://git-scm.com/doc
- **Secrets Management**: https://www.vaultproject.io/
- **GitHub Actions**: https://docs.github.com/en/actions

---

## Support & Questions

If you encounter issues with pre-commit hooks:

1. **Check this guide** - Troubleshooting section above
2. **Run with verbose output** - `pre-commit run --all-files --verbose`
3. **Review hook config** - Check `.pre-commit-config.yaml`
4. **Check tool docs** - Ruff, Biome, yamllint, etc.
5. **Review git logs** - See previous hook failures: `git log --all --grep="pre-commit"`

---

## Document Control

| Field | Value |
|-------|-------|
| **Status** | Active |
| **Version** | 1.0 |
| **Last Updated** | March 2026 |
| **Maintained By** | Engram Development Team |
| **Next Review** | September 2026 |
