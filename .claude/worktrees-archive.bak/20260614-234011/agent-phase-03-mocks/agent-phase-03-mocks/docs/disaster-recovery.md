# Disaster Recovery Plan — Sophia AI Factory

**Status:** Active (Updated 2026-05-21 docs backfill)
**Handover Score Impact:** P1 Infrastructure (affects score from 61→83)

## Recovery Objectives

| Metric | Target | Justification |
|--------|--------|---------------|
| RPO (Recovery Point Objective) | 24 hours | D1 daily backup route writes SQL dumps to R2 `sophia-backups` |
| RTO (Recovery Time Objective) | 4 hours | Redeploy from git + D1 restore from backup |
| Uptime SLA | 99.99% | Cloudflare Workers global edge distribution |

## Architecture Overview

- **Compute**: Cloudflare Workers (serverless, auto-scaling, 300+ global edge locations)
- **Database**: Cloudflare D1 (SQLite, single-region SFO with automatic + manual backups)
- **Storage**: Cloudflare R2 (ISR cache, static assets with geo-optimization)
- **DNS**: Cloudflare DNS (sophia.agencyos.network with auto-renewal SSL)
- **Code**: GitHub (longtho638-jpg/sophia-ai-factory) with branch protection

## Backup Strategy

### Database (D1)
- **Automatic:** Cloudflare D1 provides daily backups (managed service)
- **Manual:** `npx wrangler d1 export sophia-raas-db --remote --output backup.sql` (weekly recommended)
- **Workflow:** `/api/cron/d1-backup` builds a D1 dump and uploads `d1-YYYY-MM-DD.sql` to the R2 `sophia-backups` bucket.
  - Triggered by external scheduler (Upstash QStash) because GitHub Actions scheduled workflows are not the canonical path.
  - Authenticated by `CRON_SECRET`.
  - Records result in `cron_run_log` and optionally pings Better Stack.
- **Storage:** R2 lifecycle retains 30 days.

### Code
- **Repository:** GitHub (longtho638-jpg/sophia-ai-factory) with full commit history
- **Branch Protection:** Enabled on `main` (no force push, code review required before merge)
- **Deploy Trigger:** Push to `origin/main` first, then CF-direct deploy via `cd apps/sophia-ai-factory && npm run deploy:full`
- **Rollback:** Cloudflare Workers rollback for fastest recovery, or `git revert <hash>` followed by `npm run deploy:full`

### Secrets
- **Storage:** Cloudflare Workers secrets (encrypted at rest in CF vault)
- **Rotation:** Manual rotation via `npx wrangler secret put <NAME>` (90-day recommended)
- **Audit:** List all secrets: `npx wrangler secret list` (shows names only, not values)
- **Never in Code:** `.env` files added to `.gitignore`, documented in `.env.example` only
- **Required Secrets:** JWT_SECRET, OPENROUTER_API_KEY, ELEVENLABS_API_KEY, RESEND_API_KEY, NOWPAYMENTS_API_KEY, NOWPAYMENTS_IPN_SECRET, HEYGEN_API_KEY, SENTRY_DSN

### Monitoring & Alerting
- **Uptime Check:** Cron job runs `/api/health` every 5 minutes
- **Error Tracking:** Sentry SDK monitors all errors (client, server, edge)
- **Logs:** Structured JSON logs via `lib/logger.ts` (all events recorded)
- **Alerting:** Critical errors trigger Sentry notifications (configurable)

## Recovery Procedures

### Scenario 1: CF Workers Down (Cloudflare Outage)

**Time to detect:** < 5 minutes (uptime cron will fail)

**Recovery steps:**
1. Check Cloudflare status: https://status.cloudflare.com
2. Cloudflare has 99.99% SLA — outages typically resolve in 15-30 minutes
3. **No action required** — services auto-recover when Cloudflare recovers
4. Verify recovery: `curl -sI https://sophia.agencyos.network` (should return 200)

**RTO:** 15-60 minutes (depends on Cloudflare incident duration)

### Scenario 2: D1 Data Corruption or Accidental Delete

**Detection:** App errors on database queries, customer reports missing data

**Recovery steps:**
1. **Identify issue:** Check Sentry for database error pattern
2. **Locate backup:** latest `d1-YYYY-MM-DD.sql` object in the R2 `sophia-backups` bucket.
3. **Restore from backup:**
   ```bash
   npx wrangler d1 execute sophia-raas-db --remote --file=backup.sql
   ```
   ⚠️ **WARNING:** This overwrites all data! Backup current D1 first:
   ```bash
   npx wrangler d1 export sophia-raas-db --remote --output pre-restore-backup.sql
   ```
4. **Verify integrity:** Query after restore:
   ```bash
   npx wrangler d1 execute sophia-raas-db --remote --command "SELECT COUNT(*) as user_count FROM users"
   npx wrangler d1 execute sophia-raas-db --remote --command "SELECT COUNT(*) as org_count FROM organizations"
   npx wrangler d1 execute sophia-raas-db --remote --command "SELECT SUM(lifetime_debits) FROM org_balances"
   ```
5. **Notify users:** Post-incident update if data loss occurred (notify via Telegram bot or email)

**RTO:** 1-2 hours (D1 restore + verification)

### Scenario 3: Deployment Break (Bad Code Pushed to Main)

**Detection:** deploy wrapper fails, `/api/version` SHA mismatch, production HTTP fails, or app errors spike in Sentry

**Recovery steps (option A: Fast rollback):**
1. Check the failed local gate or deploy-wrapper output.
2. If the build/type/test gate fails: do not deploy.
3. If deploy succeeded but production is broken: use Cloudflare Workers rollback or revert the bad commit.
4. **Rollback by revert + redeploy:**
   ```bash
   git log --oneline -5
   git revert <bad-commit-hash>
   git push origin main
   cd apps/sophia-ai-factory
   npm run deploy:full
   ```
