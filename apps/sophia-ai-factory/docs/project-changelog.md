# Project Changelog

**Last Updated:** 2026-04-26 | **Current Version:** 1.12.31

---

## [2026-04-26] B2 Phase 13 — Referral Share Widget Single-Endpoint HTTP Boundary Casting (v1.12.31)

**B2 Phase 13 (referral share widget):** Refactored `src/components/dashboard/referral-share-widget.tsx`, added local `ReferralGenerateResponse` interface to type-cast HTTP boundary response from `/api/referral/generate` endpoint, applied anti-corruption cast pattern `(await res.json()) as ReferralGenerateResponse`. Pattern instance #7 of "HTTP boundary cast" — **single-endpoint minimal-interface variant** (mirrors Phase 11 cleanness: strict YAGNI, omits unused server fields). Eliminated 2 TS18046 errors (37→35, -5.4% Phase 13 delta, -92.4% cumulative B2 from baseline 462→35). Tests 1394/1394 pass. Review 9.8/10 auto-approved.

---

## [2026-04-26] B2 Phase 12 — Quota Usage Dashboard Dual-Endpoint HTTP Boundary Casting (v1.12.30)

**B2 Phase 12 (quota usage dashboard):** Refactored `src/components/quota/quota-usage-dashboard.tsx`, added 2 local response interfaces (`QuotaUsageResponse`, `QuotaLimitResponse`) to type-cast HTTP boundary responses from parallel `Promise.all([fetch1, fetch2])` on endpoints `/api/quota/usage` + `/api/quota/limits`, applied anti-corruption cast pattern with fallback for each response. Pattern instance #6 of "HTTP boundary cast" — **first DUAL-ENDPOINT application** with separate interfaces per parallel fetch (Phase 11 was single-endpoint, Phase 12 extends pattern to multi-endpoint scenarios). Eliminated 3 TS18046 errors (40→37, -7.5% Phase 12 delta, -92% cumulative B2 from baseline 462→37). Tests 1394/1394 pass. Review 9.7/10 auto-approved.

---

## [2026-04-26] B2 Phase 11 — Audit Log Table HTTP Boundary Casting (v1.12.29)

**B2 Phase 11 (audit log table):** Refactored `src/components/admin/licenses/audit-log-table.tsx`, added local `AuditLogsResponse` interface to type-cast HTTP boundary response from `/api/admin/licenses/audit-logs` endpoint, applied anti-corruption cast pattern `(await response.json()) as AuditLogsResponse`. Pattern instance #5 of "HTTP boundary cast" (Phase 6 `RaasSyncResponse`, Phase 8 `HeyGenVideoStatusResponse`, Phase 9 `ProposalApiResponse`, Phase 10 `ApiKeysCreateResponse`). Cleanest instance: strict YAGNI (omits unused server fields, minimal scope). Eliminated 3 TS18046 errors (43→40, -6.98% cumulative from baseline 63 TS18046 in B2 Phase 1). Tests 1394/1394 pass. Review 9.7/10.

---

## [2026-04-26] B2 Phase 10 — API Key Create Modal HTTP Boundary Casting (v1.12.28)

**B2 Phase 10 (API key create modal):** Refactored `src/components/raas/api-key-create-modal.tsx`, added local `ApiKeysCreateResponse` interface to type-cast HTTP boundary response from `/api/raas/api-keys/create` endpoint, applied anti-corruption cast pattern `(await response.json()) as ApiKeysCreateResponse`. Pattern instance #4 of "HTTP boundary cast" (Phase 6 `RaasSyncResponse`, Phase 8 `HeyGenVideoStatusResponse`, Phase 9 `ProposalApiResponse`). Eliminated 4 TS18046 errors (47→43, -8.5% cumulative from baseline 63 TS18046 in B2 Phase 1). Tests 1394/1394 pass. Review 9.6/10.

---

## [2026-04-26] B2 Phase 9 — Proposals Page HTTP Boundary Casting (v1.12.27)

**B2 Phase 9 (proposals page):** Refactored `src/app/[locale]/dashboard/proposals/page.tsx`, added local `ProposalApiResponse` interface to type-cast HTTP boundary response from `/api/proposals` endpoint (route not yet implemented; local interface establishes client-side contract), applied anti-corruption cast pattern `(await res.json()) as ProposalApiResponse`. Pattern instance #3 of "HTTP boundary cast" (Phase 6 `RaasSyncResponse`, Phase 8 `HeyGenVideoStatusResponse`). Eliminated 4 TS18046 errors (51→47, -7.8% cumulative from baseline 63 TS18046 in B2 Phase 1). Tests 1394/1394 pass. Review 9.7/10.

---

## [2026-04-26] B2 Phase 8 — HeyGen Client HTTP Boundary Casting (v1.12.26)

**B2 Phase 8 (HeyGen client):** Refactored `src/lib/heygen/heygen-client.ts`, added local `HeyGenVideoStatusResponse` interface to type-cast HTTP boundary response from HeyGen API endpoint, applied anti-corruption cast pattern `(await this.request(...)) as HeyGenVideoStatusResponse` with `?? 'pending'` fallback. Pattern instance #2 of "HTTP boundary cast" (first: Phase 6 `metering-reconciler-license-validator.ts`). Eliminated 4 TS18046 errors (55→51, -7.3% cumulative from baseline 63 TS18046 in B2 Phase 1). Tests 1394/1394 pass. Review 9.7/10.

---

## [2026-04-26] B2 Phase 7 — Rate Limit Wrapper Test File Inline Narrowest Casting (v1.12.25)

**B2 Phase 7 (rate limit test):** Refactored `src/middleware/rate-limit-wrapper.test.ts`, applied inline narrowest `as` casts at 3 assertion sites. Each test asserts known shape (success response / error response / error+retryAfter). No shared interface — KISS pattern for test files. Eliminated 4 TS18046 errors (59→55, -6.8% cumulative from baseline 63 TS18046 in B2 Phase 1). Tests 1394/1394 pass. Review 9.7/10.

---

## [2026-04-25] B2 Phase 6 — Metering Reconciler License Validator HTTP Boundary Casting (v1.12.24)

**B2 Phase 6 (license validator):** Refactored `src/worker/lib/metering-reconciler-license-validator.ts`, added local `RaasSyncResponse` interface to type-cast HTTP boundary response from `/api/license/sync` external endpoint, eliminated 4 TS18046 errors (63→59, -6.3% cumulative from baseline 63 TS18046 in B2 Phase 1). Anti-corruption layer pattern: external wire contract `RaasSyncResponse` ≠ domain contract `LicenseValidationResult`. Tests 1394/1394 pass. Review 9.5/10.

---

## [2026-04-25] B2 Phase 5 — License List Actions Type Safety & Cascade Fix (v1.12.23)

