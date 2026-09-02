# Sophia AI Factory — Deployment Runbook

> How code moves from local dev to production. Authoritative reference for operators.
> Based on actual infrastructure as of 2026-08-26. No invented tooling.

---

## 1. Deployment Method

Sophia uses **CF-direct doctrine** — deployment is done locally via Cloudflare Wrangler CLI, NOT via GitHub Actions.

- **Deploy command:** `npm run deploy:full` (runs `scripts/deploy-with-sha.sh`)
- **Build engine:** Turbopack (NOT webpack — forced by M1 16GB OOM constraints)
- **Deploy target:** Cloudflare Workers via OpenNext adapter
- **Production URL:** `https://sophia.agencyos.network`
- **GitHub Actions:** DISABLED by design (`.github/workflows/test.yml.disabled`)

---

## 2. Who Can Deploy

| Role | Access | Notes |
|------|--------|-------|
| Operator (admin) | Direct terminal access + wrangler auth | `npx wrangler whoami` must succeed |
| Deploy Guard (SOC 2) | 2-operator attestation required when `REQUIRE_DEPLOY_ATTESTATION=1` | HMAC-signed manifest verification |

**Attestation requirements:**
- Default mode: Audit-only (attestation count logged but deploy proceeds)
- Enforced mode: `REQUIRE_DEPLOY_ATTESTATION=1` — requires 2 distinct operator signatures
- Emergency bypass: `SKIP_ATTESTATION=1` — must document reason, re-attest within 24h

---

## 3. Pre-Deploy Checks (ALL MANDATORY)

The deploy script runs these gates automatically. Emergency bypass: `SKIP_<STEP>=1` for each.

### Step 0: Push Precondition
- HEAD must equal `origin/main` (no unpushed commits)
- Working tree must be clean (no uncommitted changes)
- No untracked files (except `.cleo/`, `.claude/worktrees/`, `.orchestrate/`)
- **Emergency bypass:** `ALLOW_UNPUSHED_DEPLOY=1`

### Step 0.5: TypeScript Gate
```bash
npm run type-check   # tsc --noEmit, 0 errors required
```
- **Emergency bypass:** `SKIP_TSC=1`

### Step 0.6: Test Gate
```bash
npm test             # vitest suite, all tests must pass
```
- **Emergency bypass:** `SKIP_TESTS=1`

### Step 0.7: Commit Signature Verification
- All commits since origin/main must be GPG-signed
- Runs `node scripts/supply-chain/verify-signed-commits.mjs`
- **Emergency bypass:** `SKIP_SIGNATURE_CHECK=1`

### Step 0.7: Deploy Attestation (SOC 2 CC6.1)
- Generates deploy manifest (commit SHA, branch, timestamp, operator, diff summary)
- Verifies HMAC signatures from 2 operators (when enforced)
- Records audit log to `raas_audit_logs` table
- **Emergency bypass:** `SKIP_ATTESTATION=1` (document reason)

### Step 0.9: Pre-Deploy Gate
- Runs `node scripts/pre-deploy-gate.mjs` — validates tests, typecheck, secrets, migrations
- **Emergency bypass:** `SKIP_PRE_DEPLOY_GATE=1`

### Step 1: Build
```bash
SKIP_SENTRY_BUILD=1 SKIP_SYMBOL_UPLOAD=1 npm run build
```
- Turbopack build, produces `.next/` artifact
- Source map upload skipped by default (no-tech doctrine: sourcemaps optional)

### Step 2: OpenNext Build
```bash
npx @opennextjs/cloudflare build --skipNextBuild --noMinify
```
- Produces `.open-next/worker.js` (Cloudflare Workers artifact)
- Strips SSR bloat (client-only libs like recharts, framer-motion)
- Creates instrumentation stub (OTEL incompatible with Workers)

### Step 3.7: D1 Migrations
```bash
bash scripts/apply-migrations.sh "$PREVIOUS_LIVE_SHA"
```
- Applies migrations changed between previous live SHA and current HEAD
- Runs BEFORE worker replacement (new code needs new schema)
- **Emergency bypass:** `SKIP_D1_MIGRATIONS=1`

