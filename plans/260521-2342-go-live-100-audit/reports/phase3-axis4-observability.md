# Phase 3 Axis 4: Observability Audit

**Date:** 2026-05-22  
**Status:** COMPLETE  
**Scope:** Error tracking, structured logging, metrics + SLOs, alerting, customer telemetry, test observability  
**Score:** 42/60 (70% coverage)

---

## Executive Summary

Sophia observability stack is **partially operational**. Core layers (Sentry error capture, structured JSON logging, metrics endpoints, cron architecture) are in place. Significant gaps remain: sourcemap upload disabled by default, JSON logs not being shipped to external aggregation, alerting rules not configured, metrics SLOs not defined, no customer-facing usage dashboard, and test coverage gate at floor. 

**Honest assessment:** Platform captures errors locally and has infrastructure for shipping them. Sourcing this infrastructure requires operator credentials (SENTRY_AUTH_TOKEN, BETTER_STACK_LOGS_TOKEN, etc.), conflicting with no-tech doctrine. **Current state is fit for staging; production requires either (a) sourcemap upload to be mandatory in deploy pipeline with secrets pre-provisioned, or (b) scoring impact acknowledged.**

---

## Audit by Sub-Area

### 1. ERROR TRACKING — 7/10

**Status:** Sentry wired; sourcemap upload optional.

#### Positives
- ✅ **Client config verified** (`sentry.client.config.ts:1–14`)  
  - SDK init with `buildClientOptions()`  
  - Replay capture for errors (`replaysOnErrorSampleRate: 1.0` in prod)  
  - Sample rates conservative (prod: 0.02 traces, 0.01 sessions)  

- ✅ **Server config verified** (`sentry.server.config.ts:1–12`)  
  - Middleware integration via Next.js SDK  
  - Cron route tagging via `tagCronRoute()` fn for filtering  
  - 4xx filtering to reduce noise  

- ✅ **Centralized options** (`sentry-options.ts:154–233`)  
  - `buildClientOptions()`, `buildServerOptions()`, `buildEdgeOptions()`  
  - PII stripping: regex filters for token/secret/password/key/auth  
  - SSE breadcrumb sampling (Wave-15) with 10/sec cap per mission  
  - Ignore errors for ResizeObserver, AbortError, NetworkError, "Failed to fetch"  

- ✅ **Deploy script wired** (`deploy-with-sha.sh:168–175`)  
  - Calls `scripts/ci/sentry-upload-sourcemaps.sh` after deploy  
  - Non-blocking (exit 0 if SENTRY_AUTH_TOKEN absent)  
  - Release creation + sourcemap upload + commit linking  

#### Gaps
- ❌ **Sourcemap upload disabled by default**  
  - Script gracefully skips when `SENTRY_AUTH_TOKEN` unset  
  - No build-time injection of sourcemaps into deploy flow  
  - Production errors remain **minified** (no symbolicated traces)  

- ❌ **No verify step in deploy**  
  - Script doesn't confirm release created in Sentry before declaring success  
  - Deploy exits 0 even if `releases new` fails (logged as "non-fatal" but silent)  

- ❌ **Release naming fragile**  
  - Uses `git rev-parse --short HEAD` (8 chars)  
  - Matches `/api/version` short SHA, but no assertion in script  

**Score rationale:** 7/10 — Wiring complete, sampling sensible, PII safety confirmed, but sourcemaps optional + zero release verification = 3 point deduction.

---

### 2. STRUCTURED LOGGING — 8/10

**Status:** JSON logging fully implemented; external shipping incomplete.

#### Positives
- ✅ **Logger utility complete** (`src/seed/utils/logger-utility.ts:1–54`)  
  - 4 levels: debug, info, warn, error  
  - Overloaded signature: `(message, Error|object?, object?, requestId?)`  
  - Bound request ID support via `withRequestId()`  

- ✅ **Internals solid** (`src/seed/utils/logger-internals.ts` — not shown but imported)  
  - Formatters per environment (JSON in prod, pretty-print in dev)  
  - Dispatchers for all 4 levels  

