---
description: 🐳 Docker Build — Containerize App, Multi-stage Builds, Image Optimization
argument-hint: [--prod|--dev] [--no-cache]
---

**Think harder** để docker build: <$ARGUMENTS>

**IMPORTANT:** Images PHẢI optimized — multi-stage, slim base, layer caching.

## Dockerfile Template

```dockerfile
# === Multi-stage Build ===
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

## Build Commands

```bash
# === Standard Build ===
docker build -t myapp:latest .

# === Production Build ===
docker build -t myapp:1.0.0 --prod .

# === No Cache ===
docker build --no-cache -t myapp:latest .

# === Multi-platform ===
docker buildx build --platform linux/amd64,linux/arm64 -t myapp:latest .

# === With Build Args ===
docker build --build-arg NODE_ENV=production -t myapp:latest .
```

## Image Optimization

```dockerfile
# Use slim base images
FROM node:20-slim

# Layer caching
COPY package*.json ./
RUN npm ci
COPY . .

# Multi-stage to reduce size
FROM golang:1.21 AS builder
COPY . .
RUN go build -o app

FROM alpine:latest
COPY --from=builder /app .
CMD ["./app"]
```

## Docker Compose

```yaml
version: '3.8'
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: production
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    volumes:
      - ./logs:/app/logs
```

## Related Commands

- `/k8s-deploy` — Kubernetes deployment
- `/helm-install` — Helm charts
- `/deploy` — Deploy application