### Step 4: Deploy
```bash
npx opennextjs-cloudflare deploy --config wrangler.toml
```
- Deploys the OpenNext worker to Cloudflare Workers
- Requires explicit `--config wrangler.toml` for bindings to resolve

---

## 4. Post-Deploy Verification

### Step 4.5: Secret Injection
```bash
echo '$COMMIT_SHA' | npx wrangler secret put COMMIT_SHA
echo '$DEPLOYED_AT' | npx wrangler secret put DEPLOYED_AT
echo '$DEPLOY_BRANCH' | npx wrangler secret put DEPLOY_BRANCH
```
- Secrets set AFTER deploy so running worker resolves latest values

### Step 5: SHA Verification (CRITICAL)
```bash
# Script polls /api/version up to 12 times until shortSha matches
verify_deploy_sha "$VERIFY_VERSION_URL" "$COMMIT_SHORT" 12
```
- **This is the primary deploy verification signal**
- HTTP 200 alone is NOT sufficient (may be stale worker)

### Step 5.2: HTTP Health Check
```bash
curl -s -o /dev/null -w "%{http_code}" https://sophia.agencyos.network/api/health  # must be 200
curl -s -o /dev/null -w "%{http_code}" https://sophia.agencyos.network/login        # must be 200
```

### Verification Report Format
```
## Verification Report
- Build: ✅ exit code 0
- Tests: ✅ N/N passed
- Deploy: ✅ npm run deploy:full → wrangler deployed (CF-direct)
- Migrations: ✅ none new | ✅ N applied via apply-migrations.sh
- Production HTTP: ✅ 200 (/api/health, /login, /vi/login)
- Deploy SHA Match: ✅ /api/version shortSha == <local_short_sha>
```

---

## 5. Rollback Procedures

### Option A: Wrangler Rollback (Preferred)
```bash
cd apps/sophia-ai-factory
npx wrangler rollback --name sophia-ai-factory --message "<reason>" --yes
```
- Reverts to previous Cloudflare Workers version
- Fastest rollback (< 30 seconds)
- Does NOT revert D1 migrations

### Option B: Redeploy Specific Commit
```bash
git checkout <sha>
npm run deploy:full
git checkout main
```
- Full rebuild + deploy from a specific commit
- Use when rollback version is known-good

### Option C: Emergency D1 Restore
```bash
# List available backups
npx wrangler r2 object get sophia-backups --key d1-YYYY-MM-DD.sql --file backup.sql

# Apply to D1
npx wrangler d1 execute sophia-raas-db --file=backup.sql --remote
```
- R2 backups: `sophia-backups/d1-YYYY-MM-DD.sql` (30-day retention)
- D1 backup cron: `/api/cron/d1-backup` (daily, authenticated with `CRON_SECRET`)

### Rollback Decision Tree
1. **Code bug only** → Option A (wrangler rollback)
2. **Code bug + migration needed** → Option B (redeploy previous commit) + manual migration reversal
3. **Data corruption** → Option C (D1 restore from R2 backup) + Option A

---

## 6. Health Verification

### Automated Monitoring
- **Uptime check cron:** Every 5 minutes (`/api/cron/uptime-check`)
  - Pings `/api/health`, alerts via Telegram if down or latency > 5s
  - Auto-opens incident after 3 consecutive failures
  - Auto-closes incident after 3 consecutive successes

### Health Endpoint Details
```
GET /api/health
```

**Public mode (no token):**
```json
{ "status": "healthy", "timestamp": "...", "environment": "production" }
```

**Authenticated mode (Bearer HEALTH_TOKEN):**
```json
{
  "status": "healthy",
  "timestamp": "...",
  "environment": "production",
  "version": { "shortSha": "abc12345", "deployedAt": "..." },
  "components": {
    "database": { "status": "ok", "latencyMs": 2 },
    "kv": { "status": "ok", "latencyMs": 1 },
    "r2": { "status": "ok", "latencyMs": 3 },
    "circuitBreaker": { "status": "ok", "openServices": [] },
    "realityLoop": { "status": "ok", "wired": 11, "deferred": 2, "totalEventTypes": 13 }
  }
}
```

