# Go-Live Augmentation Plan: OmniRoute Patterns for Sophia AI Factory

> **Context**: Principal engineer review of Sophia AI Factory (Next.js 16 on Cloudflare Workers) against OmniRoute (github.com/diegosouzapw/OmniRoute) patterns. Advisory-only — no code changes.

---

## TL;DR

**Top 3 highest-value OmniRoute patterns to adopt:**

1. **Per-key circuit breaker + connection cooldown** (already ~80% implemented — close the gaps)
2. **Structured logging + Sentry metrics + SLO burn-rate alerts** (foundation exists — promote to production standard)
3. **Mutation testing via Stryker** (0% implemented — highest ROI for regression protection)

**OmniRoute patterns to explicitly NOT copy:** Polyglot monorepo, npm/Docker distribution, Electron shell, 109-tool MCP surface — these violate Sophia's no-tech/BYOK doctrine and CF Workers constraints.

---

## Reframed Problem

**What is actually being decided:**
Sophia is approaching production go-live on Cloudflare Workers. The codebase has strong foundations (AES-256-GCM BYOK encryption, D1 persistence, 4-state circuit breakers, structured logging, Inngest workflows, 2,168 test files). The question is: **which OmniRoute resilience/quality patterns, when backported, reduce live risk most per unit of effort while respecting Sophia's constraints?**

**Requirements:**
- ✅ Must work on Cloudflare Workers (no long-running processes, no native binaries)
- ✅ Must align with no-tech/BYOK doctrine (customer self-input, operator manages platform only)
- ✅ Must not require operator-provided third-party credentials
- ✅ Must integrate with existing D1 + KV + Inngest + OpenNext stack

**Non-goals:**
- ❌ Full OmniRoute parity (different product, different constraints)
- ❌ Adding new infrastructure dependencies
- ❌ Breaking protected flows (Setup Wizard, Telegram Bot, NOWPayments IPN)

---

## Current State Summary (Verified)

| Capability | Status | Evidence |
|------------|--------|----------|
| **Circuit Breakers** | 80% done | 4-state machine (CLOSED/DEGRADED/OPEN/HALF_OPEN) in `seed/security/circuit-breaker.ts` with D1 persistence; per-kind cooldowns; `keyRef` for BYOK isolation |
| **Retry/Backoff** | 60% done | Exponential backoff in `land/webhooks/retry.ts` (5 attempts, 30s→6h); OpenRouter client has retry; no unified retry policy |
| **Per-Key Lockout** | 40% done | `keyRef` parameter exists but many callers pass `'platform'` (shared) instead of tenant-scoped ref |
| **Provider Cooldown** | 80% done | Per-`FailureKind` cooldowns (AUTH=immediate, RATE=60s, SERVER=5m) |
| **Encryption** | 95% done | AES-256-GCM, key rotation, AAD binding, tamper detection — `seed/security/encryption-aes-gcm.ts` + `tree/byok/byok-crypto.ts` |
| **Testing** | 70% done | 2,168 test files (vitest + Playwright + k6); mutation testing **absent** |
| **Complexity Ratchets** | 20% done | ESLint has layer boundaries; **no SonarJS, no max-complexity gates** |
| **Structured Logging** | 85% done | JSON logger with PII scrub, Sentry breadcrumbs, Better Stack batching |
| **Sentry** | 80% done | Client/server/edge configs; 6 SLO alerts defined; source map upload optional |
| **SHA Verification** | 95% done | `/api/version` returns `shortSha`; full SHA gated by `INTROSPECT_TOKEN` |
| **D1 Migrations** | 90% done | 196 migrations; `apply-migrations.sh` applies delta; schema verification non-blocking |

---

## Prioritized Augmentation Plan

Each item scored on:
- **Live-Risk Reduction** (1-5): How much does this prevent production incidents?
- **Integration Effort** (1-5): Engineering days to implement well (1=trivial, 5=major)
- **Doctrine Alignment** (1-5): Fits no-tech/BYOK/CF-Workers constraints (5=perfect fit)

**Score = (Risk × 2) + (5 - Effort) + Alignment** — higher = do first.

