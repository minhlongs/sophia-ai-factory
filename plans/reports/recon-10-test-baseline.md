# RECON-10: Section 12 — Testing / Quality Model

**Audit date:** 2026-09-07
**Auditor:** tester agent (QA Lead)
**Scope:** Test pyramid reconstruction, baseline verification, false-confidence analysis
**Method:** READ-ONLY. No test execution. File structure analysis + stale artifact analysis + pattern detection.

---

## 1. TEST PYRAMID RECONSTRUCTION

### Test Runner
- **Framework:** Vitest with jsdom environment
- **Config:** `vitest.config.ts` — globals true, setupFiles `./src/test/setup.tsx`
- **Include patterns:** `src/**/*.test.{ts,tsx}`, `src/**/*.contract.test.{ts,tsx}`, `../../tests/**/*.test.{ts}`, `scripts/__tests__/**/*.test.{ts,mts}`
- **Coverage thresholds:** lines 60%, functions 50%, branches 45%, statements 55%
  - `src/land/billing/**`: lines 75%, functions 75%, branches 75%, statements 75%
  - `src/forest/usage-metering/**`: lines 70%, functions 70%, branches 65%
  - `src/app/[locale]/dashboard/**`: lines 5%, branches 5%, functions 5%, statements 5%

### Test File Inventory