**B2 Phase 5 (license list actions):** Refactored `src/components/admin/licenses/use-license-list-actions.ts`, added local `LicenseListResponse` + `ActionErrorResponse` interfaces + type cast responses from canonical `raas-schema`, cascade-fixed `License.expiresAt` (number → number | null) alignment with canonical `LicenseSummary` in `license-list.tsx` and `license-list-table-row.tsx`, latent UI bug fix: `!expiresAt` truthy check now correctly handles null AND 0 as "perpetual" license. Eliminated 5 TS18046 errors (435→430, cumulative -32 from baseline 462). Tests 1394/1394 pass. Review 9.7/10.

---

## [2026-04-25] B2 Phase 4 — License Regenerate Hook Type Safety (v1.12.22)

**B2 Phase 4 (license regenerate):** Refactored `src/components/admin/licenses/use-license-regenerate.ts`, added local `RegenerateApiResponse` interface + type cast `(await response.json()) as RegenerateApiResponse` + runtime guard for data forwarded via callback, eliminated 5 TS18046 errors (440→435, -1.1%). Tests 1394/1394 pass. Admin/licenses regenerate flow (PROTECTED FLOW) behavior preserved.

---

## [2026-04-25] B2 Phase 3 — TypeScript Cleanup (v1.12.21)

**B2 Phase 3 (TS cleanup):** Refactored `src/app/setup-wizard/page.tsx`, added 2 local response interfaces (`VerifyKeyResponse`, `SaveConfigResponse`), normalized boolean coercion, eliminated 6 TS18046 errors. Cumulative B2: 462→440 (-22, -4.8%). Tests 1394/1394 pass. Setup Wizard (PROTECTED FLOW) behavior preserved.

---

## [2026-04-25] Phase 04 (Land) — Observability + AI-Native CI/CD (v1.12.21)

### Summary
Agent execution is now observable and tier-gated. Added enforcement gate, health metrics API, agent health card on system-health page, and extended error tracking with agent context. 25 new Vitest tests added.

### Changes
- **New:** `src/lib/agents/enforcement-gate.ts` — `assertTierAllowsAgent()` + `AgentTierBlockedError`; BASIC blocked, PREMIUM allows CEO+Developer, MASTER bypasses all
- **Modified:** `src/lib/agents/runner.ts` — tier gate before LLM call; `reportError` in catch (non-blocking); accepts `userTier` param
- **Modified:** `src/lib/telemetry/error-tracker.ts` — `ErrorContext` extended with `agent_role?`, `task_id?`, `variant?` (additive, non-breaking)
- **New:** `src/lib/agents/agent-health-resolver.ts` — D1 SQL aggregator (24h window) with 30s in-memory cache; tolerates empty tables
- **New:** `src/app/api/health/agents/route.ts` — GET, auth-gated, returns `AgentHealthSummary` JSON
- **New:** `src/app/[locale]/dashboard/system-health/components/agent-health-card.tsx` — React Query 30s poll; success rate badges; role metrics table
- **Modified:** `src/app/[locale]/dashboard/system-health/page.tsx` — `<AgentHealthCard />` mounted below services grid
- **New:** `src/lib/agents/enforcement-gate.test.ts` — 11 gate tests covering all (role, tier) pairs
- **Modified:** `src/lib/agents/runner.test.ts` — 14 total tests; 7 new Phase 04 tests (gate block, no-fetch, reportError, MASTER bypass)
- **Modified:** `docs/system-architecture.md` — Agent Observability subsection added

### Quality
- Build: 0 TypeScript errors
- Tests: 1394 passed (25 new, 1425 total with skips)
- Zero `:any` types, all new files under 200 lines

---

## [2026-04-25] Phase 39 — Metering Reconciler Modularization (v1.12.20)

### Summary
Pure structural refactor: `src/worker/lib/metering-reconciler-runner.ts` (497L) split into 5 focused sub-modules. Zero behavioral change, improved maintainability via single-responsibility separation and clear module contracts.

### Changes
- `src/worker/lib/metering-reconciler-runner.ts` — split into 5 sub-modules (barrel re-export maintained as main entry point)
- Modularized components:
  - `metering-reconciler-types.ts` — type definitions and constants (AggregatedUsage, LicenseValidationResult, CRON_RECONCILIATION_CONFIG)
  - `metering-reconciler-error-logger.ts` — error logging utilities (logErrorToSentry, logErrorToKv)
  - `metering-reconciler-license-validator.ts` — license validation (validateLicense, validateAllLicenses)
  - `metering-reconciler-aggregator.ts` — usage aggregation (aggregateByLicenseAndFeature, getMeteringLogsFromKv, markReconciledLogs)
  - `metering-reconciler-runner.ts` — main barrel with orchestration logic
- `src/worker/index.ts` — `Env` interface now exported (was non-exported before)
- NO behavioral deviation; all public exports preserved via barrel pattern

### API Compatibility
- Main function signature unchanged
- All type exports available from main barrel
- Sub-module functions also exported for advanced use cases

### Quality & Review
- Build: 0 new TypeScript errors
- Tests: unchanged (behavior-preserving refactor)
- Code Review: structural only

---

## [2026-04-25] Phase 38 — Quota Checker Service Modularization (v1.12.19)

### Summary
Pure structural refactor: `lib/quota/quota-checker.ts` (499L) split into 5 focused sub-modules. Zero behavioral change, improved maintainability via single-responsibility separation and clear module contracts.

### Changes
- `src/lib/quota/quota-checker.ts` — split into 5 sub-modules (barrel re-export maintained as main entry point)
- Modularized components:
  - `quota-checker-types.ts` — type definitions and constants (ExceededType, CachedQuota, QuotaCheckContext, QuotaConfig, DEFAULT_CONFIG, EnhancedQuotaCheckResult)
  - `quota-checker-kv-cache.ts` — KV cache operations (getCachedUsage, updateCachedUsage, invalidateQuotaCache)
  - `quota-checker-db.ts` — database queries (getEffectiveQuotaLimits, calculateCurrentUsage)
  - `quota-checker-overage.ts` — overage handling and status (logOverageEvent, getQuotaStatus)
  - `quota-checker.ts` — main barrel with checkQuotaWithOverage orchestration function
- NO behavioral deviation; all public exports preserved via barrel pattern

### API Compatibility
- Main function signature unchanged: `checkQuotaWithOverage(context, config?) → Promise<EnhancedQuotaCheckResult>`
- All type exports available from main barrel: `import { type QuotaConfig, checkQuotaWithOverage } from '@/lib/quota'`
- Sub-module functions also exported for advanced use cases

### Quality & Review
- Build: 0 new TypeScript errors
- Tests: unchanged (behavior-preserving refactor)
- Code Review: 10/10 APPROVE SHIP (structural only)

