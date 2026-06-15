# Phase 30 — Non-`err` Identifier Sweep Wave 4 (`src/lib/**`)

**Status:** ✅ COMPLETE (2026-04-24)
**Priority:** P2 (DRY sweep — extends Phase 26→27→28→29 series to non-`err` identifiers)
**Plan Parent:** `plans/260419-2121-triet-tieu-no-ky-thuat/plan.md`

## Scope

Replace `X instanceof Error ? X.message : ...` (where identifier X ∈ {`error`, `e`, `emailError`, `d1Err`}) with `getErrorMessage(X)` across **~25 hits in ~20 files** under `src/lib/**`. Mechanical, behavior-preserving.

## Why

Phase 29 closed the `err`-only ternary sweep. Code-reviewer flagged ~60 non-`err` residuals. Wave 4 targets the `src/lib/**` subset (~25 hits); `src/app/**` residuals deferred to Phase 31.

## Approach

Per file:
1. Add `import { getErrorMessage } from '@/lib/utils/to-error'` if missing.
2. Replace string-extraction ternary → `getErrorMessage(X)`.
3. Preserve surrounding contract (variable name, template literal, logger metadata shape).

**Exclusion:** Type-guard pattern `X instanceof Error ? X : new Error(String(X))` (returns `Error`, not string) — NOT replaceable without semantic change. Left untouched (~145 site-wide).

## Target Files (23)

| Module | File | Hits |
|--------|------|------|
| validation | `src/lib/validation/services.ts` | 6 |
| audit | `src/lib/audit/report-delivery.ts` | 1 (`emailError`) |
| audit | `src/lib/audit/cron-report-runner.ts` | 1 |
| audit | `src/lib/audit/right-to-erasure.ts` | 2 |
| usage-metering | `src/lib/usage-metering/debug-logger.ts` | 1 |
| usage-metering | `src/lib/usage-metering/tracker.ts` | 1 |
| usage-metering | `src/lib/usage-metering/batch-buffer.ts` | 1 |
| usage-metering | `src/lib/usage-metering/rollup/daily-rollup.ts` | 1 |
| usage-metering | `src/lib/usage-metering/rollup/hourly-rollup.ts` | 1 |
| ai | `src/lib/ai/text-to-speech-generator-elevenlabs.ts` | 1 |
| ai | `src/lib/ai/script-generator.ts` | 1 |
| ai | `src/lib/ai/anthropic-sse-parser.ts` | 1 (`err`—already uses identifier `err` but lives in `src/lib/ai/` not swept) |
| heygen | `src/lib/heygen/heygen-client.ts` | 1 |
| telegram | `src/lib/telegram/sql-rate-limiter.ts` | 1 |
| telemetry | `src/lib/telemetry/error-tracker.ts` | 1 (`d1Err`) |
| alerts | `src/lib/alerts/quota/alert-delivery-service.ts` | 1 |
| alerts | `src/lib/alerts/webhook-notification-service.ts` | 1 |
| raas | `src/lib/raas/raas-rate-limiter.ts` | 1 |
| raas | `src/lib/raas-key-generator.ts` | 1 |
| services | `src/lib/services/real/payment-service.ts` | 1 |
| services | `src/lib/services/notification-service.ts` | 1 |
| billing | `src/lib/billing/email/email-delivery-service.ts` | 1 |
| security | `src/lib/security/jwt-validator.ts` | 1 |
| **Total** | **23 files** | **28 hits** |

## Non-Goals

- `src/app/**` residuals (~30 hits) → Phase 31
- Type-guard ternary (returns `Error`) → NOT applicable
- `to-error.ts:42` JSDoc comment → documentation, not code

## Success Criteria

- [x] `npm run build` — 0 new TS errors (baseline 611)
- [x] `npm test` — 1321 baseline still green
- [x] `npm run lint` — 0 new warnings on touched files
- [x] 0 `X.message` string-extraction ternary matches under `src/lib/**` (non-`err`)
- [x] Code review ≥ 9.5/10 APPROVE SHIP (9.7/10)
- [x] CI GREEN + Production HTTP 200

## Risk Assessment

- **Risk:** VERY LOW. Mechanical transform, identical to Phase 27-29.
- **Backward-compat:** N/A (string output identical for `Error` shape; minor improvement for PostgrestError shapes).
- **Rollback:** single-commit revert.

## Deferred (Phase 31+)

- `src/app/**` non-`err` residuals (~30 hits across api routes, server actions, pages, components)
- `lib/usage-metering/types.ts` (283L > 200L) modularization
- `ClientWithStorage` → R2 migration
- `raas_licenses` D1-vs-Supabase audit
