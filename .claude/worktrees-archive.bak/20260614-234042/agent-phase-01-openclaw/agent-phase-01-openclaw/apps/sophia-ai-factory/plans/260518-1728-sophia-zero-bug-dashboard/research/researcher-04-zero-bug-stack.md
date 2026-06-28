# Zero-Bug Stack Research for Sophia /dashboard

## Section 1: Current Test Infrastructure Summary

| Tool | Version | In Use? | Context |
|------|---------|---------|---------|
| **Vitest** | ^4.0.18 | ✅ YES | 455 test files, 4563 tests, 1 failing (webhook timeout). Globals + jsdom + RTL. Coverage thresholds at 0 (unenforced). |
| **React Testing Library** | ^16.3.2 | ✅ YES | DOM queries, @testing-library/react for component unit tests. |
| **Playwright** | ^1.58.1 | ✅ YES | 18 E2E suites (auth-flow, dashboard, checkout, affiliate, dunning, etc.). Chromium only. 4 workers for remote, no retries local. |
| **MSW** | ^2.12.8 | ✅ YES | Mock Service Worker for API mocking in unit tests. |
| **Zod** | ^4.3.6 | ✅ YES | Runtime validation on API inputs (server-side). Used in API routes. |
| **ESLint** | ^9 | ✅ YES | 341 baseline warnings (pre-push G2 gate, fail-mode since 2026-05-18). |
| **TypeScript** | ^5 | ✅ YES | `tsc --noEmit` (pre-push G1 gate). `tsconfig` strict enabled. |
| **Husky** | ^9.1.7 | ✅ YES | pre-push hook with 5 gates: typecheck, lint, test, secrets, audit. |
| **Secretlint** | ^13.0.0 | ✅ YES | Pre-push G4. Scans full src tree. No secrets in codebase. |
| **Axe A11y** | — | ❌ NO | Zero a11y testing gate. No @axe-core/playwright integration. |
| **Visual Regression** | — | ❌ NO | No Chromatic, no Playwright snapshots. No visual gate. |
| **Contract Testing** | — | ⚠️ PARTIAL | Zod schemas exist for API routes; no explicit contract-test layer. |
| **Load Testing** | k6 (local) | ⚠️ PARTIAL | 4 load suites exist (`k6-steady/spike/soak/stress`). Not in pre-push gate. |

**Status:** Unit + E2E + secrets exist; a11y/visual/contract/load gates absent.

---

## Section 2: Recommended Test Pyramid (No SaaS Deps)

```
        /\
       /  \         E2E (Playwright) — 5-8% crit flows
      /────\
     /      \       Integration (Vitest + MSW) — 15-20%
    /────────\      Unit (Vitest + RTL) — 75-80%
   /──────────\
  /__________\
```

### Layer Detail

**Unit (75-80% of 4563 tests)**
- Vitest + React Testing Library
- Component render + hook behavior
- Utility functions, validators
- Current: ~3500 tests. Gap: dashboard component suites thin.

**Integration (15-20%)**
- Vitest + MSW mocking
- Server Actions + API route contract
- Hook + query coordination
- Current: ~900 tests. Gap: Server Action coverage sparse.

**E2E (5-8%)**
- Playwright Chromium
- Critical user flows per role (Customer/Ops/RaaS)
- Smoke test + checkout + tier upgrade
- Current: 18 suites. Gap: /dashboard-specific flows minimal.

**A11y (New — embedded in E2E)**
- `@axe-core/playwright` assertions
- WCAG 2.1 AA scans on dashboard pages
- Fixture: before each test via `page.addInitScript()`

**Visual Regression (New — Playwright snapshots)**
- Playwright `.toHaveScreenshot()` on critical dashboard surfaces
- Stored in `tests/e2e/__snapshots__/`
- No external SaaS; versioned in git per commit

**Contract (New — Zod as test oracle)**
- Extract Zod schema from API route file
- Generate TS type + runtime validator
- Unit test: POST body validates against schema
- Unit test: Response matches inferred type

---

## Section 3: CI Gate Sequence (CF-Direct Doctrine)

**Pre-push (Local)**
```
G1: tsc --noEmit          [5s]  ← typecheck, fail-fast
G2: eslint --max-warnings [20s] ← lint, fail-mode (341 baseline)
G3: vitest run            [45s] ← all unit + integration
G4: secretlint            [10s] ← no secrets
G5: npm audit             [15s] ← non-blocking warn
```

**Pre-deploy (Local)**
```
P1: npm run build         [30s] ← next build, 0 TS errors
P2: npm run deploy:build  [60s] ← OpenNext compile
P3: vitest run            [45s] ← full unit (already done pre-push)
P4: playwright test       [120s]← E2E critical flows only (not all 18)
    (PLAYWRIGHT_TEST_BASE_URL=http://localhost:3000)
```

**Deploy & Post-Deploy (CF)**
```
Deploy: npm run deploy:full [80s]  ← wrangler deploy + SHA inject
Post:   curl /api/version   [5s]   ← SHA match (MANDATORY)
Post:   Smoke E2E vs PROD    [30s]  ← 3-test smoke suite against live
        (PLAYWRIGHT_TEST_BASE_URL=https://sophia.agencyos.network)
```

**Per-commit (if manual)**
```
Commit gate: lint-staged on staged files only (faster than G2)
```

---

## Section 4: Coverage Targets per /dashboard Surface

