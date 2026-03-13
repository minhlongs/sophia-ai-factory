---
description: ↩️ Rollback Procedures — Emergency Revert, Zero-Downtime Recovery
argument-hint: [target: service|deployment|commit] [version]
---

**Think harder** để rollback: <target>$ARGUMENTS</target>

**IMPORTANT:** Rollback PHẢI nhanh hơn fix — ưu tiên khôi phục service trước, debug sau.

## Rollback Strategies

| Strategy | Speed | Risk | When to Use |
|----------|-------|------|-------------|
| **Immediate Rollback** | < 1 min | Low | Critical bugs, security vulns |
| **Gradual Rollback** | 5-10 min | Low-Med | Non-critical, data migration issues |
| **Hotfix Forward** | 10-30 min | Medium | Simple fixes, rollback not possible |
| **Data Rollback** | 30+ min | High | Schema changes, data corruption |

## Pre-Rollback Checklist

```bash
# 1. Identify the issue
kubectl logs -l app=app --tail=100 | grep -i error
sentry-cli releases list | head -10

# 2. Find last known good version
git log --oneline -10
kubectl rollout history deployment/app

# 3. Notify team
echo "🚨 ROLLBACK ALERT: Rolling back to v1.2.3 due to [issue]" | slack-cli -c '#incidents'

# 4. Document start time
echo "Rollback started: $(date)" >> rollback-log.md
```

## Kubernetes Rollback

```bash
# === Quick Rollback (1 command) ===
kubectl rollout undo deployment/app

# === Rollback to Specific Revision ===
# 1. Check history
kubectl rollout history deployment/app

# Output:
# deployment.apps/app
# REVISION  CHANGE-CAUSE
# 1         Initial deployment
# 2         Update to v2.0.0
# 3         Update to v2.1.0 (broken)

# 2. Rollback to revision 2
kubectl rollout undo deployment/app --to-revision=2

# 3. Monitor
kubectl rollout status deployment/app --timeout=120s

# 4. Verify pods
kubectl get pods -l app=app -w

# 5. Check logs
kubectl logs -l app=app --tail=50 | grep -i "started\|ready"
```

```bash
# === Rollback with Data Migration Revert ===
# 1. Scale down app
kubectl scale deployment/app --replicas=0

# 2. Revert database migration
rails db:rollback STEP=1
# Or
prisma migrate resolve --rolled-back "20240101000000_migration_name"

# 3. Scale up with old version
kubectl set image deployment/app app=agencyos/app:v1.2.3
kubectl scale deployment/app --replicas=3

# 4. Wait for ready
kubectl wait --for=condition=available deployment/app --timeout=120s
```

## Vercel Rollback

```bash
# === Rollback to Previous Deployment ===
# 1. List deployments
vercel ls --all

# Output:
# ┌──────┬─────────────────────┬──────────────┬─────────┬──────────┬──────────────┐
# │ Name │ Deployment URL      │ Version      │ Status  │ Created  │ Git Branch   │
# ├──────┼─────────────────────┼──────────────┼─────────┼──────────┼──────────────┤
# │ app  │ app-abc123.vercel.app │ v2.1.0      │ ERROR   │ now      │ main         │
# │ app  │ app-xyz789.vercel.app │ v1.2.3      │ READY   │ 2h ago   │ main         │
# └──────┴─────────────────────┴──────────────┴─────────┴──────────┴──────────────┘

# 2. Promote previous to production
vercel promote xyz789 --prod

# 3. Verify
curl -sI https://app.agencyos.network | head -3
```

```bash
# === Rollback via Dashboard API ===
curl -X POST "https://api.vercel.com/v13/deployments/[DEPLOYMENT_ID]/promote" \
  -H "Authorization: Bearer $VERCEL_TOKEN"
```

## AWS ECS Rollback

```bash
# === Rollback to Previous Task Definition ===
# 1. List task definitions
aws ecs list-task-definitions --family app --sort DESC | head -10

# 2. Describe previous (v1.2.3)
aws ecs describe-task-definition --task-definition app:123

# 3. Update service
aws ecs update-service \
  --cluster production \
  --service app \
  --task-definition app:123 \
  --desired-count 3

# 4. Wait for stable
aws ecs wait services-stable \
  --cluster production \
  --services app

# 5. Verify health
TASK_ARN=$(aws ecs list-tasks --cluster production --service-name app \
  --query 'taskArns[0]' --output text)
aws ecs describe-tasks --cluster production --tasks $TASK_ARN \
  --query 'tasks[0].containers[0].lastStatus'
```

## Docker Swarm Rollback

```bash
# === Automatic Rollback ===
# If --update-failure-action rollback was set
docker service update app-service --image agencyos/app:v2.1.0
# On failure, auto-rollbacks

# === Manual Rollback ===
docker service rollback app-service

# === Manual to Specific Version ===
# 1. List versions
docker service ps app-service --format "{{.Name}}@{{.Node}}" --filter "desired-state=running"

# 2. Rollback
docker service update \
  --image agencyos/app:v1.2.3 \
  --rollback-order start-first \
  app-service
```