5. Verify `/api/version` SHA match and `curl -sI https://sophia.agencyos.network` returns 200.

**Recovery steps (option B: Manual revert if git revert fails):**
1. Identify last known good commit
2. Create new branch and cherry-pick good commits
3. Force push if necessary (rare): `git push --force-with-lease origin main`

**Prevention:**
- Always run local gates before deploy (`npm run type-check`, `npm run build`, targeted tests)
- Code review required on main branch (2-person sign-off)
- Test staging environment if available

**RTO:** 10-20 minutes (git revert + CF-direct redeploy)

### Scenario 4: Secret Compromise (API Key / JWT_SECRET Leaked)

**Detection:** Unauthorized access detected, secret found in public logs

**Recovery steps:**
1. **Assess severity:** Determine which secret was exposed
2. **Rotate immediately:**
   ```bash
   # Generate new secret (example: new JWT_SECRET)
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

   # Update CF Workers secret
   npx wrangler secret put JWT_SECRET
   # Paste new secret, press Ctrl+D
   ```
3. **If JWT_SECRET compromised:**
   - All existing JWT tokens become invalid
   - All users must re-login (JWT decode will fail)
   - Announce maintenance: "Session reset for security reasons. Please login again."

4. **If ANTHROPIC_API_KEY compromised:**
   - Rotate in Anthropic console immediately
   - Update CF Worker secret: `npx wrangler secret put ANTHROPIC_API_KEY`
   - Monitor usage dashboard for suspicious activity

5. **If NOWPAYMENTS_IPN_SECRET compromised:**
   - Regenerate the webhook secret in NOWPayments dashboard
   - Update CF Worker secret: `npx wrangler secret put NOWPAYMENTS_IPN_SECRET`
   - Verify webhook signature verification still works

6. **Audit & Monitor:**
   - Check Cloudflare access logs for suspicious IPs
   - Review API usage for unusual patterns
   - Monitor Sentry for unusual errors

**RTO:** 15-30 minutes (rotate secret + redeploy + communicate)

### Scenario 5: Multi-Region Failover (Not Currently Implemented)

**Current Status:** Single-region D1 (SFO, US-West)

**Future Consideration (Q3 2026):**
- Implement cross-region D1 replica (if scale justifies)
- Until then: RPO 24h via daily backup is acceptable SLA for current load
- Fallback: restore the latest R2 `sophia-backups` dump into a replacement D1 database if needed

## Team Roles & Responsibilities

| Role | Responsibility | Contact |
|------|---------------|---------|
| **Admin** | Full system access, secret rotation, emergency deploys | billwill.mentor@gmail.com |
| **DevOps** | Monitor uptime, D1 backups, incident response | System operator |
| **Developer** | Code fixes, deployment via git push | Team |
| **On-Call** | 24/7 incident response (rotation-based) | TBD |

## Incident Response Contacts

- **Critical (P0):** Page on-call engineer immediately
- **High (P1):** Slack #incident channel + notify admin within 30 min
- **Medium (P2):** File issue, schedule fix within 48 hours
- **Low (P3):** Log in backlog, prioritize next sprint

## Quarterly DR Drill Checklist

**Recommended Schedule:** 1st Monday of each quarter (Jan, Apr, Jul, Oct)

- [x] **D1 Backup Test** (verified 2026-03-26)
  - Export D1: `npx wrangler d1 export sophia-raas-db --remote --output test-backup.sql`
  - Result: 559 lines, 41 tables exported successfully
  - Historical note: this 2026-03 drill used GitHub Actions backup workflow; current backup path is `/api/cron/d1-backup` → R2.

- [x] **Restore Test (Local)** (verified 2026-03-26)
  - Restored to local D1: `npx wrangler d1 execute sophia-raas-db --file=/tmp/sophia-backup-test.sql`
  - Result: 40 tables restored, schema integrity confirmed
  - Note: user data not in local restore (expected — production-only rows)

- [ ] **Deployment Rollback Test**
  - Pick a commit from 1 week ago
  - Create test branch: `git checkout <old-commit>`
  - Deploy to staging (if available) or test locally
  - Verify old code still runs
  - Rollback to main: `git checkout main`

- [ ] **Secret Rotation**
  - Identify secrets older than 90 days
  - Rotate each secret: `npx wrangler secret put <NAME>`
  - Verify app still works after rotation
  - Document rotation date in this file

- [ ] **Monitoring Verification**
  - Verify Sentry project is active and receiving errors
  - Check uptime cron logs (should see `/api/health` calls)
  - Verify Cloudflare analytics dashboard works
  - Test error notification channels

- [ ] **Documentation Review**
  - Update this file with any new procedures learned
  - Verify all contact emails are current
  - Check that recovery times (RTO/RPO) are still accurate
  - Review recent incidents and update scenarios if needed

**Sign-off:** After drill complete, update "Last Verified" date below

---

## Last Verified

| Date | By | Status |
|------|----|---------|
| 2026-03-26 | billwill.mentor@gmail.com | ✅ Q1 2026 Drill Complete |
| TBD | | ⏳ Q2 2026 Drill Pending |

---

## Related Documentation

- **Cloud Infrastructure:** `docs/cloud-infrastructure.md` (10-layer audit details)
- **System Architecture:** `docs/system-architecture.md` (security & monitoring section)
- **Deployment Guide:** `docs/deployment-guide.md`
- **Monitoring:** Sentry dashboard (https://sentry.io/organizations/sophia/)
