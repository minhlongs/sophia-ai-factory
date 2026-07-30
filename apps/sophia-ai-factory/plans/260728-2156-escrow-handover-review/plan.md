# Escrow / Handover Review — 24h Zero-Bug Handoff
- Status: ready
- Created: 2026-07-28 21:56 ICT
- Owner: security-reviewer + operator
- Prerequisite: 260728-2137-customer-zero-bug-handoff plan complete

## Purpose
Before signing off the customer handoff, run an escrow-style review to verify:
1. Security baseline (no exposed secrets, no unpatched CVEs, auth intact)
2. In-flight risk (unfinished work, known bugs, tech debt)
3. Compliance (PCI-aware payment handling, data retention, i18n)

## Phases
1. phase-01-tech-baseline.md — Repo health, secrets audit, dependency scan
2. phase-02-in-flight-risk.md — Unfinished work, known bugs, rollback readiness
3. phase-03-compliance-and-report.md — PCI scope, data retention, final report

## Acceptance Criteria
- No HIGH/CRITICAL secrets in git history
- No HIGH/CRITICAL dependency CVEs
- All protected flows (Setup Wizard, Telegram, Payment) re-verified
- Rollback plan documented and tested
- Handover sign-off authorized
