---
description: 🚀 Deployment Orchestration — Multi-Strategy, Multi-Environment
argument-hint: [strategy: blue-green|canary|rolling|recreate] [environment]
---

**Think harder** để deploy: <strategy>$ARGUMENTS</strategy>

**IMPORTANT:** GREEN PRODUCTION RULE — Verify CI/CD + HTTP 200 trước khi báo DONE.

## Deployment Strategies

| Strategy | Downtime | Risk | Rollback Speed | Best For |
|----------|----------|------|----------------|----------|
| **Blue-Green** | Zero | Low | Instant | Critical apps, zero-downtime req |
| **Canary** | Zero | Low-Med | Fast | Large traffic, gradual rollout |
| **Rolling** | Zero | Medium | Medium | Kubernetes, auto-healing |
| **Recreate** | Yes | High | Slow | Dev/Staging, simple apps |

## Pre-Deploy Checklist

```bash
# 1. Build MUST pass
pnpm run build

# 2. Tests MUST pass (100%)
pnpm test

# 3. Security scan
npm audit --audit-level=high

# 4. No tech debt
grep -r "console\." src --include="*.ts" | wc -l  # = 0
grep -r ": any" src --include="*.ts" | wc -l      # = 0

# 5. Git status clean
git status --short  # Empty = clean
```

## Strategy 1: Blue-Green Deployment

```bash
# === AWS ECS Example ===
# 1. Deploy to Green (inactive)
aws ecs update-service \
  --cluster production \
  --service app-green \
  --task-definition app:latest \
  --desired-count 3

# 2. Wait for Green healthy
aws ecs wait services-stable \
  --cluster production \
  --services app-green

# 3. Health check Green
GREEN_URL=$(aws ecs list-tasks --cluster production --service-name app-green \
  | jq -r '.taskArns[0]' | xargs aws ecs describe-tasks \
  | jq -r '.tasks[0].containers[0].networkBindings[0].containerPort')
curl -sI "http://$GREEN_URL/health" | head -3

# 4. Switch ALB Target Group
aws elbv2 modify-listener \
  --listener-arn arn:aws:elasticloadbalancing:... \
  --default-actions Type=forward,TargetGroupArn=arn:aws:elasticloadbalancing:...:targetgroup/app-green/xxx

# 5. Verify production
curl -sI "https://app.agencyos.network" | head -3

# 6. Stop Blue (old)
aws ecs update-service --cluster production --service app-blue --desired-count 0
```

```bash
# === Vercel Example ===
# 1. Deploy to preview
vercel --preview

# 2. Test preview
PREVIEW_URL=$(vercel --preview | grep "Inspect" | awk '{print $NF}')
curl -sI "$PREVIEW_URL" | head -3

# 3. Promote to production
vercel --prod

# 4. Verify
curl -sI "https://app.agencyos.network" | grep "200"
```

## Strategy 2: Canary Deployment

```bash
# === Kubernetes Canary ===
# 1. Deploy canary (10% traffic)
kubectl apply -f k8s/deployment-canary.yaml
kubectl apply -f k8s/service-canary.yaml

# 2. Set traffic split (Istio)
cat <<EOF | kubectl apply -f -
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: app-canary
spec:
  hosts:
  - app.agencyos.network
  http:
  - route:
    - destination:
        host: app-stable
        subset: v1
      weight: 90
    - destination:
        host: app-canary
        subset: v2
      weight: 10
EOF

# 3. Monitor metrics (5-10 min)
watch kubectl top pods -l app=app-canary
curl -s "https://prometheus.agencyos.network/api/v1/query?query=error_rate{canary='true'}"

# 4. Gradual rollout (if metrics OK)
# Update weights: 10% → 25% → 50% → 100%

# 5. Full rollout or rollback
kubectl rollout status deployment/app-canary
# If failed: kubectl rollout undo deployment/app-canary
```

```yaml
# k8s/deployment-canary.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app-canary
spec:
  replicas: 1
  selector:
    matchLabels:
      app: app
      track: canary
  template:
    metadata:
      labels:
        app: app
        track: canary
        version: v2.0.0
    spec:
      containers:
      - name: app
        image: agencyos/app:v2.0.0
        ports:
        - containerPort: 3000
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 10
```

