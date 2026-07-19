# Phase 25 — Logger-utility Structured Metadata Pickup (`code/details/hint`)

**Status:** ✅ COMPLETE (2026-04-24)
**Priority:** P2 (Phase 24 follow-up — natural closure to Phase 15+24 pair)
**Plan Parent:** `plans/260419-2121-triet-tieu-no-ky-thuat/plan.md`

## Scope

Phase 15 made `toError()` preserve Supabase `PostgrestError` shape by attaching `code/details/hint` as own-properties on the returned Error. Phase 24 gave `logger.warn/info/debug` an Error overload so call sites actually hand the Error to the logger.

Gap: `log()` in `logger-utility.ts` only picks up `name/message/stack`. PostgrestError `code/details/hint` are silently dropped from structured output. This closes the Phase 15↔24 bridge.

## Approach

1. Extend `LogEntry.error` interface with optional `code?: unknown; details?: unknown; hint?: unknown`.
2. In `log()`, after copying `name/message/stack`, pluck same 3 fields off the Error when present (via `in` check — Errors are regular objects).
3. Update `formatLogEntry()` dev pretty-print to render extra fields as a single `  Details: {...}` line when any are present.
4. Add 3 vitest cases to `logger-utility.test.ts`:
   - Error with all 3 (code+details+hint) → present in JSON output
   - Error with only `code` → only `code` in output (partial)
   - Plain Error → NO extra fields (no empty `code: undefined` pollution)

## Target Files (2)

- `apps/sophia-ai-factory/src/lib/utils/logger-utility.ts` — 3 changes (interface + `log()` pickup + `formatLogEntry()` render)
- `apps/sophia-ai-factory/src/lib/utils/logger-utility.test.ts` — 3 new tests

## Non-Goals

- Change any call-site (pickup is purely additive at sink)
- Rename `details` / `hint` to avoid shadowing (trust Supabase convention)
- Pick up arbitrary Error own-props (only the 3 known-safe PostgrestError keys)

## Success Criteria

- [x] `npm run build` — 0 new TS errors (baseline 611 → 611, Δ 0)
- [x] `npm run lint` — 0 delta
- [x] `npm test` — 1315 + 3 = 1318 pass
- [x] PostgrestError-shaped Error → `{error: {name, message, stack, code, details, hint}}` in JSON
- [x] Plain Error unchanged (no `undefined` fields serialized)
- [x] Code review 9.8/10 APPROVE SHIP (0 critical/high issues)
- [x] CI GREEN + Production HTTP 200

## Risk Assessment

- **Risk:** VERY LOW. Additive pickup at sink, no call-site semantics change.
- **Backward-compat:** Errors without extra props → same JSON output as before (conditional spread).
- **Rollback:** single-commit revert.

## Results

| Metric                          | Value                                  |
|---------------------------------|----------------------------------------|
| Files Modified                  | 2 (logger-utility.ts, logger-utility.test.ts) |
| Lines of Code Added             | ~15 (LogEntry interface + log() logic) |
| Tests Added                     | 3 (PostgrestError+3 fields, partial, plain) |
| Tests Passing                   | 1318/1318 (baseline 1315 + Phase 25: 3) |
| TypeScript Errors               | 611 (Δ 0, no regression)                |
| Code Review Score               | 9.8/10 (APPROVE SHIP)                  |
| Critical/High Issues            | 0                                      |
| PR/Commit Status                | Ready to ship                          |

**Summary:** Phase 25 closed the Phase 15↔24 bridge by extending `logger.log()` to pickup PostgrestError `code/details/hint` fields into structured JSON output. Additive change, no breaking changes, zero regression. Code review APPROVED SHIP.

## Deferred (Phase 26+ backlog)

- 244 `instanceof Error` ternary simplifications
- `ClientWithStorage` → R2 migration
- `raas_licenses` D1-vs-Supabase audit
- Split `lib/usage-metering/types.ts` if >200L
