# Phase 6 — Validation and Handoff Sign-off (Hours 20-24)
- Owner: Operator + Customer
- Dependencies: Phase 5 complete (deliverable received)

## Requirements
- Full happy-path re-run passes
- Customer confirms self-sufficiency
- Zero unhandled errors in logs

## Smoke Test Checklist (Customer Self-Test)
1. Register new account at /signup
2. Complete Setup Wizard (or skip for FREE100)
3. Click "Start Creating" → land on /create-video
4. Fill title, topic, audience → Submit
5. Wait for "Campaign created" confirmation
6. Open Telegram → /campaign → see queued campaign
7. Wait 10-15 min → /status → see progress
8. /results → receive video link
9. Play video → confirm deliverable quality

## Sign-off Criteria
- [ ] All 9 smoke test steps pass without operator help
- [ ] Telegram bot commands respond correctly
- [ ] /api/health returns 200
- [ ] No ERROR-level logs in last 4 hours
- [ ] Customer signs handoff checklist

## Rollback
If any smoke test fails:
1. Identify failing node (use phase-01 through phase-05)
2. Fix root cause before sign-off
3. Re-run full smoke test from step 1

## Handoff Package
- Customer credentials (email, login URL)
- Telegram bot username (@Sophia_Bbot)
- Support contact (operator email/Slack)
- Billing portal URL
- Documentation links (FAQ, guide)

## Unresolved Questions
- Does FREE100 tier have Inngest execution enabled or queued-only?
- Is PayOS webhook endpoint separate or shared with NOWPayments?
- What is max Inngest execution time for full video pipeline?
- Is Telegram bot user pairing automated or manual?
