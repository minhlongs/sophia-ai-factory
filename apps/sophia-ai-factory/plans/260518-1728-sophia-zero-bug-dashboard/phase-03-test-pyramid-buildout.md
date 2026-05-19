# Phase 03 — Test Pyramid Build-Out

## Context Links

- Plan: `./plan.md`
- Synthesis: `./tech-stack-synthesis.md` §2.2 (layers), §9 items 4, 9-11
- Stack: `./research/researcher-04-zero-bug-stack.md` §2 (pyramid), §3 (CI gates), §4 (effort)
- Audit: `./research/researcher-01-existing-dashboard-audit.md` §3 (coverage gap)
- Deploy verify: `apps/sophia-ai-factory/.claude/rules/sophia-deploy-verify.md`

## Overview

- **Priority:** P1 (delivers acceptance criteria 4, 9-11)
- **Status:** pending
- **Duration:** 11 dev-days (4 verify + 7 wire; tracks A/B/C parallelizable)
- **Goal:** raise `/dashboard` test coverage to acceptance bar — verify existing, then wire a11y + visual + contract + smoke layers.

## Key Insights

- Foundations from Phase 01 in place (a11y fixture, visual fixture, coverage thresholds)
- Security gates from Phase 02 in place (`getCurrentUser` + `requireMasterTier`) — tests need to stub these
- 18 E2E suites already exist — verify gap, do not duplicate
- Sub-tracks A (a11y+visual), B (contract+coverage), C (integration smoke) can parallelize
- Snapshot regen is intentional via `--update-snapshots`, never automatic

## Requirements

**Functional**
- 5 critical routes have a11y assertions (WCAG 2.1 AA, 0 serious/critical)
- Same 5 routes have visual snapshot baselines
- 10 high-risk API routes have Zod-based contract tests
- Coverage threshold enforced via pre-push gate (build fails below 65/50/60/65)
- Pre-deploy invokes Playwright smoke (`--grep "smoke"`)
- Post-deploy smoke runs against PROD URL (3 tests)

**Non-functional**
- `.claude/skills/zod-contract-test-generator/` skill scaffold so contract tests are easy to add long-term
- Snapshot churn budget: any unintentional diff blocks PR

## Architecture

```
Track A — a11y + visual
  tests/e2e/dashboard-{overview,settings,admin,api-keys,affiliate}.spec.ts
    use a11y-test fixture + visual-test fixture from Phase 01

Track B — contract + coverage
  .claude/skills/zod-contract-test-generator/SKILL.md   ← scaffold spec
  src/app/api/*/__tests__/<route>.contract.test.ts      ← 10 routes
  pre-push G3 now reads coverage threshold from vitest.config.ts

Track C — integration smoke
  tests/e2e/smoke/critical-paths.spec.ts                 ← 3 tests, tagged @smoke
  scripts/deploy-with-sha.sh                             ← appends post-deploy smoke run
```

## Related Code Files

**Create**
- `.claude/skills/zod-contract-test-generator/SKILL.md`
- `tests/e2e/dashboard-overview.spec.ts`
- `tests/e2e/dashboard-settings.spec.ts`
- `tests/e2e/dashboard-admin.spec.ts`
- `tests/e2e/dashboard-api-keys.spec.ts`
- `tests/e2e/dashboard-affiliate.spec.ts`
- `tests/e2e/smoke/critical-paths.spec.ts`
- ~10 contract test files under `src/app/api/**/__tests__/<route>.contract.test.ts`

**Modify**
- `scripts/deploy-with-sha.sh` — append post-deploy smoke invocation
- `vitest.config.ts` — coverage threshold enforce on (was 0 in Phase 01)
- `.husky/pre-push` — wire coverage gate into G3 (or new G3b); update doc comment

## Implementation Steps

### Verify-existing track (4 days)

1. Run `npx playwright test` locally; capture pass rate + per-suite duration → save `reports/phase-03-baseline-e2e.json`.
2. Audit the 18 E2E files; map gap per surface (Customer / Ops / RaaS / Agent). Output: `reports/phase-03-e2e-gap-map.md`.
3. Sample 10 API routes from each domain (auth, billing, payouts, BYOK, tier, agent, mission, refund, SOP, payments). For each: check Zod schema is exported + has at least 1 test.
4. Run `npm run test:coverage:dashboard`; record %  per surface in `reports/phase-03-coverage-by-surface.md`.
5. Document pre-push gate reliability: 10 consecutive runs of `npm run lint && npm test`, fail-rate + false-positive rate.

### Track A — a11y + visual (3 days)

6. Add a11y checks to 5 critical E2E flows: `dashboard/overview`, `dashboard/settings`, `dashboard/admin` (root), `dashboard/api-keys`, `dashboard/affiliate/payouts`. Each spec imports a11y-test fixture from Phase 01 and asserts `checkA11y` with `{ rules: { region: { enabled: true } } }` and 0 serious/critical violations.
7. Capture `.toHaveScreenshot()` baselines for same 5 routes; commit snapshots under `tests/e2e/__snapshots__/`.
8. Document baseline WCAG violations + design-required suppressions in `docs/a11y-baseline.md` (axe rule disable list with rationale).

### Track B — contract + coverage (4 days)

9. Scaffold `.claude/skills/zod-contract-test-generator/`:
   - `SKILL.md` — purpose, inputs (route file path), outputs (vitest contract test file)
   - Parses route file via ts-morph → extracts ZodSchema literal → generates test file template that asserts:
     - valid input passes
     - 5 invalid input variants fail with expected ZodError
     - response shape matches inferred type
