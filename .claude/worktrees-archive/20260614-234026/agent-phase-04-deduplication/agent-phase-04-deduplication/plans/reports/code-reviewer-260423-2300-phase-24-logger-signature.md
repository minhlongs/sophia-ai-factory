# Code Review — Phase 24 Logger Signature Alignment

**Reviewer:** code-reviewer
**Date:** 2026-04-23 23:00
**Plan:** `plans/260419-2121-triet-tieu-no-ky-thuat/phase-24-logger-signature-alignment.md`
**Scope:** `src/lib/utils/logger-utility.ts` + `logger-utility.test.ts`

---

## Verdict: **BLOCK SHIP**

**Score: 6.5 / 10** (needs auto-ship ≥ 9.5). Silent production-observability regression at 10–12 real call sites.

---

## Metrics

| Check | Value | Delta vs baseline |
|---|---|---|
| TS errors | 611 | −10 (improvement) |
| Tests pass | 1312/1312 | +6 new (all pass) |
| Lint | clean | 0 |
| Build | reported pass | — |
| Call sites surveyed | 931 (206 files) | — |
| **Regression blast radius** | **10–12 sites** | **NEW** |
| API consistency (4 levels same shape) | ✅ | — |
| Backward-compat — metadata-only form | ✅ verified | — |
| Backward-compat — `{ error: <string\|non-Error> }` form | ❌ **silently drops field** | — |

---

## Critical — BLOCKER

### C1. Silent drop of `error` field when value is not an `Error` instance

**File:** `src/lib/utils/logger-utility.ts:116-123` (`resolveErrorArgs`)

```ts
if (arg2 !== undefined && !(arg2 instanceof Error)) {
  const { error: embeddedErr, ...rest } = arg2 as Record<string, unknown>;
  const err = embeddedErr instanceof Error ? embeddedErr : undefined;   // ← drops if not Error
  const meta = Object.keys(rest).length > 0 ? rest : undefined;         // ← rest excludes `error`
  return { err, meta, reqId: arg3 as string | undefined };
}
```

**What breaks:** Existing pre-Phase-24 call form `logger.warn('msg', { error: <string|object>, ...rest })` used to output `metadata: { error: <value>, ...rest }` verbatim. After refactor:

- If value at `error` key is not `instanceof Error` → **dropped from err slot** (line 120).
- It is ALSO stripped from `rest` by the destructure on line 119 → **no longer in metadata either**.
- Net: the `error:` field **vanishes from log output entirely**.

**Blast radius — confirmed real call sites dropping data:**

| File:Line | Pre-24 behavior | Post-24 behavior |
|---|---|---|
| `lib/security/jwt-validator.ts:318` | logs `{ error: errorMessage }` | metadata = undefined, error = undefined |
| `lib/security/jwt-validator.ts:326` | logs `{ error: errorMessage }` | metadata = undefined, error = undefined |
| `lib/security/jwt-validator.ts:334` | logs `{ error: errorMessage }` | metadata = undefined, error = undefined |
| `lib/ai/text-to-speech-generator-elevenlabs.ts:69` | logs `{ error: errMsg }` | metadata = undefined, error = undefined |
| `lib/signals/digest/github-issue-poster.ts:88` | logs `{ error: parsed.error.message }` | metadata = undefined, error = undefined |
| `app/api/audit/route.ts:95` | logs `{ error: apiKeyResult.error }` | dropped |
| `app/api/audit/route.ts:107` | logs `{ error: jwtResult.error }` | dropped |
| `lib/byok/provider-router.ts:76` | logs `{ userId, error: String(err) }` | metadata = `{ userId }`, error-field lost |
| `lib/byok/provider-router.ts:91` | logs `{ userId, error: String(err) }` | metadata = `{ userId }`, error-field lost |
| `app/api/setup/local-mode/provision/route.ts:117` | logs `{ userId, error: String(err) }` | `{ userId }` only |
| `app/api/setup/local-mode/provision/route.ts:134` | same | same |
| `app/api/setup/local-mode/provision/route.ts:169` | same | same |
| `app/api/admin/audit/receipt/route.ts:62` | `{ logId, error: fetchError }` | `{ logId }` only |
| `app/api/admin/audit/reports/download/[id]/route.ts:49` | `{ reportId, error: fetchError }` | `{ reportId }` only |

**Severity:** HIGH — JWT auth failures, payment-path errors (provision, byok), and audit-API rejections will log **without the error cause** in production. This is *worse* than the original problem Phase 24 set out to fix (stack-trace-less warn). Observability loss during incident triage.

**Fix (minimal, preserves all three forms):** When `embeddedErr` is NOT an `Error`, keep it as metadata instead of dropping:

```ts
if (arg2 !== undefined && !(arg2 instanceof Error)) {
  const { error: embeddedErr, ...rest } = arg2 as Record<string, unknown>;
  if (embeddedErr instanceof Error) {
    const meta = Object.keys(rest).length > 0 ? rest : undefined;
    return { err: embeddedErr, meta, reqId: arg3 as string | undefined };
  }
  // Non-Error `error` value — keep it inside metadata (preserves pre-Phase-24 behavior)
  const meta = Object.keys(arg2 as Record<string, unknown>).length > 0
    ? (arg2 as Record<string, unknown>)
    : undefined;
  return { err: undefined, meta, reqId: arg3 as string | undefined };
}
```

Add a regression test:

