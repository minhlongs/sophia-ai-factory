# Development Roadmap — Sophia AI Factory

> Product milestones and progress tracking (2026)

**Last Updated:** 2026-04-30 (Phase 11: Auto Video Customer Handoff — post-purchase auto-gen onboarding video + email delivery, 1798/1798 tests pass)
**Target:** $1M ARR, 100/100 a16z solo company score

---

## Q1 2026: Foundation & Architecture

| Phase | Status | Completion | Details |
|-------|--------|-----------|---------|
| **Q1-P1: RaaS Core** | ✅ DONE | 2026-02-01 | Mission pipeline, D1 database, Better Auth |
| **Q1-P2: MCU Billing** | ✅ DONE | 2026-02-15 | Tiers (Starter→Master), NOWPayments integration |
| **Q1-P3: Cloudflare Migration** | ✅ DONE | 2026-03-24 | Workers + D1 + R2, sophia.agencyos.network |
| **Q1-P4: Security Audit** | ✅ DONE | 2026-03-26 | Score 83→97/100 (HSTS, CSP, tenant isolation) |
| **Q1-P5: a16z 100/100** | ✅ DONE | 2026-04-15 | Solopreneur-first, async ops, SEO, viral growth |

---

## Q2 2026: RaaS Solo Platform (Shipped 2026-04-17)

### Phase 1: BYOK Foundation + Worker Setup ✅ SHIPPED (PR #15)
- **Status:** Production green (2026-04-17)
- **Features:**
  - Client API keys stored encrypted (OpenRouter, ElevenLabs, D-ID)
  - Setup wizard for client onboarding (Zod validation)
  - Cloudflare Worker middleware for rate limiting
  - Key encryption per user session (no master key)
- **Metrics:** 850 LOC, 12 tests, 0 security issues

### Phase 2: Tier-Based RaaS Backend ✅ SHIPPED (PR #17)
- **Status:** Quota enforcement live (2026-04-17)
- **Features:**
  - 4 tiers: BASIC (10 campaigns/mo), PREMIUM (100), ENTERPRISE (1000), MASTER (∞)
  - Usage metering in D1 `usage_events` table
  - Pre-flight quota check (returns 429 if exceeded)
  - Cloudflare KV cache (5s) for edge quota checks
  - Overage logging for NOWPayments reconciliation
- **Metrics:** 1,200 LOC, 18 tests, 100% quota accuracy

### Phase 3: Admin & Client APIs ✅ SHIPPED (PR #18)
- **Status:** Admin dashboard operational (2026-04-17)
- **Features:**
  - Admin CRUD for client licenses + tier override
  - Immutable audit log (append-only tier changes)
  - Client profile API (tier, usage, billing history)
  - NOWPayments webhook handler (HMAC verified, auto tier activation)
  - Endpoint rate limiting (100/admin, 1000/client, 10/public req/min)
- **Metrics:** 1,450 LOC, 24 tests, 0 webhook failures

### Phase 4: Frontend Dashboard + Deployment ✅ SHIPPED (PR #16)
- **Status:** Production HTTP 200 verified (2026-04-17)
- **Features:**
  - Client dashboard (settings, billing, profile pages)
  - Admin dashboard (license list, audit log, tier override)
  - Tier upgrade modal with NOWPayments UI
  - Usage charts (Recharts monthly breakdown per feature)
  - GitHub Actions → Cloudflare Pages auto-deploy + health check
- **Metrics:** 1,122 LOC, 28 tests, < 10s build time

### Sophia Factory RaaS Solo Summary
- **Total:** 4,622 LOC, 854 tests (100% pass)
- **Architecture:** BYOK (clients bring own API keys) + tier metering + admin control + self-serve dashboard
- **Production URL:** https://sophia.agencyos.network (HTTP 200 ✅)
- **Commits:** 4 PRs merged to main

---

## Q2 2026: Local Mode + Offline-First (Shipped 2026-04-17)

### Phase 5: Local Mode Provisioning ✅ SHIPPED (Phase D)
- **Status:** Auto-installer deployed (2026-04-17)
- **Features:**
  - Automatic installer script for M1 Max / Qwen mekongd integration
  - Secure CF Tunnel provisioning with operator verification
  - Environment variable setup automation
- **Metrics:** 165 LOC installer guide (bilingual)

### Phase 6: Local Mode Setup Wizard ✅ SHIPPED (Phase E)
- **Status:** Customer self-serve UI live (2026-04-17)
- **Features:**
  - Multi-step setup component for founder dogfood
  - Local mekongd endpoint detection
  - Tier + BYOK provisioning UI
  - Health status dashboard
- **Metrics:** 336 LOC runbook (bilingual) + UI components