## Database Rollback

```bash
# === Prisma Rollback ===
# 1. Check migration history
npx prisma migrate status

# 2. Rollback one migration
npx prisma migrate resolve --rolled-back "20240101000000_add_user_table"

# 3. Or reset and apply from scratch
npx prisma migrate reset --force

# 4. Verify
npx prisma db pull
```

```bash
# === Rails ActiveRecord Rollback ===
# 1. Rollback last migration
rails db:rollback

# 2. Rollback specific number
rails db:rollback STEP=3

# 3. Rollback to specific version
rails db:migrate:down VERSION=20240101000000

# 4. Reset database (nuclear option)
rails db:drop db:create db:migrate
```

```sql
-- === Manual SQL Rollback ===
-- 1. Find backup point
SELECT * FROM pg_stat_activity WHERE state = 'idle';

-- 2. Restore from backup
pg_restore -d app_production -1 -v backup_20240101.sql

-- 3. Or point-in-time recovery
-- (Requires WAL archiving enabled)
-- Restore base backup + replay WAL to specific timestamp
```

## Emergency Rollback Script

```bash
#!/bin/bash
# emergency-rollback.sh

set -e

# Config
SERVICE_NAME="${1:-app}"
TARGET_VERSION="${2:-last-known-good}"
CLUSTER="${3:-production}"

echo "🚨 EMERGENCY ROLLBACK INITIATED"
echo "Service: $SERVICE_NAME"
echo "Target: $TARGET_VERSION"
echo "Cluster: $CLUSTER"
echo "Time: $(date)"

# Notify
slack-cli -c '#incidents' -m "🚨 Rolling back $SERVICE_NAME to $TARGET_VERSION"

# Kubernetes rollback
echo "Starting Kubernetes rollback..."
kubectl rollout undo deployment/$SERVICE_NAME --to-revision=$TARGET_VERSION
kubectl rollout status deployment/$SERVICE_NAME --timeout=180s

# Verify
echo "Verifying deployment..."
READY=$(kubectl get deployment/$SERVICE_NAME -o jsonpath='{.status.readyReplicas}')
DESIRED=$(kubectl get deployment/$SERVICE_NAME -o jsonpath='{.spec.replicas}')

if [ "$READY" = "$DESIRED" ]; then
  echo "✅ ROLLBACK SUCCESSFUL"
  slack-cli -c '#incidents' -m "✅ Rollback complete: $SERVICE_NAME → $TARGET_VERSION"
else
  echo "❌ ROLLBACK FAILED - $READY/$DESIRED ready"
  slack-cli -c '#incidents' -m "❌ Rollback failed: $READY/$DESIRED ready"
  exit 1
fi

# Post-rollback checks
echo "Running post-rollback checks..."
curl -sI https://$SERVICE_NAME.agencyos.network | head -1
curl -s https://$SERVICE_NAME.agencyos.network/health | jq .

echo "Rollback completed: $(date)"
```

## Rollback Decision Tree

```
Incident Detected
       │
       ▼
┌──────────────────────┐
│ Severity Assessment  │
└──────────────────────┘
       │
   ┌───┴───┐
   │       │
Critical  Minor
   │       │
   ▼       ▼
┌─────┐ ┌──────────┐
│Imme-│ │Gradual   │
│diate│ │Rollback  │
└─────┘ └──────────┘
   │       │
   ▼       ▼
┌──────────────┐
│Post-Rollback │
│Verification  │
└──────────────┘
       │
   ┌───┴───┐
   │       │
 Success  Failed
   │       │
   ▼       ▼
┌─────┐ ┌──────────┐
│Done │ │Hotfix    │
│     │ │Forward   │
└─────┘ └──────────┘
```

## Post-Rollback Actions

```bash
# 1. Document incident
cat >> rollback-log.md << EOF

## Rollback $(date +%Y-%m-%d)
- Service: app
- From: v2.1.0
- To: v1.2.3
- Reason: [Fill in]
- Duration: [Fill in]
- Impact: [Fill in]
EOF

# 2. Create bug ticket
gh issue create \
  --title "Bug: v2.1.0 caused [issue] - rolled back to v1.2.3" \
  --body "### Impact\n### Root Cause\n### Fix Plan" \
  --label "bug,critical"

# 3. Schedule post-mortem
echo "Post-mortem scheduled for $(date -d '+1 day' +%Y-%m-%d)" | cal-cli

# 4. Freeze deployments
echo "Deployment freeze until post-mortem complete" | slack-cli -c '#engineering'
```

## Related Commands

- `/deploy` — Deployment orchestration
- `/canary` — Canary deployment management
- `/blue-green` — Blue-green deployment switching
- `/environment-sync` — Environment synchronization
- `/health-check` — System health monitoring
