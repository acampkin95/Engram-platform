# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Stage 2: Runtime
FROM node:20-alpine AS runtime
RUN apk add --no-cache curl
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY hookify/ ./hookify/
COPY templates/ ./templates/
RUN addgroup -S mcpgroup && adduser -S mcpuser -G mcpgroup
USER mcpuser
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1
ENTRYPOINT ["node", "dist/index.js"]
CMD ["--transport", "http"]
