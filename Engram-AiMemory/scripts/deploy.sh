#!/bin/bash
# DEPRECATED: Use ./scripts/deploy-unified.sh from the monorepo root instead.
# This script is retained for reference only.
# To deploy the full stack: ../scripts/deploy-unified.sh deploy
# To deploy memory only:    ../scripts/deploy-unified.sh deploy:memory

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         AI Memory System - Interactive Deploy            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if Docker is running
echo -e "${YELLOW}[1/5]${NC} Checking Docker..."
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}✗ Docker is not running. Please start Docker and try again.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker is running${NC}"

# Check environment file
echo ""
echo -e "${YELLOW}[2/5]${NC} Checking environment configuration..."
if [ ! -f .env ]; then
    echo -e "${YELLOW}! .env file not found. Creating from template...${NC}"
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${GREEN}✓ Created .env from template${NC}"
        echo -e "${YELLOW}! Please edit .env and add your API keys before continuing.${NC}"
        read -p "Press Enter to continue after editing .env..."
    else
        echo -e "${RED}✗ .env.example not found. Please create .env manually.${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✓ .env file exists${NC}"
fi

# Build and start services
echo ""
echo -e "${YELLOW}[3/5]${NC} Building and starting services..."
echo -e "${BLUE}→ This may take a few minutes on first run...${NC}"

docker compose -f docker/docker-compose.yml up -d --build

# Wait for services to be ready
echo ""
echo -e "${YELLOW}[4/5]${NC} Waiting for services to be ready..."

# Check Weaviate
echo -n "  Weaviate: "
for i in {1..30}; do
    if curl -s http://localhost:8080/v1/.well-known/ready > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Ready${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}✗ Timeout${NC}"
    fi
    sleep 2
done

# Check Redis
echo -n "  Redis: "
if docker exec ai-memory-redis redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Ready${NC}"
else
    echo -e "${YELLOW}! May still be starting${NC}"
fi

# Check API
echo -n "  API: "
for i in {1..15}; do
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Ready${NC}"
        break
    fi
    if [ $i -eq 15 ]; then
        echo -e "${YELLOW}! May still be starting${NC}"
    fi
    sleep 1
done

# Final status
echo ""
echo -e "${YELLOW}[5/5]${NC} Deployment complete!"
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    Services Ready                        ║${NC}"
echo -e "${GREEN}╠════════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║  Dashboard:    http://localhost:3001                    ║${NC}"
echo -e "${GREEN}║  API:          http://localhost:8000                    ║${NC}"
echo -e "${GREEN}║  API Docs:     http://localhost:8000/docs               ║${NC}"
echo -e "${GREEN}║  Weaviate:     http://localhost:8080                   ║${NC}"
echo -e "${GREEN}║  Redis:        localhost:6379                          ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "To view logs: ${BLUE}docker compose -f docker/docker-compose.yml logs -f${NC}"
echo -e "To stop:      ${BLUE}docker compose -f docker/docker-compose.yml down${NC}"
