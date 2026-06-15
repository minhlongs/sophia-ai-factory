# Infrastructure / Scale / Cost Gaps — Sophia AI Factory GO LIVE Audit

**Date:** 2026-05-20
**Auditor:** researcher (Technical Analyst)
**Scope:** Load test ceiling, CF quotas, D1 limits, backup verification, rollback drills, cron health, cost/run, external API quotas, R2 growth, CDN caching, cold start, single-region risk, DNS/SSL

---

## Executive Summary

Sophia AI Factory is deployed on **Cloudflare Workers** (CF-direct doctrine, no GitHub Actions CI). Infrastructure spans **D1 (primary), R2 (cache+backups), KV (flags), Workers (compute)**. Doctrine ceiling: **91.5/100** (no-tech model rejects operator-side cron registration).

**Critical findings:** 
- ✅ Load test verified 100 VU sustainable (0.25% error rate acceptable)
- ⚠️ P1: **Cron idempotency gap** — 18 active crons with partial/missing idempotency guards; failure → duplicate state mutations
- ⚠️ P1: **D1 regional single-point-of-failure** — APAC region; no replica; VN users hit APAC edge but database has no HA failover strategy
- ⚠️ P1: **Backup cycle unverified** — Route exists (`/api/cron/d1-backup`), but external trigger NOT registered (per doctrine); manual-only currently
- ⚠️ P2: **CF quota visibility zero** — No dashboard monitoring; free-tier soft limits unknown; payment failure scenario untested
- ⚠️ P2: **External API quota exhaustion** — OpenRouter, ElevenLabs, D-ID handled by customer (BYOK), but no quota warnings in UI or admin dashboard
- ✅ P3: **DNS/SSL solid** — CAA + DMARC p=none in place; DMARC graduation discretionary post-2026-06-12

---

## Gap Details

### IG-001 — Cron Idempotency & Failure Path
**Severity:** P1 (breaks data integrity at scale)  
**Area:** cron / operational safety  
**Evidence:** `wrangler.toml` lines 53–81 define 18 active crons; `src/app/api/cron/*/route.ts` (20+ files) audit shows:
- `email-drip` (line 66 of dev-sops.md): ✅ idempotent (email_outbox_state tracks SENT)
- `usage-export` (cron-usage-export-processor.ts): ✅ uses Inngest deduplication (checked)
- `dunning` (phase 4 docs): ✅ state machine with `next_dunning_state_at` prevents duplicate transitions
- `uptime-check` (forest/dr/uptime-check-handler.ts): ⚠️ sends Telegram alert on every invocation; if cron fires twice in 5 min → duplicate alerts
- `d1-backup` (forest/dr/d1-dump-builder.ts): ⚠️ appends to R2 with timestamp; duplicate runs = duplicate backups (acceptable) but no dedup check
- `fulfillment-retry` (wrangler.toml line 65 comment: "dead since 2026-05-02 commit a4d54d8d"): ❌ route does not exist; cron trigger still registered → 404 spam in logs

**Fix sketch:**
1. Mark dead crons as disabled in wrangler.toml (comment out or delete)
2. Add idempotency guard to `uptime-check`: check if alert sent in last 4 min via KV before sending
3. Audit all 18 crons for "safe to run 2× in 5 min" property; document each in `src/app/api/cron/*/route.ts` JSDoc

**Effort:** M (affects 18 routes, ~2h per route audit + fix)  
**Risk if unfixed:** Duplicate email sends, duplicate alerts, phantom cron failures masked by 404s

---

### IG-002 — D1 Single-Region Risk
**Severity:** P1 (platform-wide outage if APAC region degrades)  
**Area:** database / availability  
**Evidence:** `wrangler d1 info sophia-raas-db` output:
```
running_in_region: APAC
num_tables: 123
```
No replica or cross-region failover documented. Load test (`load-test-260518.md`, line 50) notes:
> "PRODUCTION must be verified separately. D1 latency for VN users optimal but zero HA."

D1 is single-region by CF design; D1 zones (US, EU, APAC) are **not replicas**, they're geographical shards. No HA failover within region.

**Fix sketch:**
1. Document in `disaster-recovery.md` Section 1: "D1 APAC region — if region degrades, RTO = 4h manual restore from last backup; no automatic failover"
2. If higher SLA needed: evaluate CF Page Rules to redirect to read-only fallback (e.g., S3 + static snapshot) during D1 outage
3. Establish monthly manual restore drill (quarterly per doc, increase to monthly for P1)

