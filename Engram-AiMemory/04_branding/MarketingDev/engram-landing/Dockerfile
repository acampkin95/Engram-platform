FROM node:20-alpine AS builder
WORKDIR /app
COPY Engram-AiMemory/04_branding/MarketingDev/engram-landing/package*.json ./
RUN npm ci
COPY Engram-AiMemory/04_branding/MarketingDev/engram-landing ./
RUN npm run build

FROM nginx:1.27-alpine AS runner
COPY Engram-AiMemory/04_branding/MarketingDev/engram-landing/nginx.static.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/out /usr/share/nginx/html
EXPOSE 3099
CMD ["nginx", "-g", "daemon off;"]
