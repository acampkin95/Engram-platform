# Multi-stage Dockerfile for Crawl4AI OSINT Container
# Stage 1: Base Python image with dependencies
FROM python:3.11.9-slim as base

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    DEBIAN_FRONTEND=noninteractive \
    PLAYWRIGHT_BROWSERS_PATH=/app/browsers

# Install system dependencies (includes cmake + dlib build deps for face_recognition)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    curl \
    git \
    libopenblas-dev \
    liblapack-dev \
    libx11-dev \
    pkg-config \
    libnss3 \
    libnspr4 \
    libdbus-1-3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    fonts-liberation \
    xdg-utils \
    redis-tools \
    supervisor \
    && rm -rf /var/lib/apt/lists/*
# Stage 2: Python dependencies
FROM base as python-deps

WORKDIR /app

# Create non-root user for production (with home directory for crawl4ai DB)
RUN groupadd -r appuser && useradd -r -g appuser -m appuser

COPY requirements.txt requirements-face.txt ./

RUN pip install --upgrade pip setuptools wheel && \
    pip install -r requirements.txt && \
    pip install -r requirements-face.txt && \
    pip install python-multipart && \
    playwright install --with-deps chromium

# Stage 3: Production image
FROM python-deps as production

# Copy application code
COPY . .

RUN mkdir -p /app/data/cache /app/data/logs /app/data/tiers/{hot,warm,cold,archive} \
    /app/data/chroma /app/data/face_references /var/log/supervisor

# Set proper permissions (includes /app/browsers for Playwright)
RUN chmod -R 755 /app/data /var/log/supervisor && \
    chown -R appuser:appuser /app /var/log/supervisor

# Copy configuration files
COPY config.yml /app/config.yml
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY scripts/start.sh /app/scripts/start.sh
COPY scripts/healthcheck.sh /app/scripts/healthcheck.sh

# Make scripts executable
RUN chmod +x /app/scripts/start.sh /app/scripts/healthcheck.sh

# Expose ports
# 11235: Crawl4AI API
# 6379: Redis (internal)
# 80: Nginx
EXPOSE 11235 6379 80

# Set shared memory size (required for Chromium)
VOLUME ["/dev/shm"]

# Switch to non-root user
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD /app/scripts/healthcheck.sh || exit 1

# Start supervisord
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