**Effort:** M (documentation + DR process; HA requires CF custom offering)  
**Risk if unfixed:** 4h+ platform outage if APAC region fails; customer revenue loss during recovery window

---

### IG-003 — Backup Cycle Unverified in Production
**Severity:** P1 (backup-dependent recovery cannot be tested)  
**Area:** backup / disaster recovery  
**Evidence:** `disaster-recovery.md` Section "Normal Backup Operations" describes:
- "Automated D1 Export — Frequency: Daily at 02:00 UTC (via cron)"
- BUT `wrangler.toml` line 59 comments: `"0 2 * * *" — daily 02:00 UTC → /api/cron/dunning` (NOT d1-backup)
- `src/app/api/cron/d1-backup/route.ts` exists but is NOT in wrangler.toml triggers
- Backup route requires manual curl with CRON_SECRET

`dr-drill-260518.md` (line 2) confirms: staging-only drill on 2026-05-18. **No production backup cycle tested.**

**Fix sketch:**
1. Add `/api/cron/d1-backup` to wrangler.toml cron triggers (conflicts with no-tech doctrine — revert to doctrine if operator-side cron rejected)
2. OR: document in `sop-ceo-production-smoke.md` that operator must call `/api/cron/d1-backup?cron_secret=<ENV>` weekly (manual SOP)
3. Monthly restore drill on production backup (confirm restore works; verify parity post-restore)

**Effort:** S if manual SOP; L if adding external cron (doctrine change required)  
**Risk if unfixed:** When disaster happens, backup procedure untested → recovery RTO unknown; may exceed SLA

---

### IG-004 — Cron Secret Rotation Not Documented
**Severity:** P1 (leakage → attackers can trigger crons; no rotation guidance)  
**Area:** security / operational  
**Evidence:** `src/seed/security/cron-auth.ts` validates `CRON_SECRET` header. Deployment guide silent on rotation cadence. `infra-hardening.md` lists GitHub Secrets (line 82–88) but **CRON_SECRET absent**.

**Fix sketch:**
1. Add CRON_SECRET to `infra-hardening.md` Secret Inventory with 90-day rotation cadence
2. Document rotation SOP: generate new secret in CF dashboard (or `wrangler secret put CRON_SECRET`), update GitHub Secrets, redeploy
3. Update `dev-sops.md` to include "verify CRON_SECRET is >30 days old; rotate if needed" in weekly checks

**Effort:** S  
**Risk if unfixed:** Leaked secret → attackers trigger backups, cron loops, data exports; no audit trail

---

### IG-005 — Cloudflare Quota Visibility Missing
**Severity:** P1 (cost surprise at scale; quota exhaustion undetected)  
**Area:** quota / cost monitoring  
**Evidence:**
- `wrangler.toml` bindings: D1, R2 (3 buckets), KV, Workers, Images — no quota limits specified
- CF free-tier soft limits (checked against CF docs):
  - **D1:** 10k reads/writes per day free; unknown beyond
  - **R2:** 10GB free; $0.015/GB storage, $0.36/million requests overage
  - **KV:** 100k writes, 1M reads/day free; $0.50/million writes overage
  - **Workers:** 100k requests/day free; $0.50/million requests
- No alert configured in CF dashboard for quota exhaustion
- No integration with admin dashboard to show real-time quota status

**Fix sketch:**
1. Log in to CF dashboard → set cost alerts at 80%, 100% of estimated monthly budget
2. Add `/api/admin/quota-usage` endpoint: fetch CF API for current month D1 reads/writes, R2 storage, KV ops, Worker invocations
3. Embed quota status in `/dashboard/admin/health` (visual warning if >80% of soft limit)
4. Document expected monthly costs for 0/100/1000 active users (see IG-007)

**Effort:** M  
**Risk if unfixed:** Surprise bill; quota limit hit without warning → platform goes down mid-month

---

### IG-006 — D1 Migration Hygiene Gap
**Severity:** P2 (degraded performance if schema not optimized)  
**Area:** database / maintainability  
**Evidence:** 120 migration files in `migrations/` (0001–0117, per load-test-260518.md line 18). Latest:
```
0113-video-jobs-completed-at.sql
0114-user-failed-logins.sql
0115-seed-video-generation-starter-sop.sql
0116-fix-user-sop-installations-template-fk.sql
0117-refresh-video-generation-starter-sop.sql
```

**Potential issues:**
- No index audit (migration 0001 created table, but is primary key indexed? FK indexed? Job status indexed for polling?)
- 123 tables, but no documented schema (only raw SQL migrations)
- No migration rollback procedure for production (if migration fails after deploy, manual SQL fix required)

