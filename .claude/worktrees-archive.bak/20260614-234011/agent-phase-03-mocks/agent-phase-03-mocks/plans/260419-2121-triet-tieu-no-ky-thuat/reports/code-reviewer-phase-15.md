# Code Review — Phase 15: `toError()` Preserves PostgrestError Shape

**Score:** 9.7/10
**Verdict:** APPROVE SHIP
**Reviewer:** code-reviewer
**Date:** 2026-04-20

---

## Scope

- `src/lib/utils/to-error.ts` — +19 lines (PostgrestError-like branch)
- `src/lib/utils/to-error.test.ts` — +3 cases (6→9)
- Tester: 1306/1306 pass, 0 TS errors, 0 new lint.

---

## Review Focus Checklist

### 1. Narrowing correctness — no false positives ✅

Audited all 50+ `toError()` call sites. Every call passes an `error` from a
`catch` block (`unknown`) — zero DTOs, zero user-facing objects, zero places
where a `{ message: string }` DTO could leak in. The narrowing is safe:

- `jwt-nonce-tracker.ts`, `realtime-alert-service.ts`, `report-scheduler.ts`,
  `report-delivery.ts` — all `catch (error)` sites.
- Any legitimate `Error` subclass still short-circuits at the first guard
  (`value instanceof Error`). PostgrestError branch never intercepts them.

### 2. Type safety — `Object.assign` vs mutation ✅

`Object.assign(new Error(src.message), { ...conditional spreads })` is the
correct pattern:
- Single expression, no scattered mutation.
- No `any` leakage — `src` is narrowed to precise shape.
- Return type stays `Error` (superset of the assigned enumerable fields).
- No escape hatches (`// @ts-ignore`, `as any`) introduced.

### 3. YAGNI — is `code/details/hint` preservation justified? ✅

Yes — Phase 14 reviewer explicitly recommended it (documented in plan file
line 11, `Non-Goals` section line 63 acknowledges logger enhancement is
deferred). The fields are attached as cheap enumerable properties; cost is
negligible, and future logger enhancement can pick them up without another
round-trip through `toError()`. **Forward-compatible, not speculative.**

### 4. Backward compatibility — existing cases preserved ✅

Verified all 6 pre-Phase-15 test cases pass untouched:
- `Error` identity (line 9–12): unchanged.
- string→Error (line 14–18): unchanged.
- number→Error (line 20–24): unchanged (falls past the object branch).
- plain object without `.message` (line 26–30): `{foo:'bar'}` → `message: 'in'`
  check fails, falls through to `String(value)` → `"[object Object]"`. ✅
- `null` / `undefined` (line 32–42): both fail the `value !== null &&
  typeof === 'object'` guard. ✅

### 5. Non-string `message` edge case ✅

Verified at runtime (node repro):
- `{ message: 123 }` → guard `typeof === 'string'` fails → falls through to
  `String(value)` → `"[object Object]"`. Correct behavior.
- `{ message: null }` → same path. Correct.
- `{ message: undefined }` → same path. Correct (the `'message' in value`
  check matches but the typeof narrowing rejects).

This is the intended design — only genuinely string messages flow into the
new branch.

---

## Minor Observations (NON-BLOCKING)

### O1 — `code: null` is preserved, only `undefined` is stripped

`to-error.ts:30-32` — `src.code !== undefined` means `{code: null}` attaches
`code: null` to the Error. This is fine (logger handles null gracefully,
Supabase never returns `null` for these fields in practice), but if you
wanted strict "only truthy or only non-null" semantics, it would be
`src.code != null`. Current behavior is faithful to "if caller sent it
explicitly, preserve it" — acceptable, just noting the choice.

### O2 — Test coverage could add 1 more edge case

`{ message: 123 }` (non-string message) is not in the test suite. Verified
manually; behavior is correct. Not blocking — the narrowing logic is
obviously correct from reading the code. Optional: add as Phase 16 test if
you want belt-and-suspenders coverage.

---

## Positive Observations

- **JSDoc upgraded** (`to-error.ts:8–12`) — explicit callout of the
  PostgrestError problem + solution. Future maintainers won't wonder why the
  branch exists.
- **Plan → code → tests symmetry** — the diff in `phase-15-*.md` matches
  the shipped code byte-for-byte.
- **YAGNI respected at the right layer** — logger NOT modified (deferred to
  Phase 16+ backlog, line 91). Clean separation.
- **Pure additive change** — no existing code path mutated; zero regression
  surface.

---

## Unresolved Questions

None. All review focus items green.

---

## Recommendation

**APPROVE SHIP** — score 9.7/10, zero blocking issues, auto-ship OK.

The -0.3 is for:
- Minor: `{ message: 123 }` edge case not covered by explicit test (−0.2).
- Minor: `code: null` vs `undefined` asymmetry worth a 1-line comment (−0.1).

Neither blocks shipping; both are Phase 16 polish candidates.
