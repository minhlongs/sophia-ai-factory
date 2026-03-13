---
description: 🚀 Deploy AGI RaaS services to production
argument-hint: [target: all|gateway|engine|worker]
---

**Think harder** để deploy RaaS: <target>$ARGUMENTS</target>

**IMPORTANT:** GREEN PRODUCTION RULE — KHÔNG báo DONE khi chưa verify production.

## Deploy Targets

| Target | Service | Deploy Method |
|--------|---------|---------------|
| `gateway` | raas-gateway | `cd apps/raas-gateway && wrangler deploy` |
| `engine` | algo-trader | Docker build → push → restart |
| `worker` | openclaw-worker | PM2 restart on server |
| `all` | Tất cả trên | Sequential: gateway → engine → worker |

## Pre-Deploy Checklist

```bash
# 1. Build MUST pass
pnpm run build --filter=algo-trader

# 2. Tests MUST pass
cd apps/algo-trader && npx vitest run

# 3. No secrets in code
grep -r "API_KEY\|SECRET\|PASSWORD" apps/algo-trader/src/ --include="*.ts" | grep -v ".d.ts" | grep -v "process.env"
```

## Deploy Workflow

### 1. Pre-flight
- Run full build + tests
- Verify no uncommitted changes: `git status`
- Check active branch

### 2. Deploy Gateway (Cloudflare Worker)
```bash
cd apps/raas-gateway
wrangler deploy
# Verify: curl https://raas.agencyos.network/v1/health
```

### 3. Deploy Engine (if applicable)
```bash
# Build Docker image
docker build -t algo-trader:latest apps/algo-trader/
# Push + restart (environment-specific)
```

### 4. Deploy Worker (Tôm Hùm)
```bash
# Restart openclaw daemon
cd apps/openclaw-worker && node task-watcher.js
```

### 5. Post-Deploy Verification
```bash
# Gateway health
curl -sI https://raas.agencyos.network/ | head -3

# Engine health (if remote)
curl -s http://localhost:3000/api/v1/health | jq .

# Report format
echo "Gateway: ✅/❌ | Engine: ✅/❌ | Worker: ✅/❌ | Timestamp: $(date)"
```

## Rollback
- Gateway: `wrangler rollback`
- Engine: redeploy previous Docker tag
- Worker: `git stash && pm2 restart openclaw`