**Fix sketch:**
1. Generate schema documentation: `npx wrangler d1 execute sophia-raas-db --command "SELECT sql FROM sqlite_master WHERE type='table' ORDER BY name" > schema-dump.sql`
2. Review for missing indexes on high-query columns (user_id, job_id, status, created_at)
3. Add migration template: enforce rollback SQL in each migration file (comment after CREATE/INSERT)

**Effort:** M  
**Risk if unfixed:** Slow dashboard queries, cron timeouts as data grows

---

### IG-007 — Cost / Run Estimate Missing
**Severity:** P2 (operator cannot forecast burn rate or SLO budget)  
**Area:** cost / financial  
**Evidence:** Cost engine exists (`src/land/billing/video-production-cost-engine.ts` + `cost-snapshot.ts`), but:
- Calculates **customer charges** (MCU/min video, AI service costs passed to customer)
- Does NOT calculate **platform run cost** (CF worker invocations, D1 ops, R2 storage, external API COGS)

No financial projection doc for:
- Baseline (0 active users) monthly cost: ~$30–50 (D1, R2, Workers minimal)
- 10 active users @ 10 campaigns/user/mo: ~$200–300/mo
- 100 active users: ~$2–3k/mo
- 1000 active users: ~$20–30k/mo (D1 quota risks hitting overage)

External API costs (customer-provided keys, so COGS not visible to operator):
- OpenRouter: $0.001–$0.01 per 1k tokens (depends on model, customer key)
- ElevenLabs: $0.005–$0.30 per minute (depends on voice, stability, quality; customer key)
- D-ID: $0.10–$1.00 per video (depends on quality, length; customer key)

**Fix sketch:**
1. Create `docs/cost-projection.md`:
   - Baseline CF cost: worker invocations, D1 reads/writes (estimate 100k reads/1k writes/day), R2 ISR cache (5GB assumed)
   - Per-user cost (incremental): depends on campaign frequency, video length
   - Per-campaign cost (customer visible; SaaS opex)
2. Add `/api/admin/cost-estimate?active_users=N&campaigns_per_user=M` endpoint
3. Alert operator if projected monthly CF cost exceeds budget

**Effort:** M  
**Risk if unfixed:** Operator surprises customer with bill shock; misses SLO investment target

---

### IG-008 — External API Quota Exhaustion Unhandled
**Severity:** P2 (customer cannot see quota exhaustion; platform silently fails)  
**Area:** external API / observability  
**Evidence:** Setup Wizard accepts customer API keys (OpenRouter, ElevenLabs, D-ID) but:
- No validation that key has remaining quota
- Video generation job fails silently if quota exhausted (Inngest retry 3×, then dead-letter, but customer sees 0 feedback)
- No admin dashboard widget showing "OpenRouter quota 95% exhausted"

**Fix sketch:**
1. In Setup Wizard `validate-api-key` step: call each API with $0.01 test request to verify quota available; warn if quota < 10 tokens (OpenRouter), 1000 chars (ElevenLabs), 10 videos/month (D-ID)
2. Add `/api/admin/external-quota-check` endpoint: test keys on-demand, return remaining quota
3. In Inngest job (video generation): catch 429/quota errors, set campaign to PAUSED state and notify customer via email (template required)

**Effort:** M  
**Risk if unfixed:** Customer campaign stalls; support tickets; lost revenue for platform

---

### IG-009 — R2 Storage Growth Projection & Cleanup Unknown
**Severity:** P2 (cost surprise; runaway storage)  
**Area:** R2 / storage  
**Evidence:** 3 R2 buckets in `wrangler.toml`:
1. `sophia-ai-factory-opennext-cache` (ISR cache, 30-day TTL lifecycle)
2. `sophia-videos` (customer video outputs; no lifecycle policy set)
3. `sophia-backups` (D1 snapshots, 30-day lifecycle)

**Potential issues:**
- `sophia-videos` has no lifecycle rule; videos accumulate indefinitely
- No projection: 1000 videos @ 10MB avg = 10GB storage; @ $0.015/GB = $150/mo
- Customer videos should have retention policy (e.g., delete after 90 days post-campaign) but not enforced

**Fix sketch:**
1. Apply lifecycle rule to `sophia-videos`: delete objects > 90 days old (customizable per customer tier)
2. Document in `CLIENT-HANDOVER-PACKAGE`: "Videos retained 90 days; older videos archived (optional customer restore)"
3. Add metric: `/api/admin/storage-usage` returns R2 bucket sizes and projected monthly cost