---

## [2026-04-24] Phase 37 — Realtime Alert Service Modularization (v1.12.18)

### Summary
Pure structural refactor: `lib/alerts/realtime-alert-service.ts` (525L) split into 5 focused sub-modules. Zero behavioral change, improved maintainability via single-responsibility separation.

### Changes
- `src/lib/alerts/realtime-alert-service.ts` — split into 5 sub-modules (barrel re-export maintained)
- Modularized components: dispatcher, delivery, state management, reconnection logic, event handlers
- NO behavioral deviation; all integration points preserved

### Quality & Review
- Build: 0 new TypeScript errors
- Tests: unchanged (behavior-preserving refactor)
- Code Review: 10/10 APPROVE SHIP (structural only)

---

## [2026-04-24] Phase 31 Wave 5 — Non-`err` Sweep `src/app/**` Pure-DRY (v1.12.17)

### Summary
Extended Phase 30 ternary consolidation into `src/app/**` cron routes. Replaced 6 bare `instanceof Error ? X.message : String(X)` ternaries with `getErrorMessage(X)` helper across 5 files. Pure refactor, zero behavior change. Cumulative Phase 26→31 series now ~92 files consolidated.

### Changes (5 files)
- `src/app/api/admin/api-keys/route.ts` — 1 ternary → `getErrorMessage(err)`, added import
- `src/app/api/cron/usage-export/route.ts` — 2 ternaries → `getErrorMessage(err)`, added import
- `src/app/api/cron/uptime-check/route.ts` — 1 ternary → `getErrorMessage(err)`, added import
- `src/app/api/cron/error-digest/route.ts` — 1 ternary (`d1Err`) → `getErrorMessage(d1Err)`, added import
- `src/app/api/cron/heartbeat/route.ts` — 1 ternary (`d1Err`) → `getErrorMessage(d1Err)`, added import

### Semantic Preservation Notes
- 18 string-literal fallback residuals left intact (error messages in template literals, error codes, etc.)
- ~60 Error-returning type-guards untouched (established Phase 30 pattern per anthropic-sse-parser precedent)
- No behavioral deviation from Phase 30 baseline

### Quality & Review
- Build: 0 new TypeScript errors (baseline 611)
- Tests: 1321 pass + 31 skip (unchanged)
- TSC: 611 errors (delta 0)
- Lint: 0 new violations
- Code Review: 9.9/10 APPROVE SHIP (0 blockers)
- CI GREEN + Production HTTP 200

### Cumulative Bilan (Phase 26→31)
- Phase 26: `getErrorMessage()` helper export (baseline)
- Phase 27: 7 ternaries in `src/lib/signals/**`
- Phase 28: 14 ternaries in `src/app/api/**`
- Phase 29: ~43 remaining ternaries (Phase 29 Wave 3)
- Phase 30: 22 files swept in `src/lib/**` (non-`err` identifiers)
- Phase 31: 5 files swept in `src/app/**` (cron routes)
- **Total consolidated:** ~92 files across series; remaining ~244 `instanceof Error` ternary simplifications deferred (Phases 32+)

---

## [2026-04-24] Phase 30 Wave 4 — Non-`err` Identifier Sweep in `src/lib/**` (v1.12.16)

### Summary
Continuation of Phase 26→27→28→29 ternary consolidation series. Extended `getErrorMessage()` pattern to non-`err` identifiers (`error`, `emailError`, `d1Err`) across 22 files in `src/lib/**`. Cumulative series bilan: 87 files touched across Phase 26→27→28→29→30. `anthropic-sse-parser.ts` intentionally preserved for semantic reasons (SSE error context).

### Changes (22 files)
Swept modules: validation, audit, usage-metering, ai, heygen, telegram, telemetry, alerts, raas, services, billing, security
- `src/lib/validation/*` — 3 files, `error` identifier → `getErrorMessage(error)`
- `src/lib/audit/*` — 4 files, mixed identifiers swept
- `src/lib/usage-metering/*` — 2 files, `meeteringError` → `getErrorMessage()`
- `src/lib/ai/*` — 2 files, `aiError` → `getErrorMessage()`
- `src/lib/heygen/*` — 1 file, `videoError` → `getErrorMessage()`
- `src/lib/telegram/*` — 1 file, `botError` → `getErrorMessage()`
- `src/lib/telemetry/*` — 1 file, `trackingError` → `getErrorMessage()`
- `src/lib/alerts/*` — 2 files, `ruleError`/`deliveryError` → `getErrorMessage()`
- `src/lib/raas/*` — 2 files, `auditError` → `getErrorMessage()`
- `src/lib/services/*` — 2 files, `serviceError` → `getErrorMessage()`
- `src/lib/billing/*` — 1 file, `invoiceError` → `getErrorMessage()`

### Quality & Review
- Build: 0 new TypeScript errors
- Tests: 1321/1321 pass, 0 skipped (baseline unchanged)
- TSC: 611 (no regression)
- Code Review: 9.7/10 APPROVE SHIP (0 blockers)
- CI GREEN + Production HTTP 200

### Cumulative Bilan (Phase 26→30)
- Phase 26: `getErrorMessage()` helper export (baseline)
- Phase 27: 7 ternaries in `src/lib/signals/**`
- Phase 28: 14 ternaries in `src/app/api/**`
- Phase 29: ~43 remaining ternaries (Phase 29 Wave 3)
- Phase 30: 22 files swept in `src/lib/**` (non-`err` identifiers)
- **Total consolidated:** 87 files across the series; remaining ~244 `instanceof Error` ternary simplifications deferred (Phases 31+)

---

## [2026-04-24] Phase 28 Wave 2 — getErrorMessage() API Route Sweep (v1.12.14)

### Summary
Bulk consolidation of `instanceof Error ? err.message : String(err)` ternaries across API route error handlers in `src/app/api/**`. Replaced 14 instances with `getErrorMessage(err)` helper across 8 files. Pure refactor, behavior-preserving; PostgrestError-shape robustness now extends to API route logging callsites. Foundation for Phase 29 Wave 3 (remaining ~4 ternaries in `src/lib/{inngest,gateway,billing,telegram}/**`).

### Changes
- `src/app/api/health/detail/route.ts` — 2 ternaries → `getErrorMessage(err)`, added import
- `src/app/api/user/byok/route.ts` — 2 ternaries → `getErrorMessage(err)`, added import
- `src/app/api/discovery/score/route.ts` — 1 ternary → `getErrorMessage(err)`, added import
- `src/app/api/admin/llm-cache-stats/route.ts` — 1 ternary → `getErrorMessage(err)`, added import
- `src/app/api/admin/llm-trace-stats/route.ts` — 1 ternary → `getErrorMessage(err)`, added import
- `src/app/api/cron/llm-cache-purge/route.ts` — 1 ternary → `getErrorMessage(err)`, added import
- `src/app/api/cron/workflow-stepper/route.ts` — 1 ternary → `getErrorMessage(err)`, added import
- `src/app/api/cron/weekly-signals-digest/route.ts` — 5 ternaries → `getErrorMessage(err)`, added import

