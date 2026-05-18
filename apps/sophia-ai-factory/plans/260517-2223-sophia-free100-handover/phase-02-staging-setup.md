# Phase 02 — Staging Worker + D1 Setup

## Context Links
- Brainstorm: [reports/brainstorm.md](reports/brainstorm.md) §9 Q1 (staging missing)
- Wrangler config: `apps/sophia-ai-factory/wrangler.toml`
- Migrations: `apps/sophia-ai-factory/migrations/*.sql` (113 files)
- Deploy script: `apps/sophia-ai-factory/scripts/deploy-with-sha.sh`

## Overview
- **Priority:** P0 (blocker for pen test 05, DR drill 07, load test 08)
- **Status:** ✅ completed 2026-05-18 06:58 PT
- **Duration:** 1 day (D2) ✅
- **Brief:** Staging Worker `sophia-ai-factory-staging` live + D1 `sophia-raas-db-staging` deployed with 117 tables (schema parity). 4 secrets wired (2 auto-gen, 2 NOWPayments placeholders).

## Key Insights
- Staging does NOT exist (verified curl empty per brainstorm Q1).
- Only `wrangler.toml` `preview_id` exists — no Worker route, no Worker deployed.
- Need separate D1 instance because pen test will write hostile inputs.
- Acceptable to deploy to `*.workers.dev` subdomain (no custom DNS needed for internal staging).

## Requirements
**Functional:**
- Separate `wrangler.staging.toml` config
- Separate D1 instance with full migration history
- Deployed Worker reachable via HTTPS
- Health endpoint returns 200
- Same NOWPayments secrets (but TEST mode if available)

**Non-functional:**
- Zero impact on PROD
- Staging URL must be distinct + clearly marked
- Cost <$5/mo (CF Workers free tier)

## Architecture
```
PROD                       STAGING
─────                      ───────
sophia.agencyos.network    sophia-ai-factory-staging.workers.dev
D1: sophia-raas-db         D1: sophia-raas-db-staging
R2: sophia-...-cache       R2: sophia-staging-cache (new)
Same code (HEAD)           Same code (HEAD)
NOWPayments LIVE           NOWPayments LIVE (or sandbox if available)
```

## Related Code Files
**Create:**
- `apps/sophia-ai-factory/wrangler.staging.toml`
- `apps/sophia-ai-factory/scripts/deploy-staging.sh`
- `apps/sophia-ai-factory/docs/staging-environment.md`

**Modify:**
- `apps/sophia-ai-factory/package.json` (add `deploy:staging` script)

**Delete:** none

## Implementation Steps

### 1. Create staging D1
```bash
cd /Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory
npx wrangler d1 create sophia-raas-db-staging
# Capture the new database_id printed
```

### 2. Create staging R2 cache bucket
```bash
npx wrangler r2 bucket create sophia-staging-cache
```

### 3. Author `wrangler.staging.toml`
Copy `wrangler.toml` → `wrangler.staging.toml`, change:
- `name = "sophia-ai-factory-staging"`
- `[[d1_databases]] database_name = "sophia-raas-db-staging"` + new `database_id`
- `[[r2_buckets]] bucket_name = "sophia-staging-cache"`
- Add `[vars] ENVIRONMENT = "staging"`
- Remove custom route (use default `.workers.dev`)

### 4. Apply all migrations to staging D1
```bash
for f in migrations/[0-9][0-9][0-9][0-9]_*.sql migrations/[0-9][0-9][0-9][0-9]-*.sql; do
  echo "Applying $f"
  npx wrangler d1 execute sophia-raas-db-staging --remote --file="$f" \
    --config wrangler.staging.toml || { echo "FAIL on $f"; exit 1; }
done
```
Verify count: `npx wrangler d1 execute sophia-raas-db-staging --remote --command "SELECT count(*) FROM sqlite_master WHERE type='table'" --config wrangler.staging.toml`

### 5. Copy secrets to staging Worker
```bash
# For each secret in PROD list, set on staging:
for secret in NOWPAYMENTS_API_KEY NOWPAYMENTS_IPN_SECRET BETTER_AUTH_SECRET CRON_SECRET; do
  echo "Setting $secret on staging…"
  npx wrangler secret put "$secret" --config wrangler.staging.toml --name sophia-ai-factory-staging
  # paste value from secure store when prompted
done
```

