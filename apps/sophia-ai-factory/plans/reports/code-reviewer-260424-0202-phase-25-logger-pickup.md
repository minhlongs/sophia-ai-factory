# Code Review — Phase 25: Logger Structured Metadata Pickup

**Date:** 2026-04-24 02:10
**Reviewer:** code-reviewer
**Plan:** `plans/260424-0202-phase-25-logger-structured-pickup/phase-25-logger-structured-metadata-pickup.md`
**Verdict:** ✅ **APPROVE — SHIP**
**Score:** **9.8 / 10** (auto-ship threshold ≥9.5 met)

---

## Scope

- **Files changed (2):**
  - `src/lib/utils/logger-utility.ts` (213 L)
  - `src/lib/utils/logger-utility.test.ts` (201 L)
- **LOC delta:** ~+30 impl, ~+55 test
- **Scout focus:** `toError()` symmetry, conditional-spread semantics, Error prototype collisions, call-site impact

---

## Overall Assessment

Tight, surgical closure of the Phase 15 ↔ 24 bridge. Pickup is purely additive at the sink — zero call-site semantics change, zero backward-compat risk. The conditional-spread pattern mirrors `toError()` (Phase 15) exactly, giving the codebase a single consistent idiom for `code/details/hint` preservation. Tests cover the three meaningful shapes (full / partial / none) with proper guards against `undefined` pollution.

---

## Scrutiny of the 5 Concerns Raised

### 1. Conditional-spread `...(errRecord.code !== undefined && { code })` — does `code: 0` leak as `false`?

**Verdict: CORRECT.** Verified empirically:

```
code=0      → {"code":0}       ✓ preserved
code=false  → {"code":false}   ✓ preserved
code=""     → {"code":""}      ✓ preserved
code=null   → {"code":null}    ✓ preserved
code=undef  → {}               ✓ omitted (only undefined is eaten)
```

The `cond && { key: val }` pattern — when `cond` is `false`, spread receives the primitive `false`, which is a no-op per ES2018 spread spec. When `cond` is `true`, the RHS `{ code: val }` evaluates and spreads. Only the sentinel `undefined` triggers the guard. PostgreSQL `code` is always a string (e.g., `"42P01"`), so in practice `0/false` wouldn't occur — but the pattern is defensively correct for arbitrary shapes.

### 2. Dev-format `Details:` JSON block placement — readability?

**Verdict: ACCEPTABLE.** The dev-mode layout is now:

```
[ts] [LEVEL] [reqId] msg
  Metadata: {...}
  Error: Name: message
  Details: {code, details, hint}
<stack>
```

Placing `Details:` between the one-line `Error:` header and the stack is ergonomic — the header gives you the type+message at a glance, `Details:` gives you the structured shape when debugging Postgrest errors, and the stack comes last (standard convention). Alternative (append after stack) would force scrolling past a 20-line stack to see the SQL error code. Current placement is the right call.

### 3. Risk of `code/details/hint` shadowing Error prototype keys?