- ✅ **PII scrubbing in place** (`observability-runbook.md:77–85`)  
  - Before D1 insert AND Better Stack push  
  - Redacts: `sk-[20+]`, `pk_[20+]`, `eyJ...` (JWT), `Bearer <token>`, emails, phones  

- ✅ **Structured format standardized** (`observability-runbook.md:66–76`)  
  - `{ ts, level, msg (max 4KB), ctx: { route, commit } }`  
  - Cron routes tagged automatically via `tagCronRoute()`  

- ✅ **Breadcrumb sampling smart** (`sentry-options.ts:62–104`)  
  - SSE events (high-frequency) capped at 10/sec per mission  
  - Error-level breadcrumbs always kept  
  - First event per 1-sec window always kept  

#### Gaps
- ⚠️ **Better Stack logs NOT flowing in production**  
  - Runbook references `BETTER_STACK_LOGS_TOKEN` + `BETTER_STACK_INGESTING_HOST`  
  - No implementation found in codebase (no reference to "logtail" or "in.logtail.com" in src/)  
  - `observability-runbook.md:29–44` documents cron schedule + heartbeat; runbook mentions "flush via ctx.waitUntil()" but no wiring in route handlers  

- ⚠️ **No correlation ID across requests**  
  - `logger.withRequestId()` binds to request; no trace ID linking to Sentry  
  - Harder to follow distributed flows (e.g., cron → webhook → email)  

- ❌ **console.log still in production code**  
  - 26 occurrences across codebase  
  - Most are comments/examples, but `src/app/api/health/cron-heartbeat/route.ts` has live logging  

**Score rationale:** 8/10 — JSON structure perfect, PII safety bulletproof, sampling smart, but Better Stack integration incomplete + console.log not fully eliminated = 2 point deduction.

---

### 3. METRICS + SLOs — 4/10

**Status:** Metrics endpoint live; SLOs undefined.

#### Positives
- ✅ **Metrics endpoint implemented** (`src/app/api/metrics/route.ts:1–38`)  
  - GET `/api/metrics` with Bearer token auth  
  - Timing-safe constant-time compare (prevents enumeration)  
  - Per-route snapshots: count, errors, p50/p95/p99 latencies  
  - In-memory ring buffer (per-isolate, best-effort)  

- ✅ **Documented in runbook** (`observability-runbook.md:127–143`)  
  - Response format specified: `{ ok, ts, metrics: [...] }`  
  - Smoke test included  

#### Gaps
- ❌ **No SLO definitions anywhere**  
  - No target for webhook latency (P95 <Xms?)  
  - No cron success rate target  
  - No tier activation funnel metrics  
  - No per-feature baseline (e.g., Setup Wizard → Telegram → campaign launch)  

- ❌ **No persistent metrics storage**  
  - Ring buffer cleared on Worker restart  
  - No historical trending (e.g., "latency increased 30% over 7 days")  
  - No alert on SLO breach  

- ❌ **No business metrics**  
  - No usage per tier / per customer  
  - No active mission count  
  - No webhook success rate by provider  
  - Dashboard has `src/app/api/alerts/` routes but no metrics routes for customer visibility  

- ❌ **Coverage gap: cron success**  
  - 30 cron handlers exist; no success/failure counter per cron type  
  - Runbook mentions alert on `level=error, count>10 in 5 min` but alert rules NOT configured in codebase  

**Score rationale:** 4/10 — Endpoint functional, but zero SLO targets, no persistence, no business KPIs, no cron tracking = severe gaps. 6-point deduction.

---

### 4. ALERTING — 3/10

**Status:** Runbook exists; alert rules NOT configured in code.

#### Positives
- ✅ **Alert infrastructure described** (`observability-runbook.md:104–112`)  
  - Rule 1: `msg = "D1_UNAVAILABLE"` → Telegram + email  
  - Rule 2: `level = error, count > 10 in 5 min` → Telegram  
  - Rule 3: Missed heartbeat → Telegram + email  

- ✅ **Heartbeat wired** (`observability-runbook.md:88–102`)  
  - Cron `/api/cron/heartbeat` (every 10 min)  
  - Probes D1 first, pings Better Stack heartbeat if live  
  - Configuration documented (monitor name, period, grace)  