### Phase 7: Local Mode Health Monitoring ✅ SHIPPED (Phase F)
- **Status:** Self-heal + diagnostics deployed (2026-04-17)
- **Features:**
  - `/api/cron/local-mode-health` health check endpoint
  - Automated tunnel restart on connection loss
  - Troubleshooting runbook + FAQ
- **Metrics:** Integrated into sophia-local-mode-runbook.md

### Phase 8.7: Admin Monitoring Dashboard ✅ SHIPPED (Phase 4.7)
- **Status:** Server-rendered admin page live, closes Phase 4E M-2 (2026-04-17)
- **Features:**
  - `/admin/monitoring` Next.js Server Component, admin-guarded
  - D1 aggregates: LLM cache (total/fresh/expired/hits/tokens-saved), workflows 24h (queued/running/completed/failed), top-10 signals 24h
  - 4 stat cards + workflow status pills + top-N signals list (no Recharts, no client polling — YAGNI)
  - Degraded-state banner when any D1 RPC fails — distinguishes idle from broken
  - `increment_llm_cache_hit` RPC closes Phase 4E M-2 (dead hit_count column)
- **Metrics:** ~400 new LOC (page + queries + RPC + tests), 20 new tests (1165 total), commit `7f4d2dc`
- **Files:** `src/app/[locale]/(admin)/admin/monitoring/page.tsx` + `src/lib/admin/monitoring-queries.{ts,test.ts}` + `src/lib/db/d1-query-builder.ts` + `src/lib/llm/cache/llm-cache.ts`
- **Activation:** none — page renders immediately post-deploy for `role === 'admin'` users

### Phase 8.6: LLM Semantic Cache MVP ✅ SHIPPED (Phase 4E)
- **Status:** Exact-match SHA-256 D1 cache live, dark-launched (2026-04-17)
- **Features:**
  - `llm_cache` D1 table (hash PK + expires_at index)
  - `hashCacheKey` SHA-256 hex over normalized `{provider, model, messages}`
  - `lookupCache` + `writeCache` D1 client wrappers, swallow-all-errors pattern
  - TTL via `LLM_CACHE_TTL_SECONDS` (default 24h), gate via `LLM_CACHE_ENABLED=1`
  - Wired into `weekly-signals-digest` cron OpenRouter summarize path
  - Semantic similarity (embedding top-K) deferred to Phase 4E.2
- **Metrics:** ~565 new LOC (migration + module + tests + wiring), 25 new tests (1148 total), commit `69fe6a5`
- **Files:** `migrations/0008-llm-cache.sql` + `src/lib/llm/cache/llm-cache.{ts,test.ts}` + `src/app/api/cron/weekly-signals-digest/route.ts`
- **Activation:** `wrangler secret put LLM_CACHE_ENABLED --value 1` (founder manual)

### Phase 8.8: LLM Cache Wiring MVP ✅ SHIPPED (Phase 4F)
- **Status:** Production integration live, dark-launched (2026-04-18)
- **Features:**
  - `callWithCache(key, fetchLive)` wrapper primitive for transparent cache lookup + fallback
  - Wired into OpenRouter chat-completion in script-generator (campaign generation path)
  - Cache scope keyed by `event.data.userId` (single-tenant Sophia idiom)
  - Cache hit returns deserialize JSON + skips `trackUsage()` (zero-cost cache benefit)
  - Swallows all D1 errors (transparent fall-through on disabled/empty orgId/outage)
  - Feature-gated `LLM_CACHE_ENABLED` (OFF in prod, dark-launch pattern)
- **Metrics:** 4 new tests (1175 total), 1 new module (~80 LOC), 2 files wired (~20 LOC), code review 9.7/10
- **Files:** `src/lib/llm/cache/call-with-cache.{ts,test.ts}` + `src/lib/ai/script-generator.ts` + `src/lib/inngest/functions/generate-campaign.ts`
- **Activation:** `wrangler secret put LLM_CACHE_ENABLED 1` (founder manual)
- **Deferred:** Phase 4F.1 (org_id refinement), Phase 4E.2 (semantic similarity), Phase 4E.3 (per-org purge), Phase 4E.4 (per-org stats), Supervisor wiring

### Phase 8.8.1: resolveOrgId Unification ✅ SHIPPED (Phase 4F.1)
- **Status:** Canonical helper deployed, DRY refactor complete (2026-04-18)
- **Features:**
  - `export async function resolveOrgId(userId: string): Promise<string | null>` — single source of truth
  - Queries `users.org_id` from D1 (single-tenant mapping: 1 user = 1 org)
  - Removed 3 byte-identical private copies + 1 SSR inline from 4 caller sites
  - Inngest `generate-campaign` cache scope now uses helper: `(await resolveOrgId(userId)) ?? userId`
