# Code Review — Phase 26 `getErrorMessage()` Helper

**Date:** 2026-04-24
**Scope:** `src/lib/utils/to-error.ts` (+13 lines), `src/lib/utils/to-error.test.ts` (+3 cases)
**Baseline verified:** 1321 pass, 0 TS delta, lint clean.

## Correctness Checks

1. **PostgrestError inheritance** — `getErrorMessage({message: "x", code: "42P01"}) === "x"`. Delegation to `toError()` routes through the object-with-string-message branch (to-error.ts:17-34), returning `.message`, NOT `"[object Object]"`. Tested (test line 86-89).
2. **Function-call indirection** — Negligible. V8 inlines trivial one-liners; even un-inlined, call overhead is nanoseconds vs. the Error allocation already inside `toError()`. No hot-path concern.
3. **Naming collision** — One local `function getErrorMessage(code: string)` exists in `youtube-connection-settings.tsx:149` (module-scoped, NOT exported, different signature `string→string` vs new `unknown→string`, different domain = OAuth error-code lookup). No runtime conflict. If that file later imports the helper, local scope shadows — minor readability, not a bug. No common-lib clash (not in lodash/ramda/@types/node).
4. **JSDoc clarity** — Good: explains purpose (ternary shortcut), delegation chain (via toError), PostgrestError robustness guarantee, and when to use (logging metadata vs full Error). Consistent voice with existing `toError()` JSDoc.

## Observations

- Pure additive, zero consumers today → zero regression surface.
- Tests cover the 3 critical paths (Error identity, string primitive, PostgrestError). Sufficient given `toError()` already has 9 tests covering the underlying logic.
- KISS/DRY/YAGNI respected: co-located in existing file, no new module.
- Sophia quality gates met: no `:any`, no `console.log`, TS strict-safe, <200 LOC file (50 lines total).

## Issues

- **BLOCK:** none
- **CRITICAL:** none
- **HIGH:** none
- **MEDIUM:** none
- **LOW:** (optional) consider renaming the YouTube component's local helper to `getYouTubeOAuthErrorMessage()` in a future cleanup to avoid shadow risk. NOT a ship blocker.

## Recommendation

Ship it. Phase 27+ sweep can proceed with confidence.

VERDICT: APPROVE SHIP — score 9.8/10