10. Generate contract tests for 10 high-risk API routes:
    - `auth/callback` (Better Auth)
    - `billing/checkout`
    - `webhooks/nowpayments-payout` (IPN)
    - `byok/keys` (save)
    - `tier/upgrade`
    - `payouts/request`
    - `agents/run`
    - `missions/create`
    - `sops/install`
    - `refunds/create`
11. Wire coverage threshold enforcement in pre-push:
    - update `vitest.config.ts` `coverage.thresholds` from baseline → 65/50/60/65 (or `max(baseline, target)` ratcheting)
    - pre-push G3 fails if below
12. Add `playwright test --grep "@smoke"` to `scripts/deploy-with-sha.sh` BEFORE wrangler invocation (pre-deploy gate P4 in researcher-04 §3).

### Track C — integration smoke (2 days)

13. Author `tests/e2e/smoke/critical-paths.spec.ts` — 3 tests tagged `@smoke`:
    - account-load: `/dashboard` loads, user is rendered
    - billing-status: `/dashboard/billing` shows current tier
    - admin-access-denied: non-MASTER user redirected from `/dashboard/admin`
14. Append post-deploy smoke run to `scripts/deploy-with-sha.sh`:
    - after SHA match passes, `PLAYWRIGHT_TEST_BASE_URL=https://sophia.agencyos.network npx playwright test --grep "@smoke"`
    - fail script with exit 1 if smoke fails (rollback responsibility separate)
15. Update `.husky/pre-push` doc comment with new E2E timing expectations.
16. POC contract test for `/api/health` endpoint using skill from step 9 — serves as living example.

## Todo List

Verify-existing
- [ ] Capture E2E baseline → `reports/phase-03-baseline-e2e.json`
- [ ] Map 18 E2E suite gap → `reports/phase-03-e2e-gap-map.md`
- [ ] Audit Zod schema coverage on 10 routes
- [ ] Record coverage % per surface
- [ ] Document pre-push gate reliability

Track A
- [ ] `dashboard-overview.spec.ts` with a11y + visual
- [ ] `dashboard-settings.spec.ts` with a11y + visual
- [ ] `dashboard-admin.spec.ts` with a11y + visual
- [ ] `dashboard-api-keys.spec.ts` with a11y + visual
- [ ] `dashboard-affiliate.spec.ts` with a11y + visual
- [ ] Commit 5 visual snapshot baselines
- [ ] Author `docs/a11y-baseline.md`

Track B
- [ ] Scaffold `.claude/skills/zod-contract-test-generator/SKILL.md`
- [ ] Generate 10 contract test files
- [ ] Ratchet `vitest.config.ts` thresholds
- [ ] Pre-push G3 enforces coverage
- [ ] Append pre-deploy smoke to `deploy-with-sha.sh`

Track C
- [ ] Author `tests/e2e/smoke/critical-paths.spec.ts` (3 tests)
- [ ] Append post-deploy smoke to `deploy-with-sha.sh`
- [ ] Update `.husky/pre-push` doc
- [ ] POC contract test for `/api/health`

## Success Criteria

Covers `tech-stack-synthesis.md` §9 acceptance items 4, 9, 10, 11:

- Vitest coverage `/dashboard` ≥ 65% lines, 50% branches, 60% functions, 65% statements (enforced)
- `@axe-core/playwright` — 0 serious/critical WCAG 2.1 AA on 5 critical routes
- `.toHaveScreenshot()` baselines committed and stable (no unintended diffs)
- 10 Zod contract tests pass
- Pre-deploy smoke runs locally as part of `scripts/deploy-with-sha.sh`
- Post-deploy smoke runs against PROD; SHA match still mandatory upstream

## Risk Assessment

| Risk | Likelihood | Mitigation |
|---|---|---|
| Snapshot churn during active dev | High | Snapshots regenerate only on `--update-snapshots`; reviewer checks intent |
| a11y scan reveals 50+ existing violations | Medium | Triage by severity; suppress design-required in `docs/a11y-baseline.md`; gate only on serious/critical |
| Coverage threshold blocks unrelated PRs | Medium | Start at baseline + ratchet per surface; allow per-file override comment if justified |
| Contract test scaffold over-generates | Medium | Skill outputs template only — human curates inputs/expected errors |
| Post-deploy smoke flaky against PROD | Medium | 3 tests only, fast; if flake observed, retry once before failing |
| ts-morph + Zod 4 incompat | Low | POC `/api/health` route first; fallback to manual scaffold if blocks |

## Security Considerations

- Indirect: contract tests catch input-validation regressions earlier
- Direct security work lives in Phase 02
- Smoke tests MUST NOT log auth tokens or full request bodies; redact in helpers
- Contract test inputs for IPN webhook MUST use stub HMAC secret, never real `NOWPAYMENTS_IPN_SECRET`

## Next Steps

- Plan complete; deferred queue per `./plan.md` §"Deferred"
- Next iteration candidate: Phase 02 i18n full migration (P4) once Phase 03 catches regressions reliably

## Unresolved Questions

1. Coverage ratchet cadence — bump every PR (CI fail if not improving) or quarterly review?
2. a11y suppression review — who owns design rule disable list long-term?
3. Smoke test failure mode — should `deploy-with-sha.sh` auto-rollback or just fail loudly?
4. Contract test for IPN — using stub HMAC means we don't test real signature verify path. Acceptable, or add separate integration suite?
5. Skill `.claude/skills/zod-contract-test-generator/` — committed to repo or operator-only? Doctrine implies repo OK since no operator creds involved.