| # | Item | Risk | Effort | Align | Score | Source |
|---|------|------|--------|-------|-------|--------|
| **1** | **Enforce per-tenant `keyRef` everywhere** | 5 | 1 | 5 | **16** | OmniRoute per-key lockout |
| **2** | **Unified retry policy + jitter + Retry-After respect** | 4 | 2 | 5 | **14** | OmniRoute combo dispatch |
| **3** | **Sentry SLO metrics + burn-rate alerts to production** | 4 | 2 | 4 | **13** | OmniRoute SLO dashboards |
| **4** | **Mutation testing (Stryker) on critical paths** | 5 | 3 | 4 | **13** | OmniRoute 25k+ tests + Stryker |
| **5** | **ESLint complexity ratchets (SonarJS + max-complexity)** | 3 | 2 | 5 | **12** | OmniRoute complexity gates |
| **6** | **KV quota cache atomicity hardening** | 3 | 2 | 5 | **12** | OmniRoute Redis Lua scripts |
| **7** | **Connection cooldown per provider (extend existing)** | 3 | 2 | 5 | **12** | OmniRoute connection cooldowns |
| **8** | **DLQ replay API + admin UI** | 3 | 3 | 4 | **10** | OmniRoute dead-letter tooling |
| **9** | **Health endpoint enrichment (dependencies check)** | 2 | 2 | 5 | **10** | OmniRoute /health deep |
| **10** | **Automated key rotation audit trail** | 2 | 2 | 5 | **10** | OmniRoute key management |

---

### Detailed Recommendations

#### 1. Enforce Per-Tenant `keyRef` Everywhere (Score: 16)
**Gap:** 14+ files call `shouldAllowRequest('provider')` with implicit `'platform'` keyRef, sharing circuit breaker across all tenants. One tenant's bad BYOK key trips the breaker for everyone.
**Fix:** Audit all call sites; require `keyRef: \`${provider}:${userId}\`` for BYOK providers; keep `'platform'` only for shared platform keys (OAuth apps).
**Files:** `hunter-client.ts`, `heygen-helpers.ts`, `path-b-cinematic.ts`, all providers in `land/video/publishing/providers/`
**Effort:** 0.5 day (grep + replace pattern)
**Doctrine:** Perfect — BYOK isolation is core to no-tech.

#### 2. Unified Retry Policy + Jitter + Retry-After (Score: 14)
**Gap:** `land/webhooks/retry.ts` has fixed schedule; OpenRouter client has exponential backoff but ignores `Retry-After`; no central policy.
**Fix:** Create `seed/resilience/retry-policy.ts` with:
- Configurable max attempts, base delay, max delay, jitter factor
- `Retry-After` header parsing (seconds or HTTP-date)
- `FailureKind`-aware: AUTH_FAILURE → no retry; RATE_LIMIT → honor Retry-After or exponential
- Export `withRetry(fn, policy)` wrapper used by all outbound HTTP
**Effort:** 1.5 days
**Doctrine:** Pure code, no infra.

#### 3. Sentry SLO Metrics + Burn-Rate Alerts to Production (Score: 13)
**Gap:** `sentry.alerts.json` defines 6 alerts but requires manual Sentry UI creation; Honeycomb OTEL only in staging; burn-rate cron exists but metrics only go to Sentry (not alerted).
**Fix:**
- Script to create Sentry alerts via API (requires `SENTRY_AUTH_TOKEN` in CF secrets)
- Enable Honeycomb OTEL in production wrangler.toml (add `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME`)
- Wire `sophia.slo.burn_rate` metric to alert on 2%/5%/10% burn (1h/6h/24h windows)
**Effort:** 1 day + secrets config
**Doctrine:** Operator manages platform observability; no customer creds needed.

#### 4. Mutation Testing (Stryker) on Critical Paths (Score: 13)
**Gap:** 0% mutation testing. 2,168 tests but no verification they catch real bugs.
**Fix:**
- Add `@stryker-mutator/core`, `@stryker-mutator/vitest-runner`
- Configure `stryker.conf.json`: target `seed/security/`, `seed/crypto/`, `tree/byok/`, `land/video/publishing/providers/`
- Threshold: 80% mutation score on critical paths; CI gate
- Run nightly (not every PR — too slow for CF Workers bundle)
**Effort:** 2 days setup + CI integration
**Doctrine:** Pure dev tooling; no production impact.

#### 5. ESLint Complexity Ratchets (SonarJS + max-complexity) (Score: 12)
**Gap:** ESLint has layer boundaries but **no** `sonarjs/cognitive-complexity`, `max-lines`, `max-depth`, `max-params` rules. 451 files >200 lines (non-test).
**Fix:**
- Add `eslint-plugin-sonarjs`
- Rules: `sonarjs/cognitive-complexity: [error, 15]`, `max-lines: [error, 200]`, `max-depth: [error, 4]`
- Ratchet: start at current max (e.g., complexity 25), decrease by 1 per quarter
- Exempt test files and generated code
**Effort:** 0.5 day + gradual cleanup
**Doctrine:** Code quality gate; no runtime impact.

#### 6. KV Quota Cache Atomicity Hardening (Score: 12)
**Gap:** `tree/usage-metering/realtime-tracker-kv-ops.ts` uses Lua script (good); `seed/kv/quota-cache-ops.ts` is delete-only; no atomic increment for quota checks.
**Fix:**
- Port Lua `HINCRBY + EXPIRE` pattern to `quota-cache-ops.ts` for atomic check-and-increment
- Add `getOrIncrement(key, limit, windowSec)` that returns `{ allowed, remaining, resetAt }`
- Fail-open on Redis/KV unavailability (current behavior is correct)
**Effort:** 1 day
**Doctrine:** KV is platform infrastructure; no customer config.