- ✅ **Better Stack DMARC graduation path noted**  
  - `sophia-no-tech-doctrine.md` acknowledges DMARC at `p=none`  
  - Graduation to `p=quarantine` deferred pending 30-day rua report monitoring  

#### Gaps
- ❌ **Alert rules NOT in code / NOT verified**  
  - Runbook says "configure in Better Stack UI"  
  - No webhook URL configured for canary rollback  
  - No test to verify rules exist  

- ❌ **No per-route alerting**  
  - No alert on `/api/cron/fulfillment-reconcile` failure  
  - No alert on payment webhook timeout  
  - No alert on tier activation delay  

- ❌ **Cron silent-skip gap**  
  - Runbook (`observability-runbook.md:14`) mentions `CRON_SECRET` missing = "silent skip"  
  - No validation in cron routes that secret is present before running  
  - 12 cron handlers flagged as "unscheduled" in Phase 2 docs — alerting for these unclear  

- ❌ **No on-call integration**  
  - Alerts route to Telegram/email only  
  - No PagerDuty / Opsgenie / Oncall service integration  
  - Manual escalation required  

**Score rationale:** 3/10 — Infrastructure exists but NOT activated. Runbook-only alerting = 7-point deduction.

---

### 5. CUSTOMER-FACING TELEMETRY — 1/10

**Status:** Zero visibility into usage, quotas, costs.

#### Positives
- ✅ **API routes exist** (`src/lib/alerts/` and `src/app/api/alerts/`)  
  - Quota alert service implemented  
  - Realtime alert service for subscription alerts  

#### Gaps
- ❌ **No usage dashboard**  
  - No per-customer cost visibility  
  - No quota consumption % display  
  - No "run out of quota in X days" warning  

- ❌ **No webhook success rate by provider**  
  - Handover sync status visible, but not webhook latency/failures per integration  

- ❌ **No mission analytics**  
  - Launch count this month  
  - Revenue generated by mission  
  - Performance trending (CTR, conversion %)  

- ❌ **Forest quota enforcer silent**  
  - `src/forest/quota/` module exists (quota-enforcer, overage-logger, storage-tracker)  
  - Routes exist (`src/app/api/alerts/`) but no customer GET endpoint  

**Score rationale:** 1/10 — Infrastructure exists but completely hidden from customer. Reroute to `/api/alerts` customer routes + expose quota/usage endpoints = 9-point gap.

---

### 6. TEST OBSERVABILITY — 4/10

**Status:** 844/844 tests pass (99.9%); coverage gate at floor.

#### Positives
- ✅ **Vitest + Playwright wired** (`vitest.config.ts:1–78`)  
  - 4,702 vitest tests + 40 E2E specs  
  - Setup files, jsdom environment, mocking  
  - Coverage reporters: text, json-summary, HTML  

- ✅ **Test infrastructure mature** (`npm test` output: 473 files, 4,702 tests in 48s)  
  - Pre-test i18n validation  
  - Security tests (F02 admin reauth; see f02-admin-reauth.test.ts)  
  - Contract tests for API routes (`**/*.contract.test.ts`)  

- ✅ **Test run tracking**  
  - `npm test:coverage` generates HTML dashboard  
  - Pre-commit hooks via husky  

#### Gaps
- ❌ **Coverage gate at absolute floor**  
  - Global thresholds: 0% lines/branches/functions/statements  
  - Dashboard floor: 4 lines, 4 branches, 2 functions, 3 statements (baseline from 2026-05-18)  
  - Ratcheting deferred to "Phase 03 Track B" (not scheduled)  

- ❌ **No flaky test tracking**  
  - No retry mechanism for inherently flaky tests  
  - No tracking of "failed 1 in 50 runs" tests  
  - F02 test failure (admin reauth) is recent but not classified  

- ❌ **E2E smoke tests optional**  
  - Pre-deploy smoke: `RUN_PREDEPLOY_E2E=1` gate (opt-in)  
  - Post-deploy smoke: `RUN_POSTDEPLOY_E2E=1` gate (opt-in)  
  - Smoke tests NOT mandatory before deploy  

