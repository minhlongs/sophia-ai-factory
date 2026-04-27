# Code Review — Phase 29 B2 TS2304 Quick-Win Cleanup

**Date:** 2026-04-26 12:45
**Reviewer:** code-reviewer agent
**Scope:** 3 files (vi import + 2 IntlFormat type aliases)
**Verdict:** APPROVED — Score 9.7/10

---

## Scope

- `src/test/setup.tsx` — added `import { vi } from 'vitest'`
- `src/app/[locale]/dashboard/campaigns/[id]/components/campaign-details-sidebar.tsx` — added IntlFormat type alias via `Awaited<ReturnType<typeof getFormatter>>`
- `src/app/[locale]/dashboard/campaigns/[id]/components/campaign-header.tsx` — same pattern, replaces broken `import type { IntlFormat } from 'intl'`

**Diff size:** +8 / -1 lines across 3 files.

---

## Verification Results

### TS Error Count
- Total TS errors: **280 → 251** (delta -29 confirmed)
- Remaining `TS2304/TS2307`: **5** (all pre-existing, unrelated to Phase 29 — `@/components/ui/scroll-area`, `./commerce`, `./index` x3 in worker/lib metering-reconciler)
- Phase 29 fully eliminates the 27 vi + 1 IntlFormat (TS2304) + 1 broken `intl` import (TS2307) it targeted.

### Vitest Config Check
- `vitest.config.ts`: `globals: true` — confirms `vi` works at runtime via global injection
- `tsconfig.json`: NO `"types": ["vitest/globals"]` declared — TypeScript was correctly complaining about undefined `vi`
- **Adding explicit `import { vi } from 'vitest'` is the correct fix** (safer than adding global types — keeps imports explicit, no hidden ambient side effects)

### Type Alias Correctness
- `getFormatter` is a server-side async function from `next-intl/server`
- Callsite (`page.tsx:34`): `const format = await getFormatter();` — uses awaited result
- Type `Awaited<ReturnType<typeof getFormatter>>` correctly resolves to formatter object exposing `.dateTime`, `.number`, `.relativeTime`, `.list`
- Both consumers (`sidebar`, `header`) call `format.dateTime(...)` — type compatibility verified

### Protected Flows
- Setup Wizard: NOT touched
- Telegram Bot: NOT touched
- Payment Flow (NOWPayments IPN): NOT touched
- All Phase 29 changes confined to test setup + campaign detail UI components

### Caller Compatibility
- Only consumer of both components: `src/app/[locale]/dashboard/campaigns/[id]/page.tsx`
- Caller already passes `await getFormatter()` result as `format` prop
- Zero breaking changes to public API

---

## Issues

### Critical: 0
None.

### Major: 0
None.

### Minor: 1

**M1. DRY opportunity (deferred per YAGNI).**
The `type IntlFormat = Awaited<ReturnType<typeof getFormatter>>` definition is duplicated across `campaign-header.tsx` and `campaign-details-sidebar.tsx`. Could be extracted to `src/types/intl.ts` (or `src/lib/intl-types.ts`) as a shared type. **Recommendation: defer.** Two occurrences only; YAGNI applies. If a 3rd component needs it, extract then.

---

## Positive Observations

1. **Best-practice fix for `vi`.** Explicit import is preferred over `vitest/globals` type ambient — avoids polluting global namespace, makes test files self-documenting. Aligns with Sophia rule "no `:any` / no implicit globals."
2. **Bonus bug fix.** The pre-existing `import type { IntlFormat } from 'intl'` in `campaign-header.tsx` was *importing from a non-existent export of the `intl` npm package* — pure noise that would have surfaced as a real bug if anyone ever used `IntlFormat` for a runtime narrowing. Phase 29 removes both noise AND latent rot.
3. **Canonical pattern.** `Awaited<ReturnType<typeof getFormatter>>` is exactly the next-intl team's recommended pattern (per docs). Future-proof against next-intl version bumps.
4. **Behavior preservation.** Zero runtime changes; type-only diff. Test count expectation 1398/1398 PASS is reasonable — `vi` was already working via global injection.
5. **Surgical scope.** No drive-by edits, no scope creep. Three files, one purpose per file.