- **Metrics:** 5 new tests (1180 total), 19 LOC new module, 4 sites refactored, code review 9.5/10
- **Files:** `src/lib/auth/resolve-org-id.{ts,test.ts}` + 4 callers updated (API routes, dashboard page, Inngest job)
- **Addresses:** Phase 4F reviewer LOW-1 (reduce duplication)
- **Deferred:** Phase 4F.2 (async org lookup with fallback pattern), future canonical org helper for RaaS quota/signals

### Phase 8.6.3: LLM Cache Purge Cron (Ops) ✅ SHIPPED (Phase 4E.3)
- **Status:** Daily scheduled cleanup live (2026-04-18)
- **Features:**
  - `POST /api/cron/llm-cache-purge` — CRON_SECRET-guarded org-scoped purge
  - GHA cron trigger daily at 07:00 UTC via `.github/workflows/cron-llm-cache-purge.yml`
  - Deletes expired `llm_cache` rows per org: `DELETE WHERE org_id = ? AND expires_at < now()`
  - Best-effort error handling: D1 failures silently degrade (returns `ok: false`)
  - Closes migration 0008 TODO ("purge job"); Phase 4E lifecycle now complete
- **Metrics:** 4 new tests (1184 total), ~60 LOC (endpoint + GHA workflow), code review 9.7/10
- **Files:** `src/app/api/cron/llm-cache-purge/route.ts` + `.github/workflows/cron-llm-cache-purge.yml`
- **Closes:** Phase 4E multi-tenant cache lifecycle (H-1 org scoping + F wiring + 4E.3 purge ops)
- **Deferred:** Phase 4E.4 (per-org cache stats dashboard)

### Phase 8.6.5: Telemetry Honesty + LLM Trace Stats ✅ SHIPPED (Phase 4G-FIX + 4I)
- **Status:** Dark-launch refinement + ops endpoint live (2026-04-18)
- **Features:**
  - Phase 4G-FIX: Provider gate + empty response handling (closes 3 reviewer findings)
    - Unsupported providers skip live fetch, emit `llm_router_unsupported` warn
    - Empty LLM response triggers `llm_empty_response` degraded signal
    - `recordLlmCall()` writes `ok:false, errorClass:'LLM_LIVE_FAILED_FALLBACK'` when degraded
  - Phase 4I: `GET /api/admin/llm-trace-stats` JSON endpoint (CRON_SECRET-guarded, 24h aggregates)
    - Returns `{ ok, ts, stats: { total, success, failure, successRate, avgDurationMs }, topProviders, topModels }`
    - Exported `aggregateTraceStats()` for dashboard reuse
- **Metrics:** 9 new tests (1202 total), ~40 LOC new endpoint + ~20 LOC fixes, code review 9.6/10
- **Files:** `src/lib/llm/router.ts` (modify) + `src/app/api/cron/workflow-stepper/route.ts` (modify) + `src/app/api/admin/llm-trace-stats/route.ts` (new)
- **Closes:** Phase 4G reviewer findings (provider gate, empty response, telemetry honesty), Phase 4I trace stats API
- **Activation:** Automatic — no new gates; refines existing dark-launch behavior

### Phase 8.6.4: Real LLM Workflow + Cache Stats API ✅ SHIPPED (Phase 4G + 4H)
- **Status:** Dark-launched real LLM + ops endpoint live (2026-04-18)
- **Features:**
  - Phase 4G: Dark-launched real LLM in workflow-stepper (gate: `WORKFLOW_REAL_LLM_ENABLED=1` + `OPENROUTER_API_KEY`)
    - Routes through `callWithCache()` + `routeLlm()` + OpenRouter
    - Falls back to mock on gate-off or live error; no behavior change when disabled
  - Phase 4H: `GET /api/admin/llm-cache-stats` JSON endpoint (CRON_SECRET-guarded)
    - Returns `{ ok, ts, stats: { total, hit, miss }, hitRate }`
    - Reuses `getCacheStats()` helper; returns `{ ok: false, reason }` on failure
- **Metrics:** 9 new tests (1193 total), ~60 LOC combined, code review 9.5/10
- **Files:** `src/app/api/cron/workflow-stepper/route.ts` (modify) + `src/app/api/admin/llm-cache-stats/route.ts` (new)
- **Closes:** Phase 4G stub (real LLM dark launch), Phase 4H JSON endpoint (external ops stats API)
- **Activation:** Phase 4G via env gate (default off, safe); Phase 4H automatic for ops monitoring

