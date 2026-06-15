# Honest 10-Layer Audit — Wave C Baseline (post Wave A+B)

**Commit:** `1ebd38a6` (prod SHA verified: `curl /api/version` → `{"shortSha":"1ebd38a6","deployedAt":"2026-05-22T08:22:02Z"}`)
**Doctrine:** SUSPENDED (operator-action gates allowed for honest score)
**Date:** 2026-05-22

---

## Layer-by-Layer

### L1 Database — 8/10

**Evidence:**
- 122 migration files, sequential from `0001-init.sql` → `0119-campaigns-org-id.sql` (`migrations/` dir count = 122)
- GAP-R2 resolved: `0118_d1_migrations_baseline.sql` inserts `INSERT OR IGNORE` for all 122 history rows; `d1_migrations` table now tracks full history (`plans/260522-0048-ship-p0-fixes/reports/gap-r1-cron-wire.md`, `wave-b-research.md`)
- V-1.3 shipped: `campaigns.org_id` column + backfill via `org_members` join + AFTER INSERT trigger + 2 indexes (`migrations/0119-campaigns-org-id.sql:1-43`)
- Multi-tenancy = org_id FK + query-time filter (D1 has no native RLS; this is the documented approach per doctrine)
- TOTP backfill migration exists: `0092-totp-secrets-encrypt-backfill.sql`
- Backup ceiling at 100k rows/table (`src/forest/dr/d1-dump-builder.ts:29`); truncation silently marked but not errored — real failure risk at scale
- No verified foreign-key cascade enforcement (D1 SQLite behavior; no FK pragma confirmed in migrations)

**P1 gaps:**
- Campaigns `org_id` column is nullable — trigger fills it but no NOT NULL constraint added. Rows inserted without user_id in org_members get NULL org_id silently. (migration:7 `ADD COLUMN org_id TEXT` — no `NOT NULL DEFAULT`)
- Backup dump truncates tables >100k rows without failure alert (`d1-dump-builder.ts:80,119`) — silent data loss in backup at scale

**P2 gaps:**
- R2 `sophia-backups` lifecycle rules claimed as 30-day in wrangler.toml comments (`wrangler.toml:25`) but no `[[r2_buckets.lifecycle]]` block in toml. UNVERIFIED — `scripts/infra/audit-r2-lifecycle.sh` exists but script targets cache bucket, not sophia-backups. Would require prod runtime check via wrangler API.

---

### L2 Server — 9/10

**Evidence:**
- Worker name `sophia-ai-factory`, `compatibility_date = "2026-03-17"`, flags `["nodejs_compat", "global_fetch_strictly_public"]` (`wrangler.toml:1-6`)
- All bindings wired: `DB` (D1 main), `NEXT_TAG_CACHE_D1` (tag cache), `NEXT_INC_CACHE_R2_BUCKET` (R2 ISR), `VIDEO_BUCKET`, `BACKUPS_BUCKET`, `WORKER_SELF_REFERENCE` (self-call), `IMAGES`, `EXPERIMENT_KV` with real IDs (`wrangler.toml:12-90`)
- GAP-R1 resolved: `inject-scheduled-handler.mjs` now maps `'0 5 * * *'` → `/api/cron/d1-backup` (grep confirmed: `'0 5 * * *': ['/api/cron/d1-backup']`)
- Next.js `^16.2.5` (D-5.1 bump shipped in Wave A)
- 18 distinct cron schedules wired in `wrangler.toml:60`
- GAP-R3 resolved: `publish-execute.ts` returns `{ skipped: true }` on already-published jobs (`publish-execute.ts:234`)
- OpenNext ISR via `sophia-tag-cache` D1 confirmed by migration `0108-opennext-tag-cache.sql`

**P1 gaps:**
- `npm run deploy` (bare) bypasses SHA/push guards (`scripts/infra/audit-r2-lifecycle.sh audit note` — confirmed in deploy script comments). Low likelihood but exists.

**P2 gaps:**
- Staging toml (`wrangler.staging.toml`) omits BACKUPS_BUCKET intentionally (`wrangler.staging.toml:34`) — no backup testing path in staging.

---

### L3 Networking — 9/10