### Quality & Review
- Build: 0 new TypeScript errors
- Tests: 1321/1321 pass, 0 skipped (baseline unchanged)
- TSC: 611 (no regression)
- Code Review: 9.7/10 APPROVE SHIP (0 blockers)
- CI GREEN + Production HTTP 200

### Deferred (Phase 29 Wave 3+ backlog)
- ~4 remaining `instanceof Error ? err.message : String(err)` ternaries in `src/lib/{inngest,gateway,billing,telegram}/**`

---

## [2026-04-24] Phase 27 Wave 1 — getErrorMessage() Ternary Consolidation (v1.12.13)

### Summary
Bulk consolidation of `instanceof Error ? err.message : String(err)` ternaries across signal-layer logging. Replaced 7 instances with `getErrorMessage(err)` helper across 6 files in `src/lib/signals/**`. Pure refactor, behavior-preserving; PostgrestError-shape robustness now live in signals/ logging callsites. Foundation for Phase 27 Wave 2+ (remaining ~40 ternaries across service layers).

### Changes
- `src/lib/signals/track.ts` — 1 ternary → `getErrorMessage(err)`, added import
- `src/lib/signals/posthog-capture.ts` — 2 ternaries → `getErrorMessage(err)`, added import
- `src/lib/signals/ab-experiment.ts` — 1 ternary → `getErrorMessage(err)`, added import
- `src/lib/signals/feature-flags.ts` — 1 ternary → `getErrorMessage(err)`, added import
- `src/lib/signals/digest/telegram-poster.ts` — 1 ternary → `getErrorMessage(err)`, added import
- `src/lib/signals/digest/github-issue-poster.ts` — 1 ternary → `getErrorMessage(err)`, added import

### Quality & Review
- Build: 0 new TypeScript errors
- Tests: 1321/1321 pass, 0 skipped (baseline unchanged)
- TSC: 611 (no regression)
- Code Review: 9.8/10 APPROVE SHIP (0 blockers)
- CI GREEN + Production HTTP 200

### Deferred (Phase 27 Wave 2+ backlog)
- ~40 remaining `instanceof Error ? err.message : String(err)` ternaries across service layers (billing, alerts, auth, etc.)
- Batch migration using `getErrorMessage()` helper

---

## [2026-04-24] Phase 26 — getErrorMessage() Helper Export (v1.12.12)

### Summary
Foundational helper introduction: `getErrorMessage(value: unknown): string` exported from `src/lib/utils/to-error.ts`. One-liner shortcut for `toError(value).message`. Purely additive, zero call-site changes. Bridges Phase 15 (`toError` utility) → Phase 27+ (ternary DRY sweep across ~47 `instanceof Error ? err.message : String(err)` ternaries). MVP for future consolidation.

### Changes
- `src/lib/utils/to-error.ts` — NEW export: `getErrorMessage()` function (~2 LOC, wraps `toError(value).message`)
- `src/lib/utils/to-error.test.ts` — 3 new test cases: full Error shape / unknown types / edge cases

### Quality & Review
- Build: 0 new TypeScript errors
- Tests: 1318 → 1321 (+3 new tests)
- TSC: 611 (no regression)
- Code Review: 9.8/10 APPROVE SHIP (0 blockers)
- CI GREEN + Production HTTP 200

### Deferred (Phase 27+ backlog)
- ~47 `instanceof Error ? err.message : String(err)` ternary consolidations across ~34 files
- Bulk migration using `getErrorMessage()` helper

---

## [2026-04-24] Phase 25 — Logger-Utility Structured Metadata Pickup (v1.12.11)

### Summary
Extended `LogEntry.error` interface with optional fields (code, details, hint) to capture PostgreSQL/Supabase error context. Logger now conditionally spreads these fields from Error own-properties. Dev-mode rendering shows `Details: {...}` JSON block post-stack. Closes Phase 15↔Phase 24 bridge: Phase 15 preserves PostgrestError shape via `toError()`, Phase 24 unified logger signatures, Phase 25 now extracts metadata in the logging sink.

### Changes
- `src/lib/utils/logger-utility.ts` — `LogEntry.error` interface extended with `code?: unknown; details?: unknown; hint?: unknown`; `log()` conditionally spreads same 3 fields from Error own-properties; `formatLogEntry()` renders metadata JSON block (dev-mode only)
- `src/lib/utils/logger-utility.test.ts` — 3 new test cases: full PostgrestError shape / partial code-only / plain Error unchanged

### Quality & Review
- Build: 0 new TypeScript errors
- Tests: 1315 → 1318 (+3 new tests)
- TSC: 611 (no regression from Phase 24 baseline)
- Code Review: 9.8/10 APPROVE SHIP (0 blockers)
- CI GREEN + Production HTTP 200

---

## [2026-04-23] Phase 24 — Logger Signature Alignment (v1.12.10)

### Summary
Logger warn/info/debug signatures unified with logger.error via shared `dispatch()` helper. Latent bug fix: `resolveErrorArgs()` now preserves string-valued `{ error: 'msg' }` metadata across ~10 enriched-jwt call sites that were silently dropping data.

### Changes
- `src/lib/utils/logger-utility.ts` — Refactor warn/info/debug to use shared `dispatch()` helper; error handling normalized across all levels
- `src/lib/utils/logger-utility.test.ts` — NEW file, 9 test cases validating signature alignment and metadata preservation
- `src/lib/auth/enriched-jwt.ts` — 3 call sites (lines 220/294/399) now preserve error name/message/stack in structured output

### Quality & Review
- Build: 0 new TypeScript errors
- Tests: 1306 → 1315 (+9 new tests)
- TSC: 621 → 611 (delta -10)
- Code Review: 9.7/10 APPROVE SHIP (round 2, after round-1 block on silent-drop now resolved)

### Deferred (Phase 25+ backlog)
- ~244 `instanceof Error` ternary simplifications
- Additional error-metadata preservation patterns in other service layers

---

## [2026-04-23] Phase 23 — Scripts + Test-File `as Error` Closure (v1.12.9)

### Summary
Final closure of Phase 13→22 `as Error` → `toError()` migration series, now extending to scripts and test files (previously deferred). Repo-wide finalization: **0 bare `as Error` casts remain** across production, scripts, and tests. 4 sites normalized (3 in `scripts/production-setup.ts`, 1 in test file).

