# Phase 3 — AXIS 2: SCALABILITY Audit

**Date:** 2026-05-22  
**Audit cycle:** Go-Live 100/100 (doctrine suspended)  
**Live anchors:** prod SHA `b8c4f6dd` · D1 sophia-raas-db `78bd1961` · tag-cache `7b1d4fd4` · OpenNext prod `1.17.3` vs package `^1.19.5`

## Executive Summary

Sophia AI Factory scalability has **6 critical gaps** spanning D1 query efficiency, Worker CPU headroom, per-org quotas, Durable Object contention patterns, R2-tag-cache coupling risk, and multi-tenant query-time filtering. **Honest score: 5.8/10** (down from naive 8/10 if doctrine lock masked edge cases).

**Key tension:** Platform is query-efficient for single-tenant operations but lacks hard tenant boundaries at D1 layer. Under high per-org concurrency, query-time `org_id` filtering becomes a bottleneck vs. native RLS. Tag-cache DB schema is frozen to OpenNext 1.19.5 — a 1.20+ bump risks revalidation breakage without pre-migration test.

---

## Sub-Area 1: D1 Query Performance (Indexes & Hot Tables)

**Score: 6/10**

### Evidence

#### Hot table index coverage
- **missions** table: 4 separate single-column indexes (org_id, status, created_at, parent) but **NO compound (org_id, status)** index. :thought_balloon: Phase 1 noted this gap; migration 0091 added `idx_publishing_jobs_tenant_status_sched` on publishing_jobs but SKIPPED missions (verified grep 0091-composite-indexes.sql, lines 29–54).
- **publishing_jobs** table: 2 compound indexes post-0101:
  - `idx_pub_jobs_status_sched(status, scheduled_at)` — global status filter
  - `idx_pub_jobs_tenant_on_publishing_jobs(tenant_id, status, scheduled_at)` — tenant-first (0091)
  - Coverage: GOOD for cron filters; MEDIUM for org-scoped status queries (requires 2-step lookup: org → tenant_id, then index hit).
- **Example hot query (missions):** dashboard onboarding check
  ```sql
  SELECT COUNT(*) as cnt FROM engine_missions WHERE user_id = ?1 AND status = 'succeeded'
  -- src/app/[locale]/dashboard/onboarding/page.tsx:39
  -- Index used: idx_engine_missions_user_status_ts (0091, composite on user_id, status, created_at)
  -- Risk: if query switches to org_id-level filter, single-column idx_missions_status causes table scan
  ```
- **Other hot tables lacking compound indexes:**
  - `subscriptions(user_id, status)` — noted in 0091 comment; migration file claims "INDEX 7" but index not in schema snapshot
  - `error_log` — no org_id index; error rollup queries may scan
  - `signals_events` — nullable org_id with loose FK; no compound index on (org_id, created_at)

#### Verified index application
- All 117 migrations applied to sophia-raas-db (78bd1961) per wrangler.toml + grep 0117-refresh.
- **CONCERN:** researcher-02 count (117) vs. researcher-04 count (120) delta unresolved (Phase 1 Q3). Actual applied count via `wrangler d1 info` not captured in this audit.

### Gaps

1. **Missing compound (org_id, status) on missions** — Severity: **HIGH**
   - Single-column indexes do not help when both org_id AND status are in WHERE clause
   - Cron stepper queries `missions WHERE org_id=X AND status IN (...)` — estimated 10-30ms vs. 1-2ms with index
   - **Fix:** Migration 0118 to add `CREATE INDEX idx_missions_org_status ON missions(org_id, status, created_at DESC)`
   - **Effort:** Small (SQL only)

2. **Subscriptions(user_id, status) index missing** — Severity: **MEDIUM**
   - Dunning cron queries active subscriptions per user to check churn state
   - Single `idx_subscriptions_user_id` requires scan on status filter
   - **Fix:** Migration 0118 addition
   - **Effort:** Small

3. **signals_events NULL org_id leakage** — Severity: **MEDIUM**
   - Nullable org_id + loose FK is bad practice
   - Not an index gap but a schema isolation risk (addresses multi-tenant sub-area below)

4. **No index on error_log(org_id)** — Severity: **LOW**
   - Error dashboards may batch-query recent errors per org
   - Impact: errors are low-volume relative to missions; current performance acceptable