```ts
it('warn preserves { error: string } in metadata (pre-24 compat)', () => {
  logger.warn('x', { error: 'some string', userId: 'u1' });
  const out = parseOutput(warnSpy);
  const meta = (out.metadata ?? out.raw) as Record<string, unknown> | string;
  if (typeof meta !== 'string') {
    expect(meta.error).toBe('some string');
    expect(meta.userId).toBe('u1');
  }
});
```

---

## High

### H1. Test coverage misses the regression

Test #6 (`logger-utility.test.ts:98`) validates new-form only with `error: new Error(...)`. It does not exercise `error: '<string>'`, `error: <ZodError-like>`, or `error: <SupabaseError>` — the actual shapes at the 10+ call sites. This is why the regression slipped CI.

**Fix:** Add the regression test above + one for `error: { code, message }`-shaped objects.

### H2. Overload type declarations do not enforce call-form separation

The 4-arg union `arg2?: Error | Record<string, unknown>, arg3?: Record<string, unknown> | string, arg4?: string` permits nonsensical calls like `logger.warn('m', errInstance, 'req-id', 'extra')` to compile. Not a correctness bug for existing callers, but it removes the type system's ability to guide new code into the canonical form.

**Fix (post-ship):** Declare true TypeScript overloads separating legacy vs new shapes. Low-pri compared to C1.

---

## Medium

### M1. `dispatch()` arg-resolution loses `arg4` in new-form branch

In `dispatch()` (line 143–146), when `arg3` is an object (legacy: `metadata`), `reqId3 = arg4`. Correct. But if a future caller does `logger.warn('m', errInstance, { meta }, 'req-id')` (legacy: err + meta + reqId), the path works.

Edge case: `logger.warn('m', { error: err }, { someOtherMeta })` — the new-form path ignores `arg3`-as-object entirely. This isn't a regression (no call sites use this shape) but the `arg4` param is unused in the new-form branch — a latent footgun. Document via code comment or drop `arg4` from new-form overload.

### M2. `withRequestId` overload shape is narrower than `logger.*`

`withRequestId().warn` declares only 3 params (`message, arg2, arg3`), missing `arg4`. This is fine in practice (reqId comes from closure) but creates silent signature divergence — mental model drift between `logger.warn` and `logger.withRequestId(id).warn`.

Acceptable; note in code comment.

---

## Low

### L1. `LogLevel` case `default` in log switch (line 96–98) uses `console.log` for `info`

Pre-existing, unchanged by Phase 24. Non-blocking.

### L2. Dev-mode `debug` test (`logger-utility.test.ts:69`) accepts 0-or-1 calls

Test is correct (defensive vs `NODE_ENV`) but does not assert Error-propagation semantics. Expand by forcing dev mode with `vi.stubEnv('NODE_ENV', 'development')` to exercise the branch.

---

## Positive Observations

- Refactor extracts shared `dispatch()` — clean DRY win for the warn/info/debug/error quartet.
- 10-error TS delta improvement (621 → 611) at enriched-jwt.ts sites is measurable and real.
- Zero call-site churn across 931 logger invocations — backward-compat discipline maintained (except for C1).
- Test file follows existing vitest conventions; spy cleanup (`afterEach`) correct.
- Plan file explicitly acknowledged risk as LOW and called out rollback path — discipline good, but scope of "new form" was under-specified (assumed `error` always Error).

---

## Edge Cases Found (Scouting)

| # | Case | Status |
|---|---|---|
| 1 | `logger.warn('m', errInstance)` (3 enriched-jwt sites) | ✅ stack preserved |
| 2 | `logger.warn('m', { foo: 'bar' })` (legacy metadata) | ✅ works |
| 3 | `logger.warn('m', { error: <Error> })` (new embedded) | ✅ works, test #6 |
| 4 | `logger.warn('m', { error: '<string>' })` (10+ sites) | ❌ **silently drops** |
| 5 | `logger.warn('m', { error: <{code,msg}> })` (audit sites) | ❌ **silently drops** |
| 6 | `logger.warn('m', { error: fetchError, logId: x })` | ⚠️ keeps `logId`, drops `error` |
| 7 | `logger.warn('m', errInstance, { meta }, 'req-id')` | ✅ all three resolved |
| 8 | `logger.warn('m', undefined, 'req-id')` | ✅ works (no matches in codebase) |

---

## Recommended Actions (before ship)

1. **BLOCKER:** Fix `resolveErrorArgs` line 120–121 per C1 patch above. Non-Error `error` values must stay in metadata.
2. **BLOCKER:** Add regression test for `{ error: '<string>' }` shape.
3. **Nice-to-have:** Add test for mixed `{ error: '<str>', userId: 'x' }` to guard the audit-route / provider-router / provision patterns.
4. **Post-ship:** Split `dispatch()` into true TS overloads (H2) for future authoring clarity.

After fix + new test, re-verify: `npm run build && npm test` — expect 1313/1313 pass, 611 TS errors held steady. Re-request review.

---

## Unresolved Questions

1. Is the structured-output contract for `logger.warn('m', { error: stringValue })` documented anywhere? If consumers (log aggregators, dashboards) rely on `metadata.error`, the C1 regression may already be silently breaking them since merge. Recommend checking any monitoring dashboards keyed on `$.metadata.error`.
2. Should Phase 24's "new form" be the *canonical* form going forward (migrate the 10+ string-error sites to use `toError()` wrapper)? If so, that migration is a follow-up phase — but the current refactor **must not silently change semantics** for un-migrated sites.
3. The plan file's Phase-23-deferred note mentions "logger-utility structured metadata pickup for `code/details/hint` on Error." Does that intended future work assume `error` key is always Error-instance? If yes, the 10+ non-Error sites need a migration phase *before* tightening resolveErrorArgs.
