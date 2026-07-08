# Phase 3: E2E Auth Fixture
> Status: pending | Priority: P1 | Parallel with Phase 2

## Context
36 Playwright specs exist (~3,675 lines) but 6+ skipped tests require a signed Better Auth session + local D1. No reusable fixture exists.

## Requirements
1. Reusable fixture: authenticate test user, inject session cookie, seed test D1 data
2. Unblock ≥6 currently-skipped tests (auth-flow, dashboard, quota-upsell)
3. Zero impact on production auth flow
4. All 36 specs maintain current pass rate

## Architecture
- **Test auth user:** pre-existing `E2E_TEST_USER_EMAIL` + `E2E_TEST_USER_PASSWORD` env vars
- **Session capture:** After login, save Better Auth session cookie to a shared fixture file
- **D1 seeding:** `scripts/e2e-bootstrap-d1.sh` already applies ~35 migrations — extend with test data seeder
- **Fixture pattern:** Playwright `test.extend({ auth: ... })` global fixture

## Files to Create
| File | Purpose |
|------|---------|
| `tests/e2e/fixtures/auth-fixture.ts` | Login + session capture, exports `authenticatedContext()` |
| `tests/e2e/fixtures/d1-fixture.ts` | D1 bootstrap + test data seeding per spec |
| `tests/e2e/fixtures/index.ts` | Barrel export combining auth + d1 fixtures |
| `tests/e2e/support/test-data.ts` | Test user factory, sample campaigns, quota data |

## Files to Modify
| File | Change |
|------|--------|
| `tests/e2e/auth-flow.spec.ts` | Replace skip with actual auth using new fixture |
| `tests/e2e/dashboard-overview.spec.ts` | Replace skip, use authenticatedContext |
| `tests/e2e/quota-upsell.spec.ts` | Replace skip, use d1-fixture for test quota state |
| `playwright.config.ts` | Add fixture to global setup |

## Implementation Steps
1. Extend e2e-bootstrap-d1.sh with test-data seeding (sample user, campaigns, quotas)
2. Write auth-fixture.ts: headless login → extract session → store in context
3. Write d1-fixture.ts: ensure D1 migrations applied + seed per test require
4. Wire fixtures into 6 skipped specs (remove .skip())
5. Smoke test: run `npm run test:e2e` — confirm 6+ unblocked tests pass

## Out of Scope
- CI automation (GitHub Actions disabled, manual runner only)
- Production auth changes
- New E2E test scenarios (only unblock existing ones)
