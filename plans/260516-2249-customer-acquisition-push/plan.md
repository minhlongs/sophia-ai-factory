---
title: "Customer Acquisition Push — First 10 Paying Customers"
description: "Post-handover acquisition workstream. Sophia is READY (def90421, matrix 17/0/4). Goal: ship first 10 paying customers within 6 weeks via affiliate + content + Telegram-native channels."
status: pending
priority: P1
effort: "4-6 weeks wall (parallelizable phases 01-04)"
branch: main
tags: [acquisition, growth, raas, post-handover, no-tech-doctrine]
created: 2026-05-16
upstream_plan: 260516-1948-raas-zero-bug-handover
production_sha: def90421
---

# Plan — Customer Acquisition Push

## Goal

Take Sophia AI Factory from `production-READY, zero customers` → `10 paying customers`. Match the customer profile (non-tech VN/EN CEOs running content + lead-gen agencies). Validate honest-pivot copy converts. Build feedback loop into product iteration.

## North Star Metric

**10 paying customers (any tier) within 6 weeks of handover.**

Sub-metrics:
- Trial → Paid conversion ≥ 25%
- Setup Wizard completion rate ≥ 80%
- First-mission success rate ≥ 90% (catches BYOK onboarding friction)
- 30-day refund rate ≤ 20% (validates value delivery)

## Doctrine Constraints

- **No-tech v1.28.1 preserved:** every acquisition channel must respect customer-BYOK model. No operator-managed paid keys / observability tokens.
- **Honest-pivot copy:** all new marketing copy follows Phase 01 baseline (no SOC 2 / fake testimonials / numerical SLA without backing).
- **Payments:** NOWPayments USDT primary + PayOS VN backup. **No Polar / PayPal.**
- **Bilingual:** every customer-facing surface VN + EN per `sophia-handover-rules.md`.

## Context Inputs

- Handover doc: `plans/reports/handover-260516-raas-zero-bug.md`
- Promise matrix: `plans/reports/audit-260516-promise-wiring-matrix.md`
- Existing acquisition docs: `docs/admin-ops/first-customer-close.md`, `docs/sophia-activation-runbook.md`, `docs/getting-started.md`

## Phase Index

| # | Phase | Effort | Status | Depends |
|---|-------|--------|--------|---------|
| 01 | Tracking + Analytics Setup | M (~3-5h) | pending | — |
| 02 | Landing CRO + Trial Funnel | M (~5-8h) | pending | 01 |
| 03 | Onboarding UX Hardening (Setup Wizard polish) | M (~4-6h) | pending | — |
| 04 | Acquisition Channels (Affiliate + Content seed) | L (~8-12h) | pending | 01 |
| 05 | First 10 Customers (manual close + iteration) | XL (~ongoing) | pending | 02, 03, 04 |
| 06 | Post-Acquisition Iteration + Scale Signal | M (~4-6h) | pending | 05 |

## Success Criteria

- 10 paying customers acquired (any tier) within 6 weeks
- Acquisition funnel measured at every step (visit → signup → wizard → first mission → first paid TX)
- 0 P0 customer-blockers reported in first 4 weeks (else loop back to handover Phase 04)
- Affiliate program live with first 3 creator partners
- Content seed: 5 VN + 5 EN long-form articles or demo videos published
- Setup Wizard inline-validation for ElevenLabs xi-api-key + D-ID base64 format (closes handover §8 gotchas)
- Lifecycle email sequence (D+0, D+1, D+3, D+7, D+14, D+30) automated via existing `email:campaign` infra

## Out of Scope

- Building paid ads infrastructure (defer — no-tech doctrine on ad platform setup)
- Multi-account YouTube schema (P13 deferred backlog item — separate plan)
- Apollo live integration (P5 / P9 deferred backlog — separate plan when customer requests)
- Enterprise sales motion (focus first 10 on self-serve BASIC/PREMIUM tiers)

## Risk Register

| Risk | Likelihood | Mitigation |
|------|-----------|-----------|
| Zero acquisition signal after 3 weeks | MED | Phase 05 has built-in pivot trigger — review at week 3 |
| Setup Wizard friction blocks 80%+ completion | MED | Phase 03 hardening is parallel to 01-02; ship before paid traffic |
| First customer reports P0 bug | LOW-MED | Phase 05 smoke (operator-funded) catches highest-risk surfaces before paid customer; 30-day refund window absorbs first-incident churn |
| Refund rate > 20% (value mismatch) | MED | Phase 05 (iteration) feeds back into copy + pricing; honest matrix already removed false claims |
| Operator burnout on manual onboarding | HIGH | Cap first batch at 10 customers; automate D+1+3+7 emails before scaling beyond |

## Files

- `phase-01-tracking-analytics-setup.md`
- `phase-02-landing-cro-trial-funnel.md`
- `phase-03-onboarding-ux-hardening.md`
- `phase-04-acquisition-channels.md`
- `phase-05-first-10-customers.md`
- `phase-06-post-acquisition-iteration.md`

## Unresolved Questions

1. **Pricing experiment:** Free 7-day trial vs $1-trial-then-tier? Affects refund-rate signal.
2. **Affiliate commission structure:** Sophia's own affiliate program (one-time vs recurring) — Phase 04 decision.
3. **Content language split:** start VN-heavy (operator's market) or EN-heavy (global TAM)? Phase 04 ratio.
4. **Outreach channel:** cold email vs Telegram-native (creator DMs) vs LinkedIn vs Twitter? Phase 04 picks 2 to test.
