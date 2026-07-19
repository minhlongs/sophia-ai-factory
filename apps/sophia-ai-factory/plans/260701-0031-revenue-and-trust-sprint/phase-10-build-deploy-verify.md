# Phase 10 — Build + Deploy + Verify

**Priority:** P1 | **Status:** pending | **Effort:** 1h | **Depends On:** Phase 09

## Overview

Build, deploy, and verify per CF-direct doctrine. Apply migrations, run full CI gate, deploy, verify SHA match.

## Steps

### Step 1: Apply Migrations

```bash
cd apps/sophia-ai-factory
# Check which migrations are new
git diff --name-only HEAD~1 HEAD apps/sophia-ai-factory/migrations/
# Apply new migrations
bash scripts/apply-migrations.sh
```

New migrations expected:
- `0204_commission_events.sql` — Commission event tracking
- `0205_overage_topup.sql` — Top-up tables
- `0206_refund_events.sql` — Refund event tracking (if needed)

### Step 2: Full CI Gate

```bash
npm run ci  # typecheck + lint + test + secrets + audit
```

Must pass with 0 errors. Expected test count: 6300+ (6250 existing + 50+ new).

### Step 3: Build

```bash
npm run build  # Production build, 0 TypeScript errors required
```

### Step 4: Deploy

```bash
git push origin main
npm run deploy:full
```

### Step 5: Verify SHA Match

```bash
LOCAL_SHA=$(git rev-parse HEAD | cut -c1-8)
LIVE_SHA=$(curl -s https://sophia.agencyos.network/api/version | grep -o '"shortSha":"[^"]*"' | cut -d'"' -f4)
echo "Local: $LOCAL_SHA  Live: $LIVE_SHA"
[ "$LOCAL_SHA" = "$LIVE_SHA" ] && echo "DEPLOY MATCHES COMMIT" || { echo "STALE"; exit 1; }
```

### Step 6: Smoke Test

```bash
# Health check
curl -sI https://sophia.agencyos.network | head -3  # HTTP/2 200

# Critical endpoints
curl -s https://sophia.agencyos.network/api/version  # shortSha match
```

## Success Criteria

- [] All migrations applied successfully
- [] CI gate: typecheck, lint, test, secrets, audit — all pass
- [] Build: 0 TypeScript errors
- [] Deploy: `npm run deploy:full` exit 0
- [] SHA verification: local matches live
- [] HTTP 200 on production
- [] Smoke test: protected flows responsive

## Rollback Plan

```bash
# If SHA mismatch or errors in production:
cd apps/sophia-ai-factory
npx wrangler rollback --name sophia-ai-factory --message "Revenue sprint rollback" --yes
```
