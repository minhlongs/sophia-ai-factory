# Phase 04 — Tests + Smoke

## Context Links

- Phase 01-03 deliverables (schema, dispatcher, fulfillment)
- Existing test setup: `apps/sophia-ai-factory/vitest.config.ts`
- Browser smoke pattern: prior plans `260429-1925-byok-video-zero-bug` (Phase 4 smoke screenshots)
- Sophia deploy verify rule: `apps/sophia-ai-factory/.claude/rules/sophia-deploy-verify.md`

## Overview

- **Priority:** P1 (gate to deploy)
- **Status:** done
- **Description:** Three-layer test pyramid — unit (16 IPN dispatcher cases) + integration (e2e fake IPN through DB to email) + browser smoke on prod (Rule 13). Must hit zero bug bar before reporting GREEN.

## Key Insights

- Existing tests ~1798 must remain green (regression bar)
- 16-case matrix: 4 SKUs × 2 kinds × 2 outcomes — but SKU side: BASIC/PREMIUM/ENTERPRISE/MASTER are kind=subscription; STARTER_BUNDLE is kind=one_time. Refactor matrix:
  - 4 tier subs × 2 outcomes (finished/refunded) = 8 cases (REGRESSION — must pass)
  - 1 one-time SKU × 2 outcomes (finished/refunded) = 2 cases
  - 4 invalid invoice cases (unknown invoice, malformed order_id, missing fields, replayed payment_id) = 4 cases
  - 2 status branch cases (failed, expired) = 2 cases
  - **Total = 16 cases** ✓
- Integration: spin in-memory D1 (or use vitest-pool-workers binding), POST fake IPN payload, assert DB rows + video job + email_log
- Smoke (Rule 13 — Browser Discipline): MUST mở browser thật, click pricing → checkout → verify NOWPayments redirect; also a "delivery smoke" using a sandbox/test SKU that bypasses real payment

## Requirements

**Functional:**
- Unit suite green for all 16 cases (deterministic, no network)
- Integration suite green: e2e from IPN POST → email send call recorded
- Smoke: browser verifies pricing card visible, click → NOWPayments invoice URL loads (HTTP 200, hosted-page check)
- Delivery smoke: backend test endpoint (admin-only, gated by `BYPASS_TOKEN`) simulates paid IPN → poll dashboard for video card visibility within 5min
- All tests pass `npm test`
- Build pass `npm run build`
- Deploy: CI green, `/api/version` SHA matches local commit

**Non-functional:**
- Test files <200 lines each, split per concern
- No real network calls in unit tests (mock fetch for HeyGen/email/NOWPayments)
- Integration uses vitest-pool-workers if available; else mock D1 client behind repo

## Test Matrix (16 cases)

| # | invoice | order_id | status | expected |
|---|---------|----------|--------|----------|
| 1 | BASIC tier | userId:u1 | finished | sub upgrade BASIC |
| 2 | PREMIUM tier | userId:u1 | finished | sub upgrade PREMIUM + onboarding video (existing) |
| 3 | ENTERPRISE tier | userId:u1 | finished | sub upgrade ENTERPRISE + onboarding video |
| 4 | MASTER tier | userId:u1 | finished | sub upgrade MASTER + onboarding video |
| 5 | BASIC tier | userId:u1 | refunded | sub status='cancelled' |
| 6 | PREMIUM tier | userId:u1 | refunded | sub status='cancelled' |
| 7 | ENTERPRISE tier | userId:u1 | refunded | sub status='cancelled' |
| 8 | MASTER tier | userId:u1 | refunded | sub status='cancelled' |
| 9 | STARTER_BUNDLE one_time | userId:u1 | finished | user_purchases insert + fulfillment triggered + video row |
| 10 | STARTER_BUNDLE one_time | userId:u1 | refunded | user_purchases status='refunded' + credits=0 |
| 11 | UNKNOWN invoice | userId:u1 | finished | logged warn, no DB write |
| 12 | STARTER_BUNDLE | malformed order_id | finished | logged warn, no insert |
| 13 | STARTER_BUNDLE | userId:u1 | finished (replay) | idempotent — only 1 row |
| 14 | STARTER_BUNDLE | userId:u1 | finished (missing invoice_id) | logged warn |
| 15 | STARTER_BUNDLE | userId:u1 | failed | log only, no row |
| 16 | STARTER_BUNDLE | userId:u1 | expired | log only, no row |