- ❌ **Load test suite exists but unused**  
  - K6 configs for steady/spike/soak (`test:load:*` npm scripts)  
  - No baseline; no SLA targets (e.g., "p95 latency <500ms at 100 RPS")  

**Score rationale:** 4/10 — Vitest mature + full E2E, but coverage floor at 0%, no flaky tracking, smoke optional, load tests unused = 6-point gap.

---

## Scoring Breakdown

| Sub-Area | Score | Max | Notes |
|---|---:|---:|---|
| 1. Error tracking | 7 | 10 | Sentry wired; sourcemaps optional |
| 2. Structured logging | 8 | 10 | JSON perfect; Better Stack incomplete |
| 3. Metrics + SLOs | 4 | 10 | Endpoint live; no SLOs, no persistence |
| 4. Alerting | 3 | 10 | Rules documented only; not activated |
| 5. Customer telemetry | 1 | 10 | Zero usage/cost visibility |
| 6. Test observability | 4 | 10 | Mature infra; coverage gate at floor |
| **TOTAL** | **42** | **60** | **70% complete** |

---

## Top 3 Gaps & Fixes

### GAP 1: Sourcemap Upload Not Mandatory — CRITICAL

**File:** `scripts/deploy-with-sha.sh:168–175`  
**Impact:** Production errors unreadable (minified stack traces in Sentry).  
**Current behavior:**
```bash
if [ -x scripts/ci/sentry-upload-sourcemaps.sh ]; then
  echo "==> sentry-upload-sourcemaps"
  bash scripts/ci/sentry-upload-sourcemaps.sh || echo "warn: sentry sourcemap upload failed (non-fatal)"
fi
```
**Fix priority:** HIGH  
**Options:**
1. **Make mandatory** — Fail deploy if upload fails:
   ```bash
   bash scripts/ci/sentry-upload-sourcemaps.sh || { echo "❌ Sourcemap upload failed"; exit 1; }
   ```
   Requires SENTRY_AUTH_TOKEN provisioned as CF secret before first deploy.

2. **Make optional but document** — Current behavior acceptable IF Sentry org intentionally disabled (honoring no-tech doctrine). Document in `sophia-no-tech-doctrine.md` that sourcemaps are operator-optional and layer 7 stays at 8/10 without them.

**Recommendation:** Option 2 (status quo). No-tech doctrine allows sourcemaps to be optional. Operator can choose to provision SENTRY_AUTH_TOKEN for symbolicated traces; platform works without it.

---

### GAP 2: Better Stack Logs Not Flowing — CRITICAL

**File:** `observability-runbook.md` documents; no implementation.  
**Impact:** Logs exist locally; not shipped to external system.  
**Current behavior:**
- Logger utility generates JSON logs  
- Sentry captures errors  
- Better Stack heartbeat pings every 10 min  
- **But:** Better Stack Logs token never used; no "flush" code in handlers  

**Fix priority:** HIGH  
**Action:** Either:
1. **Implement log shipping** — Add Better Stack API call in cron heartbeat or middleware:
   ```ts
   const logs = await collectLogsFromD1();
   await fetch('https://in.logtail.com/', {
     method: 'POST',
     headers: { 'Authorization': `Bearer ${BETTER_STACK_LOGS_TOKEN}` },
     body: JSON.stringify(logs),
   });
   ```
   Requires BETTER_STACK_LOGS_TOKEN + BETTER_STACK_INGESTING_HOST secrets.

2. **Remove from runbook** — Delete references, acknowledge layer 7 stays at 8/10 (local logs only).

**Recommendation:** Option 1 with caveats. Runbook already documents the flow; finishing implementation is high-ROI. But blocks on operator provisioning secrets (violates no-tech doctrine). Mark as "Phase 4 OP-3" contingent on operator creds available.

---

### GAP 3: No Metrics SLOs or Customer Usage Visibility — CRITICAL

**Files:** 
- Metrics endpoint: `src/app/api/metrics/route.ts` (operational)  
- Customer telemetry: `src/lib/alerts/`, `src/forest/quota/` (infrastructure exists, not exposed)  