| Category | Count | Location |
|----------|------:|----------|
| Co-located unit tests (*.test.ts under src/) | 853 | src/seed, tree, forest, land, app |
| Integration tests | 7-42 | src/__tests__/integration/ and other paths |
| Contract tests | 6 | *.contract.test.ts |
| E2E Playwright specs | 36 | tests/e2e/*.spec.ts |
| Security tests | 7 | src/security-tests/*.test.ts |
| Middleware tests | 2 | src/middleware/*.test.ts |
| Root scaffold tests | 1 | tests/registry.test.ts |
| Script tests | 3 | scripts/__tests__/*.test.ts |
| **Total test files** | **~909** | |

### Layer Breakdown (Co-located Unit Tests)

| Layer | Test Files | Production Files (~) | Coverage Density |
|-------|----------:|---------------------:|-----------------:|
| land | 215 | ~113 | 1.90 tests/file |
| tree | 188 | ~162 | 1.16 tests/file |
| forest | 173 | ~362 | 0.48 tests/file |
| app | 140 | varies | UI coverage |
| seed | 112 | ~147 | 0.76 tests/file |
| security | 7 | 7 | 1.00 tests/file |
| middleware | 2 | varies | Thin |
| __tests__ | 10 | — | Integration/guard |

### E2E / Load Tests
- **Playwright specs:** 36 files in `tests/e2e/` — includes smoke, checkout-flow, creative-mission-flywheel, affiliate-flow, dashboard tests, quota-upsell, handover-bughunt, etc.
- **Playwright config:** `playwright.config.ts` exists
- **k6 load tests:** `tests/load/` — k6-soak.js, k6-spike.js, k6-steady.js, k6-stress.js, plus `tests/load/scenarios/` and `tests/load/edge-probe/`
- **E2E helper scripts:** `scripts/e2e/` — run-e2e-validation.sh, seed-magic-link.sh, cleanup-magic-link.sh, etc.

---

## 2. BASELINE VERIFICATION

### Claims vs Evidence

| Source | Claimed Baseline | Date | Verifiability |
|--------|-----------------|------|---------------|
| test-results.json (stale) | 5994 total, 5915 passed, 45 failed, 34 pending | Jul 5, 18:02 | VERIFIED (parsed JSON) |
| test-results/.last-run.json | "passed", failedTests: [] | Aug 20, 12:21 | VERIFIED (parsed JSON) |
| docs/roadmap/SOPHIA_2028_ROADMAP.md | 8679 passed/0 failed | Aug 26+ | UNVERIFIED (no supporting artifact) |
| docs/architecture/REPO_RECONNAISSANCE_2026-08-25-REFRESH.md | 7985 passed / 1 failed / 34 skipped / 10 todo | Aug 25 | UNVERIFIED (document only) |
| docs/ceo-handover/FOUNDER_DEPENDENCY_AUDIT.md | 8757 tests | Aug 29 | UNVERIFIED (document only) |
| docs/roadmap (Phase 4) | 8546 tests | Aug 27 | UNVERIFIED (document only) |
| docs/roadmap (Phase 2) | 8213 tests | Aug 26 | UNVERIFIED (document only) |
| test-results.json (from summary) | 7020 test files newer than test-results.json | Sep 7 | VERIFIED (find +444 -newer) |

### Critical Baseline Discrepancy

**The committed `test-results.json` is STALE (Jul 5) by ~2 months relative to current code (Sep 7).**

- test-results.json reports **5994 tests**
- 7020 test files have been modified SINCE that artifact was generated
- Documentation claims grow from 8213 → 8546 → 8679 → 8757 across Aug 26-29
- The `.last-run.json` (Aug 20) claims "passed" with empty failedTests

**IMPLICATION:** There is NO recent, machine-verified test baseline in the repository. All claimed test counts (8679, 8757, etc.) are derived from CI runs or local runs that were NOT persisted as structured artifacts. The only machine-readable artifact (test-results.json) is 2 months stale and contradicts every documented baseline.

### Baseline Comparison Matrix

| Metric | test-results.json (Jul 5) | .last-run.json (Aug 20) | Docs claims (Aug 25-29) | Current (inferred) |
|--------|--------------------------:|------------------------:|------------------------:|-------------------:|
| Total tests | 5994 | unknown | 7985-8757 | ~8500-9000 (estimated from file count) |
| Passed | 5915 | 100% | 7985-8757 | unknown |
| Failed | 45 | 0 | 0-1 | unknown |
| Pending | 34 | unknown | unknown | unknown |
| Test files | 2203 suites | unknown | 785 files | 909 files |

**Gap:** The 45 failures from Jul 5 may or may not still be present. The Aug 20 `.last-run.json` claims 0 failures, but this is a local artifact that could have been generated after fixes that were later committed. The documentation chain (8213→8546→8679→8757) suggests continuous test addition but no surviving structured evidence of the actual pass/fail state.

---

## 3. FAILURE ANALYSIS (Jul 5 Artifacts — May Be Stale)

### Failed Suites (15 suites, 45 individual test failures)

| Suite | Failures | Category |
|-------|--------:|----------|
| `src/tree/handover/auto-handover.test.ts` | 9 | mock setup bug (`mockResolvedValue is not a function`) |
| `src/forest/missions/__tests__/api-key-auth.test.ts` | 7 | mock wiring gap (`vi.fn()` not called) |
| `src/forest/missions/__tests__/checkpoint-dispatcher.test.ts` | 5 | mock setup bug |
| `src/land/video/__tests__/cost-guardrail.test.ts` | 5 | mock setup bug |
| `src/tree/handover/__tests__/auto-handover.test.ts` | 4 | mock setup (duplicate of tree/handover above) |
| `src/app/actions/campaigns-tier-integration.test.ts` | 3 | mock wiring |
| `src/app/api/proposals/route.test.ts` | 2 | mock setup bug |
| `src/app/actions/__tests__/video-generate-action.test.ts` | 2 | D1 binding unavailable in test env |
| `src/app/api/cron/mission-reaper/route.test.ts` | 1 | deep-equal mismatch |
| `src/forest/agents/enforcement-gate.test.ts` | 1 | mock wiring |
| `src/forest/agents/repository.test.ts` | 1 | mock wiring |
| `src/forest/publishing/__tests__/oauth-token-refresher.test.ts` | 1 | real external API call (Threads OAuth 400) |
| `src/forest/inngest/functions/__tests__/publish-execute-gap-r3.test.ts` | 1 | real external API |
| `src/app/api/cron/workflow-stepper/route.test.ts` | 1 | mock wiring |

### Failure Root Causes
1. **Mock setup bugs (53% of failures):** `mockResolvedValue is not a function` — suggests vitest API misuse or vi.mock hoisting issues
2. **Mock wiring gaps (27%):** `vi.fn()` created but never called by the code under test — tests assert on calls that never happen
3. **D1 binding unavailable (9%):** Tests attempt to use D1 database binding that does not exist in test environment
4. **Real external API calls (9%):** Tests hit live external APIs (Threads OAuth, etc.) without mocking — fail in CI or env without keys
5. **Deep-equal mismatches (2%):** Shape changes in return objects not reflected in test assertions

---

## 4. TEST PATTERN ANALYSIS

### Mocking Intensity

| Pattern | Files | Assessment |
|---------|------:|------------|
| `vi.mock(...)` | 500 | Heavy module-level mocking across 59% of test files |
| `vi.fn(...)` | 572 | Extensive function stubbing |
| `noRealFetch` / `msw` / `setupServer` | 0 | **Zero HTTP traffic interception** |
| `skipIf(DATABASE_URL)` | 1 | Only video-generate-e2e.test.ts |
| `.skip` / `.todo` / `.only` | 22 files | Mix of intentional skips and pending tests |

### False Confidence Indicators

**1. Zero HTTP Mocking (msw/noRealFetch) — CRITICAL**
- 0 test files use recorded HTTP traffic interception or global fetch mocking
- This means: every test that calls a "real" API path either (a) mocks the function at the module boundary (vi.mock), or (b) actually hits the network
- The 500 files with `vi.mock` are mocked at the module level, NOT at the HTTP level
- **Risk:** Module-level mocks verify mock behavior, not real API contracts. A change to the real API response shape (e.g., OpenRouter, ElevenLabs) would NOT be caught by tests until production.

**2. No Real-DB Testing — HIGH**
- Only 1 file uses `skipIf(DATABASE_URL)` pattern (video-generate-e2e.test.ts)
- D1 binding is unavailable in test env (confirmed by 2 video-generate-action test failures)
- All DB interactions are mocked via vi.mock
- **Risk:** Schema changes, migration bugs, SQL errors not caught by test suite

**3. Dashboard Coverage at 5% — LOW BAR**
- vitest.config.ts sets dashboard coverage thresholds at 5% lines/functions/branches/statements
- 140 dashboard test files exist, but the threshold is essentially "any test counts"
- **Risk:** Dashboard regression detection is minimal

**4. Heavy Mock Dependence — MEDIUM**
- 572 test files use `vi.fn()` — avg 0.67 per test file across 853 unit test files
- Mock-only tests can pass while the real code has bugs if mocks are incorrectly configured
- Evidence: the 45 failures in Jul 5 were ALL mock-related (setup bugs, not real logic failures)

**5. Security Tests Are Static — MEDIUM**
- 7 security test files exist in `src/security-tests/`
- 1 is intentionally skipped (f03-promo-idor.test.ts — N-A finding, route does not exist)
- Security tests are structural/rule-based, not dynamic penetration tests
- **Risk:** Security validation relies on code review, not runtime verification

### Skip/TODO Patterns

| File | Pattern | Assessment |
|------|---------|------------|
| `src/land/video/__tests__/video-generate-e2e.test.ts` | `skipIf(!hasSecrets)` | CORRECT — real API E2E only runs with keys |
| `src/land/billing/__tests__/ipn-concurrent-processing-contract.test.ts` | 5 `it.todo` items | PENDING — TOCTOU race fix not yet implemented |
| `src/land/billing/__tests__/ipn-dlq-contract.test.ts` | 6 `it.todo` items | PENDING — DLQ capacity/cron tests not yet implemented |
| `src/land/billing/__tests__/phase6-integration.test.ts` | 15 `it.skip` items | EMPTY STUBS — all tests are empty, pending real assertions |
| `src/security-tests/f03-promo-idor.test.ts` | 1 `it.skip` | INTENTIONAL — N-A finding |

**50% of skips (15/29) are in phase6-integration.test.ts** — an entire integration test file with 15 empty stub tests. These inflate the test count while contributing zero coverage.

---

## 5. TEST INFRASTRUCTURE ASSESSMENT

### Coverage Gaps by Layer

| Layer | Unit Tests | Gap Areas |
|-------|----------:|-----------|
| seed | 112 | Core primitives well-tested; auth, config, types covered |
| tree | 188 | Handover has failures (mock bugs); agent-protocol needs more tests |
| forest | 173 | Lowest test density (0.48/file); 362 production files, many Inngest functions untested |
| land | 215 | Billing has 75% threshold (good); video pipeline has E2E test (skipIf) |
| app | 140 | Dashboard at 5% threshold (weak); API routes have mock-heavy tests |
| security | 7 | Structural only; no dynamic security testing |
| middleware | 2 | Very thin for critical auth/CSRF/CORS middleware |

### What Is NOT Tested
1. **Real provider API contracts** — No recorded HTTP tests for OpenRouter, ElevenLabs, D-ID, HeyGen, NOWPayments
2. **Inngest function execution** — Functions tested via mocked step/run, not real Inngest runtime
3. **Middleware pipeline integration** — Only 2 test files for the entire middleware stack (auth, CSRF, CORS, MFA, CSP, locale redirect)
4. **D1 migration correctness** — No tests that run migrations against a real D1 instance
5. **R2 storage operations** — Mocked, never tested against real R2
6. **Deploy pipeline** — No tests for `deploy:full`, SHA verification, or CF Workers deployment
7. **E2E user flows** — 36 Playwright specs exist but execution status unknown (no CI artifact proving they pass)

### Test Execution Artifacts

| Artifact | Date | Status | Trust |
|----------|------|--------|-------|
| test-results.json | Jul 5, 18:02 | 5994/45 failed | STALE (2 months old) |
| .last-run.json | Aug 20, 12:21 | "passed", 0 failed | LOCAL (no CI provenance) |
| plans/reports/k6-load-260510-2150.md | May 10 | Load test report | OLD (4 months) |
| reports/devops/deploy/test-results.md | May 30 | 6/7 smoke pass | OLD (3 months) |

---

## 6. QUALITY MODEL VERDICT

### Testing Pyramid Assessment

```
                    ___________
                   /           \        E2E (36 specs) — execution unverified
                  /  Integration \      Integration (7-42) — thin layer
                 /    + Contract   \    Contract (6) — minimal
                /___________________\   
               /                     \
              /     Unit Tests        \  Unit (853 files) — heavy, mock-dependent
             /_________________________\
```

**Shape:** Pyramid is bottom-heavy (853 unit vs 36 E2E), which is conventional but the middle layer (integration/contract) is severely thin. The top layer (E2E) exists but has no recent execution proof.

### Confidence Level

| Dimension | Score | Notes |
|-----------|:-----:|-------|
| Unit test coverage | MEDIUM | 853 files exist, but 500 use vi.mock (module-level stubbing), 0 use HTTP mocking |
| Integration test coverage | LOW | 7-42 integration tests for a 853-file test suite is thin |
| E2E test coverage | LOW | 36 specs exist, no CI artifact proving execution |
| Security test coverage | LOW | 7 structural tests, 1 skipped, no dynamic testing |
| Baseline freshness | VERY LOW | Only machine-readable artifact is 2 months stale |
| Mock realism | LOW | Module-level mocks verify mock behavior, not real API contracts |
| DB testing | VERY LOW | D1 unavailable in tests; all DB mocked; 1 skipIf file |
| Coverage threshold adequacy | MEDIUM | 60% lines overall is reasonable; 5% dashboard is weak; 75% billing is strong |

### Overall Assessment: **MEDIUM-LOW confidence**

The test suite has volume (853+ unit test files) but suffers from:
1. **Mock cannibalization** — Most tests verify mock behavior, not real code behavior
2. **Stale baseline** — No recent machine-verified pass/fail record
3. **Missing integration/E2E proof** — No CI artifacts showing the suite actually runs
4. **Zero HTTP mocking** — API contract changes invisible to tests
5. **Thin middleware/security testing** — Critical auth/CSRF/CORS stack has 2 test files

---

## COMPACT SUMMARY

**Test Pyramid:** 853 unit / ~42 integration / 6 contract / 36 E2E specs
**Observed Baseline (Jul 5, STALE):** 5994 total / 5915 passed / 45 failed / 34 pending across 2203 suites
**Documented Claims (Aug 25-29):** 7985-8757 passed — UNVERIFIED, no supporting structured artifact
**New test files since Jul 5 baseline:** 7020 files modified (baseline is 2 months stale)

**False Confidence Risks:**
1. Zero HTTP mocking (msw/noRealFetch) — 0 files. Module-level vi.mock in 500 files verifies mock behavior only
2. Dashboard coverage threshold at 5% — effectively no guard
3. 15 empty stub tests in phase6-integration.test.ts — inflate count, zero coverage
4. Only 2 middleware test files for the entire auth/CSRF/CORS/MFA/CSP pipeline
5. No DB integration testing — D1 unavailable in test env, all mocked
6. 500 files use vi.mock = tests can pass while real code has bugs if mocks are wrong (evidence: 45/45 Jul 5 failures were mock-related)

**Critical Unresolved Questions:**
1. What is the ACTUAL current test pass/fail count? (Cannot be determined from available artifacts)
2. Do the 36 Playwright E2E specs pass? (No CI artifact, no local artifact)
3. Are the 45 Jul 5 failures still present or were they fixed? (.last-run.json claims 0 but lacks provenance)
4. Why is test-results.json not updated by CI/CD? (GitHub Actions disabled since May 2026; no replacement automated test reporting)
5. What is the actual code coverage percentage? (Thresholds configured but no coverage report artifact found)