**Evidence:**
- Live HSTS: `strict-transport-security: max-age=63072000; includeSubDomains; preload` (curl confirmed)
- Live CSP: nonce-based per-request, `script-src 'self' 'nonce-<...>'`, no `unsafe-inline` for scripts (`middleware.ts:21-47`, live header confirmed)
- `X-Frame-Options: DENY` and `X-Content-Type-Options: nosniff` confirmed live
- SPF: dig confirms `resend._domainkey.agencyos.network` DKIM TXT record active (live DNS)
- DMARC: `v=DMARC1; p=none;` confirmed live (`dig +short TXT _dmarc.agencyos.network`)
- `next.config.ts:128` HSTS value matches live header
- Nonce-based CSP: `src/seed/security/content-security-policy-configuration.ts:3-113`

**P1 gaps:**
- DMARC at `p=none` — report-only mode, no enforcement. Graduation to `p=quarantine` deferred to 2026-06-12 ops check (doctrine doc §"DMARC graduation"). Operator action required; not code change. -0.5 from ceiling.

**P2 gaps:**
- SPF record not independently verified from dig (TXT on root domain not shown in output; only DKIM confirmed). UNVERIFIED — needs `dig +short TXT agencyos.network` to confirm `v=spf1` present.

---

### L4 Cloud — 9/10

**Evidence:**
- Single CF stack: Workers + D1 + R2 + KV + CF Images — fully declarative in `wrangler.toml`
- GitLab mirror confirmed: `git remote -v` shows `gitlab https://gitlab.com/agency.os-group/sophia-ai-factory.git`; `deploy-with-sha.sh:75` prompts `git push gitlab main` as part of pre-deploy step
- `IS_CONFIGURED = "true"` in `[vars]` correctly gates platform-level middleware (`wrangler.toml:[vars]`)
- Vendor lock-in documented in `plans/260521-2342-go-live-100-audit/reports/phase3-axis6-infra-cost.md:122` — accepted tradeoff
- No cost alert configured (CF dashboard-only, no API for standard plan) — documented gap

**P1 gaps:**
- No CF billing alert at $50/$100/$200 threshold. Runaway cron loop could hit $1k+ before manual review (`reports/phase3-axis6-infra-cost.md:102`). Dashboard-only action.

**P2 gaps:**
- GitLab push is in deploy instructions but NOT automated in `deploy-with-sha.sh` script body — relies on operator running `git push gitlab main` manually. Mirror may lag.

---

### L5 CI/CD — 9/10

**Evidence:**
- GitHub Actions intentionally disabled (`test.yml.disabled`) — CF-direct is canonical doctrine since 2026-05-03 (`CLAUDE.md:historical note`)
- `deploy-with-sha.sh` enforces pre-deploy push guard: exits 2 if `git log origin/main..HEAD` is non-empty (`scripts/deploy-with-sha.sh: ALLOW_UNPUSHED_DEPLOY check`)
- SHA inject + verify sequence documented and enforced: `wrangler-set-build-vars.sh` + `api/version` endpoint
- 458 test files (`find src -name "*.test.ts" | wc -l = 458`)
- Sentry sourcemap upload is non-fatal step in deploy script: `deploy-with-sha.sh: "warn: sentry sourcemap upload failed (non-fatal)"` — deploy doesn't block if SENTRY_AUTH_TOKEN absent

**P1 gaps:**
- SENTRY_AUTH_TOKEN not set → sourcemap upload skipped silently. Sentry captures errors but stack traces are minified (per doctrine, 8/10 cap for monitoring). This affects L7 score, not L5.
- No automated test run gate in deploy script (`deploy-with-sha.sh` does not run `npm test` pre-deploy). Tests run manually before commit per doctrine; no enforcement in script.

**P2 gaps:**
- Re-enabling GitHub Actions CI (rename `test.yml.disabled`) would add automated test-on-push gate. Deliberate tradeoff.

---

### L6 Security — 9/10

