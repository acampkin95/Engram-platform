"""
Docker configuration for Dark Web OSINT addon.

This module provides Docker Compose configuration with Tor service.
"""

from pathlib import Path


# Docker Compose configuration with Tor service
DOCKER_COMPOSE_TOR = """
version: '3.8'

services:
  # Tor proxy service
  tor:
    image: dperson/torproxy
    container_name: crawl4ai-tor
    restart: unless-stopped
    ports:
      - "9050:9050"   # SOCKS proxy
      - "9051:9051"   # Control port
    environment:
      - TOR_MAX_MEM=512M
    networks:
      - crawl4ai-network
    healthcheck:
      test: ["CMD", "curl", "-x", "socks5h://127.0.0.1:9050", "https://check.torproject.org/"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

  # Crawl4AI with Dark Web OSINT addon
  crawl4ai:
    build:
      context: .
      dockerfile: Dockerfile
      target: production
    image: crawl4ai-osint:latest
    container_name: crawl4ai-osint
    restart: unless-stopped
    ports:
      - "11235:11235"
    volumes:
      - ./data/cache:/app/data/cache
      - ./data/logs:/app/data/logs
      - ./data/chroma:/app/data/chroma
      - ./addons:/app/addons:ro
      - ./config.yml:/app/config.yml:ro
    environment:
      - PYTHONUNBUFFERED=1
      - LOG_LEVEL=INFO
      # Dark Web OSINT Configuration
      - DARKWEB_TOR_PROXY_HOST=tor
      - DARKWEB_TOR_PROXY_PORT=9050
      - DARKWEB_LLM_PROVIDER=lmstudio
      - DARKWEB_LLM_MODEL=glm-5
      - DARKWEB_LLM_BASE_URL=http://host.docker.internal:1234/v1
      # Existing config
      - LM_STUDIO_URL=http://host.docker.internal:1234/v1
      - REDIS_URL=redis://redis:6379/0
    extra_hosts:
      - "host.docker.internal:host-gateway"
    shm_size: 3g
    depends_on:
      tor:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - crawl4ai-network
    healthcheck:
      test: ["CMD", "/app/scripts/healthcheck.sh"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s

  redis:
    image: redis:7-alpine
    container_name: crawl4ai-redis
    restart: unless-stopped
    volumes:
      - ./data/redis:/data
    command: redis-server --appendonly yes --maxmemory 512mb --maxmemory-policy allkeys-lru
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - crawl4ai-network

networks:
  crawl4ai-network:
    driver: bridge

volumes:
  crawl4ai-data:
  crawl4ai-redis:
"""


# Standalone Tor-only compose (for existing Crawl4AI)
DOCKER_COMPOSE_TOR_ONLY = """
version: '3.8'

services:
  tor:
    image: dperson/torproxy
    container_name: crawl4ai-tor
    restart: unless-stopped
    ports:
      - "9050:9050"
      - "9051:9051"
    environment:
      - TOR_MAX_MEM=512M
    healthcheck:
      test: ["CMD", "curl", "-x", "socks5h://127.0.0.1:9050", "https://check.torproject.org/"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - crawl4ai-network

networks:
  crawl4ai-network:
    external: true
"""


# Dockerfile snippet for addon dependencies
DOCKERFILE_ADDON_DEPS = """
# Install Dark Web OSINT addon dependencies
RUN pip install --no-cache-dir \
    requests[socks]>=2.31.0 \
    aiohttp>=3.9.0 \
    beautifulsoup4>=4.12.0 \
    tenacity>=8.2.0 \
    httpx>=0.25.0

# Optional: Install stem for Tor control
# RUN pip install --no-cache-dir stem>=1.8.0
"""


def generate_docker_compose(output_path: Path, include_full_stack: bool = True) -> None:
    """
    Generate Docker Compose file with Tor support.

    Args:
        output_path: Path to write docker-compose.yml
        include_full_stack: Include full Crawl4AI stack or just Tor
    """
    content = DOCKER_COMPOSE_TOR if include_full_stack else DOCKER_COMPOSE_TOR_ONLY

    with open(output_path, "w") as f:
        f.write(content.strip())

    print(f"Generated: {output_path}")


def generate_dockerfile_addon(output_dir: Path) -> None:
    """
    Generate Dockerfile snippet for addon dependencies.

    Args:
        output_dir: Directory to write the snippet
    """
    snippet_path = output_dir / "Dockerfile.addon"

    with open(snippet_path, "w") as f:
        f.write(DOCKERFILE_ADDON_DEPS.strip())

    print(f"Generated: {snippet_path}")


# CLI entry point
if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Docker configuration generator")
    parser.add_argument(
        "--compose", action="store_true", help="Generate docker-compose.yml"
    )
    parser.add_argument(
        "--tor-only", action="store_true", help="Generate Tor-only compose"
    )
    parser.add_argument(
        "--dockerfile", action="store_true", help="Generate Dockerfile snippet"
    )
    parser.add_argument("--output", default=".", help="Output directory")

    args = parser.parse_args()

    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    if args.compose:
        generate_docker_compose(
            output_dir / "docker-compose.darkweb.yml",
            include_full_stack=not args.tor_only,
        )

    if args.dockerfile:
        generate_dockerfile_addon(output_dir)

    if not (args.compose or args.dockerfile):
        parser.print_help()