---

## Edge Cases Considered

- **Vitest global injection vs explicit import collision:** No conflict. With `globals: true` AND explicit import, both resolve to same `vi` instance. No runtime change.
- **next-intl version bumps:** `Awaited<ReturnType<typeof getFormatter>>` will track upstream changes automatically — no hardcoded interface to maintain.
- **Server vs Client component boundary:** Both campaign components are pure presentational (no `"use server"` / `"use client"` directive observed). They receive `format` as prop from server-rendered `page.tsx`. Type alias is purely structural — no runtime SSR/CSR concerns.
- **Strict mode compatibility:** `tsconfig.json` has `"strict": true`. Both new type aliases compile under strict mode without `any`.
- **Test setup.tsx ordering:** `import { vi } from 'vitest'` placed after docblock comment, before any `vi.fn()` / `vi.mock()` usage. Hoisting concerns N/A (vi.mock auto-hoists regardless of import position; explicit import hoists correctly per ESM spec).

---

## Sophia Standards Compliance

| Standard                                  | Status |
| ----------------------------------------- | ------ |
| No `:any` types in production code        | PASS   |
| No `console.log` in production code       | PASS   |
| Canonical import paths (no banned legacy) | PASS   |
| Tier enum uppercase                       | N/A    |
| Zod validation on API inputs              | N/A    |
| Server Actions for mutations              | N/A    |
| Files under 200 LOC                       | PASS (setup.tsx ~50 lines visible, both components < 100) |
| Modularization                            | PASS   |

---

## Metrics

- TS Error Reduction: 280 → 251 (-29, 10.4% improvement)
- Files Modified: 3
- LOC Delta: +8 / -1
- Behavior Risk: ZERO (type-only)
- Test Coverage Impact: NONE
- Build Risk: ZERO

---

## Recommended Actions

1. **MERGE** — Quick-win cleanup with zero risk and clear benefit.
2. **OPTIONAL FOLLOW-UP** — Consider adding `"types": ["vitest/globals"]` to `tsconfig.json` `compilerOptions` IF other test files have ambient `vi`/`describe`/`it` references that still error. Phase 29 fixed setup.tsx specifically; verify next phase whether other test files need same treatment or already use explicit imports.
3. **DEFER** — Shared `IntlFormat` type extraction (M1). Wait for 3rd usage.

---

## Score Breakdown

| Category              | Score | Note                                          |
| --------------------- | ----- | --------------------------------------------- |
| Correctness           | 10/10 | Both fixes are canonically correct            |
| Type Safety           | 10/10 | Strict-mode clean; no `any`                   |
| Behavior Preservation | 10/10 | Type-only, zero runtime risk                  |
| Maintainability       | 9/10  | Minor DRY opportunity (deferred)              |
| Scope Discipline      | 10/10 | No scope creep                                |
| Sophia Compliance     | 10/10 | All standards met                             |
| **TOTAL**             | **9.7/10** | **AUTO-APPROVE (≥9.5, 0 critical)** |

---

## Auto-Approval Decision

- Threshold: ≥9.5 with 0 critical
- Achieved: 9.7 with 0 critical, 0 major, 1 minor (deferred)
- **DECISION: AUTO-APPROVED**

---

## Unresolved Questions

1. Are there OTHER test files (beyond `setup.tsx`) still relying on ambient `vi` global that emit TS2304? If yes, Phase 30 should sweep them (or add `"types": ["vitest/globals"]` to tsconfig as a single-line alternative covering all test files).
2. The 5 remaining TS2307 errors (`@/components/ui/scroll-area`, `./commerce`, `./index` x3) are pre-existing — should they be triaged into a follow-up Phase 30 quick-win batch?
