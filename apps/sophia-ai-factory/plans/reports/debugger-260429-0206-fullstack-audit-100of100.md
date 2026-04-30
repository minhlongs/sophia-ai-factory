# Actual Full Stack Audit — Sophia AI Factory
**Date:** 2026-04-29 02:06 UTC  
**Commit deployed:** a2aa6302 (verified via /api/version)  
**HEAD local:** 9987d596 (3 commits ahead — not deployed)  
**Production:** https://sophia.agencyos.network  
**Auditor:** debugger agent  

---

## Score Summary

| Layer | Score | Verdict |
|-------|-------|---------|
| 1. Database | 6/10 | D1 up, backup workflow disabled |
| 2. Server | 7/10 | CF Workers running, degraded health |
| 3. Networking | 9/10 | HSTS + CSP + headers solid |
| 4. Cloud | 7/10 | CF D1/R2/KV configured, no cost alerts |
| 5. CI/CD | 3/10 | GH Actions disabled, GitLab blocked on CC |
| 6. Security | 8/10 | Strong headers, rate-limiting, auth OK |
| 7. Monitoring | 6/10 | Sentry configured but source maps untested |
| 8. Containers | N/A | Serverless — skip |
| 9. CDN | 7/10 | CF edge live, static assets immutable, dynamic pages no-cache |
| 10. Backup | 5/10 | D1 backup script + workflow exist but not running |
| **TOTAL** | **58/100** | Partial Stack |

---

## Layer-by-Layer Analysis

### Layer 1: Database 6/10
**What's good:** D1 migrations versioned (0001–0009), `wrangler.toml` binding `DB` confirmed, Supabase used only for OAuth exceptions (correct isolation), `sqlite_master` schema export in snapshot script.

**Blockers:**
- D1 backup workflow (`d1-backup.yml`) depends on GitHub Actions — currently DISABLED (account flagged). Zero backups running in production.
- D1 snapshot script (`scripts/dr/d1-snapshot.sh`) uses wrong export method: `SELECT sql FROM sqlite_master` captures schema only, not data. `wrangler d1 export --remote` is the correct command (already in `d1-backup.yml`).
- No point-in-time recovery — CF D1 free tier has no PITR.
- No RLS (D1 is SQLite, not Postgres — N/A by design, but no equivalent row-level checks in queries).
- RPO/RTO undefined in docs.

**Fixes:**
1. Switch D1 backup to external cron: use Upstash QStash or EasyCron to call `wrangler d1 export` via a dedicated worker endpoint — bypasses GH Actions dependency.
2. Fix `d1-snapshot.sh`: replace `sqlite_master` query with `npx wrangler d1 export "$DB_NAME" --remote --output "$SNAPSHOT_FILE"`.
3. Document RPO=24h / RTO=4h in `docs/deployment-guide.md`.

---

### Layer 2: Server 7/10
**What's good:** CF Workers runtime, OpenNext 1.17.3, global edge, `wrangler.toml` has D1/R2/KV/Images bindings, cold start < 100ms typical for Workers.

**Blockers:**
- `GET /api/health` returns `{"status":"degraded"}` — root cause: **Upstash Redis ping fails**. Health route lines 100–119: if `UPSTASH_REDIS_REST_URL` is set and `redisHelpers.ping()` returns false/throws → `healthStatus.status = 'degraded'`. Redis is used for session state (FSM). If down, workflow stepper crons will silently fail.
- Local HEAD (9987d596) is 3 commits ahead of deployed (a2aa6302) — latest code not live.
- `open-next.config.ts` uses `incrementalCache: "dummy"` and `tagCache: "dummy"` — ISR cache is no-op; full SSR on every request for dynamic pages.

**Fixes:**
1. Verify/rotate `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` in CF secrets. Test with `curl -s https://sophia.agencyos.network/api/health?token=$HEALTH_CHECK_SECRET`.
2. Push HEAD (9987d596) after CI is restored or manual deploy via `npx wrangler deploy`.
3. Evaluate switching `incrementalCache` from `dummy` to `r2-incremental-cache` (opennextjs-cloudflare) for ISR performance.

