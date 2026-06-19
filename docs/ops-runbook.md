# Operations Runbook — Sophia AI Factory

**Status:** Active (Updated 2026-06-20)
**Current Deploy SHA:** `94f5796b81f174f5ee088cd2ca20495214807aaa`
**Production URL:** https://sophia.agencyos.network

---

## Quick Reference

| Item | Value |
|------|-------|
| **Production URL** | https://sophia.agencyos.network |
| **API Health** | https://sophia.agencyos.network/api/health |
| **API Version** | https://sophia.agencyos.network/api/version |
| **Deploy Command** | `cd apps/sophia-ai-factory && npm run deploy:full` |
| **Rollback Command** | `npx wrangler rollback --name sophia-ai-factory --yes` |
| **Git Repository** | https://github.com/longtho638-jpg/sophia-ai-factory |
| **Deploy Doctrine** | CF-direct (GitHub Actions disabled since 2026-05-03) |

---

## 1. Deployment Workflow

### Deploy Command (CF-Direct)

```bash
# Step 0: Push to origin FIRST (mandatory guard)
git push origin main

# Step 1: Build + inject SHA + deploy
cd apps/sophia-ai-factory
npm run deploy:full
# Runs: type-check → tests → next build → OpenNext build → changed D1 migrations → wrangler deploy → SHA verification
```

### Deploy Verification (MANDATORY)

```bash
# 1. Check deploy script exit code (must be 0)
# 2. Verify SHA match (NOT just HTTP 200)
LOCAL_SHA=$(git rev-parse HEAD | cut -c1-8)
LIVE_SHA=$(curl -s https://sophia.agencyos.network/api/version | grep -o '"shortSha":"[^"]*"' | cut -d'"' -f4)
echo "Local: $LOCAL_SHA  Live: $LIVE_SHA"
# Must be equal

# 3. HTTP health check
curl -sI https://sophia.agencyos.network | head -3
# Must return: HTTP/2 200

# 4. Apply any new D1 migrations
cd apps/sophia-ai-factory && bash scripts/apply-migrations.sh
```

**Deploy Verification Report Format:**
```
## Verification Report
- Build: ✅ exit code 0
- Tests: ✅ all passed
- Deploy: ✅ CF-direct deployed
- Migrations: ✅ none new | ✅ N applied
- Production HTTP: ✅ 200
- Deploy SHA Match: ✅ /api/version shortSha == <local_short_sha>
- Verified: <ISO timestamp>
```

---

## 2. Rollback Procedures

### Option A: Instant Cloudflare Rollback (Fastest)

Rollback to the previous Cloudflare Workers version:

```bash
cd apps/sophia-ai-factory
npx wrangler rollback --name sophia-ai-factory --message "<reason for rollback>" --yes
```

**Verification after rollback:**
```bash
curl -s https://sophia.agencyos.network/api/version | jq -r .shortSha
# Should match the previous deploy SHA (check git log)
```

### Option B: Redeploy Specific Commit

If you need to roll back to a specific known-good commit:

```bash
# Find the good commit SHA
git log --oneline -10

# Checkout and deploy
git checkout <good-sha>
npm run deploy:full
git checkout main
```

### Option C: Git Revert + Redeploy

If the bad commit is on main and you want to create a revert commit:

```bash
git log --oneline -5
git revert <bad-commit-hash>
git push origin main
cd apps/sophia-ai-factory
npm run deploy:full
```

---

## 3. Monitoring & Observability

### Production Endpoints

| Endpoint | Purpose | Auth Required |
|----------|---------|---------------|
| `/api/health` | Service health check | No (basic), Yes (full detail) |
| `/api/version` | Deploy SHA, timestamp, OpenNext version | No |
| `/api/metrics` | Route performance metrics (p50/p95/p99) | Yes (`INTROSPECT_TOKEN`) |

### Monitoring Dashboards

| System | URL | Purpose |
|--------|-----|---------|
| **Sentry** | https://mekong-cli.sentry.io/projects/sophia-ai-factory/ | Error tracking, stack traces |
| **Cloudflare Analytics** | Cloudflare Dashboard → Workers & Pages → sophia-ai-factory | Request volume, errors, latency |
| **Better Stack (Logtail)** | (configured via `BETTER_STACK_LOGS_TOKEN`) | Structured logs, log search |
| **D1 Database** | Cloudflare Dashboard → D1 → sophia-raas-db | Database queries, size, connections |

### Cron Jobs (Production Schedule)

All cron routes require `Authorization: Bearer ${CRON_SECRET}`.