### 6. Create `scripts/deploy-staging.sh`
```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
SHA=$(git rev-parse HEAD | cut -c1-8)
echo "Deploying staging at SHA $SHA"
npm run build
SHORT_SHA=$SHA npx wrangler deploy --config wrangler.staging.toml
echo "✅ Staging deployed: https://sophia-ai-factory-staging.<account>.workers.dev"
```
Chmod +x.

### 7. Add `deploy:staging` to package.json scripts
```json
"deploy:staging": "bash scripts/deploy-staging.sh"
```

### 8. First deploy
```bash
npm run deploy:staging
```

### 9. Verify staging healthy
```bash
STAGING_URL="https://sophia-ai-factory-staging.<account>.workers.dev"  # capture from deploy output
curl -sI "$STAGING_URL/api/health" | head -3      # expect HTTP 200
curl -s "$STAGING_URL/api/version" | head -3       # expect shortSha match
```

### 10. Document staging in `docs/staging-environment.md`
Include: URL, D1 name, R2 bucket, deploy command, secret rotation note, "DO NOT USE FOR REAL CUSTOMER DATA" banner.

## Todo List — ALL COMPLETE 2026-05-18 06:58

- [x] Create staging D1 via `wrangler d1 create` → `bf74b301-7bb4-441f-9960-c96244b82953`
- [x] Create staging tag-cache D1 → `46da1446-adb4-4afc-8514-8a9daa63b92f`
- [x] Create staging R2 buckets (`sophia-staging-cache`, `sophia-videos-staging`)
- [x] Author `wrangler.staging.toml`
- [x] Apply schema to staging D1 via PROD dump → 117 tables parity
- [x] Seed FREE100 in staging D1 (0067 + 0068 migrations)
- [x] Write `scripts/deploy-staging.sh` + chmod +x
- [x] Add `deploy:staging` to package.json
- [x] Document in `docs/staging-environment.md`
- [x] Set staging Worker secrets (auto-gen + NOWPayments placeholders) 2026-05-18 06:58
- [x] Deploy staging via `npm run deploy:staging`
- [x] Verify staging `/api/health` 200 + `/api/version` SHA d4421b01 match HEAD

## Success Criteria
✅ **ALL MET (2026-05-18 06:58)**
- [x] Staging Worker reachable at `*.workers.dev` URL with HTTP 200 → https://sophia-ai-factory-staging.agencyos-openclaw.workers.dev/ HTTP 200 ✅
- [x] `/api/version` shortSha matches local HEAD → d4421b01 matches `git rev-parse HEAD | cut -c1-8` ✅
- [x] Staging D1 has all 113+ migrations applied → Schema parity with PROD via dump method ✅
- [x] Secrets list on staging → BETTER_AUTH_SECRET, CRON_SECRET, NOWPAYMENTS_API_KEY, NOWPAYMENTS_IPN_SECRET ✅
- [x] `docs/staging-environment.md` committed ✅

**Post-Deploy Verification (2026-05-18 06:58 PT):**
- Deploy SHA: d4421b01 (matches HEAD)
- Staging URL: https://sophia-ai-factory-staging.agencyos-openclaw.workers.dev
- `/api/health`: HTTP 200 ✅
- `/api/version`: HTTP 200 + shortSha ✅
- 4 secrets confirmed on Worker via wrangler secret list ✅

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Migration file fails on staging (ordering) | Med | High | Apply numerically; first failure → stop + investigate |
| NOWPayments LIVE secrets in staging cause real charges | Med | Critical | Use sandbox creds if available; else block real-money tests; document |
| R2 bucket name collision | Low | Low | Use `sophia-staging-cache` prefix |
| Wrangler config drift (PROD vs staging) | Med | Med | Diff `wrangler.toml` vs `wrangler.staging.toml`; only changes: name, D1 id, R2 name, route |

## Security Considerations
- Staging URL is `*.workers.dev` (public by default) — DO NOT seed real customer PII
- Auth flows still work (Better Auth) — use test admin account only
- NOWPayments LIVE in staging = real money; prefer sandbox or hard-block payment tests
- Staging D1 contains ZERO production user data at end of phase

## Next Steps
- Phase 03 (FREE100 bulk API) can start in parallel — only needs PROD D1 schema knowledge
- Phase 05 (pen test) targets staging URL — unblocked
- Phase 07 (DR drill) uses staging D1 as restore target — unblocked
- Phase 08 (load test) uses staging URL — unblocked