**Component statuses:**
- `database` (D1): `ok` | `error` | `unknown`
- `kv` (KV namespace): `ok` | `error` | `unknown`
- `r2` (R2 bucket): `ok` | `error` | `unknown`
- `circuitBreaker`: `ok` | `degraded` (has open services) | `unknown`
- `realityLoop`: `ok` | `degraded` (has stale emitters) | `unknown`

**Aggregate status rules:**
- `unhealthy` (503): database `error`
- `degraded` (200): circuit breaker `degraded` OR kv `error` OR realityLoop `degraded`
- `healthy` (200): all components ok

### Version Endpoint
```
GET /api/version
```
```json
{ "shortSha": "abc12345", "deployedAt": "2026-08-26T00:00:00Z", "opennextVersion": "1.19.0" }
```

---

## 7. Login Verification

After deploy, verify authentication works:

```bash
# Check login page loads
curl -s -o /dev/null -w "%{http_code}" https://sophia.agencyos.network/login        # must be 200
curl -s -o /dev/null -w "%{http_code}" https://sophia.agencyos.network/vi/login     # must be 200

# Verify auth endpoints respond
curl -s -o /dev/null -w "%{http_code}" https://sophia.agencyos.network/api/auth     # must not be 500
```

**Protected flows to validate (manual):**
1. Setup Wizard: API key onboarding (OpenRouter, ElevenLabs, D-ID, HeyGen)
2. Telegram Bot: @Sophia_Bbot responds to `/status`
3. Payment Flow: NOWPayments IPN webhook processes correctly

---

## 8. CEO Post-Deploy Checklist

After every production deploy, the CEO (or designated operator) should verify:

### Automated Checks (run by deploy script)
- [ ] `npm run deploy:full` exited with code 0
- [ ] SHA verification passed (`/api/version` shortSha matches local commit)
- [ ] HTTP health check passed (`/api/health` returns 200)

### Manual Verification (5-minute checklist)
- [ ] Login page loads: `https://sophia.agencyos.network/login`
- [ ] Dashboard loads after login (no blank page or JS errors)
- [ ] Setup Wizard accessible (API key entry form renders)
- [ ] Telegram bot responds: send `/status` to @Sophia_Bbot
- [ ] No alerts in Telegram admin channel (check last 10 minutes)

### If Something Fails
1. **Login broken** → Rollback immediately (`npx wrangler rollback`)
2. **Dashboard blank** → Check browser console for JS errors, rollback if critical
3. **Setup Wizard broken** → Rollback (protected flow — must always work)
4. **Telegram bot unresponsive** → Check webhook status, may need manual webhook re-registration
5. **Payment failure** → Check NOWPayments IPN logs, rollback if tier activation broken

---

## 9. Failure Detection

### Automated Detection
- **Uptime cron** (every 5 min): Detects service down, high latency (>5s), unreachable
- **Circuit breaker** (per-service): 4-state machine (CLOSED → DEGRADED → OPEN → HALF_OPEN)
  - AUTH_FAILURE: immediate open (no cooldown)
  - RATE_LIMIT: cooldown period
  - SERVER_ERROR: retry with backoff
  - Persists state in D1 (survives worker restarts)
- **Incident state machine**: 3 consecutive failures → auto-open incident; 3 successes → auto-close

### Manual Detection
- **Sentry errors**: Check `sentry.io` for new error spikes (stack traces minified without source maps)
- **Cloudflare logs**: `wrangler tail` for real-time Worker logs
- **D1 queries**: Direct SQL for quota/usage anomalies

### Alert Channels
- **Telegram admin alerts**: Service down, incidents opened/closed, quota warnings
- **Slack webhook**: Severity-based alerts (info/warn/critical)
- **Better Stack heartbeat**: Backup success/failure monitoring

---

## 10. Emergency Procedures

### Hotfix Deploy (Skip All Gates)
```bash
# DANGER: Bypasses all safety checks. Document reason in commit message.
SKIP_TSC=1 SKIP_TESTS=1 SKIP_SIGNATURE_CHECK=1 SKIP_PRE_DEPLOY_GATE=1 \
SKIP_ATTESTATION=1 npm run deploy:full
```
- **Require:** Documented reason, rollback plan, re-attest within 24h
- **Use only for:** Critical production issues where normal deploy is too slow