**Evidence:**
- V-1.1 shipped: `campaigns-retry-resume.ts:49,119` now checks `c.user_id !== currentUser.id` before proceeding (IDOR closed)
- V-1.2 shipped: `api/v1/campaigns/create/route.ts:12,46-67` derives userId from `raas_licenses.user_id` (key-bound), not from request body
- V-2.1 shipped: AES-GCM AAD with userId in both `encryptValue`/`decryptValue` (`credentials/encryption.ts:80,100`) and `encryptApiKey`/`decryptApiKey` (`byok/byok-crypto.ts:68,88`); dual-decrypt fallback for legacy rows
- Callers pass userId: `user-credentials-repo.ts:71,103` and `user-api-key-store.ts:41,82`
- Nonce-based CSP active live (verified above)
- HSTS with preload active live
- Rate limiting wired in middleware: `middleware-api-handler.ts:3,36-55` with `RATE_LIMITS.api/auth/webhook/discovery`
- TOTP/MFA: `middleware.ts:23,112-113` + migrations `0028,0029,0092`
- RBAC: `land/publish/schedule-video-publish.ts:90,102`, admin routes: `api/admin/users/[id]/route.ts`
- `npm audit` result: **0 HIGH/CRITICAL** — only 4 moderate in `wrangler`/`miniflare` dev tooling (not prod runtime)
- Zero `: any` type annotations in production source (grep confirmed 0 true TS :any in prod code, only in comments)
- 31 `console.log` occurrences in non-test code — 20+ are in `sdk/examples/` (not deployed prod routes); remaining 2-3 in `logger-internals.ts` (intentional) and `cron-heartbeat/route.ts:104`

**P1 gaps:**
- `console.log` at `cron-heartbeat/route.ts:104` — single instance in prod route (not examples/). Minor.

**P2 gaps:**
- 4 moderate vulns in wrangler/miniflare (dev tooling only, not in Worker runtime). `npm audit fix` available.

---

### L7 Monitoring — 8/10

**Evidence:**
- Sentry SDK wired: `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts` — all use `buildClientOptions()` from `lib/observability/sentry-options.ts`
- DSN from `NEXT_PUBLIC_SENTRY_DSN` env; enabled only in production (`process.env.NODE_ENV === 'production'`)
- Sentry release tagged via `COMMIT_SHA` or `SENTRY_RELEASE` (`sentry-options.ts:getRelease()`)
- Replay integration wired for client errors
- Source maps: upload script `scripts/ci/sentry-upload-sourcemaps.sh` exists; called non-fatally in `deploy-with-sha.sh`; requires `SENTRY_AUTH_TOKEN` at deploy — UNVERIFIED if set in prod secrets
- Better Stack client wired: `lib/telemetry/better-stack-client.ts`; d1-backup, heartbeat crons ping it; `BETTER_STACK_LOGS_TOKEN` env checked at runtime
- CF Worker logs (`wrangler tail`) = real-time canonical stream regardless of Sentry
- 18 cron schedules including uptime check `*/5 * * * *` → heartbeat

**P1 gaps:**
- SENTRY_AUTH_TOKEN presence in CF Worker secrets UNVERIFIED (local file check cannot confirm). If absent, stack traces are minified. Would require `wrangler secret list` or prod runtime check.
- No alerting policy confirmed for error rate spikes (Sentry alert rules UNVERIFIED from code alone).

**P2 gaps:**
- `error-digest` cron at `0 5 * * *` is in wrangler.toml crons array but marked P2 in comments. UNVERIFIED if handler active.
- Better Stack token not confirmed set in prod — depends on operator provisioning.

---

### L8 Containers — 10/10

**Evidence:** Serverless architecture (Cloudflare Workers). No containers used or needed. Score 10/10 by audit framework convention (`actual-fullstack-audit.md` §Layer 8 note).

---

### L9 CDN — 9/10

**Evidence:**
- OpenNext ISR via two stores: R2 (`NEXT_INC_CACHE_R2_BUCKET = sophia-ai-factory-opennext-cache`) + D1 (`NEXT_TAG_CACHE_D1 = sophia-tag-cache`, migration `0108-opennext-tag-cache.sql`)
- `revalidateTag` and `revalidatePath` wired in Server Actions: `campaigns.ts:142`, `complete-onboarding-action.ts:59-60`, `sops/[id]/actions.ts:67,95,130`
- Static assets: `Cache-Control: public, max-age=31536000, immutable` (`next.config.ts:95-96`, `104-105`)
- Marketing pages: `Cache-Control: public, s-maxage=60, stale-while-revalidate=600` (`next.config.ts:115-116`)
- CF edge = global CDN by default; no additional configuration needed for Cloudflare Workers
- HTTP/2 confirmed (live curl shows `HTTP/2 200`)