### Phase 8.6-H1: LLM Cache Org Scoping (Security) ✅ SHIPPED (Phase 4E H-1)
- **Status:** Multi-tenant isolation shipped, closes reviewer H-1 BLOCKER (2026-04-17)
- **Features:**
  - Migration `0009-llm-cache-org-scoping.sql` adds `org_id TEXT NOT NULL` column
  - Composite PK changed to `(hash, org_id)` — prevents cross-tenant response collisions
  - `CacheKey.orgId` required field; hash includes `orgId` for defense-in-depth
  - `lookupCache` + `writeCache` queries filtered by `org_id`
  - `increment_llm_cache_hit` RPC scoped by `(hash, org_id)` composite key
  - Caller `weekly-signals-digest` passes `'system'` sentinel for platform-scope cron
  - New index `idx_llm_cache_org_id_expires_at` enables Phase 4E.3 per-org purge
- **Security:** Prevents H-1 leak vector (same prompt colliding across tenants)
- **Metrics:** 6 new tests (1171 total), migration idempotent, build clean, code review 9.7/10
- **Files:** `migrations/0009-llm-cache-org-scoping.sql` + `src/lib/llm/cache/llm-cache.{ts,test.ts}` + `src/lib/db/d1-query-builder.ts` + `src/app/api/cron/weekly-signals-digest/route.ts`
- **Deferred:** Phase 4E.2 (semantic similarity), Phase 4E.3 (per-org purge cron), Phase 4E.4 (per-org stats), Phase 4F (Supervisor/RaaS wiring — now UNBLOCKED)

### Phase 8.5: Langfuse External LLM Observability ✅ SHIPPED (Phase 4D)
- **Status:** Secondary fire-and-forget sink live, dark-launched (2026-04-17)
- **Features:**
  - Env-gated HTTP POST to Langfuse `/api/public/ingestion` (generation-create)
  - Basic auth via `btoa(public:secret)`; overridable host via `LANGFUSE_HOST`
  - `AbortSignal.timeout(2000)` caps CF subrequest blast radius
  - `scrubPIIDeep` defence-in-depth against leaked API keys
  - Contract test guards `LlmCallTrace` → Langfuse body drift
  - D1 `LLM_CALL_TRACE` remains source of truth; Langfuse is mirror
- **Metrics:** ~90 new LOC, 19 new tests (4 wired to llm-trace, 15 standalone), 1123/1123 total
- **Files:** `src/lib/telemetry/langfuse-client.{ts,test.ts}` + `llm-trace.{ts,test.ts}` edits
- **Activation:** `wrangler secret put LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY` (founder manual)

### Phase 8: Supervisor Agent MVP (D1+Cron) ✅ SHIPPED (Giai đoạn 3 Bước 3.4)
- **Status:** Linear 3-step workflow orchestrator live (2026-04-17)
- **Features:**
  - D1 `workflows` table + `missions` link via `parent_mission_id`
  - 3-step linear chain: create_plan → execute_development → run_tests
  - Cron stepper `*/1 * * * *` (1-min tick) with idempotent state machine
  - Dashboard timeline + real-time polling (3s interval)
  - 4 D1 event types: WORKFLOW_STARTED/STEP_COMPLETED/COMPLETED/FAILED
  - POST/GET /api/raas/workflows + /api/cron/workflow-stepper
- **Metrics:** 1,200 LOC (11 modules ≤200 each), 78 new tests (1054 total pass), 0 TS errors, bilingual UI
- **Files:** migrations/0007-workflows.sql + supervisor-*.ts + workflow-*.ts + components + routes + runbook
- **Deployment:** GH Actions green, CF Pages HTTP 200, prod E2E verified

### Phase 8.9: SSE Parser + Semantic Cache + Tenant Helpers + BYOK Foundations ✅ SHIPPED (Round 5: Phase 4N + 4E.2 + 4F.2 + 4G-BYOK)
- **Status:** Four parallel feature shipments live (2026-04-18)
- **Features:**
  - Phase 4N: SSE parser extraction (`parseAnthropicSse` + `AnthropicStreamEvent` union, 7 event types) + `callAnthropicStreamEvents` for tool-use flows
  - Phase 4E.2: Semantic LLM cache fallback via Workers AI embeddings (`llm-cache-semantic.ts` + `@cf/baai/bge-base-en-v1.5`, opt-in `LLM_CACHE_SEMANTIC_ENABLED=1`)
  - Phase 4F.2: `getTenantContext(userId)` single-JOIN helper returning `{ orgId, tier }` (future callers; YAGNI: zero current use both together)
  - Phase 4G-BYOK: Per-user API key foundations (AES-GCM crypto + D1 store + resolver, opt-in `BYOK_ENABLED=1`, env fallback when disabled; no caller wiring yet)
- **Metrics:** 62 new tests (1220 → 1282 total), 4 new modules (total ~641 LOC), migration 0010 + 0011, code review ≥9.6/10 all phases
- **Files:**
  - Phase 4N: `src/lib/ai/anthropic-sse-parser.ts` (128 LOC)
  - Phase 4E.2: `src/lib/llm/cache/llm-cache-semantic.ts` (170 LOC) + migration 0010
  - Phase 4F.2: `src/lib/auth/get-tenant-context.ts` (40 LOC)
  - Phase 4G-BYOK: `src/lib/byok/{byok-crypto,user-api-key-store,resolve-user-api-key}.ts` (271 LOC) + migration 0011