## Strategy 3: Rolling Deployment

```bash
# === Kubernetes Rolling Update ===
# 1. Update deployment
kubectl set image deployment/app app=agencyos/app:v2.0.0

# 2. Monitor rollout
kubectl rollout status deployment/app --timeout=300s

# 3. Watch pods
kubectl get pods -l app=app -w

# 4. Verify
kubectl exec $(kubectl get pod -l app=app -o jsonpath='{.items[0].metadata.name}') \
  -- curl -s localhost:3000/health | jq .

# 5. Rollback if needed
kubectl rollout undo deployment/app
```

```bash
# === Docker Swarm ===
docker service update \
  --image agencyos/app:v2.0.0 \
  --update-parallelism 1 \
  --update-delay 30s \
  --update-failure-action rollback \
  app-service

# Monitor
docker service ps app-service
```

## Strategy 4: Recreate Deployment

```bash
# === Simple Recreate ===
# 1. Scale down
kubectl scale deployment/app --replicas=0

# 2. Update image
kubectl set image deployment/app app=agencyos/app:v2.0.0

# 3. Scale up
kubectl scale deployment/app --replicas=3

# 4. Wait
kubectl wait --for=condition=available deployment/app --timeout=120s
```

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production

    steps:
    - uses: actions/checkout@v4

    - name: Build
      run: pnpm run build

    - name: Test
      run: pnpm test

    - name: Deploy to Vercel
      run: vercel --prod --token=${{ secrets.VERCEL_TOKEN }}

    - name: Verify Production
      run: |
        HTTP_CODE=$(curl -sI https://app.agencyos.network | head -1 | awk '{print $2}')
        [ "$HTTP_CODE" = "200" ] && echo "✅ GREEN" || exit 1
```

### GitLab CI

```yaml
# .gitlab-ci.yml
stages:
  - build
  - test
  - deploy
  - verify

deploy_production:
  stage: deploy
  script:
    - kubectl set image deployment/app app=$CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
    - kubectl rollout status deployment/app
  environment:
    name: production
    url: https://app.agencyos.network
  only:
    - main

verify_production:
  stage: verify
  script:
    - curl -sI https://app.agencyos.network | grep "200 OK"
  when: on_success
```

## Post-Deploy Verification

```bash
# === Verification Script ===
#!/bin/bash

PROD_URL="https://app.agencyos.network"
MAX_ATTEMPTS=10
ATTEMPT=0

echo "=== Post-Deploy Verification ==="

# 1. HTTP Check
echo "Checking HTTP status..."
HTTP_CODE=$(curl -sI "$PROD_URL" | head -1 | awk '{print $2}')
echo "HTTP Status: $HTTP_CODE"

# 2. Health Endpoint
echo "Checking health endpoint..."
curl -s "$PROD_URL/api/health" | jq .

# 3. CI/CD Status (GitHub)
echo "Checking GitHub Actions..."
gh run list -L 1 --json status,conclusion -q '.[0]'

# 4. Report
if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ DEPLOYMENT SUCCESSFUL"
  echo "Build: ✅ | Tests: ✅ | CI/CD: ✅ | Production: ✅ HTTP $HTTP_CODE"
else
  echo "❌ DEPLOYMENT FAILED - HTTP $HTTP_CODE"
  exit 1
fi
```

## Rollback Procedures

```bash
# === Emergency Rollback ===

# Kubernetes
kubectl rollout undo deployment/app

# Vercel
vercel rollback

# AWS ECS
aws ecs update-service \
  --cluster production \
  --service app \
  --task-definition app:previous-version

# Docker Swarm
docker service rollback app-service
```

## Environment Variables

```bash
# .env.production
NODE_ENV=production
DATABASE_URL=postgresql://prod:...
REDIS_URL=redis://prod:...
SENTRY_DSN=https://...@sentry.io/...
MONITORING_ENABLED=true
LOG_LEVEL=warn
```

## Related Commands

- `/rollback` — Rollback procedures
- `/canary` — Canary deployment management
- `/blue-green` — Blue-green deployment switching
- `/environment-sync` — Environment synchronization
- `/health-check` — System health monitoring
- `/monitor` — Metrics & APM dashboard
