.PHONY: help dev build test lint format docker-up docker-down docker-logs deploy clean

PYTHON ?= python3.11
# Local dev only. Override via environment or .env in CI/production.
JWT_SECRET ?= local-dev-jwt-secret-0123456789abcdef0123456789abcdef

help:  ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

dev:  ## Start memory API in development mode
	JWT_SECRET=$(JWT_SECRET) $(PYTHON) -m memory_system.api

build:  ## Build CLI package
	npm run build

test:  ## Run all tests (Python)
	JWT_SECRET=$(JWT_SECRET) $(PYTHON) -m pytest packages/core/tests/ -v --no-header

test-python:  ## Run Python tests only
	JWT_SECRET=$(JWT_SECRET) $(PYTHON) -m pytest packages/core/tests/ -v --no-header

lint:  ## Run all linters (ruff + biome + mypy)
	ruff check packages/core/src/memory_system/
	npx biome check packages/cli/src
	mypy packages/core/src/memory_system/api.py --ignore-missing-imports || true

lint-fix:  ## Auto-fix lint issues
	ruff check packages/core/src/memory_system/ --fix
	npx biome check packages/cli/src --fix

format:  ## Format all code
	ruff format packages/core/src/memory_system/
	npx biome format . --write

docker-up:  ## Start Docker development stack
	docker compose -f docker/docker-compose.yml up -d

docker-down:  ## Stop Docker development stack
	docker compose -f docker/docker-compose.yml down

docker-logs:  ## Tail Docker logs
	docker compose -f docker/docker-compose.yml logs -f

docker-prod-up:  ## Start Docker production stack
	docker compose -f docker/docker-compose.prod.yml up -d

docker-prod-down:  ## Stop Docker production stack
	docker compose -f docker/docker-compose.prod.yml down

deploy:  ## Run deployment script
	bash scripts/deploy.sh

clean:  ## Remove build artifacts
	rm -rf packages/cli/dist
	find . -type d -name __pycache__ -not -path "./.venv/*" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name htmlcov -exec rm -rf {} + 2>/dev/null || true

install:  ## Install all dependencies
	$(PYTHON) -m pip install -e ".[dev]"
	npm ci

health:  ## Check system health
	bash scripts/healthcheck.sh

test-coverage:  ## Run tests with coverage report
	JWT_SECRET=$(JWT_SECRET) $(PYTHON) -m pytest packages/core/tests/ -v --cov=packages/core/src --cov-report=term-missing --cov-fail-under=80