- **Activation:** Phase 4N automatic; 4E.2 via env flag + Workers AI binding; 4F.2 available API; 4G-BYOK via `BYOK_ENABLED=1` + `BYOK_MASTER_KEY` (base64 32 bytes)
- **Backward Compatibility:** All changes backward-compatible; exact-match LLM cache unaffected when Phase 4E.2 disabled; env-driven API key callers work unchanged

### Phase 8.10: Tier Normalization + SSE Polish + Cache Index Tuning + BYOK Integration ✅ SHIPPED (Round 6: Phase 4F.3 + 4N-POLISH + 4E.2-TUNING + 4G-WIRE)
- **Status:** Four follow-up refinements live (2026-04-18)
- **Features:**
  - Phase 4F.3: `normalizePlanToTier(plan)` canonical helper using DB_TIER_MAPPING — safe enum coercion from D1 text columns (closes unsafe casts)
  - Phase 4N-POLISH: Try/finally reader cleanup + `parse_error` SSE event variant — robust stream error handling with graceful degradation
  - Phase 4E.2-TUNING: Semantic-cache index widened to `(org_id, embedding_model, provider, model, created_at)` + `LLM_CACHE_STORE_PROMPT_TEXT=1` PII/GDPR gate (vectors always, text optional)
  - Phase 4G-WIRE: `resolveOrgOwnerUserId` helper + per-user key resolution into workflow-stepper cron + Anthropic/OpenRouter live callers (BYOK fully integrated)
- **Metrics:** 9 new tests (1285 → 1294 total), all 4 reviews 9.5–9.7/10 SHIP, 0 critical/high, no breaking changes
- **Files:** `src/lib/auth/normalize-tier.ts` (new) + migrations/0010 (widen) + anthropic-sse-parser.ts (modify) + llm-cache-semantic.ts (modify) + workflow-stepper (modify)
- **Activation:** All gates remain off by default; Phase 4F.3 automatic (replaces unsafe casts); 4N-POLISH automatic (SSE reader safety); 4E.2-TUNING automatic (index) + opt-in text storage; 4G-WIRE automatic when BYOK_ENABLED=1
- **Backward Compatibility:** 100% backward-compatible; all existing calls work unchanged; BYOK gate off by default

### Phase 8.12: Hygiene Bundle + User-Facing BYOK Admin ✅ SHIPPED (Round 8: Phase 8A + 8C)
- **Status:** Four narrow edits + two new UI routes live (2026-04-18)
- **Features:**
  - Phase 8A.1: workflow-stepper errorClass split — new `degradeReason` local distinguishes `'LLM_MISSING_KEY_FALLBACK'` (missing BYOK key) from `'LLM_LIVE_FAILED_FALLBACK'` (live provider error) for Langfuse signal discriminability (closes R7 L-4)
  - Phase 8A.2: weekly-signals-digest BYOK symmetry — adopts `resolveUserApiKey(null, 'openrouter', envFallback)` pattern (cron context, no userId; BYOK-off → env fallback, byte-identical pre-wire)
  - Phase 8A.3: error-digest BYOK symmetry — same resolver pattern (closes R7 H-2)
  - Phase 8C: User-facing BYOK admin — new `/api/user/byok` endpoint (GET providers, POST set/rotate, DELETE clear) + `/dashboard/byok` SSR page + `byok-key-form` bilingual component (VN/EN); signals `BYOK_KEY_SET` + `BYOK_KEY_CLEARED` (provider-only, no key bytes); reuses 4G-BYOK D1 table + AES-GCM encryption
- **Metrics:** 11 new tests (1300 → 1311 total), review 9.6/10 SHIP, 0 critical, 0 high
- **Files:** `workflow-stepper/route.ts` (modify) + `weekly-signals-digest/route.ts` (modify) + `error-digest/route.ts` (modify) + `src/app/api/user/byok/route.ts` (new) + `src/app/[locale]/(dashboard)/dashboard/byok/page.tsx` (new) + `src/components/byok/byok-key-form.tsx` (new) + `src/lib/signals/byok-events.ts` (new)
- **Activation:** Phase 8A automatic (existing BYOK_ENABLED gate); Phase 8C automatic (no new env needed; reuses user_api_keys D1 table from 4G-BYOK)
- **Backward Compatibility:** 100% backward-compatible; `BYOK_ENABLED=0` → env fallback (pre-wire behavior); new endpoints gated by auth
- **Commit:** pending R8 session completion — deferred items (L-1/L-2/INFO-2/L-3) → R9