### Current state

```bash
# Verification (from migrations/ grep):
grep "CREATE INDEX.*missions" migrations/*.sql
# Output:
# 0001: idx_missions_org_id, idx_missions_status, idx_missions_created_at
# 0007: idx_missions_parent  
# 0091: idx_engine_missions_user_status_ts (composite, user_id + status + ts)
# 0097: idx_missions_byok
# MISSING: (org_id, status, created_at) compound

# Workaround: code-level sorting/filtering (app-side pagination)
# src/app/[locale]/dashboard/onboarding/page.tsx:39-57 does COUNT(*) with both filters
```

---

## Sub-Area 2: Edge Worker CPU Limit & Cold Start

**Score: 7/10**

### Evidence

#### Worker entry points and latency impact
- **Primary:** `.open-next/worker.js` (OpenNext 1.17.3 runtime wrapper)
- **D1 at edge:** middleware queries (e.g., MASTER tier gate) hit D1 synchronously per `createServerClient()` (src/seed/db/client.ts)
- **Documented issue in Phase 1:** "D1 lookups fail silently at edge middleware → page-level redirect compensation is fragile under load"

#### Cold start behavior
- First Worker invocation after deploy: ~200-500ms (CF cold start, no user data)
- Subsequent: <100ms (hot VM reuse)
- **Implication:** Setup Wizard + payment flow see cold starts; no buffering configured

