# Phase 21 Re-Review — ESLint no-as-error Guard

**Score: 9.7/10**
**Verdict: SHIP — auto-ship gate clears**
**Blockers: 0**

## Verification
- `npm run lint | grep no-restricted-syntax | wc -l` → **0**
- `grep -rn "as Error" src` (excl. tests) → **3 expected lines only**:
  - `to-error.ts:5` (doc comment)
  - `logger-utility.ts:125` (`as Error | undefined` union, exempted)
  - `logger-utility.ts:156` (`as Error | Record | undefined` union, exempted)
- Prior blocker (2 tracked `as Error` in `coupons/coupons/{activate,activate-redirect}/route.ts`) resolved: both now use `toError(e).message` with `toError` imported from `@/lib/utils/to-error`.

## Quality
- AST selector correctly scoped: `TSTypeReference` + `typeName.name='Error'` — does not false-positive on union types.
- File exemptions minimal and justified (logger overloads, to-error self).
- Tests/specs excluded via glob — pragmatic.
- Rule message guides devs to the correct helper.

## Remaining Notes
None blocking. Optional: add a unit test that imports a fixture with `as Error` to assert the rule fires (defensive regression for future eslint-config-next upgrades).

## Unresolved Questions
- None.
