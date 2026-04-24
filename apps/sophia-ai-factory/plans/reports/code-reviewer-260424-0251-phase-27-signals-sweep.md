# Code Review — Phase 27 Wave 1: `getErrorMessage()` sweep (signals/)

**Verdict:** **APPROVE SHIP**
**Score:** **9.8/10**
**Critical:** 0 | **High:** 0 | **Medium:** 0 | **Low:** 0

---

## Scope

- 6 files / 7 mechanical replacements in `src/lib/signals/**`
- Pattern: `err instanceof Error ? err.message : String(err)` → `getErrorMessage(err)`
- 6 new imports (`getErrorMessage` from `@/lib/utils/to-error`)
- Zero logic changes, zero new call signatures, zero new exports

## Diff Verification

Confirmed via `git diff HEAD -- src/lib/signals/`:

| File | Hits | Import Added |
|---|---|---|
| `track.ts` | 1 | ✅ L12 |
| `posthog-capture.ts` | 1 | ✅ L8 |
| `ab-experiment.ts` | 1 | ✅ L8 |
| `feature-flags.ts` | 2 | ✅ L7 |
| `digest/telegram-poster.ts` | 1 | ✅ L14 |
| `digest/github-issue-poster.ts` | 1 | ✅ L14 |
| **Total** | **7** | **6** |

Grep for legacy pattern in `src/lib/signals/` → **0 remaining** ✅
Grep for `getErrorMessage` in `src/lib/signals/` → **7 usages + 6 imports** ✅

## Behavior Preservation Analysis

`getErrorMessage(v)` returns `toError(v).message`. Contract vs original ternary:

| Input case | Original `err instanceof Error ? err.message : String(err)` | New `getErrorMessage(err)` | Verdict |
|---|---|---|---|
| `Error` instance | `err.message` | `err.message` (same instance) | **IDENTICAL** |
| `string` | the string | `new Error(str).message` = the string | **IDENTICAL** |
| `null` / `undefined` / `number` / other | `"null"` / `"undefined"` / `"42"` / etc. | `new Error(String(v)).message` = same | **IDENTICAL** |
| PostgrestError-shape (`{message, code, ...}`) | `"[object Object]"` ⚠️ | actual `.message` string | **STRICTLY BETTER** (intentional Phase 25/26 fix) |

Logger metadata shape unchanged — still `{ error: string }`. All 7 call sites pass result to `logger.warn(..., { error: <string> })`, never throw further.

## Verification (already green)

- `npm run build` → 0 new TS errors (baseline 611, Δ 0) ✅
- `npm test` → 1321/1321 pass ✅
- `npm run lint src/lib/signals` → 0 errors, 3 pre-existing warnings on test files only ✅
- Grep residual ternary in signals/ → 0 ✅

## Risk Assessment

- **Fire-and-forget contexts preserved:** all 7 sites are in `catch` blocks that swallow (`track` IIFE, `captureServer` fire-and-forget, `flag` fallback, etc.). No throw-chain behavior modified.
- **Edge runtime safe:** `toError()` uses only `instanceof`, `typeof`, `Object.assign`, `String()` — all available on Cloudflare Workers. Already shipped in Phases 23–26 without incident.
- **Import path valid:** `@/lib/utils/to-error` exists (Phase 26), exports `getErrorMessage` alongside `toError`.
- **No async/await surface change:** `getErrorMessage` is sync; original ternary was sync; identical call site shape.

## Findings

None. This is a textbook mechanical refactor:
- DRY win: 7 copies of the same ternary collapsed to 1 helper.
- Observability win: PostgrestError-shaped logs now carry real `.message` instead of `"[object Object]"` (inherited from Phase 26 helper).
- Zero behavior surface exposed to callers.

## Positive Observations

- Import placement consistent (grouped with other `@/lib/utils/*` imports).
- All 6 files use the same canonical import form — no aliasing drift.
- Test suite (1321 tests) passed unchanged — proves logger metadata strings identical for all exercised paths.
- Phase plan explicitly scoped to `src/lib/signals/**` — Wave 2 (rest of codebase) kept out of this diff. Good blast-radius discipline.

## Recommended Actions

1. **SHIP** — auto-mode threshold (≥9.5, 0 critical/high) met.
2. Commit with `refactor(errors): Phase 27 Wave 1 — getErrorMessage() sweep in signals/`.
3. Proceed to Wave 2 (remaining occurrences codebase-wide) in a follow-up phase.

## Unresolved Questions

None.