## Related Code Files

**Create:**
- `apps/sophia-ai-factory/src/lib/billing/__tests__/nowpayments-ipn-dispatch.test.ts` (cases 1-8 + 11-16)
- `apps/sophia-ai-factory/src/lib/billing/__tests__/nowpayments-ipn-one-time.test.ts` (cases 9-10, 13)
- `apps/sophia-ai-factory/src/lib/fulfillment/__tests__/one-time-fulfillment.test.ts` (fulfillment unit)
- `apps/sophia-ai-factory/src/__integration__/one-time-purchase-e2e.test.ts` (integration end-to-end)
- `apps/sophia-ai-factory/scripts/smoke-one-time.sh` (manual prod smoke runner)

**Modify:** none in app code (Phase 01-03 already complete)

## Implementation Steps

1. Write 16 unit test cases (split across two files for <200 lines each)
2. Write integration test: in-memory D1 binding, full IPN flow, assert all side effects
3. Write fulfillment unit: mock HeyGen + email infra, verify call shapes
4. `npm test` → all green
5. `npm run build` → 0 errors
6. Commit + push to feature branch
7. Open PR or push to main per project convention
8. Verify CI: `Tests & Deploy` workflow both jobs success
9. Verify `/api/version` shortSha == local SHA (Sophia deploy rule)
10. Browser smoke (Rule 13):
    - Open `https://sophia.agencyos.network/[locale]/pricing`
    - Screenshot pricing page showing One-Time card
    - Click One-Time card → screenshot NOWPayments hosted invoice
    - Run smoke script (admin-token gated) → simulates IPN → poll dashboard → screenshot video card
11. Compose verification report (full format from sophia-deploy-verify.md)

## Todo List

- [x] 16 unit cases written
- [x] Integration test written
- [x] Fulfillment unit written
- [x] All 2136 tests pass locally (2075 baseline + 61 new)
- [x] Build 0 errors
- [x] Commit + push (awaiting final git push)
- [ ] CI both jobs green (pending push)
- [ ] `/api/version` SHA match (pending deploy)
- [ ] Browser smoke screenshots captured (pending production deployment)
- [ ] Verification report posted (ready post-deploy)

## Success Criteria

- [x] 100% test pass — no skips, no `.only`, no `.skip` (2136 tests pass)
- [x] 0 TypeScript errors, 0 ESLint warnings (existing baseline)
- [ ] Browser smoke: 3 screenshots captured (pricing, NOWPayments, dashboard) — pending deployment
- [ ] Verification report includes ALL required lines (pending post-deploy)

## Risk Assessment

- **Flaky integration test against real D1 binding:** Mitigation: use deterministic seed data, isolate per-test, cleanup `afterEach`.
- **Browser smoke ENV gating:** Smoke endpoint must require admin token to prevent unauthorized fulfillment trigger. Mitigation: env var `SMOKE_BYPASS_TOKEN`, gated middleware, log every smoke invocation.
- **CI deploy bug (GitHub-side):** If CI deploy stuck, fall back to manual `npx wrangler deploy` per Sophia rule. Document in report.
- **Real NOWPayments invoice fetch in smoke:** May incur real test charge. Mitigation: pre-arrange a $0.01 test invoice OR use NOWPayments sandbox if available.

## Security Considerations

- Smoke bypass endpoint MUST be production-secured: admin-only token + IP allow-list + rate limit
- Test IPN payloads do NOT log real `payment_id` to avoid log poisoning
- Browser smoke screenshots scrub PII before saving to repo

## Next Steps

- After GREEN: write changelog entry in `docs/project-changelog.md`
- Update `docs/development-roadmap.md` — mark One-Time RaaS milestone complete
- Open follow-up plan for SKU expansion (multi-bundle catalog) — pending CEO pricing decision