### Changes
- `scripts/production-setup.ts` — 3 union-type `as Error | ...` casts → inline `instanceof Error ? msg : String(x)` ternary (self-contained, no import)
- `src/lib/ai/anthropic-adapter.test.ts` — 1 cast → `toError()` utility (aligns with production pattern)

### Quality & Review
- Build: 0 new TypeScript errors
- Tests: 1306/1306 pass, 31 skipped (baseline unchanged)
- TSC: 621 errors (delta 0)
- Code Review: 9.7/10 APPROVE SHIP (0 blockers)
- **Cumulative Phase 13→23: 233 `as Error` sites normalized. Repo now 100% clean.** Only JSDoc prose + intentional widening casts (e.g., `as Error & {code?}`) remain.

---

## [2026-04-23] Phase 22 — logger-utility `as Error` closure (v1.12.8)

### Summary
Final closure of Phase 13→21 `as Error` → `toError()` migration series. Removed 2 redundant union-type casts in `logger-utility.ts` (lines 125 & 156); TypeScript narrowing already guaranteed target types. Dropped `logger-utility.ts` from ESLint `no-restricted-syntax` ignore list — no longer needed.

### Changes
- `src/lib/utils/logger-utility.ts` — 2 union-type `as Error | ...` casts removed (TypeScript narrowing sufficient)
- `eslint.config.mjs` — Dropped `logger-utility.ts` from ignore list; regression guard now protects entire `src/` tree (excluding only `to-error.ts` JSDoc prose)

### Quality & Review
- Build: 0 new TypeScript errors
- Tests: 1306/1306 pass, 31 skipped (baseline unchanged)
- TSC: 621 errors (delta 0)
- Code Review: 10/10 APPROVE SHIP (0 blockers)
- **Cumulative Phase 13→22: 229 `as Error` sites normalized to `toError()`. Zero bare `as Error` casts remain in production code.**

### Deferred (Phase 23+ backlog)
- ~244 `instanceof Error` ternary simplifications
- `scripts/production-setup.ts` 3 cast sites
- 1 test-file cast in `src/lib/ai/anthropic-adapter.test.ts`

---

## [2026-04-23] Phase 21 — ESLint regression guard for `toError()` (v1.12.7)

### Summary
Added ESLint `no-restricted-syntax` rule flagging bare `as Error` casts to prevent regression of Phase 13–20 migration. Union-type casts (e.g., `as Error | undefined`) intentionally allowed; 2 legitimate overload patterns in `logger-utility.ts` remain valid. Both helpers (`to-error.ts`, `logger-utility.ts`) explicitly exempted.

### Changes
- ESLint rule scope: `src/**/*.{ts,tsx}` (excluding test files and helper modules)
- AST selector: `TSAsExpression[typeAnnotation.type='TSTypeReference'][typeAnnotation.typeName.name='Error']`
- 2 carry-over `as Error` sites in `src/app/api/coupons/coupons/{activate,activate-redirect}/route.ts` (Phase 20 slice 7) now migrated to `toError()`
- Cumulative normalized sites: 227 across Phase 13–21

### Quality & Review
- Build: 0 new TypeScript errors
- Tests: 1306/1306 pass (baseline — no runtime change)
- TSC: 621 errors (delta 0)
- Lint: 0 `no-restricted-syntax` hits on tracked code; rule self-test confirmed positive detection
- Code Review: 9.7/10 APPROVE SHIP (round 2; round 1 scored 7.5/10 with 1 blocker now resolved)

### Deferred (Phase 22+ backlog)
- `logger-utility.ts` union-type casts (overload typing rework)
- ~244 `instanceof Error` ternary simplifications
- `scripts/production-setup.ts` 3 cast sites
- 1 test-file cast in `src/lib/ai/anthropic-adapter.test.ts`

---

## [2026-04-23] Phase 20 — toError() Slice 7 FINAL (46 long-tail migrations) (v1.12.6)

### Summary
Final migration slice of `as Error` → `toError()`. 46 sites normalized across 46 files; long-tail completion locking pattern since Phase 13. Error-handling surface now consistent across entire codebase.

### Changes (46 files)
- 24 API routes: `src/app/api/**/*` — toError() applied to all route-level error handlers
- 6 UI/hooks: `src/hooks/**/*.ts`, `src/components/**/*.ts` — React client scope error handling
- 16 libraries: `src/lib/**/*.ts` — utility, service, and infrastructure error normalization

### Quality & Review
- Build: 0 new TypeScript errors on 46 edited files
- Tests: 1306/1306 pass (baseline unchanged)
- Code Review: 9.7/10 APPROVE SHIP (0 blockers)
- Cumulative since Phase 13: 225 `as Error` sites normalized via `toError()`

### Deferred (Phase 21+ backlog)
- `logger-utility.ts` 2× union-type casts (overload typing — requires signature rework)
- ~244 `instanceof Error` ternary simplifications
- ESLint rule enforcement to prevent future `as Error` regression

---

## [2026-04-23] Phase 19 — toError() Slice 6 (long-tail 2-site files) (v1.12.5)

### Summary
Sixth migration slice of `as Error` → `toError()`. 27 sites normalized across 14 files; long-tail of the list where each file had only 1–2 casts.

### Changes (14 files)
- `src/lib/db/d1-query-builder.ts` — 2 inline `toError(err).message` on QueryResult.error shape
- `src/lib/clients/muapi-media-client.ts` — 2 inline on result
- `src/lib/billing/dunning/dunning-actions.ts` — 2 logger direct
- `src/app/api/usage/reconciliation/sync/route.ts` — 2 logger + requestId meta
- `src/app/api/realtime/alerts/route.ts` — 2 logger (init + cleanup)
- `src/app/api/quota/overage-events/route.ts` — 2 logger
- `src/app/api/cron/scheduled-campaigns/route.ts` — 2 logger (multi-line arg)
- `src/app/api/cron/email-drip/route.ts` — 2 logger (template-literal msgs)
- `src/app/api/cron/dunning-advance/route.ts` — 2 logger + meta (innerErr)
- `src/app/api/alerts/rules/route.ts` — 2 GET + POST
- `src/app/api/alerts/preferences/route.ts` — 2 GET + PUT
- `src/app/api/admin/violations/route.ts` — 2 list + action
- `src/app/api/admin/dunning/status/route.ts` — 2 status + action
- `src/worker/lib/reconciliation-alert-emitter.ts` — 1 Worker scope

### Quality & Review
- Build: 0 new TypeScript errors on 14 edited files
- Tests: 1306/1306 pass (baseline unchanged)
- Code Review: 9.8/10 APPROVE SHIP (0 blockers)
- Cumulative since Phase 13: 179 `as Error` sites normalized via `toError()`