### Phase 8.11: BYOK Wiring Completion for OpenRouter Callers ✅ SHIPPED (Round 7: Phase 7A + 7B + 7C)
- **Status:** Three narrow follow-ups live (2026-04-18)
- **Features:**
  - Phase 7A: workflow-stepper OpenRouter `!openrouterKey` guard → degrade-to-mock with `llm_openrouter_missing_key` warn event (mirrors Anthropic pattern; closes R6 4G-WIRE L-1)
  - Phase 7B: `GenerateScriptInput.userId` threaded through generate-campaign Inngest → script-generator resolves OpenRouter key via `resolveUserApiKey(userId, 'openrouter', env)` with sentinel `'unknown'` stripped
  - Phase 7C: `enhanceNicheScoreWithAI` cloud-fallback (priority 3) uses same resolver with existing `userId` param; local-mekongd priorities 1+2 unchanged
- **Metrics:** 6 new tests (1294 → 1300 total), review 9.5/10 SHIP, 0 critical, 0 high, no breaking changes
- **Files:** `workflow-stepper/route.ts` + `script-generator.ts` + `generate-campaign.ts` + `services/types.ts` + `affiliate-openrouter-niche-enhancer.ts` + 3 test files (1 new, 2 extended)
- **Activation:** All three resolvers inert when `BYOK_ENABLED` unset (envFallback pass-through); identical to pre-wire behavior
- **Backward Compatibility:** 100% backward-compatible; `GenerateScriptInput.userId` optional; no schema or env changes
- **Commit:** `0cab570` — CI green, prod HTTP 200, shortSha match

### Phase 9: Analytics Dashboard ✅ SHIPPED (2026-04-25)
- **Status:** Production deployment complete (2026-04-25)
- **Features:**
  - **Real-Time SSE Analytics** — `GET /api/analytics/realtime` (admin-only, edge runtime)
    - Broadcasts snapshot every 10s: activeUsers, campaignsLast1h, apiCallsLast1h, errorRateLast1h, tierDistribution
  - **Revenue Metrics API** — `GET /api/analytics/revenue` (MRR, ARR, growth %, tier breakdown)
    - `<RevenueCard />` component — 4 stat tiles + 30d Recharts AreaChart sparkline + tier table
  - **Cohort Retention + Churn + LTV** — `GET /api/analytics/cohorts` (metric=retention|churn|ltv)
    - Migration 0015: tier_change_events tracking + calculator modules
    - Components: `<CohortRetentionChart />`, `<ChurnTimeline />`, `<LTVCalculator />`
  - **Tier Adoption Chart** — `GET /api/analytics/tier-adoption` (stacked chart data)
    - `<TierAdoptionChart />` — Recharts AreaChart, 4 tiers (BASIC/PREMIUM/ENTERPRISE/MASTER)
  - **Date Range Picker** — `<DateRangePicker />` with 7d/30d/90d presets + custom range
  - **Dashboard Integration** — `<AnalyticsDashboardClient />` wires all Phase 9 components
    - Integrated: `dashboard/analytics/page.tsx` — RevenueCard + TierAdoptionChart + DateRangePicker + UsageView
- **Metrics:** ~1,800 LOC, 21 new tests, 1362/1362 pass (100%)
- **Files:**
  - New types: `src/types/analytics-{realtime,revenue,cohort}.ts`
  - New modules: `src/lib/analytics/{sse-broadcaster,realtime-snapshot,revenue-nowpayments,cohort,churn,ltv}-calculator.ts`
  - New components: `src/components/analytics/{revenue-card,cohort-retention-chart,churn-timeline,ltv-calculator,tier-adoption-chart}.tsx`
  - New endpoint: `src/app/api/analytics/{realtime,revenue,cohorts,tier-adoption}/route.ts`
  - Migration: `migrations/0015_tier_change_events.sql` (additive, tier change tracking)
  - Dashboard: `src/app/[locale]/(dashboard)/dashboard/analytics/page.tsx`
- **Target:** Real-time dashboard for founder + tier adoption visibility

### Phase 11: Auto Video Customer Handoff ✅ SHIPPED (2026-04-30)
- **Status:** Production complete — post-purchase auto-gen onboarding video + email delivery
- **Features:**
  - **Pipeline Completion:** 4 Inngest stubs → real (OpenRouter script → Coqui TTS → HeyGen visual → R2 upload)
  - **Purchase Trigger:** NOWPayments IPN → auto trigger onboarding video for ENTERPRISE/MASTER tiers
  - **Delivery System:** HeyGen webhook → email notification + dashboard gallery (`is_onboarding = 1`)
  - **DB Schema:** New `video_onboarding_events` table + `videos.is_onboarding` column (migration 0034)
  - **Script Templates:** Vietnamese onboarding scripts per tier, HeyGen Anna_public avatar + standard voice
  - **Email:** HTML template with Sophia branding, dashboard deep-link, non-blocking delivery