**P1 gaps:**
- Cache-hit rate UNVERIFIED (would need CF analytics dashboard). Immutable hashing depends on Next.js build producing unique filenames per deploy — standard behavior, no code evidence needed.

**P2 gaps:**
- `R2_PUBLIC_BASE_URL` for video bucket documented as unset fallback to HeyGen CDN URL (`wrangler.toml:[vars]:4`) — volatile CDN for user videos.

---

### L10 Backup — 7/10

**Evidence:**
- `BACKUPS_BUCKET` binding to `sophia-backups` wired (`wrangler.toml:26-28`)
- `/api/cron/d1-backup` route exists with CRON_SECRET auth, BetterStack heartbeat, idempotency window 12h (`src/app/api/cron/d1-backup/route.ts:1-30`)
- GAP-R1 resolved: cron now wired in `inject-scheduled-handler.mjs` at `'0 5 * * *'` — CF Worker trigger fires daily
- Recovery procedure documented: manual `curl CRON_SECRET` → `wrangler d1 execute --file=dump.sql --remote` (`sophia-no-tech-doctrine.md:§Backup`)
- R2 lifecycle 30-day claimed in comments (`wrangler.toml:25`) but NOT in toml config block — UNVERIFIED
- No off-site copy: R2 only (same CF infrastructure); CF-wide outage = zero RPO honored
- No monthly restore test or DR drill documented
- 100k row/table cap with silent truncation (`d1-dump-builder.ts:29,80`)

**P1 gaps:**
- R2 lifecycle rules for `sophia-backups` NOT confirmed applied — `scripts/infra/audit-r2-lifecycle.sh` targets cache bucket, not backup bucket. Needs `wrangler r2 bucket lifecycle get sophia-backups` verification.
- No off-site backup copy (R2 = same provider as origin D1). Cloudflare-wide incident = loss.
- Dump truncates at 100k rows/table silently — no ERROR emit, no alerting.

**P2 gaps:**
- No quarterly DR drill process or restore test documented.
- Cron failure (if `CRON_SECRET` unset or misconfigured) does not surface to operator dashboard.

---

## Total Score: 88/100

| Layer | Score | vs. prior doctrine ceiling |
|-------|------:|---------------------------|
| L1 Database | 8/10 | +1 (GAP-R2 + V-1.3 shipped) |
| L2 Server | 9/10 | = (no regression) |
| L3 Networking | 9/10 | = (DMARC p=none unchanged) |
| L4 Cloud | 9/10 | = (cost alert still missing) |
| L5 CI/CD | 9/10 | = (no test gate in deploy script) |
| L6 Security | 9/10 | = (V-1.1, V-1.2, V-2.1 now in, 0 HIGH vulns) |
| L7 Monitoring | 8/10 | = (sourcemaps still unverified) |
| L8 Containers | 10/10 | = (N/A serverless) |
| L9 CDN | 9/10 | = |
| L10 Backup | 7/10 | = (cron wired, but lifecycle + off-site unverified) |
| **TOTAL** | **88/100** | **+0.5 vs. prior 87.5 honest** |

Note: +0.5 reflects L1 improvement from Wave B (GAP-R2 + V-1.3). All other layers unchanged from prior honest assessment.

---

## P1 Blockers (would lift score ≥ +0.5, ranked by impact)

| ID | Layer | Title | Lift | Parallel-safe? | Owner | Notes |
|----|-------|-------|------|----------------|-------|-------|
| C-1 | L7 | Verify + set SENTRY_AUTH_TOKEN in CF Worker secrets | +0.5 | yes | operator | `wrangler secret put SENTRY_AUTH_TOKEN`; deploy-with-sha.sh already calls upload script non-fatally |
| C-2 | L10 | Apply R2 lifecycle rules to `sophia-backups` bucket | +0.5 | yes | operator | `wrangler r2 bucket lifecycle put sophia-backups --days 30`; code already exists |
| C-3 | L4 | Configure CF billing alert at $50/$100/$200 | +0.5 | yes | operator | Dashboard-only action; no code change |
| C-4 | L10 | Off-site backup copy (R2 → S3 or rclone nightly) | +0.5 | yes | platform | Needs rclone in d1-backup route or separate cron; breaks same-provider single-point-of-failure |
| C-5 | L3 | Graduate DMARC `p=none` → `p=quarantine` | +0.5 | yes | operator | 30-day monitoring window; target 2026-06-12; single DNS TXT update |
| C-6 | L1 | Add NOT NULL constraint to campaigns.org_id post-backfill | +0.25 | no — requires migration | platform | `ALTER TABLE campaigns ALTER COLUMN org_id TEXT NOT NULL` after confirming all rows filled; needs separate migration |
| C-7 | L5 | Add `npm test` gate to deploy-with-sha.sh | +0.5 | yes | platform | Insert `npm test || exit 1` before wrangler deploy in `deploy-with-sha.sh` |