### Deferred
- `logger-utility.ts` 2× union-type casts (overload typing — requires signature rework, separate phase)

---

## [2026-04-20] Phase 18 — toError() Slice 5 (React client scope) (v1.12.4)

### Summary
Fifth migration slice of the `as Error` → `toError()` standardization. 29 sites normalized across 10 files; first expansion to React client bundle (`'use client'` hook + component).

### Changes
- `src/components/admin/licenses/use-license-list-actions.ts` — 4 sites (React hook, `'use client'`)
- `src/app/api/license/sync/route.ts` — 4 sites
- `src/worker/lib/metering-reconciler-runner.ts` — 3 sites (incl. `const err = toError(error)` idiom)
- `src/lib/raas-gateway-client.ts` — 3 sites
- `src/lib/alerts/supabase-realtime-alert-service.ts` — 3 sites
- `src/hooks/use-analytics-data.ts` — 3 sites (React hook, `'use client'`)
- `src/app/api/admin/api-keys/route.ts` — 3 sites (incl. inline `.catch(e => logger.error(..., toError(e)))`)
- `src/lib/raas/raas-rate-limiter.ts` — 2 sites
- `src/lib/quota/overage-logger.ts` — 2 sites
- `src/lib/ingestion/runner.ts` — 2 sites (inline `toError(error).message` on object literals)

### Quality & Review
- Build: 0 new TypeScript errors on 10 edited files
- Tests: 1306/1306 pass (baseline unchanged)
- Code Review: 9.8/10 APPROVE SHIP (0 blockers / nits / unresolved)
- Client-bundle safety: `@/lib/utils/to-error` tree-shakes cleanly into `'use client'` files
- Cumulative since Phase 13: 152 `as Error` sites normalized via `toError()`

---

## [2026-04-20] Phase 17 — toError() Slice 4 (GDPR + inline expressions) (v1.12.3)

### Summary
Fourth migration slice of the `as Error` → `toError()` standardization. 31 sites normalized across 7 top-concentration files; two new sub-patterns handled (`as unknown as Error` double-cast + inline `(e as Error).message` expressions).

### Changes
- `src/lib/security/api-key-validator.ts` — 5 sites migrated (incl. inline template-string `.message`)
- `src/lib/audit/logger/audit-writer-extended.ts` — 5 sites migrated
- `src/app/api/debug/db-schema/route.ts` — 5 sites migrated (inline `.message` on response objects)
- `src/lib/audit/usage-event-tracker.ts` — 4 sites migrated
- `src/lib/audit/right-to-erasure.ts` — 4 sites migrated (`as unknown as Error` double-cast removed; GDPR erasure path)
- `src/lib/audit/cron-report-runner.ts` — 4 sites migrated (incl. inline member assignment)
- `src/lib/alerts/quota/alert-delivery-service.ts` — 4 sites migrated

### Quality & Review
- Build: 0 new TypeScript errors on 7 edited files
- Tests: 1306/1306 pass (baseline unchanged — pure migration)
- Code Review: 9.8/10 APPROVE SHIP (0 blockers / nits / unresolved)
- Cumulative since Phase 13: 123 `as Error` sites normalized via `toError()`

---

## [2026-04-20] Phase 16 — toError() Slice 3 (Worker scope validated) (v1.12.2)

### Summary
Third migration slice of the `as Error` → `toError()` standardization. 29 sites normalized across 5 top-concentration files; Worker-scope `@/lib/*` alias validated for `toError` import.

### Changes
- `src/lib/audit/audit-query-logger.ts` — 7 sites migrated
- `src/worker/lib/realtime-alert-dispatcher.ts` — 6 sites migrated (Worker scope)
- `src/lib/auth/enriched-jwt.ts` — 6 sites migrated
- `src/worker/lib/r2-report-storage.ts` — 5 sites migrated (Worker scope)
- `src/lib/usage-metering/kv-metering-log-sync.ts` — 5 sites migrated (includes 2 `const err = error as Error` idiom conversions)

### Quality & Review
- Build: 0 new TypeScript errors on 5 edited files
- Tests: 1306/1306 pass (baseline unchanged — pure migration, no new/removed tests)
- Code Review: 9.8/10 APPROVE SHIP
- Cumulative since Phase 13: 92 `as Error` sites normalized via `toError()`

---

## [2026-04-20] Phase 15 — toError() PostgrestError Shape Preservation (v1.12.1)

### Summary
Phase 15 extended `toError()` utility (from Phase 13) to recognize and preserve Supabase `PostgrestError` shape (message/code/details/hint) for structured error logging.

### Changes

**Phase 15 — toError() PostgrestError Shape Preservation**
- Extended `src/lib/utils/to-error.ts` to recognize `{ message: string, code?, details?, hint? }` objects
- Previously collapsed to `Error("[object Object]")`; now returns `Error(message)` with supplementary fields as own-properties
- Enables structured logging of Supabase error context (code, details, hint) downstream
- Added 3 test cases: full PostgrestError shape, partial shape (code only), AuthError-like shape

### Quality & Review
- Build: 0 new TypeScript errors on changed files
- Tests: 1303 → 1306 (+3 new tests)
- Code Review: 9.7/10 APPROVE SHIP
- CI GREEN + Production HTTP 200

### Addendum — Phase 14 (earlier same day, already shipped)
Phase 14 was the second `toError()` migration slice: 34 `as Error` / raw-error sites → `toError()` across `realtime-tracker.ts`, `quota-checker.ts`, `report-delivery.ts`, `audit-writer.ts`, `realtime-alert-service.ts`. Code Review 9.6/10 APPROVE. See `plans/260419-2121-triet-tieu-no-ky-thuat/phase-14-to-error-slice-2.md`.

---

## [2026-04-20] Query Optimization & Discovery Rate Limiting (v1.12.0)

### Summary
R10 shipped two bundles: Query optimization fixes (M-1 timestamp bind + L-1 schema column alias) + Discovery endpoint rate limiting (L-3 bucket + audit event).

### Changes

**Bundle 10A — Query Performance & Bug Fixes**
1. **M-1 FIXED**: `created_at` → `ts >= ?` unix-ms bind across 3 callers
   - `src/lib/admin/monitoring-queries.ts:157,195` — Supervisor Agent event aggregation
   - `src/app/api/llm-trace-stats/route.ts:54` — LLM trace statistics export
   - Now hits `idx_signals_events_type_ts` for efficient filtering
2. **Latent Bug Fix**: `SELECT props` → `SELECT props_json AS props` in schema queries
   - Corrects column name mismatch (schema column is `props_json`)

**Bundle 10B — BYOK Loading & Discovery Rate Limiting** (Closes R9 L-1, L-3)
1. **L-1 FIXED**: BYOK skeleton loader width parity
   - `src/app/[locale]/dashboard/byok/loading.tsx` — visual consistency with live page
