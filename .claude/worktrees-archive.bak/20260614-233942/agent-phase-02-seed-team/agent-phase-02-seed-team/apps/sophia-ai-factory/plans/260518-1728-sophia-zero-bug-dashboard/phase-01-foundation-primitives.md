# Phase 01 — Foundation Primitives

## Context Links

- Plan: `./plan.md`
- Synthesis: `./tech-stack-synthesis.md` §2.2 (test pyramid), §2.6 (gate sequence)
- Audit: `./research/researcher-01-existing-dashboard-audit.md` §2 (flake at row 10)
- Stack: `./research/researcher-04-zero-bug-stack.md` §1, §2
- Deploy verify: `apps/sophia-ai-factory/.claude/rules/sophia-deploy-verify.md`

## Overview

- **Priority:** P0 (blocks 02 + 03)
- **Status:** pending
- **Duration:** 2-3 dev-days
- **Goal:** install test layers + fix known NOWPayments flake + capture baseline coverage.

## Key Insights

- a11y + visual + contract layers are MISSING; everything else in pyramid exists
- Coverage thresholds currently 0 (unenforced) — must start at baseline, ratchet later
- `nowpayments-payout/route.test.ts:74` flake risk: masks real IPN async bug; debug first
- Husky pre-push 5-gate already wired (G1-G5); coverage gate added later in 03, not 01

## Requirements

**Functional**
- a11y fixture wraps Playwright `test` to inject axe + run `checkA11y`
- visual fixture exports a `test` that auto-masks dynamic regions + disables animations
- coverage report runs for `src/app/[locale]/dashboard/**` and fails build below thresholds

**Non-functional**
- Thresholds start at observed baseline + 0 — DO NOT block PRs on day 1
- All new dev-deps locked in `package.json` `devDependencies`
- No SaaS introduced (no Chromatic, no Percy)

## Architecture

```
tests/e2e/fixtures/
  a11y-test.ts      → wraps @playwright/test; exports `test` w/ injectAxe before
  visual-test.ts    → wraps @playwright/test; exports `test` w/ mask + animations:'disabled'

vitest.config.ts
  coverage:
    include: ['src/app/[locale]/dashboard/**']
    thresholds: { lines: 65, branches: 50, functions: 60, statements: 65 }
```

## Related Code Files

**Modify**
- `vitest.config.ts` — add `coverage.thresholds` scoped to dashboard
- `package.json` — add `test:coverage:dashboard` script + `@axe-core/playwright` devDep
- `src/app/api/webhooks/nowpayments-payout/__tests__/route.test.ts:74` — debug + fix
- `.husky/pre-push` — doc-only update (no behavior change yet)

**Create**
- `tests/e2e/fixtures/a11y-test.ts`
- `tests/e2e/fixtures/visual-test.ts`

**Delete:** none.

## Implementation Steps

1. Reproduce flake locally: `npx vitest run src/app/api/webhooks/nowpayments-payout/__tests__/route.test.ts` ≥3x. Capture stack + IPN mock setup.
2. Root-cause: likely `vi.useFakeTimers()` interaction or async `await` missing on IPN handler return. Fix without lowering assertion strictness; if mock is racing, switch to `await waitFor()` or explicit `flushPromises()`.
3. Add `@axe-core/playwright` to devDeps: `npm i -D @axe-core/playwright`.
4. Create `tests/e2e/fixtures/a11y-test.ts`:
   - extends `@playwright/test`
   - `beforeEach`: `await injectAxe(page)`
   - exposes `checkA11y(page, opts?)` helper with default WCAG 2.1 AA + `serious|critical` failure threshold
5. Create `tests/e2e/fixtures/visual-test.ts`:
   - extends `@playwright/test`
   - default screenshot options: `animations: 'disabled'`, default mask selectors (toast, timestamp, avatar img)
   - exports `expectSnapshot(page, name)` thin wrapper
6. Update `vitest.config.ts` — add coverage.include for dashboard + thresholds (start at observed; record baseline in commit message).
7. Add `npm run test:coverage:dashboard` script invoking `vitest run --coverage` with dashboard scope.
8. Capture baseline coverage % per surface (Customer / Admin / RaaS / Agent / Help) — emit a `phase-01-baseline.json` artefact in `./reports/` for phase 03 reference.
9. Pre-push doc update: add comment noting "G3 will enforce coverage in Phase 03". No behavior change.

## Todo List

- [ ] Reproduce + log NOWPayments flake (3+ runs)
- [ ] Land fix for `route.test.ts:74` (no flakiness reintroduced)
- [ ] `npm i -D @axe-core/playwright`
- [ ] Write `tests/e2e/fixtures/a11y-test.ts`
- [ ] Write `tests/e2e/fixtures/visual-test.ts`
- [ ] Add coverage thresholds to `vitest.config.ts`
- [ ] Add `test:coverage:dashboard` script
- [ ] Run baseline coverage + save `reports/phase-01-baseline.json`
- [ ] Update `.husky/pre-push` doc comment
- [ ] Verify `npm run build` + `npm test` still green

## Success Criteria

- a11y + visual fixtures importable from `tests/e2e/fixtures/`
- `npm run test:coverage:dashboard` exits 0 at baseline (not 1)
- `nowpayments-payout/route.test.ts` passes 5/5 consecutive runs
- Baseline coverage report saved + reviewed
- `npm run build` + `npm test` + pre-push gate all green

## Risk Assessment

| Risk | Likelihood | Mitigation |
|---|---|---|
| Threshold set too aggressively → block PRs day 1 | Medium | Start AT observed baseline (no headroom); ratchet in phase 03 |
| NOWPayments flake masks real bug | Medium | Treat root-cause analysis as mandatory; don't `.skip()` |
| `@axe-core/playwright` peer-dep clash | Low | Pin exact version; verify `npx playwright --version` post-install |
| Visual fixture default mask too permissive | Low | Mask only known-dynamic regions; review snapshots manually before commit |

## Security Considerations

- N/A for fixtures (test code only)
- Confirm NOWPayments IPN test does NOT use real webhook secret — should be a stub constant

## Next Steps

- Unblocks Phase 02 (security gate uses no new infra) AND Phase 03 (which depends on a11y/visual fixtures + coverage gate)

## Unresolved Questions

1. Coverage thresholds at 65/50/60 — should we lower starting threshold if observed baseline is < 65%? Decision rule: start at `max(observed - 2pp, 50)`.
2. a11y `disabledRules` list — do we suppress design-required rules now or document and defer to Phase 03?
3. Visual snapshot baseline branch — capture on `main` or per-PR? Recommend `main` and regenerate intentionally.
4. Pre-push G3 budget impact — adding coverage to G3 may push pre-push past 95s ceiling. Acceptable?
5. NOWPayments flake — if root cause requires touching prod handler (not just test), do we ship the handler change in this phase or split?