### Service Down (Immediate Rollback)
```bash
# 1. Rollback to previous version
npx wrangler rollback --name sophia-ai-factory --message "Emergency rollback: <reason>" --yes

# 2. Verify rollback
curl -s https://sophia.agencyos.network/api/version | grep shortSha

# 3. Check health
curl -s https://sophia.agencyos.network/api/health | jq .status
```

### Database Corruption (D1 Restore)
```bash
# 1. List available backups
npx wrangler r2 object get sophia-backups --key d1-$(date -d yesterday +%Y-%m-%d).sql --file backup.sql

# 2. Create backup of current state (if possible)
npx wrangler d1 execute sophia-raas-db --command="SELECT * FROM users LIMIT 1"

# 3. Restore from backup
npx wrangler d1 execute sophia-raas-db --file=backup.sql --remote

# 4. Verify data integrity
npx wrangler d1 execute sophia-raas-db --command="SELECT COUNT(*) FROM users"
```

---

## Appendix A: Environment Variables

### Required for Deploy
- `CLOUDFLARE_ACCOUNT_ID` or wrangler.toml auth
- `CLOUDFLARE_API_TOKEN` or wrangler.toml auth

### Optional (Emergency Bypass)
- `ALLOW_UNPUSHED_DEPLOY=1` — Skip push precondition
- `SKIP_TSC=1` — Skip TypeScript check
- `SKIP_TESTS=1` — Skip test suite
- `SKIP_SIGNATURE_CHECK=1` — Skip GPG signature verification
- `SKIP_ATTESTATION=1` — Skip deploy attestation (document reason)
- `SKIP_PRE_DEPLOY_GATE=1` — Skip pre-deploy gate
- `SKIP_NEXT_BUILD=1` — Reuse existing .next artifact
- `SKIP_D1_MIGRATIONS=1` — Skip D1 migration apply
- `SKIP_SENTRY_BUILD=1` — Skip Sentry build-time wrap
- `SKIP_SYMBOL_UPLOAD=1` — Skip R2 source map upload
- `SKIP_SBOM=1` — Skip SBOM generation

### Optional (Enhanced Deploy)
- `REQUIRE_DEPLOY_ATTESTATION=1` — Enforce 2-operator attestation
- `RUN_PREDEPLOY_E2E=1` — Run Playwright smoke tests before deploy
- `DEPLOY_GUARD_API_TOKEN` — Enable Deploy Guard API tracking

---

## Appendix B: Key Files

| File | Purpose |
|------|---------|
| `scripts/deploy-with-sha.sh` | Main deploy script (660 lines) |
| `scripts/verify-production-deploy.sh` | Standalone SHA verification |
| `scripts/apply-migrations.sh` | D1 migration application |
| `scripts/pre-deploy-gate.mjs` | Pre-deploy validation |
| `src/app/api/health/route.ts` | Health endpoint (component checks) |
| `src/app/api/version/route.ts` | Version endpoint (SHA verification) |
| `src/seed/security/circuit-breaker.ts` | 4-state circuit breaker |
| `src/land/status/status-store.ts` | Incident/check persistence |
| `src/app/api/cron/uptime-check/route.ts` | 5-min uptime monitoring |
| `src/app/api/cron/d1-backup/route.ts` | Daily D1 backup to R2 |

---

## Appendix C: Known Limitations

1. **No automated rollback** — Rollback is manual (`npx wrangler rollback`)
2. **No canary deploy** — All-or-nothing deployment to production
3. **D1 migrations are forward-only** — No automatic rollback for schema changes
4. **Source maps optional** — Sentry errors have minified stack traces by default
5. **M1 16GB OOM** — Build requires Turbopack (webpack OOMs on this hardware)
6. **GitHub Actions disabled** — No CI/CD pipeline, all deploys are manual CF-direct

---

*Last updated: 2026-08-26. Based on actual infrastructure in `apps/sophia-ai-factory/`.*