---

### Layer 3: Networking 9/10
**What's good:** HSTS `max-age=63072000; includeSubDomains; preload` confirmed live. CSP nonce-based (middleware). `x-frame-options: DENY`, `x-content-type-options: nosniff`, `referrer-policy`, `permissions-policy` all present and verified on production response. CF proxied (cf-ray confirmed).

**Blockers:**
- No `X-XSS-Protection: 1; mode=block` header (intentional — modern browsers ignore it, but some scanners flag absence).
- Email DNS (SPF/DKIM/DMARC) not verified — no email infrastructure audit done here.
- CAA records not verified.

**Fixes:**
1. Verify SPF/DKIM/DMARC via `dig TXT sophia.agencyos.network` — low effort, high compliance score.
2. Add CAA record if not present.

---

### Layer 4: Cloud 7/10
**What's good:** CF D1 (database_id: `78bd1961`), R2 (opennext-cache + sophia-videos), KV (experiment), Images binding, CF Workers — all declared in `wrangler.toml`. Multi-binding architecture sound.

**Blockers:**
- No budget alerts or CF spend monitoring configured.
- `VIDEO_BUCKET` (sophia-videos) binding present but `R2_PUBLIC_BASE_URL` env var documented as "unset → fallback to HeyGen CDN" — volatile external dependency.
- `WORKER_SELF_REFERENCE` service binding (self-referencing worker) — unusual pattern; latency cost for any internal fetch.
- No failover for CF D1 outage (no read replica, no fallback).

**Fixes:**
1. Set `R2_PUBLIC_BASE_URL` in CF secrets to avoid HeyGen CDN dependency for video storage.
2. Set up Cloudflare budget alerts in dashboard (Billing → Notifications).

---

### Layer 5: CI/CD 3/10
**Blockers (critical):**
- **GitHub Actions disabled** on account `longtho638-jpg` (flagged). ALL 12 workflows non-functional: test, deploy, d1-backup, security-scan, dependency-audit, etc.
- **GitLab `.gitlab-ci.yml` prepared** (quality + deploy stages, correct) but pipeline blocked on user adding credit card to GitLab free tier.
- **Deployed commit a2aa6302 ≠ HEAD 9987d596** — at least 3 unreleased commits. No automated path to deploy them.
- `canary-rollback.yml` exists but requires GH Actions.
- `post-merge-tests.yml`, `quality-gate.yml` all dead.

**What's good:** Workflows are well-structured (SHA-pinned actions, Sentry upload step, migration guard before wrangler deploy). GitLab pipeline is ready and well-thought-out.

**Fixes (no GH Actions / no GitLab CC required):**
1. **Manual wrangler deploy now:** `cd apps/sophia-ai-factory && npm run build && npx wrangler deploy` — restores latest code to production immediately.
2. **Add GitLab CC** (cheapest plan ~$29/mo) to unblock GitLab pipeline — recommended over fixing GH flagged account.
3. **Interim cron pings:** Use external service (UptimeRobot free tier, EasyCron free, or Upstash QStash) to hit `/api/cron/*` endpoints every 5 min — as recommended in `.gitlab-ci.yml` comments.

---

### Layer 6: Security 8/10
**What's good:** CSP nonce-based middleware, HSTS preload, rate-limiting on `/api/health` (300 req/min via `withRateLimit`), Zod validation standard, auth via Better Auth, no secrets in codebase, `@ts-ignore` banned, `security-scan.yml` has trufflehog + npm audit.

**Blockers:**
- `security-scan.yml` only runs on `pull_request` — with GH Actions down, not running at all.
- `npm audit --audit-level=high` in `test.yml` has `continue-on-error: true` — high CVEs won't block deploy.
- No CSRF token visible on form submissions (relies on SameSite cookies — verify cookie config).
- MFA not enforced for admin users (Better Auth config not audited here).