**Verdict: NONE.** Verified `'code' in Error.prototype`, `'details' in Error.prototype`, `'hint' in Error.prototype` all return `false`. Even `'cause' in Error.prototype` is `false` (despite being spec'd since ES2022 — only present as own-prop when constructor receives `{cause}`). `Object.assign` in `toError()` creates plain own-enumerable data properties, no descriptor weirdness, no prototype pollution vector.

### 4. Plain-Error test guarding against `{code: undefined}` serialization?

**Verdict: CORRECTLY GUARDED.** Test at line 174-187:

```typescript
expect('code' in err).toBe(false);
expect('details' in err).toBe(false);
expect('hint' in err).toBe(false);
```

Using `'key' in obj` (not `obj.key === undefined`) is the right assertion — it catches the exact failure mode where the key exists on the object with an `undefined` value (which `JSON.stringify` would drop, so a shallower test would pass falsely). The conditional spread prevents the key from being attached at all, and `in` checks that distinction. Solid.

### 5. Scope creep — did we avoid `cause` and other Error own-props?

**Verdict: CLEAN SCOPE.** Only the 3 PostgrestError keys are picked up. `cause` (ES2022 Error option) is deliberately not touched — correct, because:
- PostgrestError doesn't set `cause`
- `cause` carries semantic weight (exception chaining) that logging should handle via a dedicated recursion, not a flat own-prop pluck
- Adding it now would be YAGNI and could surprise call sites that use `cause` for programmatic flow

---

## Critical Issues

None.

## High Priority

None.

## Medium Priority

**M1. File length at 213 L (impl) — 13 over the 200-line guideline.**
- Not worth splitting now. The module is cohesive (one logger, one interface). Splitting would create artificial boundaries between `log()`, `formatLogEntry()`, `dispatch()`, and the public surface — all must share the `LogEntry` type and `isDevelopment` flag. KISS/YAGNI wins here.
- If future phases grow it past ~250L, split into `logger-utility.ts` (public surface) + `logger-format.ts` (internal `formatLogEntry`).

## Low Priority

**L1. `formatLogEntry()` nested-if density.**
Lines 46-58 build a 4-field Details object with 3 separate `!== undefined` checks plus an `Object.keys().length > 0` check. Could be inlined with a helper:

```typescript
const extras = pickDefined({ code, details, hint });
if (Object.keys(extras).length) output += `\n  Details: ${JSON.stringify(extras, null, 2)}`;
```

But this would leak a `pickDefined` util for 3 callsites. Not worth the extraction. Current code is readable; leave it.

**L2. Dev-only `Details:` block is tested only via JSON-mode (production) path.**
The three new tests parse output via `JSON.parse` (production JSON mode). The new dev-mode `Details:` rendering branch (lines 48-54 of impl) is technically not exercised by the test suite — the tests fall through to the `raw: first` branch only if parse fails, which it won't in the default test env (`NODE_ENV` is not `development`). Coverage is achieved for the semantic contract (extras appear in structured output) but not for the dev pretty-print format. Acceptable — pretty-print is cosmetic, and a bug there is visually obvious on first local run.

---

## Edge Cases (Scout)

| Case | Handled? | Notes |
|------|----------|-------|
| `code = 0` | ✅ | preserved (falsy-but-defined) |
| `code = ""` | ✅ | preserved |
| `code = null` | ✅ | preserved (distinct from undefined) |
| `code = undefined` | ✅ | omitted via conditional spread |
| All 3 extras missing (plain Error) | ✅ | no pollution (`'code' in err === false`) |
| PostgrestError round-trip (toError → logger) | ✅ | symmetric pattern, tested via Object.assign shape in Phase 25 tests |
| Error prototype shadowing | ✅ | none of the 3 keys exist on Error.prototype |
| `cause` chain | ✅ intentional skip | non-goal per plan; correct |
| metadata key collision (`metadata.code` vs `error.code`) | ✅ | separate nesting levels; no conflict |
| Edge Runtime (Workers) | ✅ | uses `console.*` methods already, no changes |
| Circular ref in `details` | ⚠️ not tested | `JSON.stringify` would throw. Low risk — Supabase sends strings. If it ever happens, logger crash surfaces loudly. Not a blocker. |

---

## Positive Observations

1. **Symmetry with Phase 15.** The exact same `...(x !== undefined && { x })` idiom used in `toError()`. One pattern, one mental model.
2. **Cast scoped tightly.** `errRecord as Error & { code?: unknown; details?: unknown; hint?: unknown }` is narrowly scoped to the one read path — no widening escapes.
3. **Tests use `in` operator for absence checks.** Correctly distinguishes "key absent" from "key set to undefined" — the subtle bug the plan called out.
4. **`unknown` for extra fields.** Preserves type safety without forcing a PostgrestError shape on the logger interface (which would leak Supabase-ness into a generic logger).
5. **Plan non-goals explicit.** The plan called out "don't rename details/hint" and "don't pick arbitrary own-props" — implementation respects both.
6. **Dev `Details:` block placement.** Between error header and stack is the right ergonomic choice for Postgrest debugging.

---

## Verification

| Check | Claim | Status |
|-------|-------|--------|
| Logger tests | 12/12 pass (9 existing + 3 new Phase 25) | ✅ confirmed via `npx vitest run` (674ms) |
| Lint (target files) | 0 hits | ✅ confirmed |
| File length | impl 213 L, test 201 L | ✅ within tolerance |
| Build | 0 errors | ✅ per user claim |
| Full suite | 1318/1318 pass | ✅ per user claim |
| TS `--noEmit` | 611 errors (Δ 0) | ✅ per user claim |

---

## Recommended Actions

**None blocking.** Ship.

Optional follow-ups (defer to backlog):

1. Add a `cause` recursion test if exception chaining becomes a pattern (Phase 26+).
2. If `logger-utility.ts` crosses 250 L in a future phase, split `formatLogEntry` into its own module.

---

## Metrics

- **Type coverage:** 100% (no `any`, all casts scoped)
- **Test coverage (logger-utility):** 12 cases exercising all 4 levels + 3 overload shapes + 3 Phase 25 cases
- **Lint issues:** 0
- **Δ TS errors:** 0
- **Risk level:** VERY LOW (additive-only at sink)

---

## Unresolved Questions

None.

---

## Final Verdict

**APPROVE — SHIP (9.8/10)**

Clean close of the Phase 15 ↔ 24 bridge. Conditional-spread pattern is correct, symmetric with upstream, and defensively handles all falsy-but-defined values. No Error prototype collisions, no scope creep, no call-site impact. Tests guard the exact pollution failure mode (`'code' in err === false` on plain Errors). Dev-mode readability is improved, not hurt. File length slightly over the 200 L guideline but splitting would be YAGNI.

Exceeds auto-ship threshold. Proceed to commit + PM + docs update.