| Cron Schedule | Route | Purpose |
|---------------|-------|---------|
| `*/5 * * * *` | `/api/cron/uptime-check` | Self-ping + Telegram alert |
| `5 * * * *` | `/api/cron/usage-export` | Hourly usage rollup |
| `0 1 * * *` | `/api/cron/dunning` | Dunning state machine |
| `0 2 * * *` | `/api/cron/reminders` | Subscription reminders |
| `0 3 * * *` | `/api/cron/scheduled-campaigns` | Auto-campaign creation |
| `0 4 * * *` | `/api/cron/email-drip` | Nurture drip |
| `0 7 * * *` | `/api/cron/llm-cache-purge` | LLM cache cleanup |
| `0 */4 * * *` | `/api/cron/affiliate-scout` | Affiliate discovery |
| `0 6 * * 1` | `/api/cron/weekly-signals-digest` | PostHog digest |
| `0 0 1 * *` | `/api/cron/mcu-monthly-reset` | Monthly MCU reset |
| `0 0 * * *` | `/api/cron/clearance-promote` | Promote pending credits |
| `10 * * * *` | `/api/cron/wallet-rebuild` | Rebuild user wallets |
| External (Upstash) | `/api/cron/d1-backup` | Daily D1 → R2 backup |
| `*/10 * * * *` | `/api/cron/heartbeat` | Better Stack liveness ping |
| `0 5 * * *` | `/api/cron/error-digest` | Daily error summary |

---

## 4. Alerting & Incident Response

### Alert Rules (Better Stack)

| Alert | Condition | Action |
|-------|-----------|--------|
| Fatal D1 | `msg = "D1_UNAVAILABLE"` | Telegram + email |
| Error spike | `level = error, count > 10 in 5 min` | Telegram |
| Missed heartbeat | sophia-liveness misses 1 ping | Telegram + email |

### Incident Response Contacts

| Severity | Response Time | Action |
|----------|---------------|--------|
| **P0 Critical** | Immediate | Page on-call engineer |
| **P1 High** | 30 minutes | Slack #incident + notify admin |
| **P2 Medium** | 48 hours | File issue, schedule fix |
| **P3 Low** | Next sprint | Log in backlog |

**Admin Contact:** billwill.mentor@gmail.com

---

## 5. Recovery Procedures

### Scenario 1: Cloudflare Workers Outage

**Detection:** Uptime cron fails, production HTTP errors

**Steps:**
1. Check Cloudflare status: https://status.cloudflare.com
2. Wait for Cloudflare recovery (99.99% SLA, typically 15-30 min)
3. No platform action required — services auto-recover
4. Verify: `curl -sI https://sophia.agencyos.network` returns 200

**RTO:** 15-60 minutes (depends on Cloudflare incident)

---

### Scenario 2: D1 Data Corruption

**Detection:** App database errors, customer reports missing data

**Steps:**
1. Check Sentry for database error pattern
2. Locate latest backup: R2 bucket `sophia-backups` object `d1-YYYY-MM-DD.sql`
3. **Backup current D1 first:**
   ```bash
   npx wrangler d1 export sophia-raas-db --remote --output pre-restore-backup.sql
   ```
4. **Restore from backup:**
   ```bash
   npx wrangler d1 execute sophia-raas-db --remote --file=backup.sql
   ```
5. Verify integrity:
   ```bash
   npx wrangler d1 execute sophia-raas-db --remote --command "SELECT COUNT(*) as user_count FROM users"
   npx wrangler d1 execute sophia-raas-db --remote --command "SELECT COUNT(*) as org_count FROM organizations"
   ```

**RTO:** 1-2 hours

---

### Scenario 3: Bad Deployment (Code Break)

**Detection:** Deploy succeeds but production errors spike, `/api/version` SHA mismatch

**Steps (Fast Rollback):**
1. Instant rollback:
   ```bash
   npx wrangler rollback --name sophia-ai-factory --message "bad deploy" --yes
   ```
2. Verify SHA match and HTTP 200
3. Investigate locally: `git log -2` to identify bad commit
4. Fix and redeploy

**RTO:** 10-20 minutes

---

### Scenario 4: Secret Compromise

**Detection:** Unauthorized access, secret in logs, API abuse