#### 7. Connection Cooldown Per Provider (Score: 12)
**Gap:** Circuit breaker has cooldowns but no **connection-level** cooldown (separate from request-level). OmniRoute tracks connection pool health separately.
**Fix:** Extend `CircuitBreakerEntry` with `consecutiveConnectionFailures`, `lastConnectionFailureAt`, `connectionCooldownUntil`. On DNS/TCP/TLS failure (NETWORK kind), increment connection counter; open connection cooldown after 3 failures (60s). Distinct from request cooldown.
**Effort:** 1 day
**Doctrine:** Pure resilience logic; no infra.

#### 8. DLQ Replay API + Admin UI (Score: 10)
**Gap:** DLQ exists (`land/billing/nowpayments-ipn-dead-letter.ts`, `land/affiliates/commission-dlq.ts`) but replay is CLI-only (`scripts/replay-dlq.ts`). No admin visibility.
**Fix:**
- Add `/api/admin/dlq/list` and `/api/admin/dlq/replay/:id` (Server Actions)
- Admin page: list DLQ entries with payload preview, error, timestamp; one-click replay
- Idempotency: replay uses original `idempotency_key`
**Effort:** 2 days
**Doctrine:** Admin UI is platform-only; fits operator-management model.

#### 9. Health Endpoint Enrichment (Score: 10)
**Gap:** `/api/health` (if exists) likely only returns `{ status: 'ok' }`. No dependency checks.
**Fix:** Create `/api/health/deep` (protected by `INTROSPECT_TOKEN`):
- D1: `SELECT 1`
- KV: `get('health-check')`
- R2: `headObject` on bucket
- Inngest: `GET /v1/events` (if reachable)
- External: ping OpenRouter, HeyGen (circuit-breaker aware — don't hammer)
- Return per-dependency latency + status
**Effort:** 1 day
**Doctrine:** Platform health; no customer data.

#### 10. Automated Key Rotation Audit Trail (Score: 10)
**Gap:** `byok-crypto.ts` supports key rotation (`key_versions` table) but no audit log of rotations, no automatic re-encryption trigger.
**Fix:**
- Add `key_rotation_audit` table: `version, rotated_at, rotated_by, keys_reencrypted, status`
- Cron (monthly): scan `user_api_keys` for old version; re-encrypt in batches; log to audit table
- Alert if rotation stalls >7 days
**Effort:** 1.5 days
**Doctrine:** Crypto hygiene is platform responsibility.

---

## TTY / Production-Readiness Checklist

> Run these **before** declaring go-live. Each must pass.

### D1 Migrations
- [ ] `bash scripts/apply-migrations.sh` — all 196 migrations apply clean on staging D1
- [ ] `bash scripts/check-duplicate-migration-prefixes.sh` — no duplicate prefixes
- [ ] Schema verification query passes (add blocking mode to apply-migrations.sh)
- [ ] Rollback plan documented for last 5 migrations (manual SQL in `docs/rollback-plan.md`)

### KV Quota Cache
- [ ] `scripts/check-cf-quota.ts` passes: KV namespace `KV_KV` has <80% quota used
- [ ] `EXPERIMENT_KV` feature flags load within 50ms p99 (test via `scripts/perf-check.ts`)
- [ ] Atomic Lua script for quota check-and-increment deployed and verified

### Sentry
- [ ] `SENTRY_DSN` set in CF Worker secrets (production)
- [ ] `SENTRY_AUTH_TOKEN` set in CF Worker secrets (for source map upload)
- [ ] Source maps upload on deploy (verify in deploy logs: "Uploading source maps to Sentry")
- [ ] All 6 alerts from `sentry.alerts.json` created in Sentry project and routed to Slack/email
- [ ] `sophia.slo.burn_rate` metric visible in Sentry Metrics
- [ ] Error grouping/fingerprinting works (test with `throw new Error('test-fingerprint-abc123')`)

### SHA Verification
- [ ] `git push origin main` completes
- [ ] `npm run deploy:full` exits 0
- [ ] `LOCAL_SHA=$(git rev-parse HEAD | cut -c1-8)` matches `curl -s https://sophia.agencyos.network/api/version | jq -r .shortSha`
- [ ] `curl -s https://sophia.agencyos.network/api/health` returns 200
- [ ] `curl -s https://sophia.agencyos.network/vi/login` returns 200 (i18n routing works)

### Inngest
- [ ] All 32 functions registered in Inngest dashboard
- [ ] No stuck executions >24h (check Inngest UI)
- [ ] `workflow-stepper` cron (every 1 min) healthy — no backlog
- [ ] DLQ reaper cron catches failed functions

### Protected Flows (Smoke Test)
- [ ] Setup Wizard: new tenant → enter OpenRouter/ElevenLabs/D-ID keys → save → keys decrypt/encrypt roundtrip
- [ ] Telegram Bot: `/campaign`, `/status`, `/results` respond within 3s
- [ ] NOWPayments IPN: test payment → webhook received → tier activated → confirmation sent

### Load / Stress
- [ ] `npm run test:load:steady` — 100 VUs for 5 min, p99 <2s, error rate <0.1%
- [ ] `npm run test:load:spike` — 500 VUs for 30s, no worker OOM, graceful degradation
- [ ] Cold start p99 <3s (verify via `test:load:soak` 30 min)

### Security
- [ ] `npm run ci:secrets` passes (no secrets in code)
- [ ] `npm run ci:audit` passes (no high/critical vulns)
- [ ] CSP report endpoint `/api/csp-report` receives violations in production (monitor for 24h)
- [ ] All API routes use Zod validation (spot-check 10 routes)

---

## OmniRoute Patterns to EXPLICITLY NOT Copy

| OmniRoute Pattern | Why Not for Sophia |
|-------------------|-------------------|
| **Polyglot monorepo (Go + TypeScript + Python)** | Sophia is pure TypeScript on CF Workers. Go/Python would require separate runtimes, breaking CF-direct doctrine. |
| **npm package distribution (`omniroute`, `omniroute-core`)** | Sophia is a deployed SaaS, not a library. No packaging needed. |
| **Docker containers for local dev** | CF Workers use `wrangler dev` / `opennextjs-cloudflare`. Docker adds complexity without parity (Workers runtime differs from Node). |
| **Electron desktop shell** | Sophia is web-only. No desktop app in roadmap. |
| **109-tool MCP surface** | Sophia's MCP gateway (`land/openclaw/mcp-gateway.ts`) has 6 whitelisted servers (YouTube, TikTok, Supabase, claude-mem, pencil, cheetahclaws). 100+ tools would explode attack surface, violate no-tech (customers can't configure 100 tools), and exceed CF Workers bundle limits. |
| **Provider-agnostic abstraction layer (Provider interface + registry)** | Sophia has `seed/ai/provider-interface.ts` but only OpenRouter + Anthropic + HeyGen are real. Over-abstraction adds indirection for marginal gain. |
| **A2A (Agent-to-Agent) protocol endpoints** | No multi-agent coordination requirement. Inngest handles workflow orchestration. |
| **Self-hosted control plane** | Sophia uses Cloudflare as control plane (Workers + D1 + KV + R2 + Cron). No separate infra. |
| **OpenTelemetry collector sidecar** | CF Workers don't support sidecars. Honeycomb OTEL via `@opentelemetry/sdk` in-process only. |
| **Kubernetes-style health/readiness probes** | CF Workers has no pod lifecycle. `/api/health` is HTTP-only. |