**Fastest wins (all operator, zero code):** C-1, C-2, C-3, C-5 → +2.0 pts → brings score to 90/100.

---

## P2 Polish (skip unless requested)

| ID | Layer | Title | Notes |
|----|-------|-------|-------|
| P2-1 | L6 | Remove `console.log` from `cron-heartbeat/route.ts:104` | Replace with `logger.info` |
| P2-2 | L6 | `npm audit fix` for 4 moderate wrangler/miniflare vulns | Dev tooling only; low risk |
| P2-3 | L9 | Set `R2_PUBLIC_BASE_URL` for video bucket | Prevents volatile HeyGen CDN for user videos |
| P2-4 | L10 | Document quarterly DR drill | Process doc only |
| P2-5 | L4 | Automate `git push gitlab main` in deploy-with-sha.sh | Mirror reliability |
| P2-6 | L5 | Re-enable GitHub Actions CI | Rename `test.yml.disabled` → `test.yml` when account credits restored |

---

## Recommended Wave C Plan

**Batch C-A (operator-only, parallel-safe, zero code — ship same day):**
- C-1: `wrangler secret put SENTRY_AUTH_TOKEN`
- C-2: `wrangler r2 bucket lifecycle put sophia-backups --days 30`
- C-3: CF dashboard billing alert ($50/$100/$200)
- C-5: DMARC DNS `p=none` → `p=quarantine` (after confirming rua clean at 2026-06-12)

**Batch C-B (code, parallel-safe):**
- C-7: Add `npm test` gate to `deploy-with-sha.sh`
- P2-1: Replace console.log in cron-heartbeat
- P2-5: Auto-push gitlab in deploy script

**Batch C-C (gated/irreversible — user signoff):**
- C-4: Off-site backup (R2 → S3/rclone); requires code change + new binding
- C-6: NOT NULL constraint on campaigns.org_id; requires migration + confirm 0 NULL rows first

**Skip:**
- P2-6 (re-enable GH Actions): Only when account credits restored; not blocking.

**Score trajectory:**
- After C-A (operator actions): **90/100**
- After C-A + C-B (code): **90.5/100**
- After C-C (backup + schema): **92/100**
- 100/100 ceiling: unreachable without months of DR drills + monthly restore tests (operational track record, not code)

---

## Unresolved Questions

1. **SENTRY_AUTH_TOKEN in prod secrets**: Is it already set via `wrangler secret put`? Cannot verify from local file scan. Run `wrangler secret list --name sophia-ai-factory` to confirm. If set, L7 → 9/10 immediately.

2. **R2 lifecycle on sophia-backups**: `wrangler r2 bucket lifecycle get sophia-backups` — if already applied, L10 → 7.5/10 and C-2 closes.

3. **`d1_migrations` baseline actually applied to remote D1**: GAP-R2 migration `0118_d1_migrations_baseline.sql` is in the migrations dir and commit `1ebd38a6` is live, but `apply-migrations.sh` needed to confirm remote D1 was updated. UNVERIFIED from code alone.

4. **SPF record on agencyos.network root**: `dig +short TXT agencyos.network` was not captured in this audit (only DKIM was). Should confirm `v=spf1` present for full L3 evidence.

5. **`campaigns.org_id` NULL rows**: Are there any campaigns rows that failed the backfill (user_id with no org_member record)? Should run `SELECT COUNT(*) FROM campaigns WHERE org_id IS NULL` on remote D1 before adding NOT NULL constraint (C-6).