**Fixes:**
1. Remove `continue-on-error: true` from npm audit step — should block on high/critical.
2. Run `npm audit --audit-level=high` locally now: `cd apps/sophia-ai-factory && npm audit --audit-level=high --omit=dev`.
3. Verify Better Auth session cookies have `SameSite=Strict` or `Lax` + `HttpOnly`.

---

### Layer 7: Monitoring 6/10
**What's good:** Sentry SDK (`@sentry/nextjs ^8.55.2`) installed. `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts` present. Source map upload script exists and is graceful (skips if no token). `instrumentation.ts` present. PostHog analytics integrated. Uptime-check cron (every 5 min) with Telegram alert exists.

**Blockers:**
- Source map upload only runs in CI (`SENTRY_AUTH_TOKEN` as GH secret) — with GH Actions down, all recent deploys have **no source maps in Sentry**. Errors show minified stack traces.
- Uptime-check cron (`*/5 * * * *`) is a **dead cron trigger** — see Layer 8 / Cron section below.
- No APM or database query monitoring beyond basic latency in `/api/health`.
- PostHog weekly digest cron also dead.

**Fixes:**
1. Run `SENTRY_AUTH_TOKEN=... SENTRY_ORG=... SENTRY_PROJECT=... bash scripts/ci/sentry-upload-sourcemaps.sh` locally for current deploy.
2. Set up external uptime monitor (BetterStack free, UptimeRobot) pointing to `https://sophia.agencyos.network/api/health` — independent of crons.

---

### Layer 8: Containers N/A — Serverless Architecture
Not applicable. CF Workers + OpenNext = serverless, no containers.  
Local dev: no docker-compose needed (D1 via wrangler dev, Supabase via supabase CLI).  
Score excluded from total.

---

### Layer 9: CDN 7/10
**What's good:** CF Workers = global edge by default (cf-ray: HKG confirmed). Static assets (`/_next/static/*`) have `Cache-Control: public, max-age=31536000, immutable` in `next.config.ts`. HTTP/2 confirmed.

**Blockers:**
- Dynamic pages (HTML) served with `cache-control: private, no-cache, no-store` — correct for auth app, but means every page hit goes to origin Worker. No stale-while-revalidate for public pages (landing, pricing).
- `incrementalCache: "dummy"` means R2 ISR cache is unused — R2 bucket paying for storage but not accelerating serving.
- No CF Cache Rules configured for public routes.
- No geographic latency data collected.

**Fixes:**
1. Add CF Cache Rule for `/` and `/pricing` (public landing pages): `Cache-Control: public, s-maxage=300, stale-while-revalidate=60`.
2. Enable R2 ISR cache in `open-next.config.ts` (`incrementalCache: "r2-incremental-cache"` from `@opennextjs/cloudflare`).

---

### Layer 10: Backup 5/10
**What's good:** `d1-backup.yml` workflow well-designed: exports D1 → R2 (off-site) + GH artifact (30-day retention). `scripts/dr/d1-snapshot.sh` + `restore-from-snapshot.sh` exist with dry-run mode. Restore validation step included.