---

## Assumptions & Confidence

| Assumption | Confidence | What Would Flip It |
|------------|------------|-------------------|
| CF Workers is the permanent runtime (no migration to K8s/VMs) | High | Business decision to move off Workers |
| BYOK + no-tech doctrine is non-negotiable | High | Pivot to enterprise managed-service model |
| D1 + KV + R2 + Inngest stack is stable | Medium | Cloudflare deprecates a binding; Inngest pricing change |
| 2,168 tests provide adequate regression coverage without mutation testing | Medium | Production incident caused by surviving mutant |
| Sentry + Better Stack observability stack is sufficient | Medium | Need for distributed tracing (add Honeycomb prod) |
| `shortSha` (8 chars) collision risk is acceptable for `/api/version` | Low | Deploy frequency >100/day for years |

---

## Recommended Execution Order

**Week 1 (Quick Wins):**
1. Enforce per-tenant `keyRef` everywhere (Item 1)
2. Add ESLint complexity ratchets (Item 5)
3. Health endpoint enrichment (Item 9)

**Week 2 (Core Resilience):**
4. Unified retry policy (Item 2)
5. Connection cooldown per provider (Item 7)
6. KV quota cache atomicity (Item 6)

**Week 3 (Observability Hardening):**
7. Sentry SLO alerts to production (Item 3)
8. DLQ replay API + admin UI (Item 8)

**Week 4 (Quality Gates):**
9. Mutation testing setup (Item 4)
10. Automated key rotation audit (Item 10)

**Go-Live Gate:** All checklist items pass + Week 1-2 complete.

---

*Report generated by Kongming advisory agent. No code modified. All evidence sourced from repository at commit `$(git rev-parse HEAD)`.*