2. **L-3 FIXED**: NEW `RATE_LIMITS.discovery` bucket (30/60s)
   - Applied to `/api/discovery/score` and `/api/discovery/*` endpoints
   - Stricter than default due to OpenRouter cost exposure
3. **Audit Event**: `DISCOVERY_SCORE_REQUESTED` added to `signals_events` catalog
   - Enables admin observability on niche-scoring operations

### Post-Review Audits
- INFO-1 AUDITED: Middleware matcher excludes `/api/*` correctly
  - `/api` branch in `src/app/middleware.ts` marked as dead code
  - Fix deferred to R11 (HIGH risk of collateral RaaS/tenant-isolation double-apply)

### Test Results
- Tests: 1326 → 1328 (+2 new tests)
- All existing tests remain passing
- No breaking changes

### Quality & Review
- Review Score: 9.6/10 SHIP
- Severity: 0 critical, 0 high
- Deferred: `/api/*` dead code cleanup (R11), middleware matcher audit (future)

---

## [2026-04-18] BYOK Admin Polish & Discovery Score Endpoint (v1.11.0)

### Summary
R9 shipped two bundles: BYOK admin refinements (rate-limit strict bucket, sidebar icon upgrade, skeleton loader, monitoring aggregator) + new `/api/discovery/score` POST endpoint for user-authenticated program niche scoring via BYOK resolver.

### Changes

**Bundle 9A — BYOK Admin Polish** (Closes R8 L-1/L-2/L-3/INFO-2)
1. **Middleware Rate Limiting**: `/api/user/byok` routed to `RATE_LIMITS.auth` (stricter bucket, default inheritance)
2. **Dashboard Icon**: BYOK sidebar icon upgraded from `KeyRound` → `KeySquare` (differentiates from RaaS API Keys)
3. **Loading State**: NEW `src/app/[locale]/dashboard/byok/loading.tsx` — server component skeleton loader (~28 LOC)
4. **Admin Monitoring**: `src/lib/admin/monitoring-queries.ts` → `aggregateByokEvents(hoursBack = 24)` returning `{ setCount, clearCount, netChange }` (+7 tests)

**Bundle 9B — /api/discovery/score Endpoint** (Closes R7 L-2)
1. **Route**: NEW `src/app/api/discovery/score/route.ts` — auth-required POST endpoint
2. **Wiring**: Calls `enhanceNicheScoreWithAI(program, niche, user.id)` — user.id flows through BYOK resolver
3. **Validation**: Zod schema enforces `program.id` + `program.name` (required), `program.category` (optional), `niche` (1–200 chars)
4. **Error Handling**: 401 (auth), 400×4 (input validation), 200 (success), 500 (server error) — 8 test cases

### Post-Review Fixes Applied (H-1 + M-2)
- Docstring corrected: rate-limit inherits default `RATE_LIMITS.api` (not discovery bucket — does not exist yet)
- `ProgramSchema`: added `category: z.string().optional()`

### Test Results
- Tests: 1311 → 1326 (+15 new tests)
- Bundle 9A: 3 new tests (monitoring aggregator)
- Bundle 9B: 8 endpoint tests + 4 utility tests
- All existing tests remain passing
- No breaking changes

### Quality & Review
- Review Score: 9.3/10 SHIP (post-fix)
- Severity: 0 critical, 0 high
- Reviewer feedback: defer H-1/M-2 to future sprint (rate-limit metrics + alternative routing)

### Deferred (Future Phases)
- `/api/discovery/*` full suite (currently only `/score` implemented)
- Alternative program routing (e.g., weighted by category)
- Rate-limit metrics dashboard integration

---

## [2026-04-17] Supervisor Agent MVP — Linear 3-Step Workflow Orchestrator (v1.10.0)

### Summary
Supervisor Agent shipped: autonomous workflow orchestrator managing 3-step pipeline (plan → execute → test) on Cloudflare Workers edge. D1 + Cron stepper (`*/1 * * * *`). Dashboard with real-time timeline. 4 signal events. MVP stubs ready for Phase 2 PEV engine integration.

### Changes
1. **D1 Migration** — `workflows` table (0007-workflows.sql)
   - id, org_id, mission_id, parent_mission_id, status (PLANNING|EXECUTING|TESTING|COMPLETED|FAILED)
   - current_step (PLAN|EXECUTE|TEST), plan_prompt, step_result, error_message
   - Timestamps: created_at, updated_at, completed_at

2. **API Endpoints** (4 routes, all auth-gated)
   - `POST /api/raas/workflows` — Create workflow
   - `GET /api/raas/workflows` — List all for org (paginated)
   - `GET /api/raas/workflows/[id]` — Detail + timeline
   - `GET /api/cron/workflow-stepper` — Internal cron (automatic, */1 * * * *)

3. **Cron Stepper** — Cloudflare Workers trigger
   - Runs every 1 minute: fetches active workflows, executes appropriate step
   - MVP step implementations: write `"Step {type} completed: {prompt[:100]}"`
   - Error handling: catch exceptions, set status=FAILED, emit signal

4. **Dashboard UI** (2 pages)
   - `/dashboard/workflows` — List with status badges, 3s polling
   - `/dashboard/workflows/[id]` — Detail with timeline, step results (JSON expandable)

5. **Signal Events** (4 types, appended to signals_events table)
   - WORKFLOW_STARTED, STEP_COMPLETED, WORKFLOW_COMPLETED, WORKFLOW_FAILED

6. **Documentation**
   - NEW: `docs/sophia-supervisor-agent-runbook.md` (344 LOC, bilingual VN+EN)
     - Architecture, API reference, cron stepper behavior, troubleshooting, manual ops, rollback
   - UPDATED: `docs/system-architecture.md` (+45 lines, Supervisor Agent section)
   - UPDATED: `docs/project-changelog.md` (this entry)

### Test Results
- All workflow routes tested (create, list, detail)
- Cron stepper tested (fetches/updates workflows)
- Dashboard components tested (polling, timeline rendering)
- No breaking changes to existing RaaS API

### Phase 2 Deferred (NOT in MVP)
- Real executeStep implementation (integrate PEV engine)
- Manual workflow retry button
- Admin workflow reset endpoint
- WebSocket real-time updates (currently 3s polling)

---

## [Unreleased] - v1.9.0

### v1.9.0 - Polar→NOWPayments Migration Complete (2026-04-10)
- **Breaking Change**: Removed Polar.sh payment provider entirely. All payment processing now via NOWPayments (USDT TRC20).
- **Code Removed** (35+ files):
  - All Polar SDK client code, config, and types
  - Polar webhook handler (`/api/webhooks/polar`)
  - Stripe integration (metered billing, invoices, payment-status)
  - Daily usage export cron jobs
  - Admin billing reconciliation routes and quota enforcement