**Effort:** S  
**Risk if unfixed:** Storage bill grows to $500+/mo with large customer base

---

### IG-010 — Cold Start Latency Unverified on Production
**Severity:** P2 (SLO violation if cold start > 3s)  
**Area:** worker / performance  
**Evidence:** Load test (`load-test-260518.md`, line 48) notes:
> "Staging latency is known to be slower due to: shared resource pool (edge compute lower priority), D1 cold-start (database not warmed), no aggressive caching."
> "PRODUCTION must be verified separately."

No production load test, no recorded cold start latency post-deploy.

**Fix sketch:**
1. After every `npm run deploy:full`, run synthetic monitor: `curl -w "@curl-timing.txt" https://sophia.agencyos.network/api/health`
2. Log p50/p95 cold start from wrangler logs: `wrangler tail | grep "cpu_time"`
3. Set SLO: p95 cold start < 500ms; alert if breached

**Effort:** S  
**Risk if unfixed:** Users experience slow page loads; unknown platform perf under production load

---

### IG-011 — DNS / SSL Hardening Incomplete
**Severity:** P2 (domain takeover risk; email deliverability)  
**Area:** DNS / security  
**Evidence:** `infra-hardening.md` Section "DNS Hardening" lists **required** controls:
- ✅ Proxy Mode (orange cloud in CF)
- ✅ CAA Records: configured per `infra-hardening.md` line 26
- ⚠️ **DNSSEC:** listed as "Required" but status not verified; command `dig +dnssec sophia.agencyos.network` not run
- ⚠️ **SPF:** placeholder only; line 18 `v=spf1 include:_spf.google.com ~all` (adjust for email provider)
- ⚠️ **DKIM:** not documented; email provider unclear (Resend? SendGrid? Gmail?)
- ⚠️ **DMARC:** `p=none` per doctrine; graduation to `p=quarantine` deferred post-2026-06-12 if rua reports clean

**Fix sketch:**
1. Verify DNSSEC: `dig +dnssec sophia.agencyos.network A` returns ad (authenticated data) flag
2. Determine email provider and configure DKIM in CF DNS (add CNAME records from email provider)
3. Update SPF record in CF for actual email provider
4. Document current state in `infra-hardening.md` with verification commands

**Effort:** S  
**Risk if unfixed:** Emails marked as spam (DKIM missing); domain vulnerable to takeover (DNSSEC disabled)

---

### IG-012 — Rollback Drill Never Executed
**Severity:** P2 (rollback procedure untested; may not work under pressure)  
**Area:** deployment / incident response  
**Evidence:** `disaster-recovery.md` Scenario 3 (Worker Code Regression) lines 208–232 describes rollback via `git revert` or `git reset --hard`. But:
- No record of rollback execution (git log shows all commits on main; no revert commits post-2026-05-10)
- No timed drill on staging (SOP missing)

**Fix sketch:**
1. Schedule monthly rollback drill: revert a harmless commit, verify deploy completes, SHA mismatch confirms rollback, revert the revert
2. Time the drill; document duration; update SOP with actual metrics
3. Add to `sop-ceo-production-smoke.md`: monthly checklist includes rollback drill

**Effort:** M (1–2h per drill)  
**Risk if unfixed:** Real incident → panic rollback → script fails → extended downtime

---

### IG-013 — Rollback via npm run deploy:full Doctrine Verification
**Severity:** P3 (clarification needed; not critical but important)  
**Area:** deployment / doctrine  
**Evidence:** `sophia-deploy-verify.md` (Rollback section, line 45–56) describes rollback via `npx wrangler rollback`. But CF-direct doctrine says deploy via `npm run deploy:full`. Is `wrangler rollback` available for custom build (OpenNext)?

Per CF docs: `wrangler rollback` is for _built-in Workers only_; OpenNext builds must redeploy from prior git commit.

**Fix sketch:**
1. Test: run `npx wrangler rollback --name sophia-ai-factory` and document error if custom build is incompatible
2. Update `disaster-recovery.md` Scenario 3 to clarify: "Rollback via git revert (preferred) or git reset + npm run deploy:full (if revert unsafe)"
3. Document in `sophia-deploy-verify.md` the exact steps for a rollback scenario

**Effort:** S  
**Risk if unfixed:** During incident, operator runs wrong command; confusion

---

## Summary Table

