# Triệt Tiêu Nợ Kỹ Thuật (Clean Tech Debt) — Sophia AI Factory

**Plan ID:** 260419-2121  
**Status:** IN PROGRESS (Phase 29 ✅ COMPLETE / Phase 30+ BACKLOG)  
**Timeline:** 2026-04-19 → ongoing  

## Overview

Systematic removal of TypeScript `:any` types, eslint-disables, and deferred debt across Sophia RoIaaS platform.

## Phases

| Phase | Title | Status | Progress |
|-------|-------|--------|----------|
| 1 | Auth & Security Types | ✅ COMPLETE | [Phase 1](phase-01-any-auth-types.md) |
| 2 | Core API Routes `:any` Reduction | ✅ COMPLETE | [Phase 2](phase-02-any-type-auth-security.md) |
| 3 | **API Routes Expansion** | ✅ COMPLETE | [Phase 3](phase-03-api-routes-any-reduction.md) |
| 4 | **Database & Migration Cleanup** | ✅ COMPLETE | [Phase 4](phase-04-d1-migration.md) |
| 5 | **Console.log → logger Refactor** | ✅ COMPLETE | [Phase 5](phase-05-console-cleanup.md) |
| 6 | ESLint Disables & Review | ✅ COMPLETE | [Phase 6](phase-06-eslint-disables-and-nits.md) |
| 7 | Observability & Safety | ✅ COMPLETE | [Phase 7](phase-07-observability-and-safety.md) |
| 8 | Telegram Handlers + Nits | ✅ COMPLETE | [Phase 8](phase-08-telegram-handlers-plus-nits.md) |
| 9 | Audit Module `:any` Cleanup | ✅ COMPLETE | [Phase 9](phase-09-audit-module-any-cleanup.md) |
| 10 | Usage Metering + Route Handlers `:any` Cleanup | ✅ COMPLETE | [Phase 10](phase-10-usage-metering-and-routes.md) |
| 11 | `lib/raas*` `:any` Cleanup (Careful Scope) | ✅ COMPLETE | [Phase 11](phase-11-raas-module-careful-scope.md) |
| 12 | DB Helpers + FSM Design (D1Response + insertTyped) | ✅ COMPLETE | [Phase 12](phase-12-db-helpers-and-fsm-design.md) |
| 13 | `toError()` Helper Standardization | ✅ COMPLETE | [Phase 13](phase-13-to-error-helper.md) |
| 14 | toError() Slice 2 (next 34 sites) | ✅ COMPLETE | [Phase 14](phase-14-to-error-slice-2.md) |
| 15 | toError() preserves Supabase PostgrestError shape | ✅ COMPLETE | [Phase 15](phase-15-to-error-postgrest-shape.md) |
| 16 | toError() Slice 3 (next 29 sites) | ✅ COMPLETE | [Phase 16](phase-16-to-error-slice-3.md) |
| 17 | toError() Slice 4 (next 31 sites) | ✅ COMPLETE | [Phase 17](phase-17-to-error-slice-4.md) |
| 18 | toError() Slice 5 (next 29 sites) | ✅ COMPLETE | [Phase 18](phase-18-to-error-slice-5.md) |
| 19 | toError() Slice 6 (27 sites, long-tail 2-site files) | ✅ COMPLETE | [Phase 19](phase-19-to-error-slice-6.md) |
| 20 | toError() Slice 7 (final 46 sites) | ✅ COMPLETE | [Phase 20](phase-20-to-error-slice-7.md) |
| 21 | ESLint Regression Guard (`no-restricted-syntax`) + 2 carry-over migrations | ✅ COMPLETE | [Phase 21](phase-21-eslint-no-as-error.md) |
| 22 | Logger-utility `as Error` closure (final 2 union casts + ESLint ignore drop) | ✅ COMPLETE | [Phase 22](phase-22-logger-utility-as-error-closure.md) |
| 23 | Scripts + test-file as Error closure (4 final casts) | ✅ COMPLETE | [Phase 23](phase-23-scripts-and-test-closure.md) |
| 24 | Logger warn/info/debug signature alignment (Error overload) | ✅ COMPLETE | [Phase 24](phase-24-logger-signature-alignment.md) |
| 25 | Ternary Sweep — Wave 1 (scripts/test scope) | ✅ COMPLETE | Phase 25 (scripts/test closure) |
| 26 | Ternary Sweep — Wave 1.5 (intermediate scope) | ✅ COMPLETE | Phase 26 (intermediate cleanup) |
| 27 | Ternary Sweep — Wave 2a (API scope partial) | ✅ COMPLETE | Phase 27 (API routes part 1) |
| 28 | Ternary Sweep — Wave 2b (API scope final) | ✅ COMPLETE | [Phase 28](../260424-0325-phase-28-ternary-sweep-wave-2-api/phase-28-ternary-sweep-wave-2-api.md) |
| 29 | Ternary Sweep — Wave 3 (lib scope) | ✅ COMPLETE | [Phase 29](../260424-0423-phase-29-ternary-sweep-wave-3-lib/phase-29-ternary-sweep-wave-3-lib.md) |

