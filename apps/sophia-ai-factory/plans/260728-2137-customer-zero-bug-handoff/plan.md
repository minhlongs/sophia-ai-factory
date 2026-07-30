# Customer Zero-Bug Handoff
- Status: ready
- Created: 2026-07-28 21:37 ICT
- Owner: operator + customer (CEO)
- SLA: 24h from contract to first deliverable

## Phases
1. phase-01-environment-and-credentials.md — Hours 0-2
2. phase-02-user-provisioning.md — Hours 2-4
3. phase-03-payment-path.md — Hours 4-7
4. phase-04-campaign-creation.md — Hours 7-12
5. phase-05-workflow-execution.md — Hours 12-20
6. phase-06-validation-and-handoff-signoff.md — Hours 20-24

## Dependencies
- Phase 2 depends on Phase 1
- Phase 3 depends on Phase 2
- Phase 4 depends on Phase 3
- Phase 5 depends on Phase 4
- Phase 6 depends on Phase 5

## Confirmed Assumptions
1. FREE100 tier: full Inngest workflow execution enabled (not queued-only)
2. PayOS webhook: separate endpoint from NOWPayments
3. Telegram bot: user pairing automated (no manual step)
4. Inngest: full execution, no time limit constraints

## Acceptance Criteria
- Customer can register, create campaign, receive video deliverable without operator help
- All smoke tests pass (see phase-06)
- Zero unhandled errors in production logs during handoff window
- Customer confirms receipt of first video deliverable