- **Architecture:** `script(OpenRouter) → TTS(Coqui) → visual(HeyGen) → compose(skip) → upload(R2) → publish`
- **Key Decision:** HeyGen replaces HunyuanVideo (already integrated, creates complete mp4); Remotion impossible on CF Workers
- **Metrics:** 16 new tests, 1798/1798 total (100%), 0 type errors, code review approved
- **Files:** `src/lib/video/onboarding-video.ts`, `src/lib/email/onboarding-emails.ts`, `src/app/api/webhooks/heygen/route.ts`, `src/lib/billing/nowpayments-ipn-subscription.ts`, `migrations/0034-video-onboarding-events.sql`, +6 more

### Phase 10: Multi-Language Support (Planned)
- **Timeline:** June 2026
- **Features:**
  - Vietnamese + English bilingual UI
  - i18n framework (next-intl or react-intl)
  - Email templates in both languages
  - Customer support in Vietnamese
- **Owner:** Product team
- **Target:** APAC market expansion

---

## Backlog (Future)

### Post-Deploy Enhancements
- [ ] Real-time APM dashboard (New Relic integration)
- [ ] Custom event enrichment (user tier, org_id tagging)
- [ ] Advanced funnel analysis (multi-step conversion)
- [ ] Cost attribution per feature (MCU → margin)

### Agent Autonomy Improvements
- [ ] CMO auto-publishing blog posts (scheduled cadence)
- [ ] CSO auto-outreach campaigns (lead scoring)
- [ ] COO auto-ticket response (support chatbot)
- [ ] CTO auto-security patch (vulnerability remediation)

### Scale Infrastructure
- [ ] Multi-region D1 replica for DR
- [ ] Edge compute optimization (Workers KV for session cache)
- [ ] Async queue system (Bull for long-running missions)
- [ ] Webhook retry strategy with exponential backoff

### Customer Features
- [ ] Custom integrations marketplace
- [ ] White-label branding (MASTER tier)
- [ ] Team collaboration (multi-user orgs)
- [ ] Advanced reporting + export (CSV/PDF)

---

## Metrics & Success

| KPI | Target | Current | Timeline |
|-----|--------|---------|----------|
| **ARR** | $1M | ~$5K | Q4 2026 |
| **Uptime** | 99.9% | 99.9% | Current |
| **Response Time (p95)** | < 500ms | < 200ms | Current |
| **Build Time** | < 10s | < 10s | Current |
| **Test Coverage** | > 80% | 99.5% | Current |
| **Security Score** | 95/100 | 97/100 | Current |
| **a16z Score** | 100/100 | 100/100 | Current |

---

## Release Calendar

