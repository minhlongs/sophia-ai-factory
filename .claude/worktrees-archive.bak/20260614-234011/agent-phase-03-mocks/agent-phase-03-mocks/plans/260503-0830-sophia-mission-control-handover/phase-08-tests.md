# Phase 08 — Tests (Vitest Unit + Playwright E2E)

## Context Links
- `apps/sophia-ai-factory/vitest.config.ts`
- `apps/sophia-ai-factory/playwright.config.ts`
- Existing tests: `src/lib/handover/__tests__/`, `src/lib/email/__tests__/`, `src/lib/security/api-key-validator.test.ts`

## Overview
- **Priority:** P1 (gate for merge)
- **Status:** pending
- **Effort:** 25m

Cover the gaps introduced by Phases 01–07 with focused tests. Reuse existing fixtures + setup.

## Coverage Targets

### Vitest unit tests

| Test file | Phase | Asserts |
|-----------|-------|---------|
| `src/lib/email/render-email.test.ts` | 01 | Each template renders for vi+en, returns `{html,text,subject}`, snapshot stable |
| `src/lib/email/email-outbox.test.ts` | 02 | enqueue idempotent on payment_id; flush sends + marks sent; 5 fails → status=failed |
| `src/lib/security/api-key-validator-d1.test.ts` | 04 | Generate→hash→verify roundtrip; revoke blocks check; rate-limit-per-tier mapping |
| `src/lib/status/incident-state-machine.test.ts` | 06 | 3-fail opens; 3-success closes; mixed sequence noop |
| `src/lib/email/lifecycle-email-rules.test.ts` | 07 | Matrix: D+1 fires only when no login; D+7 fires only when has login + calls; never duplicate |
| `src/lib/email/week-stats.test.ts` | 07 | Stats computation against fixture |

### Playwright E2E

| Spec | Flow |
|------|------|
| `tests/e2e/welcome-onboarding.spec.ts` | Stub IPN webhook → poll outbox until sent → fetch magic link from D1 → load `/welcome/[token]` → verify redirect to `/onboarding` step 1 → complete each step → reach dashboard |
| `tests/e2e/api-key-issuance.spec.ts` | Login → `/dashboard/api-keys` → create key → key shown once → reload → only prefix visible → use key against `/api/v1/quota` → 200 → revoke → 401 |
| `tests/e2e/status-page-public.spec.ts` | Logout → load `/status` → 200 → uptime grid present → JSON endpoint returns `{status: "operational"}` |
| `tests/e2e/mission-control-card.spec.ts` | Login → `/dashboard` → mission control card visible → tier badge, quota %, sparkline, CTA all render |

## Architecture

Test setup uses existing patterns:
- D1 mocked via `@cloudflare/workers-types` + in-memory better-sqlite3
- Better Auth session stubbed via cookie injection
- Email send mocked via `vi.mock('@/lib/email/sender')`
- Playwright runs against `wrangler dev` local

## Implementation Steps
1. Vitest snapshots: `vitest -u` to create initial baseline; commit
2. Outbox: simulate Resend 500 by mocking `sender.sendEmail` → expect retries, then `failed` + Telegram alert (mock fetch to api.telegram.org)
3. Incident state machine: pure function — feed arrays of check results, assert action transitions
4. Lifecycle rules: pure function — fixture matrix of (created_at, login_at, sop_install_at, run_at) → expected emails
5. Playwright welcome: requires test seed for handover row + magic-link token; reuse `tests/e2e/utils/seed-handover.ts` (verify exists, else create)
6. Playwright API key: hit real `/api/v1/api-keys/create` against test D1; teardown deletes row
7. Playwright status: simplest — just GET, assert HTML + JSON

## Todo
- [ ] 6 vitest unit specs
- [ ] 4 playwright e2e specs
- [ ] All snapshots committed
- [ ] CI workflow includes new specs (`pnpm test` + `pnpm test:e2e`)
- [ ] No flake on 3 consecutive runs

## Success Criteria
- `pnpm -C apps/sophia-ai-factory test` → 100% pass on new specs
- `pnpm -C apps/sophia-ai-factory test:e2e` → 4 new specs green
- Coverage: new code (Phases 01–07) ≥ 80% line coverage on `src/lib/email`, `src/lib/status`, `src/lib/security/api-key-validator-db-d1.ts`

## Risk Assessment
- **Playwright flakiness** on status page if rollup cron hasn't run yet → seed `status_day_rollup` fixture before spec
- **Outbox test timing** — stub `Date.now` for retry windows

## Security Considerations
- Test fixtures must use placeholder emails (`@example.test`), never real addresses
- Magic-link tokens in tests scoped to test DB only

## Unresolved Questions
- Which deploy job name in `.github/workflows/` runs e2e? Verify Playwright spec runs in CI before merge.
- Is there an existing `tests/e2e/utils/seed-handover.ts` or do we need to create it? (Glob check before starting Phase 08.)

## Next
After Phase 08 green: full plan executed. Ship to staging, monitor outbox + incident dashboard for 48h before declaring "Forest layer live."