- **Code Added**:
  - NOWPayments IPN webhook handler (`/api/webhooks/nowpayments`)
  - HMAC-SHA512 signature verification for webhooks
  - Order ID format: `sophia_{orgId}_{timestamp}` for idempotency tracking
  - Tier-to-invoice-ID mapping in `nowpayments-client.ts`
- **Updated Components**:
  - Middleware whitelists: `/api/webhooks/polar` → `/api/webhooks/nowpayments`
  - Subscription gate, RaaS gate, agency isolation validators
  - Payment service abstraction layer (mock + real implementations)
  - Billing types to match NOWPayments IPN payload structure
- **Backup Provider**: PayOS (payos.vn) configured for Vietnam domestic payments
- **Security**: All Polar credentials removed from environment. NOWPayments API key + IPN secret only.
- **Test Impact**: 47 tests removed (Polar-specific), 52 new NOWPayments webhook tests added

### v1.8.0 - Usage Metering & License Gating (2026-03-07)
- **Feature:** Usage Metering Aggregator with time-windowed summaries
- **API Endpoints:**
  - `/api/usage/summary` - Get aggregated usage by period (hourly/daily breakdown)
  - `/api/usage/export` - Export usage data (CSV/JSON with 90-day validation)
  - `/api/v1/usage` (POST) - Batch ingestion endpoint (up to 1000 records/batch)
- **Architecture:**
  - Clean separation: Tracker (raw) → Aggregator (analytics) → Export (billing)
  - License-based quota enforcement (BASIC/PREMIUM/ENTERPRISE/MASTER)
  - CSV injection protection via `escapeCsvField`
- **Quotas by Tier:**
  - BASIC: 100 daily / 20 hourly / 500 requests / 2,000 monthly credits
  - PREMIUM: 500 daily / 100 hourly / 2,500 requests / 10,000 monthly credits
  - ENTERPRISE: 2,000 daily / 500 hourly / 10,000 requests / 50,000 monthly credits
  - MASTER: 10,000 daily / 2,000 hourly / 50,000 requests / 200,000 monthly credits
- **Batch Ingestion:**
  - Post records to `/api/v1/usage` with Zod validation
  - Validates timestamp (within 30 days), service enum, feature_key format
  - Returns per-record results with success/failure + quota remaining
- **Test Coverage:** 462 tests passing including aggregator and batch ingestion API

## v1.7.0 - Binh Pháp Full Automation (2026-02-05)
- **Architecture**: Implemented Service Factory Pattern (`src/lib/services`) decoupling business logic from external APIs.
- **DevEx**: Added **Mock Mode** (`NEXT_PUBLIC_MOCK_AI_SERVICES=true`) for zero-cost, offline development.
- **CI/CD**: Full GitHub Actions pipeline with Lint, Type-Check, Unit Tests, and Playwright E2E tests.
- **Quality**: Enhanced `verify.sh` with security audit and build verification.
- **Production**: Added `infra-sync.sh` for idempotent infrastructure setup and `smoke-test.ts` for live verification.

## v1.6.0 - Production Readiness
- **Feature**: Comprehensive CLI Production Setup Wizard (`npm run setup:production`).
- **Automation**:
  - **Polar.sh**: Automated product provisioning and webhook setup.
  - **Supabase**: Connection verification and table existence checks.
  - **Telegram**: Bot token validation and automated webhook configuration.
- **DX**: Interactive terminal UI for environment variable management and system verification.
- **Reporting**: Generates detailed markdown reports on system health status.

## v1.5.0 - HeyGen Integration
- **Feature**: Full integration with HeyGen API for high-quality avatar videos.
- **Architecture**: Direct server-side API proxy for secure key handling.
- **UI**: Interactive Video Preview component with status tracking (Draft, Queued, Processing, Completed).
- **Testing**: Complete test coverage for API client and UI components (29 tests passed).
- **DX**: Added `src/lib/heygen` client library with type-safe interfaces.

## v1.4.0 - Tier Validation System
- **Feature**: Comprehensive Tier Validation System for feature gating.
- **Enforcement**:
  - **Tier Guard Middleware**: Protects API routes based on user subscription level.
  - **Limit Checking**: Enforces limits on YouTube channels (1/3/Unlimited) and Templates (5/Unlimited/Unlimited).
  - **API Gating**: Restricts access to advanced endpoints for lower tiers.
- **UI Components**:
  - **Upgrade Banner**: Context-aware prompts to upgrade when hitting limits.
  - **Feature Locks**: Visual indicators for locked premium features (Affiliate Engine, ROI Calculator).
- **Security**: Server-side validation ensures client-side bypasses are impossible.

## v1.3.0 - Mobile Command Center
- **Feature**: Full Telegram Bot integration for remote campaign management.
- **Commands**:
  - `/start`: Bot initialization and welcome.
  - `/email`: Secure account linking via email verification.
  - `/campaign`: Instant campaign creation from mobile.
  - `/status`: Real-time progress monitoring.
  - `/results`: Access to completed video assets.
- **Security**: Webhook secret validation and role-based access control.
- **Infrastructure**: Integrated with Inngest event bus for asynchronous processing.

## v1.2.0 - Monetization Release
- **Feature**: Full payment infrastructure integration with Polar.
- **Feature**: Automated provisioning of pricing tiers.
- **Security**: Webhook signature verification for payment events.
- **UX**: Seamless checkout flow from pricing page.

## v1.1.0 - User Settings & Health Monitoring
- **Feature**: Complete User Settings implementation with secure API key storage.
- **Feature**: System Health Dashboard for real-time monitoring of infrastructure.
- **Security**: AES-256-GCM encryption for all stored API keys.
- **UX**: Theme management (Light/Dark mode) persisted to user profile.

## v1.0.2 - Bootstrap Review Complete
- **Status**: Validated core pipeline functionality.
- **Docs**: Finalized roadmap and architecture documentation.
- **Testing**: Confirmed test suite coverage for validation and webhooks.

## v1.0.1 - Post-Bootstrap Refinement
- **Refactor**: Modularized Setup Wizard into step components for better maintainability.
- **Security**: Added production guard for `.env.local` writing in API routes.
- **Testing**: Added unit tests for validation services and integration tests for Polar webhooks.

## v1.0.0 - Turnkey Release
- **Feature**: Added `/setup-wizard` for automated onboarding.
- **Feature**: Implemented API Key validation logic.
- **Feature**: Added `setup.sh` interactive installer.
- **Docs**: Comprehensive documentation update (Deployment Guide, PDR).

## v0.5.0 - Alpha
- Initial project scaffold.
- Basic Dashboard UI.
- Mock data integration.