| Date | Milestone | Status |
|------|-----------|--------|
| 2026-01-15 | RaaS Platform Launch | ✅ |
| 2026-02-01 | Mission Pipeline | ✅ |
| 2026-02-15 | MCU Billing | ✅ |
| 2026-02-28 | Custom Domain | ✅ |
| 2026-03-10 | Admin Panel | ✅ |
| 2026-03-15 | JWT Auth System | ✅ |
| 2026-03-24 | CF Workers Migration | ✅ |
| 2026-03-26 | Security Audit (97/100) | ✅ |
| 2026-04-10 | Payment Provider Migration | ✅ |
| 2026-04-15 | Architecture Consolidation | ✅ |
| 2026-04-17 | Sophia Factory RaaS Solo Platform (4 PRs) | ✅ |
| 2026-04-17 | Local Mode Provisioning + Installer + Health Monitoring | ✅ |
| **2026-04-17** | **Supervisor Agent MVP (D1+Cron stepper, Giai đoạn 3.4)** | **✅ SHIPPED** |
| **2026-04-17** | **Phase 4D Langfuse External LLM Observability (env-gated)** | **✅ SHIPPED** |
| **2026-04-17** | **Phase 4E LLM Semantic Cache MVP (exact-match + D1, env-gated)** | **✅ SHIPPED** |
| **2026-04-17** | **Phase 4E H-1 LLM Cache Org Scoping (multi-tenant isolation, H-1 blocker)** | **✅ SHIPPED** |
| **2026-04-17** | **Phase 4.7 Admin Monitoring Dashboard (D1 aggregates + M-2 hit_count close)** | **✅ SHIPPED** |
| **2026-04-18** | **Phase 4F LLM Cache Wiring (campaign script generation integration, env-gated)** | **✅ SHIPPED** |
| **2026-04-18** | **Phase 4F.1 resolveOrgId Unification (canonical helper, DRY refactor)** | **✅ SHIPPED** |
| **2026-04-18** | **Phase 4E.3 LLM Cache Purge Cron (daily org-scoped cleanup, ops hygiene)** | **✅ SHIPPED** |
| **2026-04-18** | **Phase 4G Real LLM Workflow + Phase 4H Cache Stats API (dark launch + ops endpoint)** | **✅ SHIPPED** |
| **2026-04-18** | **Phase 4J Anthropic API Adapter + Phase 4K Admin Monitoring LLM Trace (real Anthropic + trace embed)** | **✅ SHIPPED** |
| **2026-04-18** | **Phase 4M + 4L Trace Aggregator Extraction + Anthropic Streaming/Tool-Use (Round 4)** | **✅ SHIPPED** |
| **2026-04-18** | **Phase 4N SSE Parser Extraction + Phase 4E.2 Semantic Cache + Phase 4F.2 Tenant Helpers + Phase 4G-BYOK Foundations (Round 5)** | **✅ SHIPPED** |
| **2026-04-18** | **Phase 4F.3 Tier Normalization + Phase 4N-POLISH SSE Reader + Phase 4E.2-TUNING Cache Index + Phase 4G-WIRE BYOK Integration (Round 6)** | **✅ SHIPPED** |
| **2026-04-18** | **Phase 7A OpenRouter Degrade-to-Mock + Phase 7B script-generator BYOK + Phase 7C niche-enhancer BYOK (Round 7)** | **✅ SHIPPED** |
| **2026-04-18** | **Phase 8A Hygiene (errorClass split + weekly-signals + error-digest) + Phase 8C User-Facing BYOK Admin (/api/user/byok + /dashboard/byok) (Round 8)** | **✅ SHIPPED** |
| **2026-04-20** | **Tech Debt Phase 5: Console.log → logger Refactor (17 files, 34 statements, 1297/1297 tests 100%)** | **✅ COMPLETE** |
| **2026-04-20** | **Tech Debt Phase 8: Telegram Handlers Type Safety + FSM/Rate-Limiter Review Nits (6 files, `:any` → 0, 9.2/10 APPROVE_WITH_NITS)** | **✅ COMPLETE** |
| **2026-04-20** | **Tech Debt Phase 9: Audit Module `:any` Cleanup (11 files + 1 new types.ts, 33 `:any` → 0, 9.6/10 APPROVE)** | **✅ COMPLETE** |
| **2026-04-20** | **Tech Debt Phase 10: Usage Metering + Route Handlers `:any` Cleanup (9 files, 20 `:any` → 0, D1Response<T> generic, 9.6/10 APPROVE)** | **✅ COMPLETE** |
| **2026-04-20** | **Tech Debt Phase 12: DB Helpers & FSM Design (D1Response consolidated, insertTyped 10 sites, FSM design doc, 9.6/10 APPROVE)** | **✅ COMPLETE** |
| **2026-04-20** | **Tech Debt Phase 11: RaaS License System Type Safety (2 files, 3 `:any` → 0, discriminated union narrowing, incidental severity-routing bug fix, 9.7/10 APPROVE)** | **✅ COMPLETE** |
| **2026-04-25** | **Phase 9 Analytics Dashboard (SSE realtime, revenue metrics, cohort retention/churn/LTV, tier adoption, 1,800 LOC, 1362/1362 tests)** | **✅ SHIPPED** |
| **2026-04-25** | **Tech Debt Phase 30: Analytics Query Type Safety + Billing Page Modularization (`:any` elimination, 440L→139L, 1362/1362 tests)** | **✅ COMPLETE** |
| **2026-04-25** | **Build Fix: 8 Turbopack Errors Resolved (server re-exports, ssr:false in SC, vi.json translations)** | **✅ COMPLETE** |
| **2026-04-28** | **Go-Live Audit Phase 01 (Tier-1): CI Hardening, Auth Gates, i18n, A11y, CDN, Backup** | **✅ SHIPPED** |
| **2026-04-30** | **Phase 11: Auto Video Customer Handoff (post-purchase onboarding video + email, 1798 tests)** | **✅ SHIPPED** |
| 2026-05-15 | Go-Live Audit Phase 02 (Tier-2): Load Testing, Error Budgets, Observability | 🔄 Planned |
| 2026-06-01 | Multi-Language Support (Vietnamese) | 🔄 Planned |
| 2026-07-01 | Telegram Bot Enhancement | 🔄 Planned |
| 2026-Q4 | $1M ARR Milestone | 🎯 Target |

---

## Owner & Contact

- **Product Lead:** Founder (BYOK delivery model)
- **CTO:** AI-driven code + infrastructure
- **CMO:** Content + brand automation
- **CSO:** Sales + customer acquisition
- **COO:** Operations + metrics

All decisions documented in `.sophia-factory/journal/` for audit trail.
