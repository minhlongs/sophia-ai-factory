# Phase 15 — `toError()` Preserves Supabase `PostgrestError` Shape

**Status:** ✅ COMPLETE (2026-04-20)
**Priority:** P2 (Tech-debt polish — Phase 14 reviewer recommendation)
**Session:** CLOSED

## Scope

Teach `toError()` to recognize Supabase `PostgrestError`-like objects and preserve
`message` + `code`/`details`/`hint` fields, so `logger.error()` logs actionable
error info instead of `Error("[object Object]")`.

### Problem (observed in Phase 14)

The 6 latent raw-Supabase sites in `realtime-alert-service.ts` (lines 161/197/233/274/305/515)
were wrapped via `toError(error)`. Because `toError()` falls to `new Error(String(value))`,
a PostgrestError-like object collapses to `Error("[object Object]")` — losing `message`,
`code`, `details`, `hint` that Supabase returns.

### Target

`src/lib/utils/to-error.ts` — extend narrowing to handle `{ message: string, code?, details?, hint? }`.

## Approach

```diff
 export function toError(value: unknown): Error {
   if (value instanceof Error) return value
   if (typeof value === 'string') return new Error(value)
+
+  // PostgrestError-like shape — object with string `message`.
+  // Preserve message + supabase fields (code/details/hint) for logging.
+  if (
+    value !== null &&
+    typeof value === 'object' &&
+    'message' in value &&
+    typeof (value as { message: unknown }).message === 'string'
+  ) {
+    const src = value as {
+      message: string
+      code?: unknown
+      details?: unknown
+      hint?: unknown
+    }
+    return Object.assign(new Error(src.message), {
+      ...(src.code !== undefined && { code: src.code }),
+      ...(src.details !== undefined && { details: src.details }),
+      ...(src.hint !== undefined && { hint: src.hint }),
+    })
+  }
+
   return new Error(String(value))
 }
```

**Why this shape:**
- Primary win — `.message` no longer becomes `"[object Object]"`; logger prints Supabase's real message.
- Bonus — `code`/`details`/`hint` attached as enumerable own-properties, ready for future logger enhancement (e.g., structured Supabase metadata).
- `Object.assign` keeps it a single expression, no mutation of `err` scattered across lines.

## Non-Goals

- Teaching `logger-utility.ts` to pick up `code`/`details`/`hint` — separate YAGNI; defer until a caller demands it.
- Migrating more `as Error` sites — Phase 16+ continues the slice pattern.
- Narrowing `AuthError` (`{ message, status }`) specifically — the same PostgrestError-like branch handles it because `message` is `string`.

## Files to Edit

- `src/lib/utils/to-error.ts` — extend narrowing (see Approach)
- `src/lib/utils/to-error.test.ts` — add 3 cases: PostgrestError full-shape, partial-shape (only `code`), AuthError-shape (`message` + `status`)

## Success Criteria

- [x] Build: 0 new TS errors
- [x] Tests: +3 new (1306 total); 100% pass
- [x] Lint: 0 new errors on edited files
- [x] `toError({ message: 'x', code: '42P01' })` → `Error('x')` with `.code === '42P01'`
- [x] `toError({ message: 'x' })` → `Error('x')` (no extra fields when not present)
- [x] Original identity preserved for real `Error` instances
- [x] Code review score ≥9.5/10 APPROVE → auto-ship ✅ 9.7/10 SHIP
- [x] CI GREEN + Production HTTP 200

## Results (2026-04-20)

| Metric | Value |
|--------|-------|
| Files Edited | 2 (`to-error.ts`, `to-error.test.ts`) |
| Behavior Improvement | PostgrestError logs real `.message` instead of `"[object Object]"` |
| New Tests | 3 (full PostgrestError, partial PostgrestError, AuthError-like) |
| Tests | 1306/1306 (1303 Phase 14 baseline + 3 new) |
| TSC Errors | 0 new on changed files |
| Lint Errors | 0 new on changed files |
| Code Review | 9.7/10 APPROVE SHIP |
| Reviewer Nits (non-blocking) | Edge tests `{message:123}`/`{message:null}` verified manually but not scripted; `code:null` preserved vs `undefined` stripped asymmetry (expected JS spread semantics) — defer to Phase 16 polish if/when needed |

## Risk Assessment

- **Risk:** VERY LOW — pure additive narrowing; existing 6 `toError` cases unaffected.
- **Rollback:** revert-safe.
- **Behavior improvement only** — previously `Error("[object Object]")`, now `Error("<supabase message>")`.

## Deferred (Phase 16+ backlog)

- Teach logger to serialize `code`/`details`/`hint` when present on Error
- Remaining ~160 `as Error` sites (slices ~30 each)
- 244 `instanceof Error` ternary simplifications
- `ClientWithStorage` → R2 migration (runtime bug in `report-delivery.ts`)
- ESLint rule to enforce `toError()` over `as Error`
- `raas_licenses` D1-vs-Supabase audit
