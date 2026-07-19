# Phase 8 — Telegram Handlers `:any` + Phase 7 Review Nits

**Status:** ✅ COMPLETE (2026-04-20)
**Priority:** P2 (Quick Wins, bounded scope)
**Session:** `/cook next --auto Phase 8`

## Scope

### Group A — Telegram Handler `:any` Cleanup (6 occurrences, 4 files)

Phase 6 noted "~420 `:any` in components"; actual scan today (2026-04-20) shows 131 non-test occurrences in 45 files — much smaller than estimated. Phase 8 tackles the telegram handlers module as a cohesive unit.

| File | Count | Shape |
|---|---|---|
| `src/lib/telegram/handlers/campaign-handler.ts` | 1 | |
| `src/lib/telegram/handlers/email-handler.ts` | 2 | |
| `src/lib/telegram/handlers/results-handler.ts` | 2 | |
| `src/lib/telegram/handlers/status-handler.ts` | 1 | |

**Approach:** Replace `as any` / `: any` with narrow row interfaces or `unknown` + guard. Reuse existing D1 typed shim from Phase 6.

### Group B — Phase 7 Code-Reviewer Nits (5 items)

From `plans/260419-2121-triet-tieu-no-ky-thuat/reports/code-reviewer-phase-07-260420.md`:

| # | File | Nit | Fix |
|---|---|---|---|
| 1 | `telegram-fsm-state-manager.ts` L63 | Comma-ternary `(logger.warn(...), BotState.IDLE)` is dense | Refactor to plain `if` + fallback const |
| 2 | `logger-utility.ts` | Dead `arg4` fallback path in `resolveErrorArgs` new-form branch | Remove unreachable branch |
| 3 | `sql-rate-limiter.ts` + `fsm-state-manager.ts` | `[metric]` prefix + `metric:` key redundancy | Standardize: keep `metric:` key, drop `[metric]` prefix (structured logs don't need human-readable marker) |
| 4 | Metric naming consistency | FSM uses natural-language message, rate-limiter uses structured `metric:` key | Align FSM to structured `metric:` pattern for invalid-state log |
| 5 | FSM invalid-state self-heal | Currently logs on every read — no write-back healing | **DEFER** — needs design discussion (is silent coercion correct?). Document in Phase 9 backlog. |

**Decision on #5:** Defer. Writing back a coerced value could mask real corruption; needs explicit rollback strategy. Keep logging loud for now.

## Non-Goals

- Remaining non-test `:any` debt (~125 occurrences in `lib/audit/*`, `lib/raas/*`, `lib/usage-metering/*`, etc.) — defer to Phase 9+
- Test file `:any` — legitimate for mocking unknowns
- `raas_licenses` audit (Phase 8+ backlog)
- Untracked WIP coupon routes (needs user decision)

## Files to Edit

- `src/lib/telegram/handlers/campaign-handler.ts`
- `src/lib/telegram/handlers/email-handler.ts`
- `src/lib/telegram/handlers/results-handler.ts`
- `src/lib/telegram/handlers/status-handler.ts`
- `src/lib/telegram/telegram-fsm-state-manager.ts` (nit #1, #4)
- `src/lib/utils/logger-utility.ts` (nit #2)
- `src/lib/telegram/sql-rate-limiter.ts` (nit #3)

## Success Criteria

- [x] Build: 0 TS errors
- [x] Tests: 1297/1297 pass (no regressions)
- [x] Lint: 0 errors on edited files
- [x] Telegram handlers `:any` count: 6 → 0
- [x] Phase 7 nits #1-#4 resolved; #5 documented as deferred
- [x] Production: HTTP 200 after push

## Deferred (Phase 9+ backlog)

1. FSM self-heal write-back strategy (needs design)
2. `lib/audit/*` `:any` cleanup (~30 occurrences across 9 files)
3. `lib/raas-gateway-enhanced.ts` + `lib/raas*` — part of live license system
4. `lib/usage-metering/*` `:any`
5. `src/app/api/v1/usage/batch/route.ts` + `admin/licenses/audit/route.ts`
6. `raas_licenses` D1-vs-Supabase migration audit
7. Untracked coupon routes WIP (`src/app/api/coupons/coupons/*`) — need user decision