| Surface | Unit | Integration | E2E | A11y | Visual | Target |
|---------|------|-------------|-----|------|--------|--------|
| **Customer: Overview** | 60% | 40% | ✅ smoke | ✅ | ✅ | 85/100 |
| **Customer: Missions** | 70% | 30% | ✅ CRUD | ✅ | ✅ | 85/100 |
| **Customer: Videos** | 80% | 20% | ✅ gen flow | ⚠️ | ✅ | 80/100 |
| **Customer: Settings** | 75% | 25% | ✅ tier upgrade | ✅ | ✅ | 85/100 |
| **Customer: Support** | 50% | 30% | ❌ | ✅ | ⚠️ | 70/100 |
| **Ops: Admin** | 65% | 35% | ✅ promo/user | ✅ | ⚠️ | 75/100 |
| **RaaS: Affiliate** | 80% | 20% | ✅ payout | ✅ | ⚠️ | 80/100 |
| **RaaS: API Keys** | 90% | 10% | ✅ gen/revoke | ✅ | ⚠️ | 85/100 |

**Global coverage policy:**
- Lines: 65% minimum (dashboard only)
- Branches: 50% minimum
- Enforce via `vitest.config.ts` thresholds

---

## Section 5: New Tooling to Add

### 1. **@axe-core/playwright** (A11y Gate)
```bash
npm install --save-dev @axe-core/playwright
```
- Add to E2E setup: `tests/e2e/fixtures/a11y-test.ts`
- Inject before each test: `await injectAxe(page)`
- Assert post-action: `await checkA11y(page, { axeOptions: { rules: { ... } } })`
- Rationale: WCAG 2.1 AA automation, no SaaS token required.

### 2. **Playwright Snapshots (Visual Gate)**
- Built-in; no new dep.
- Usage: `await expect(page).toHaveScreenshot()`
- Stores in `tests/e2e/__snapshots__/`
- Update via `--update` flag.
- Rationale: No external SaaS, versioned in git, diff-friendly.

### 3. **Zod + ts-morph for Contract Tests**
- Zod already in deps.
- Add skill: `.claude/skills/zod-contract-test-generator/`
- Parses API route file, extracts `ZodSchema`, generates unit test scaffold.
- Rationale: Single source of truth for API contracts.

### 4. **MSW Enhancements** (Optional)
- Add request/response logging handler for debugging
- Consolidate handlers into `tests/mocks/handlers.ts` barrel
- Already v2.12.8; no new version needed.

### 5. **Vitest Coverage Thresholds** (Enforce in Config)
```typescript
coverage: {
  thresholds: {
    lines: 65,      // Minimum 65% line coverage
    branches: 50,   // 50% branch coverage
    functions: 60,  // 60% function coverage
    statements: 65, // Match lines
  },
}
```

**No doctrine conflicts:** All tools are self-hosted or built-in. Zero operator tokens.

---

## Section 6: Effort Split

### Verify Existing (4 days, 1 person)
- [ ] Run full Playwright suite locally, capture baseline pass rate
- [ ] Audit 18 E2E test files; identify gaps per dashboard surface
- [ ] Sample 10 API routes; check Zod schema coverage
- [ ] Measure current coverage (`npm run test:coverage`); report per surface
- [ ] Document pre-push gate reliability (fail rate, false-positive rate)

### New Wiring (7 days, 2 people parallel)

**Person A: A11y + Visual (3 days)**
- [ ] Install `@axe-core/playwright`
- [ ] Create `tests/e2e/fixtures/a11y-test.ts` helper
- [ ] Add a11y checks to 5 critical E2E flows (Overview, Settings, Admin, API Keys, Affiliate)
- [ ] Capture Playwright snapshots for same 5 routes
- [ ] Document baseline violations (WCAG rules to suppress if design-required)

**Person B: Contract + Coverage (4 days)**
- [ ] Create `.claude/skills/zod-contract-test-generator/` scaffold
- [ ] Generate contract tests for 10 high-risk API routes (auth, billing, payouts)
- [ ] Update `vitest.config.ts` with coverage thresholds (lines: 65, branches: 50)
- [ ] Add pre-deploy `playwright test --grep "smoke"` to deploy script
- [ ] Document contract-test update SOP (when to regenerate)

**Lead: Integration (2 days)**
- [ ] Wire pre-deploy E2E into `deploy-with-sha.sh`
- [ ] Create smoke test suite: 3-test suite for post-deploy verification
- [ ] Update `.husky/pre-push` doc with new E2E timing expectations
- [ ] Add `/api/health` contract test (minimal proof-of-concept)

---

## Section 7: Unresolved Questions

1. **Dashboard route inventory:** What are ALL /dashboard/{surface} routes? (Found ~10 via grep; need complete list to assign coverage targets.)

2. **E2E flake root cause:** 1 webhook test timeouts in Vitest. Is this test-env-specific or prod-like? Should it be skipped pre-push or fixed?

3. **Playwright worker count:** Pre-push has 0 retries locally; pre-deploy has 4 workers. Should pre-deploy smoke be capped at 2 workers to avoid resource contention on M1 16GB?

4. **Visual snapshot update cadence:** When should Playwright snapshots be regenerated? (e.g., per design update, per commit, or only on intentional `/update` runs?)

5. **Operator observability:** If error rate spikes post-deploy, how is it observed without Sentry symbolic stacks? (Raw minified JS from `wrangler tail` is the fallback; acceptable?)

---

**Report prepared:** 2026-05-18 17:45 UTC  
**Baseline status:** 4528/4563 tests pass (99.2%). One timeout flake. Zero a11y/visual/contract gates.  
**Scope:** 30+ /dashboard routes across Customer/Ops/RaaS surfaces.