## Key Metrics

- **Phase 5 Result:** 34 console.log/warn/error → logger.* across 17 production files; 3 nits deferred
- **Phase 6 Result:** 11 eslint-disables → 0 in telegram module; fixed latent bug in checkTierAccess
- **Phase 7 Result:** logger.error() overload + isBotState() guard + rate-limiter warn metrics; raas_licenses scope dropped (17 active usages found)
- **Phase 8 Result:** Telegram handlers `:any` count 6 → 0 across 4 files; Phase 7 nits #1-#4 resolved; nit #5 deferred to Phase 9+ (FSM self-heal write-back design)
- **Phase 9 Result:** lib/audit `:any` count 33 → 0 across 11 files; new `types.ts` with 8 shared row interfaces; inline nit (duplicate `ScheduledReportRow`) fixed; 6 nits deferred to Phase 10+
- **Phase 10 Result:** lib/usage-metering `:any` count 20 → 0 across 9 files (1 lib module + 2 routes); 4 new interfaces (D1Response<T>, UsageEventInsertable, LicenseMetadataRow, ApiKeyRecord); 2 pre-existing bugs fixed incidentally (service_name, error.message); 6 nits deferred to Phase 11+
- **Phase 11 Result:** lib/raas* `:any` count 3 → 0 across 2 files; JWT payload typing + discriminated union narrowing + Tier guard; latent bug fix (severity routing in denied-quota branch); incidental: ops/alerting should expect elevated critical counts for hourly_credits exceedance
- **Phase 12 Result:** 2 new DB helper files (types.ts, insert-typed.ts); 13 files migrated (D1Response + insertTyped); 10 insertTyped call sites active; FSM self-heal decision documented (log-only, no auto-write-back); Code Review 9.6/10 APPROVE
- **Phase 13 Result:** `toError()` helper created in `@/lib/utils/to-error`; 29 `as Error` casts → 0 across 3 top-concentration files (jwt-nonce-tracker, report-scheduler, realtime-alert-service); 6 unit tests; Code Review 9.7/10 APPROVE; strict behavior improvement — non-Error throws now produce full log entries
- **Phase 14 Result:** 34 `as Error` / raw-error sites → `toError()` across 5 files (realtime-tracker, quota-checker, report-delivery, audit-writer, realtime-alert-service); Code Review 9.6/10 APPROVE; no regression
- **Phase 15 Result:** toError() extended to preserve Supabase PostgrestError shape — `{message, code?, details?, hint?}` → `Error(message)` with own-properties attached; 3 new tests (1306 total); Code Review 9.7/10 APPROVE SHIP
- **Phase 16 Result:** 29 `as Error` sites → `toError()` across 5 files (audit-query-logger, realtime-alert-dispatcher, enriched-jwt, r2-report-storage, kv-metering-log-sync); Worker-scope `@/lib/*` alias validated for `toError` import; Code Review 9.8/10 APPROVE SHIP; 0 behavior regression
- **Phase 17 Result:** 31 `as Error` sites → `toError()` across 7 files (api-key-validator, audit-writer-extended, db-schema/route, usage-event-tracker, right-to-erasure, cron-report-runner, alert-delivery-service); handled 2 new sub-patterns (`as unknown as Error` double-cast in GDPR path + inline `(e as Error).message` expressions); Code Review 9.8/10 APPROVE SHIP; 0 behavior regression.
- **Phase 18 Result:** 29 `as Error` sites → `toError()` across 10 files (use-license-list-actions, api/license/sync, metering-reconciler-runner, raas-gateway-client, supabase-realtime-alert-service, use-analytics-data, admin/api-keys, raas-rate-limiter, overage-logger, ingestion/runner); FIRST expansion to React client scope (`'use client'` hook + component); tree-shake safety verified; Code Review 9.8/10 APPROVE SHIP.
- **Phase 19 Result:** 27 `as Error` sites → `toError()` across 14 files (d1-query-builder, muapi-media-client, dunning-actions, + 10 API routes + reconciliation-alert-emitter worker); long-tail slice — each file had 1–2 casts; Code Review 9.8/10 APPROVE SHIP; 0 behavior regression.
- **Tests:** 1321/1321 pass (100% maintained across all phases; 31 skipped = legitimate fixtures; +6 from Phase 24 through Phase 29)
- **Code Review:** APPROVE 9.8/10 (Phase 28-29 latest), SHIP verdict
- **Production:** CI GREEN (to be verified by git-manager after sync-back completion)
- **Phase 20 Result:** 46 `as Error` sites → `toError()` across 46 files (20 API routes + 6 UI/hooks + 20 lib modules); final slice with largest file count; 3 remaining `as Error` refs (1 documentation comment + 2 union-type casts in logger-utility); Code Review 9.7/10 APPROVE SHIP; 0 behavior regression.
- **Phase 21 Result:** ESLint `no-restricted-syntax` rule added to flag bare `as Error` casts + 2 carry-over coupon route migrations (inadvertently committed in Phase 20); regression guard locks in Phase 13→20 gains; Code Review 9.7/10 APPROVE SHIP.
- **Phase 22 Result:** Eliminated final 2 union-type `as Error | ...` casts in `logger-utility.ts` (lines 125 & 156, redundant — TS narrowing handles both). Dropped file from ESLint ignore list. No runtime impact. Code Review 10/10 APPROVE SHIP.
- **Phase 23 Result:** Eliminated final 4 `as Error` casts across 2 files: 3 inline ternary in `scripts/production-setup.ts` (lines 188, 238, 304 — self-contained pattern `error instanceof Error ? error.message : String(error)`) + 1 `toError()` replacement in `src/lib/ai/anthropic-adapter.test.ts` (line 496). Repo-wide closure: entire codebase (production + scripts + tests) now free of bare `as Error` casts. Code Review 9.7/10 APPROVE SHIP.
- **Phase 24 Result:** Extended `logger.warn/info/debug` to accept optional `Error` via overload; reused `resolveErrorArgs` pattern from `logger.error`. 2 files modified (`logger-utility.ts`, test file). 9 new tests (3 Phase 24 cases + 6 incidental metadata preservation forms). TS error reduction 621 → 611 (Δ -10). Incidental fix: latent bug in `resolveErrorArgs` preserving non-Error string values in `{ error: 'msg' }` records (found & fixed during round 1 code review, prevented silent data loss at ~10 call sites). Code Review 9.7/10 APPROVE SHIP.
- **Phase 25-27 (Ternary Sweep Waves 1-2a):** Cumulative 47 ternary `error instanceof Error ? error.message : String(error)` patterns simplified across scripts, test utilities, and initial API routes scope. Core prep for Wave 2b+3 closure.
- **Phase 28 Result (Ternary Sweep Wave 2b):** 6 ternary patterns simplified across API routes scope (generate-report, process-webhook, sync-operations routes). Files: 6. Code Review 9.8/10 APPROVE SHIP. 1321/1321 tests pass.
- **Phase 29 Result (Ternary Sweep Wave 3):** 4 ternary patterns simplified across lib modules (gateway, billing, inngest, telegram). Files: 4. Code Review 9.8/10 APPROVE SHIP. 1321/1321 tests pass. **Ternary sweep series CLOSED** — all `error instanceof Error` ternaries in production scope (src/lib/**, src/app/api/**, src/app/telegram/**) eliminated. Cumulative Phase 25-29: 65 files, ~57 ternary hits.
- **Cumulative (Phase 1→29):** ~509 `:any` removed; 233 `as Error` sites normalized (Phase 13-23 closure) + 57 ternary patterns simplified (Phase 25-29 closure); React client hook/component bundle + toError() preserves Supabase PostgrestError shape + GDPR erasure path + inline-message expressions + long-tail slice + scripts/test closure + Logger-utility Error overload + latent resolveErrorArgs bug fix; ESLint regression guard; 0 bare `as Error` casts + 0 `instanceof Error` ternaries remain in targeted scopes; 2 reusable DB helpers + 1 error helper created; tech debt elimination spans auth, API routes, database, observability, telegram, audit, metering, RAAS, D1-layer, error-handling, worker (R2/alert-dispatcher), GDPR, React client modules, scripts, test utilities, logger-utility, lib modules
- **Deferred to Phase 30+:** Non-error-related ternary simplifications (~22 hits in edge cases/utility patterns), Logger-utility structured metadata pickup (code/details/hint), `ClientWithStorage` → R2 migration, `raas_licenses` D1-vs-Supabase audit, Split `lib/usage-metering/types.ts`

## Links

- [Phase 4 Details](phase-04-d1-migration.md)
- [Phase 3 Details](phase-03-api-routes-any-reduction.md)
- [Phase 2 Complete](phase-02-any-type-auth-security.md)
- [GitHub Repo](https://github.com/sophia-ai-factory)
- [Docs](../../docs/)