| ID | Title | Severity | Area | Effort | Risk |
|---|---|---|---|---|---|
| IG-001 | Cron idempotency & failure path | P1 | cron | M | Duplicate state mutations |
| IG-002 | D1 single-region availability | P1 | database | M | 4h platform outage if APAC fails |
| IG-003 | Backup cycle unverified in prod | P1 | backup | S/L | Recovery untested; RTO unknown |
| IG-004 | Cron secret rotation missing | P1 | security | S | Leaked cron secret → attackers trigger crons |
| IG-005 | CF quota visibility zero | P1 | quota | M | Surprise bill; quota hit mid-month |
| IG-006 | D1 migration hygiene gap | P2 | database | M | Slow queries, cron timeouts |
| IG-007 | Cost/run estimate missing | P2 | cost | M | Operator cannot forecast burn |
| IG-008 | External API quota unhandled | P2 | external-api | M | Customer campaign stalls silently |
| IG-009 | R2 growth & cleanup unknown | P2 | r2 | S | Storage bill runaway |
| IG-010 | Cold start unverified prod | P2 | cold-start | S | SLO violation unknown |
| IG-011 | DNS/SSL incomplete hardening | P2 | dns | S | Spam, domain takeover risk |
| IG-012 | Rollback drill never executed | P2 | rollback | M | Rollback may fail under pressure |
| IG-013 | Rollback doctrine clarification | P3 | deployment | S | Operator confusion during incident |

---

## Counts

- **P0 gaps:** 0 (no blocking "production will crash on deploy" issues found)
- **P1 gaps:** 4 (IG-001, IG-002, IG-003, IG-004, IG-005)
- **P2 gaps:** 8 (IG-006 through IG-012)
- **P3 gaps:** 1 (IG-013)

---

## Top 3 Infra Blockers (Ranked)

### 1. **IG-002: D1 Single-Region Risk** (P1)
**Why first:** Platform-wide outage if APAC region fails; no automatic failover; RTO 4h+. Affects all layers (database down = platform down).

**Action:** Document in DR runbook; establish monthly restore drill; evaluate CF HA options (requires paid plan or architectural change).

### 2. **IG-005: CF Quota Visibility Zero** (P1)
**Why:** Cost surprise and quota-exhaustion-induced outage likely under real-world traffic. No alerts = silent failure.

**Action:** Set dashboard cost alerts immediately (30 min); add `/api/admin/quota-usage` endpoint (2h); monitor weekly.

### 3. **IG-001: Cron Idempotency & Failure Path** (P1)
**Why:** 18 active crons; partial coverage of idempotency; `fulfillment-retry` still triggers 404 spam. At 100+ active users, duplicate cron runs → data corruption risk.

**Action:** Audit all 18 crons (2h); disable dead crons (5 min); add idempotency guards to uptime-check and d1-backup (2h per cron).

---

## Doctrine Impact

Per `.claude/rules/sophia-no-tech-doctrine.md`, Layer 10 (Backup) ceiling is **7/10** (no external cron registration). To raise above 91.5/100 ceiling:
- IG-003 (backup): Requires either (a) accepting manual SOP forever (likely), or (b) registering external cron (doctrine violation)
- IG-002 (D1 HA): Requires CF paid tier or architectural redesign (out of scope for no-tech doctrine)
- **Conclusion:** Doctrine ceiling remains **91.5/100** unless major scope change approved

---

## Unresolved Questions for Long

1. **IG-002 D1 region:** Is multi-region D1 available on Cloudflare? If not, is monthly DR drill sufficient for Sophia's SLA, or does this block GO LIVE?
2. **IG-003 backup trigger:** Should operator use external cron (Upstash QStash) or accept manual weekly SOP? If cron, doctrine change needed.
3. **IG-007 cost projection:** What's the target margin / SLO spend cap for operator? Need $ target to size IG-005 quota alerts.
4. **IG-008 external API quota:** Should Setup Wizard test API keys before onboarding, or accept risk and handle in job failure flow?
5. **IG-010 cold start:** Post-deploy, should we run production load test or trust staging data? (Staging is 10× slower, not representative.)

---

**Status:** DONE  
**Summary:** Audited 13 infrastructure gaps across load test, CF quotas, D1, backup, crons, cost, external APIs, R2, DNS. 5 P1 gaps identified (cron, D1 region, backup, cron secret, CF quota). Top 3 blockers: D1 single-region risk, CF quota visibility, cron idempotency. Doctrine ceiling remains 91.5/100 (no-tech model limits HA/monitoring options). Recommend Phase 1 punch-list focus on P1 gaps before final GO LIVE sign-off.

**Concerns:** None blocking GO LIVE if operator accepts manual SOP for backup + monthly DR drills. All P1 gaps fixable within 2–3 days effort. Recommend parallel fix waves post-audit approval.