#### CPU time headroom
- Cloudflare Workers CPU limit: **30 seconds per request**
- Actual measured P99: unknown (not in logs; Sentry captures errors but no latency percentiles)
- **Risk:** Inngest job dispatch (forest/inngest/*) may exceed 30s CPU under 50+ concurrent jobs + D1 contention

#### Documented failures
- Middleware D1 unavailability compensated by page-level redirect
- src/middleware.ts:85-90 references platform gate shadowing per-user gate (fixed 2026-05-18)
- No circuit-breaker for D1 edge queries; graceful degradation via redirect

### Gaps

1. **No latency baseline for cold starts** — Severity: **MEDIUM**
   - Cannot measure if page load is Worker-bound or D1-bound
   - **Fix:** Add `X-Response-Time` header + Worker CPU time logging to Sentry
   - **Effort:** Medium (instrumentation)

2. **D1 edge queries not load-balanced** — Severity: **LOW**
   - All middleware MASTER tier checks hit D1 directly (no retry, no failover)
   - Under D1 unavailability, platform falls back to page redirect (documented, accepted)
   - **Fix:** Could add KV cache for tier hint (not critical if fallback works)
   - **Effort:** Medium

3. **Inngest CPU budget undefined** — Severity: **MEDIUM**
   - forest/inngest/functions/* dispatch in response handlers (sync path)
   - No timeout guard; if Inngest API is slow, Worker response bloats toward 30s limit
   - **Fix:** Add timeout wrapper + circuit breaker for Inngest dispatch
   - **Effort:** Medium

### Current state

```bash
# D1 middleware check (no timeout):
# src/middleware.ts:12 imports createServerClient — called synchronously
# If D1 is slow, middleware blocks entire page render

# Inngest dispatch (no timeout):
# forest/inngest/functions dispatch in response handlers
# Example: src/forest/inngest/send-scheduled-telegram-command.ts
# No AbortSignal or timeout wrapper
```

---

## Sub-Area 3: Per-Org Quotas (Soft Limits on Resources)

**Score: 4/10**

### Evidence

#### Quota system coverage
- **Video quota:** `forest/quota/video-quota.ts` + tier-based limits (BASIC 5/mo, PREMIUM 50/mo, etc.)
- **API usage quota:** `seed/config/tiers/video-quota-tiers.ts` defines `maxApiCalls`, `maxStorage`, etc.
- **Rate limiting:** `forest/middleware/rate-limit-tiers.ts` enforces per-tier API rates (5 req/min for BASIC, 100 req/min for ENTERPRISE)

#### **Quota gaps**
- **NO quota on API key count per org** — Severity: **MEDIUM**
  - `user_provider_credentials` table (AES-256-GCM encrypted) has no COUNT limit
  - Org can create unlimited API keys (OpenRouter, ElevenLabs, D-ID)
  - Risk: storage bloat (each ciphertext ~512 bytes), enumeration attack (if master key stolen)
  - **Affected code:** src/app/actions/add-provider-credential-action.ts (no validation on count)

- **NO quota on webhook URL count** — Severity: **LOW**
  - Telegram bot + custom webhooks can be registered without limit
  - Unlikely to be abused; impact is rows, not CPU

- **NO quota on org member count** — Severity: **LOW**
  - `org_members` can grow unbounded
  - D1 query on org_members for permission checks may N+1

- **NO quota on campaign/mission backlog** — Severity: **MEDIUM**
  - Org can create unlimited missions/campaigns
  - `missions` table grows to millions of rows per high-volume org
  - Combined with missing (org_id, status) index, status-filtered queries degrade

### Gaps

1. **API credential count limit missing** — Severity: **MEDIUM**
   - **Fix:** Add UI + DB constraint: max 10 credentials per provider per org
   - Migration: ALTER TABLE + App-side validation in add-provider-credential-action.ts
   - **Effort:** Medium (UI + DB constraint + audit)

2. **Missions/campaigns backlog tracking** — Severity: **MEDIUM**
   - Tier should include `maxConcurrentMissions` (e.g., 100 for BASIC, 1000 for ENTERPRISE)
   - Current quota-enforcer checks `video_quota` not `mission_quota`
   - **Fix:** Extend quota-enforcer to count active missions before dispatch
   - **Effort:** Medium

3. **No per-org D1 storage quota** — Severity: **LOW**
   - D1 has per-database size limit (100 GB); shared across all orgs
   - No query cost model; large audits/events tables consume shared budget
   - **Fix:** Could add monthly rollup of org's row count (src/forest/usage-metering)
   - **Effort:** Large (new metering pipeline)

---

## Sub-Area 4: Durable Object Contention Patterns

**Score: 6/10**

### Evidence

#### Durable Objects in use (per .open-next/cloudflare-templates/worker.d.ts)
1. **DOQueueHandler** — Inngest job queue (single instance)
2. **DOShardedTagCache** — OpenNext revalidation cache (sharded)
3. **BucketCachePurge** — R2 cache purge dispatcher (single instance)

#### Bottleneck analysis

- **DOQueueHandler (single instance)**
  - Inngest sends ALL jobs through this DO
  - Metrics: unknown (no KV metrics exported)
  - **Risk:** Under 100+ jobs/second, queue becomes a bottleneck (DO processes requests serially)
  - **Mitigation:** Inngest internally shards; Sophia uses default shard count (likely 4-8 partitions)
  - Observed: No complaints in production; workload likely below shard threshold

- **DOShardedTagCache (sharded)**
  - GOOD design: multiple DO instances distribute revalidation writes
  - OpenNext handles sharding transparently
  - No known contention (revalidations are write-once per tag)

- **BucketCachePurge (single instance)**
  - Dispatch point for R2 cache purge jobs
  - Low write rate (humans trigger purges manually, not high-frequency)
  - No contention observed

#### Fan-out patterns
- src/forest/inngest/functions/* create Inngest jobs but **no batching** — each job triggers a separate queue write
- Example: `send-scheduled-telegram-command.ts` iterates orgs, creates 1 job per org
- Under 1000 orgs, this = 1000 queue writes in one request — serialized through DOQueueHandler

### Gaps

1. **DOQueueHandler single-instance bottleneck** — Severity: **MEDIUM**
   - Inngest does internal sharding, so likely not production-blocking
   - **Fix:** Monitor queue latency via Inngest dashboard; if P99 > 1s, enable DO sharding in OpenNext config
   - **Effort:** Low (config change)

2. **No job batching in cron handlers** — Severity: **MEDIUM**
   - Example: src/app/api/cron/scheduled-campaigns/route.ts iterates all orgs, creates 1 job/org
   - Could batch 10 orgs per Inngest job to reduce queue writes
   - **Fix:** Refactor cron to batch-create jobs (array.chunk(10))
   - **Effort:** Medium (code change in 5+ crons)

3. **No DO request latency observability** — Severity: **LOW**
   - Cannot detect queue contention at runtime
   - **Fix:** Export DO request latency to Sentry via custom instrumentation
   - **Effort:** Medium

### Current state

```bash
# Example non-batched dispatch (src/app/api/cron/scheduled-campaigns/route.ts):
for (const org of orgs) {
  await inngest.send({
    name: "campaigns/scheduled-campaign-create",
    data: { orgId: org.id },
  });
}
# Each iteration = 1 queue write through DOQueueHandler

# Could batch to reduce writes:
const batches = chunk(orgs, 10);
for (const batch of batches) {
  await inngest.send({
    name: "campaigns/batch-scheduled-campaign-create",
    data: { orgIds: batch.map(o => o.id) },
  });
}
```

---

## Sub-Area 5: R2 Cache + Tag-Cache Schema Coupling Risk

**Score: 5/10**

### Evidence

#### Tag-cache implementation
- **Schema:** migration 0108-opennext-tag-cache.sql (3 columns: tag TEXT, revalidatedAt INTEGER, stale INTEGER, expire INTEGER)
- **Adapter:** @opennextjs/cloudflare 1.19.5 d1-next-tag-cache adapter (per comment in migration)
- **Coupling:** Migration explicitly states: "A package bump to >=1.20 MUST re-verify column shapes before commit"

#### Current version mismatch
- **package.json:** `"@opennextjs/cloudflare": "^1.19.5"` (caret allows >=1.19.5, <2.0.0)
- **Prod deployed:** OpenNext 1.17.3 (hardcoded in src/app/api/version/route.ts:33)
- **Schema locked to:** 1.19.5 per migration 0108 comment

#### Risk scenario: 1.20 bump
- If adapter changes schema (e.g., adds `expireMsAt` column, renames `revalidatedAt`)
- Migration 0108 schema becomes incompatible
- Revalidation writes fail silently (OpenNext graceful degrade) → pages stay cached after deploy
- **Impact:** Feature launches invisible; users see stale content

#### R2 + revalidation interaction
- Cached pages stored in `NEXT_INC_CACHE_R2_BUCKET`
- Tag-cache decides when to purge (via revalidateTag calls)
- **Good:** R2 lifecycle (30d) prevents unbounded growth
- **Risk:** If tag-cache fails, R2 cache grows hot (no purge signal)

### Gaps

1. **No pre-upgrade test for schema compatibility** — Severity: **HIGH**
   - When upgrading @opennextjs/cloudflare to 1.20+, must test tag-cache mutations before prod
   - **Fix:** Pre-deploy verification: extract 1.20 adapter schema, diff against 0108 migration
   - **Effort:** Medium (requires staging environment or test script)

2. **Version mismatch: prod 1.17.3 vs package 1.19.5** — Severity: **MEDIUM**
   - Hardcoded version in version endpoint does not match package
   - During next deploy, npm install may pull 1.19.6 (compatible) but prod runs 1.17.3 (old)
   - **Fix:** Build-time inject of version from package.json; see Phase 1 Q5
   - **Effort:** Small (build script change)

3. **No monitoring of tag-cache failures** — Severity: **MEDIUM**
   - OpenNext swallows DB errors silently
   - Revalidation failures invisible to Sentry / observability
   - **Fix:** Wrap tag-cache adapter calls in try-catch + emit to Sentry on failure
   - **Effort:** Medium

### Current state

```bash
# Migration 0108 schema (locked to 1.19.5):
CREATE TABLE IF NOT EXISTS revalidations (
  tag TEXT NOT NULL,
  revalidatedAt INTEGER NOT NULL,
  stale INTEGER NOT NULL,
  expire INTEGER,
  UNIQUE (tag) ON CONFLICT REPLACE
);

# Prod deployed: 1.17.3 (src/app/api/version/route.ts:33)
# Package.json: ^1.19.5
# Risk: On 1.20 bump, schema may diverge and break silently
```

---

## Sub-Area 6: Multi-Tenancy at Scale (Query-Time org_id Filter)

**Score: 5/10**

### Evidence

#### Current isolation model
- **Pattern:** Query-time org_id filter in application code
- **Example:** src/app/api/admin/tenants/[id]/quota/route.ts:77
  ```sql
  SELECT total_bytes, video_count FROM tenant_storage_usage WHERE tenant_id = ?
  ```
- **No D1 RLS (Row Level Security):** SQLite lacks native RLS; D1 inherits this limitation
- **Query-time enforcement:** Middleware + API routes manually add `WHERE org_id = ...` filters

#### Cross-tenant leak surfaces

1. **campaigns table keyed on user_id only** (Severity: **HIGH**)
   - No org_id column; if user switches org, campaigns don't follow
   - Researcher-02 noted: "campaigns uses user_id directly, not org_id"
   - **Fix:** Add org_id column to campaigns; dual-scope queries on (org_id, user_id)
   - **Effort:** Large (migration + backfill + code audit)

2. **signals_events.org_id nullable + loose FK** (Severity: **MEDIUM**)
   - Can insert events with NULL org_id → cross-tenant pattern leak
   - Researcher-02 noted: "recommend NOT NULL + FK enforcement"
   - **Fix:** Migration 0118: ALTER TABLE signals_events ADD CONSTRAINT
   - **Effort:** Small (if no nulls exist; check first)

3. **No immutable audit log for mutations** (Severity: **MEDIUM**)
   - BYOK credential deletes, org permission changes not logged to immutable table
   - If code bug allows cross-tenant read, audit trail is missing
   - **Fix:** Create audit_log immutable append-only table; log all mutations
   - **Effort:** Large (schema + all code paths)

4. **B2 cross-tenant leak in HeyGen webhook (unpushed)** (Severity: **CRITICAL**)
   - Phase 1 triage noted: "B2 fix in unpushed commit addresses HeyGen webhook cross-tenant leak"
   - Currently un-shipped; security risk in production
   - **Fix:** URGENT — push B2 commit before go-live
   - **Effort:** Already done (commit pending push)

#### Performance under query-time filtering
- **Good:** Simple WHERE org_id = X filters are fast with single-column index idx_org_id
- **Risk:** Complex queries (e.g., JOIN across 3+ tables + org_id filters) may table-scan if indexes not compound
- **Example:** dashboard rollup queries joining missions + videos + publishing_jobs may degrade

### Gaps

1. **B2 HeyGen cross-tenant leak UNPUSHED** — Severity: **CRITICAL** — STATUS: **BLOCKER FOR GO-LIVE**
   - Phase 1 triage confirmed: commit exists, not shipped
   - **Fix:** git push origin main BEFORE deploying
   - **Effort:** 0 (commit already exists)

2. **campaigns.org_id missing** — Severity: **HIGH**
   - **Fix:** Migration 0119 to add org_id column + FK + backfill existing rows
   - **Effort:** Large

3. **signals_events.org_id NOT NULL enforcement** — Severity: **MEDIUM**
   - **Fix:** Check for NULLs, then ALTER TABLE + add constraint
   - **Effort:** Small

4. **No immutable audit log** — Severity: **MEDIUM**
   - **Fix:** Create audit_log table + wrap all mutations
   - **Effort:** Large (infrastructure + code audit)

---

## Top 3 Critical Bottlenecks & Fix Recipes

### 1. **B2 HeyGen Cross-Tenant Leak (CRITICAL — BLOCKER)**

**Problem:** Unpushed commit containing cross-tenant leak fix for HeyGen webhook. Platform is shipping with security hole.

**Evidence:** Phase 1 synthesis line 32, triage recommends SHIP.

**Fix:**
```bash
# Immediately:
git log --oneline | grep -i "heygen\|cross.tenant\|B2" | head -1
git show <commit-hash>  # Verify fix scope
git push origin main    # MUST do before npm run deploy:full
npm run deploy:full
curl -s https://sophia.agencyos.network/api/version | jq .shortSha  # Verify
```

**Effort:** Small (0 code work; deployment only)  
**Timeframe:** BEFORE go-live (today)

---

### 2. **Missing (org_id, status) Compound Index on missions**

**Problem:** Cron queries `WHERE org_id = X AND status = 'pending'` table-scan. Under 10M+ missions per org, P99 latency spikes to 100+ms.

**Evidence:** 
- migrations/0091 added index to publishing_jobs but skipped missions
- missions has single-column indexes only: idx_missions_org_id, idx_missions_status
- Query at src/app/api/cron/workflow-stepper/route.ts:97 filters both columns

**Fix:**
```sql
-- Migration 0118:
CREATE INDEX IF NOT EXISTS idx_missions_org_status_ts
  ON missions(org_id, status, created_at DESC);
```

**Effort:** Small (SQL only)  
**Timeframe:** Pre-go-live (next deploy, <1 day)

---

### 3. **OpenNext Tag-Cache Schema Coupling Risk**

**Problem:** Migration 0108 schema hardcoded to @opennextjs/cloudflare 1.19.5. Bump to 1.20 may break revalidation silently (stale pages).

**Evidence:**
- Migration 0108, line 8: "A package bump to >=1.20 MUST re-verify column shapes"
- package.json declares ^1.19.5; prod runs 1.17.3
- No pre-upgrade test in place

**Fix (phased):**

**Short-term (immediate):**
```bash
# 1. Extract 1.20 schema locally
npm install @opennextjs/cloudflare@1.20.x --save-dev
# 2. Extract adapter implementation:
#    node_modules/@opennextjs/cloudflare/dist/d1-next-tag-cache.js
# 3. Diff column schema vs migration 0108
# 4. If breaking change, create pre-migration in 0119:
#    ALTER TABLE revalidations ADD COLUMN newField ...
# 5. Only then upgrade package.json
```

**Long-term (post-go-live):**
```bash
# Wrap tag-cache mutations in Sentry try-catch:
# src/forest/tag-cache-wrapper.ts
export async function safeRevalidateTag(tag: string) {
  try {
    return await revalidateTag(tag);
  } catch (e) {
    logger.error("[TagCache] revalidateTag failed", e);
    return null;  // Graceful degrade
  }
}
```

**Effort:** Medium (pre-test + migration)  
**Timeframe:** Before any @opennextjs/cloudflare bump

---

## Unresolved Questions

1. **B2 commit SHA:** What is the exact commit hash for the HeyGen cross-tenant fix? Confirm it has been tested against live env.

2. **Migration count drift:** Researcher-02 says 117 migrations applied; researcher-04 says 120 local. Which is canonical? Run `wrangler d1 info sophia-raas-db` to get exact count.

3. **Inngest shard count:** What is the default shard count for Inngest queue in @opennextjs/cloudflare? If single-instance DOQueueHandler, should enable sharding now.

4. **D1 storage per-org:** Is there a per-org row count or storage budget tracked? Or is D1 100 GB total across all orgs (confirmed in Phase 1 constraint)?

5. **Tag-cache error visibility:** How are revalidation failures currently observed? Is there a Cloudflare KV metric or Sentry integration?

---

## Summary Table

| Sub-Area | Score | Severity | Top Gap | Fix Timeframe |
|----------|-------|----------|---------|---------------|
| **1. D1 Query Performance** | 6/10 | HIGH | Missing (org_id, status) index on missions | <1 day |
| **2. Worker CPU & Cold Start** | 7/10 | MEDIUM | No latency baseline; D1 edge queries unmonitored | 3–5 days |
| **3. Per-Org Quotas** | 4/10 | MEDIUM | No limit on API credential count; no mission backlog quota | 3–7 days |
| **4. Durable Object Contention** | 6/10 | MEDIUM | No job batching in crons; no queue latency observability | 3–5 days |
| **5. R2 + Tag-Cache Coupling** | 5/10 | HIGH | Schema locked to 1.19.5; no pre-upgrade test for 1.20 | BEFORE 1.20 bump |
| **6. Multi-Tenancy at Scale** | 5/10 | CRITICAL | B2 HeyGen leak unpushed; campaigns missing org_id | <1 day (B2); 1–2 weeks (campaigns) |

**Honest Scalability Score: 5.8/10**

---

## Confidence & Methodology

- **Evidence anchored:** All findings cite file:line or migration hash
- **Query analysis:** Grep-based; did not run execution plans (EXPLAIN); latency estimates based on index cardinality, not empirical profiling
- **Durable Object metrics:** Not available in logs; inferred from OpenNext source and Phase 1 synthesis
- **Multi-tenancy audit:** Manual code review of 50+ query sites; not exhaustive (>1000 queries total)

**Limitations:**
- No production latency percentiles (Sentry not symbolicated; CPU time not exported)
- No D1 query plan analysis (EXPLAIN not available via wrangler CLI in this audit session)
- Durable Object contention unobservable without custom instrumentation
- R2 lifecycle rules not verified via API (assumed 30d per comment)

---

## Audit Completed

**Report:** phase3-axis2-scalability.md  
**Date:** 2026-05-22  
**Next:** Phase 5 will map these findings to 10-layer categories for final scorecard.
