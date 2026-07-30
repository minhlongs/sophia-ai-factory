# Phase 2 — In-Flight Risk (Unfinished Work + Rollback)
- Owner: security-reviewer + operator
- Dependencies: Phase 1 complete

## Checklist
- [ ] No unfinished work in src/land/**: search for TODO, FIXME, HACK, WIP
- [ ] No known bugs in CHANGELOG or tech-debt files that affect handoff flows
- [ ] DLQ empty: `SELECT count(*) FROM ipn_dead_letter_queue WHERE resolved = 0`
- [ ] payment_events processed: `SELECT count(*) FROM payment_events WHERE processed = 0`
- [ ] Inngest queue healthy: no stuck jobs in dashboard
- [ ] Rollback plan documented:
  - Last known good commit SHA
  - `npx wrangler rollback` command tested
  - Customer data export procedure (if needed)
- [ ] Staging re-test: full happy-path (register → campaign → deliverable) on staging

## Report Location
Append to `/Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/plans/reports/escrow-260728-2156-tech-baseline-report.md`