**Steps:**
1. **Identify** which secret was exposed
2. **Generate new secret:**
   ```bash
   # Example: new JWT_SECRET
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
3. **Update CF Workers secret:**
   ```bash
   npx wrangler secret put <SECRET_NAME>
   # Paste new value, Ctrl+D
   ```
4. **Special cases:**
   - **JWT_SECRET**: All existing tokens invalidate → users must re-login
   - **NOWPAYMENTS_IPN_SECRET**: Regenerate in NOWPayments dashboard first
5. **Audit:** Check CF access logs, API usage for anomalies
6. **Communicate:** Notify users if session reset required

**RTO:** 15-30 minutes

---

## 6. Backup Strategy

### Database (D1)

**Automatic:**
- Cloudflare D1 daily backups (managed service)
- `/api/cron/d1-backup` route writes SQL dumps to R2 `sophia-backups` bucket
- Retention: 30 days (R2 lifecycle)

**Manual Backup (Recommended Weekly):**
```bash
npx wrangler d1 export sophia-raas-db --remote --output backup-$(date +%Y%m%d).sql
```

**Restore from Backup:**
```bash
npx wrangler d1 execute sophia-raas-db --remote --file=backup.sql
```

### Code

- Repository: GitHub (longtho638-jpg/sophia-ai-factory)
- Branch protection on `main` (no force push, code review required)
- Full commit history preserved

---

## 7. Secrets Management

### Required Secrets (Production)

| Secret | Purpose |
|--------|---------|
| `JWT_SECRET` | Authentication tokens |
| `OPENROUTER_API_KEY` | AI services |
| `ELEVENLABS_API_KEY` | Voice generation |
| `HEYGEN_API_KEY` | Avatar video |
| `RESEND_API_KEY` | Email delivery |
| `NOWPAYMENTS_API_KEY` | Payment processing |
| `NOWPAYMENTS_IPN_SECRET` | Payment webhook verification |
| `TELEGRAM_BOT_TOKEN` | Telegram bot |
| `BETTER_AUTH_SECRET` | Better Auth sessions |
| `CRON_SECRET` | Cron route authentication |
| `CREDENTIALS_MASTER_KEY` | BYOK encryption (AES-GCM-256) |
| `BYOK_MASTER_KEY` | LLM/media BYOK encryption |

### Secret Operations

```bash
# List secret names (values hidden)
npx wrangler secret list

# Set a secret
npx wrangler secret put SECRET_NAME
# Paste value, press Ctrl+D

# Rotation recommended: every 90 days
```

---

## 8. Local Development Commands

```bash
# Always run from apps/sophia-ai-factory/
cd apps/sophia-ai-factory

# Development server
npm run dev                    # http://localhost:3000

# Database migrations (local)
npx wrangler d1 migrations apply sophia-raas-db --local

# Tests
npm run test                   # Vitest unit tests
npm run test:e2e               # Playwright E2E (requires mock AI services)
npm run ci                     # Full CI gate (typecheck, lint, test, secrets audit)

# Deploy verification
npm run deploy:verify          # Run health checks

# Database access
npx wrangler d1 execute sophia-raas-db --remote --command "SELECT * FROM users LIMIT 10"
```

---

## 9. Current Infrastructure State

| Component | Status | Details |
|-----------|--------|---------|
| **Compute** | ✅ Active | Cloudflare Workers (300+ global edge locations) |
| **Database** | ✅ Active | Cloudflare D1 (sophia-raas-db, ID: 78bd1961-b62d-43bb-b551-0c5d7d389506) |
| **Storage** | ✅ Active | R2 buckets: sophia-videos, sophia-backups, sophia-ai-factory-opennext-cache |
| **KV Namespace** | ✅ Active | EXPERIMENT_KV (c3857792e4014334ba31b62b19d2f32a), KV_KV (ba8c93a931524b7e97027dbad43b31c0) |
| **Deploy Method** | ✅ CF-direct | GitHub Actions disabled (2026-05-03) |
| **Branch Protection** | ✅ Enabled | main: no force push, PR review required |
| **Monitoring** | ✅ Sentry + Better Stack | Error tracking, structured logs |
| **Backups** | ✅ R2 lifecycle | 30-day retention, daily D1 dumps |

---

## 10. Quarterly DR Drill Checklist

Schedule: 1st Monday of each quarter (Jan, Apr, Jul, Oct)

- [ ] **D1 Backup Test** — Export D1, verify successful
- [ ] **Restore Test (Local)** — Restore backup to local D1, verify schema
- [ ] **Deployment Rollback Test** — Deploy old commit, verify, rollback
- [ ] **Secret Rotation** — Rotate secrets > 90 days, verify app works
- [ ] **Monitoring Verification** — Check Sentry, uptime cron, CF analytics
- [ ] **Documentation Review** — Update this runbook, verify contacts

**Last Verified:** 2026-03-26 (Q1 2026 Drill Complete)

---

## 11. Useful Links

| Resource | URL |
|-----------|-----|
| Production App | https://sophia.agencyos.network |
| API Documentation | https://sophia.agencyos.network/docs/api |
| Status Page | https://sophia.agencyos.network/status |
| GitHub Repository | https://github.com/longtho638-jpg/sophia-ai-factory |
| Sentry Issues | https://mekong-cli.sentry.io/issues/ |
| Cloudflare Dashboard | (operator access required) |
| Deployment Guide | ./docs/deployment-guide.md |
| Disaster Recovery | ./docs/disaster-recovery.md |
| Observability Runbook | ./docs/observability-runbook.md |

---

## 12. Emergency Contacts

| Role | Contact | Notes |
|------|---------|-------|
| **Admin** | billwill.mentor@gmail.com | Full system access, emergency deploys |
| **Support** | support@mekongmind.com | Customer support |
| **Telegram Bot** | @Sophia_Bbot | Customer-facing automation |

---

*Last updated: 2026-06-20 | Sophia AI Factory v2.0 (Deploy SHA: 94f5796b)*
