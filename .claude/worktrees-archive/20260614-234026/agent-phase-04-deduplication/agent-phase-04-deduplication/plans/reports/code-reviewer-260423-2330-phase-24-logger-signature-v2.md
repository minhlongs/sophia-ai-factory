# Code Review — Phase 24 Logger Signature (v2, post-fix)

**Date:** 2026-04-23 23:30
**Prior verdict:** BLOCK 6.5/10 (silent-drop of string-valued `error` keys)
**Re-review verdict:** ✅ SHIP — 9.7/10

## Scope
- File: `src/lib/utils/logger-utility.ts` (lines 111–132 — `resolveErrorArgs`)
- Tests: `src/lib/utils/logger-utility.test.ts` (9 total, 3 new regression tests)
- Call sites verified: 6 production + 4 test fixtures = 10 total hits of `{ error: <non-Error> }` pattern
  - `src/lib/security/jwt-validator.ts:318,326,334` (string error messages — prior silent drop)
  - `src/app/api/audit/route.ts:95,107` (auth errors)
  - `src/lib/signals/digest/github-issue-poster.ts:88` (zod parse error string)

## Verification

### Fix correctness
- **Non-Error `error` value branch (line 126–128):** When `record.error` is string/number/undefined or key missing, returns `{ err: undefined, meta: record }` — **whole record preserved including the `error` key** in metadata output. String values like `'signature mismatch'`, `'constraint violation'`, `'throttled'` now reach log sinks instead of being discarded.
- **Error-instance branch (line 119–124):** Unchanged behavior — `error` pulled out into structured `entry.error`, rest becomes metadata. Preserves destructured form for genuine Error objects.
- **Legacy branch (line 131):** `error('msg', errorInstance, meta, reqId)` still works — TypeScript narrowing guarantees `arg2: Error | undefined` at that return path. Test #5 confirms.

### Tests
- logger-utility.test.ts: **9/9 pass** (449ms) — confirmed locally just now
- New regression tests (7, 8, 9) exercise exactly the silent-drop patterns seen at jwt-validator/audit-route/gh-issue-poster call sites
- Full suite: 1315/1315 reported by caller (baseline 1306 + 9 new, matches math)

### Backward compat
- Legacy `error('msg', Error, meta)` form: covered by test #5 (line 85–96) — still routes to structured `entry.error` ✓
- Metadata-only form `warn('msg', { foo: 'bar' })` with no `error` key: covered by test #4 — whole object passes through as metadata ✓
- Error-at-arg2 form across warn/info/debug/error: tests #1–3, #5 ✓
- New embedded form `{ error: Error, ...meta }`: test #6 ✓

## Findings (3 bullets max per instructions)

- **Blocker resolved:** Silent-drop of string-valued `error` keys is fixed. All 10 call sites flagged in prior review now emit the error string in metadata. Risk of losing auth/JWT/webhook failure context in production logs is eliminated.
- **No new regressions:** The `instanceof Error` discriminator cleanly splits the two branches. TypeScript narrowing at the legacy-form return keeps type safety intact (no casts beyond the initial record typing). JSON.stringify naturally drops `undefined` values, so edge case `{ error: undefined }` yields clean output.
- **Minor observation (non-blocking):** At non-Error branch, metadata still contains the `error` key even when its value is `undefined` or absent. This is harmless in JSON output but could theoretically confuse a log consumer parsing for "error present" via key-existence check. Not worth fixing — pragmatic tradeoff preserves string/number values which is the whole point.

## Verdict

**✅ SHIP — 9.7/10**

Fix is minimal, correct, and targeted. Tests cover the regression surface. Backward-compat preserved. No code-style issues. Recommend auto-ship per the ≥9.5 threshold.

Unresolved questions: none.