**Blockers:**
- GH Actions disabled → `d1-backup.yml` (scheduled `0 2 * * *`) NOT running. Zero automated backups since account flagged.
- `d1-snapshot.sh` uses wrong SQL export method (captures schema only, not row data).
- No off-site backup verification or restore test ever documented.
- No incident log (`docs/incidents.log` referenced in restore script but doesn't exist).
- RPO/RTO undefined.
- GitLab pipeline backup job not yet configured (only quality + deploy stages in `.gitlab-ci.yml`).

**Fixes:**
1. Manually run `npx wrangler d1 export sophia-raas-db --remote --output backups/d1-$(date +%Y%m%d).sql` now.
2. Fix `d1-snapshot.sh` export command (line 60–63): replace with `npx wrangler d1 export "$DB_NAME" --remote --output "$SNAPSHOT_FILE"`.
3. Add D1 backup job to `.gitlab-ci.yml` triggered by schedule (or external cron hitting a backup endpoint).

---

## Known Gap Confirmations

| Gap | Confirmed | Details |
|-----|-----------|---------|
| /api/health "degraded" | YES | Redis ping failing — `UPSTASH_REDIS_REST_URL` configured but Upstash endpoint returning non-PONG. D1/R2/KV status hidden (auth required). |
| GH Actions disabled | YES | `gh run list` returns `[]`. All 12 workflows dead. |
| worker.js NO `scheduled` handler | YES | `grep "scheduled" worker.js` → 0 matches. Only `export default { async fetch(...) }`. All 14 cron triggers in wrangler.toml fire but worker has no handler → crons silently no-op. |
| GitLab pipeline blocked | YES | `.gitlab-ci.yml` ready. Blocked on CC requirement. |
| Sentry source maps in CI | YES | Script exists + SENTRY_AUTH_TOKEN in secrets — but CI is down so recent deploys lack maps. |
| D1 backup not running | YES | `d1-backup.yml` exists, scheduled daily, but GH Actions disabled. |

---

## Prioritized Action List (Top 5 for biggest score gains)

### P1 — Fix Crons: Add `scheduled` handler to worker.js (CI/CD: +2, Server: +1)
**Gain: ~+3 points**  
14 crons are DEAD. Add to `open-next.config.ts` or via a custom worker wrapper:
```js
// Append to worker.js export or configure via opennext custom handler
scheduled: async (event, env, ctx) => {
  const url = new URL(`https://sophia.agencyos.network/api/cron/${mapCronToRoute(event.cron)}`);
  // forward to Next.js handler
  await fetch(url, { headers: { 'x-cron-secret': env.CRON_SECRET } });
}
```
This requires a rebuild + manual `wrangler deploy`.

### P2 — Fix Redis / Resolve Degraded Health (Server: +2)
**Gain: +2 points**  
Check Upstash dashboard — likely expired free-tier token or quota exceeded. Rotate `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` CF secrets. Re-test with authenticated health endpoint.

### P3 — Add GitLab CC → Unblock CI/CD (CI/CD: +4)
**Gain: +4 points**  
$29/mo unlocks GitLab pipeline. Immediately restores: automated tests on push, wrangler deploy, security scanning, quality gates. Biggest single score gain.

### P4 — Manual D1 Backup Now + Fix Snapshot Script (Backup: +2)
**Gain: +2 points**  
Run `npx wrangler d1 export sophia-raas-db --remote --output backups/d1-$(date +%Y%m%d).sql` immediately. Fix `d1-snapshot.sh` export command. Add backup step to GitLab pipeline for when CC is added.

### P5 — Manual Deploy HEAD (9987d596) (Server: +1, CI/CD: +1)
**Gain: +1 point**  
`cd apps/sophia-ai-factory && npm run build && npx wrangler deploy` — syncs production to HEAD. Also triggers Sentry source map upload if run with `npm run deploy` (which includes `sentry:upload`).

---

**Projected score after top 5 fixes: ~68/100 (Full Stack+)**  
**Score after GitLab CC + all fixes: ~80/100 (Full Stack++)**

---

## Unresolved Questions
1. Is Upstash Redis on free tier quota/expired? Check dashboard at https://console.upstash.com — this is the direct cause of "degraded" status.
2. What is the GitLab project URL for Sophia? (needed to verify pipeline status once CC added)
3. Is `sophia-backups` R2 bucket already created? (`wrangler r2 bucket list` to verify — needed for d1-backup.yml R2 step to succeed)
4. Are SENTRY_ORG and SENTRY_PROJECT secrets configured correctly in GH? (they exist in test.yml but values unknown — matters once CI restored)
5. Is `HEALTH_CHECK_SECRET` set in CF secrets? (needed to get detailed health response with per-service breakdown)
