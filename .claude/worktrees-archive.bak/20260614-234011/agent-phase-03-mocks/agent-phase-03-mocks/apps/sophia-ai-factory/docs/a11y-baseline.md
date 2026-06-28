# A11y Baseline — Sophia AI Factory Dashboard

## Purpose

This document governs the WCAG 2.1 AA accessibility gate for the five critical dashboard routes:

- `/dashboard` (overview)
- `/dashboard/settings`
- `/dashboard/admin`
- `/dashboard/api-keys`
- `/dashboard/affiliate`

The gate is enforced in CI via Playwright E2E specs in `tests/e2e/dashboard-*.spec.ts`.
Tests fail on `serious` or `critical` violations; `minor` and `moderate` are reported only.

## Severity Policy

| Impact    | CI behavior    | Action required           |
|-----------|----------------|---------------------------|
| critical  | FAIL — blocks  | Fix before merge          |
| serious   | FAIL — blocks  | Fix before merge          |
| moderate  | WARN — reports | Fix within current sprint |
| minor     | WARN — reports | Fix in next sprint        |

This maps to axe-core's `impact` field. Controlled via `checkA11y(page, { failOn })` in
`tests/e2e/_fixtures/a11y-test.ts`.

## Suppressed Rules

No rules are suppressed at project baseline as of Phase 03 initial commit.

Suppressions will be added here as the first scan runs and design-required exceptions
are identified. Each entry must include:

| Rule ID | Affected routes | Rationale | Suppressed since | Owner |
|---------|-----------------|-----------|------------------|-------|
| *(none)* | — | — | — | — |

### How to add a suppression

1. Identify the axe rule ID (e.g. `color-contrast`) from the violation report.
2. Confirm the violation is design-required (not a code bug) — get sign-off from design owner.
3. Add a row to the table above with route(s), rationale, date, and owner.
4. Update the relevant spec: `await checkA11y(page, { disabledRules: ['rule-id'] })`.
5. PR description must link back to this file.

### Design-required vs fixable

- **Design-required (suppressible):** Brand color contrast below 4.5:1 in decorative badges
  where the text is non-informational and a visible alternative is present.
- **Not suppressible:** Form labels missing, keyboard navigation broken, ARIA roles wrong.
  These MUST be fixed, not suppressed.

## Rescan Cadence

- **Phase 03 commits:** Every spec run (automated on PR/push when E2E env is configured).
- **Quarterly review:** Suppress list reviewed for staleness; any rule suppressed >90 days
  without a ticket for design update is escalated.
- **After major UI changes:** Manual re-run with `--update-snapshots` to refresh visual
  baselines; a11y scan re-runs automatically.

## Running the Scans

```bash
# Full a11y + visual suite (requires running dev server + auth env):
E2E_TEST_USER_PASSWORD=<password> npx playwright test tests/e2e/dashboard-*.spec.ts

# Regenerate visual snapshots after intentional design changes:
E2E_TEST_USER_PASSWORD=<password> npx playwright test --update-snapshots tests/e2e/dashboard-*.spec.ts

# View axe violation detail (add --reporter=html):
npx playwright test tests/e2e/dashboard-overview.spec.ts --reporter=html
```

## Ownership

- A11y fixture: `tests/e2e/_fixtures/a11y-test.ts`
- Visual fixture: `tests/e2e/_fixtures/visual-test.ts`
- Suppress list owner: lead frontend developer + design lead (joint sign-off required)
- Quarterly review trigger: Phase milestone or quarterly engineering review

## References

- WCAG 2.1 AA: https://www.w3.org/TR/WCAG21/
- axe-core rules: https://dequeuniversity.com/rules/axe/4.10
- `@axe-core/playwright`: https://github.com/dequelabs/axe-core-npm/tree/develop/packages/playwright