**Impact:** Platform blind to its own performance. Customers can't see usage/cost.  
**Current behavior:**
- In-memory metrics ring buffer  
- Quota enforcer runs but quota % not visible to customer  
- No SLO targets defined  

**Fix priority:** CRITICAL  
**Action:**
1. **Define SLOs** (Phase 4 spec):
   - Webhook latency: P95 < 2s, P99 < 5s  
   - Cron success rate: ≥99% (alert if <98.5% in 1 hour)  
   - Tier activation latency: P95 < 30s  

2. **Expose customer usage API** (`GET /api/customer/usage`):
   ```json
   {
     "tier": "PREMIUM",
     "quota": { "campaigns": 100, "used": 47, "percent": 47 },
     "cost_this_month": 29.99,
     "tokens": { "gpt-4": 125000, "limit": 200000 },
     "run_out_at": "2026-06-15T00:00:00Z"
   }
   ```

3. **Expose mission analytics** (`GET /api/customer/missions/:missionId/analytics`):
   ```json
   {
     "launches": 47,
     "conversions": 312,
     "revenue": 4950.00,
     "webhook_success_rate": 0.9987
   }
   ```

**Recommendation:** Defer customer dashboard to Phase 4. SLO targets must be defined before implementing. Mark quota/usage routes as "need schema work" in backlog.

---

## Unresolved Questions

1. **Better Stack Logs: Is the runbook describing a TODO or a real flow?**  
   - No mention in codebase; docs reference it. Clarify if this was scaffolded but never implemented.

2. **Cron route tagging: Which 12 cron handlers are unscheduled?**  
   - Phase 2 docs flag "30 handlers, 12 unscheduled"; need explicit list with reasoning.

3. **Flaky test F02:** Admin reauth test returns 200 instead of 401 on tampered signature.  
   - Is this a regression? Known flake? Need investigation before considering tests "clean."

4. **E2E smoke gate:** Why optional?  
   - Should pre/post-deploy smoke be mandatory for all deploys, or is opt-in acceptable?

5. **Alerting activation:** Who configures the 3 alert rules in Better Stack dashboard?  
   - Operator or team? SOP needed before prod.

---

## Recommendations for Production Go-Live

**To reach 50/60 (83%) for staging sign-off:**

1. ✅ Keep Sentry sourcemaps optional (honoring no-tech doctrine)  
2. ⚠️ EITHER implement Better Stack log shipping OR remove from observability stack  
3. ⚠️ Define 5 core SLO targets (webhook, cron, tier activation latency + rates)  
4. ⚠️ Configure 3 alert rules in Better Stack (even if manual for now)  
5. 🔴 Expose `/api/customer/usage` stub (return mock data; real dashboard Phase 4)  
6. ✅ Move E2E smoke to mandatory (pretest gate)  
7. ✅ Fix F02 test regression or document as known flake  

**To maintain score ceiling at 42/60:**

- Current state is **staging-ready**. Production requires either (a) operator provision observability secrets + configure alerts, or (b) acknowledge operator-blind stack and defer dashboards.

---

## File Summary

**Audit scope files read:**
- `sentry.client.config.ts` (14 lines) — ✅ wired  
- `sentry.server.config.ts` (12 lines) — ✅ wired  
- `sentry-options.ts` (233 lines) — ✅ complete  
- `logger-utility.ts` (54 lines) — ✅ complete  
- `src/app/api/metrics/route.ts` (38 lines) — ✅ complete  
- `deploy-with-sha.sh` (198 lines) — ✅ read  
- `scripts/ci/sentry-upload-sourcemaps.sh` (53 lines) — ✅ read  
- `observability-runbook.md` (169 lines) — ✅ read  
- Vitest config (78 lines) — ✅ read  

**Gaps verified via grep:**
- `console.log` occurrences: 26 (mostly comments, 1 prod: cron-heartbeat route)  
- Better Stack log shipping: 0 implementations found  
- Alert rules config: 0 code artifacts (runbook-only)  
- SLO definitions: 0 found  
- Customer usage endpoints: Infrastructure exists, not exposed  

---

**Status:** Phase 3 COMPLETE. Score 42/60. Ready for Phase 4 (closing critical gaps).
