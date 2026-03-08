#!/bin/bash

# setup.sh - Streamlined setup for Engram

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting Engram Setup...${NC}"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Docker is not running or you don't have permission.${NC}"
    echo "Please start Docker and try again."
    exit 1
fi

# Check if .env exists, create if not
if [ ! -f "Engram-Platform/.env" ]; then
    echo -e "${BLUE}📝 Creating .env from .env.example...${NC}"
    cp Engram-Platform/.env.example Engram-Platform/.env
    echo -e "${YELLOW}⚠️  Created Engram-Platform/.env. You will need to add your API keys (Clerk, OpenAI, etc.) manually.${NC}"
else
    echo -e "${GREEN}✅ Engram-Platform/.env already exists.${NC}"
fi

# Domain Configuration
PROD_DOMAIN="https://memory.velocitydigi.com"
echo -e "${BLUE}🌐 Configuration${NC}"
read -p "Do you want to configure this instance for ${PROD_DOMAIN}? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}⚙️  Applying production settings...${NC}"

    # Update NEXT_PUBLIC_APP_URL
    if grep -q "NEXT_PUBLIC_APP_URL=" Engram-Platform/.env; then
        sed -i "s|NEXT_PUBLIC_APP_URL=.*|NEXT_PUBLIC_APP_URL=${PROD_DOMAIN}|" Engram-Platform/.env
    else
        echo "NEXT_PUBLIC_APP_URL=${PROD_DOMAIN}" >> Engram-Platform/.env
    fi

    # Update CORS_ORIGINS
    # We include the prod domain, engram domain, and localhost/tailscale for flexibility
    CORS_VAL="${PROD_DOMAIN},https://engram.velocitydigi.com,http://localhost:3002,http://localhost:3001,http://localhost:3000"
    if grep -q "CORS_ORIGINS=" Engram-Platform/.env; then
        sed -i "s|CORS_ORIGINS=.*|CORS_ORIGINS=${CORS_VAL}|" Engram-Platform/.env
    else
        echo "CORS_ORIGINS=${CORS_VAL}" >> Engram-Platform/.env
    fi

    echo -e "${GREEN}✅ Configured for memory.velocitydigi.com${NC}"
else
    echo -e "${YELLOW}ℹ️  Skipping domain configuration. Using existing .env settings.${NC}"
fi

# Build and Start
echo -e "${BLUE}🐳 Building and starting services...${NC}"
cd Engram-Platform
docker-compose up -d --build

echo -e "${GREEN}✨ Setup complete!${NC}"
echo -e "Check status with: ${BLUE}cd Engram-Platform && docker-compose ps${NC}"
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "Access your instance at: ${BLUE}${PROD_DOMAIN}${NC}"
fi
