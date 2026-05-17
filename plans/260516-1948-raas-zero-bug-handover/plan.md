---
title: "RaaS Zero-Bug Handover — Promise vs Code Audit & Remediation"
description: "Verify 30 homepage promises map to working code so customer can sign up → BYOK → run full RaaS loop zero bugs."
status: in-progress
priority: P0
effort: "6-10h (phases 02-06, smoke deferred)"
branch: main
tags: [handover, audit, raas, no-tech-doctrine, byok]
created: 2026-05-16
---

# Plan — RaaS Zero-Bug Handover

## Goal

Customer lands on `sophia.agencyos.network` → signs up → enters own keys via Setup Wizard (BYOK) → runs full RaaS loop (campaign → script → video → telegram → publish) → outputs real video. Zero bugs. Architectural fidelity to homepage promises verified.

## Doctrine Constraints (NON-NEGOTIABLE)

- No-tech doctrine v1.28.1: customer owns 100% of API keys. Operator manages platform code + CF bindings only.
- Payments: NOWPayments (crypto/USDT) primary + PayOS backup. **Polar.sh BANNED for Sophia.**
- Stack: Next.js 16 + CF Workers + D1 + Better Auth + OpenRouter/ElevenLabs/D-ID (BYOK).
- Deploy: CF-direct via `npm run deploy:full` (wrangler CLI). GitHub Actions disabled by design.

## Context Inputs

- Brainstorm: `plans/reports/brainstorm-260516-1948-video-gen-zero-bug-handover-promise-audit.md`
- Phase 01 shipped at commit `4531f6d4` (honest-pivot copy edits — false marketing claims removed).
- Promise matrix: 30 promises across Groups A (wiring), B (false claims — done in 01), C (perf).

## Phase Index

| # | Phase | Effort | Status | Depends |
|---|-------|--------|--------|---------|
| 01 | Copy Honest Pivot | S (~30min) | completed @ 4531f6d4 | — |
| 02 | Wiring Audit (Group A static) | M (~2-3h) | completed @ audit-260516 | 01 |
| 03 | Perf Verification (Group C) | S (~1h) | completed @ audit-260516 (Group C rows + summary updated) | 01 |
| 04 | Wiring Fixes (P0/P1 only) | Actual ~3-4h | completed @ c7aab382 | 02, 03 |
| 05 | Smoke Test (operator BYOK $) | L (~4-6h wall) | deferred-pending-budget | 04 |
| 06 | Final Handover Sign-Off | S (~30min) | pending | 04 (05 optional) |

## Success Criteria

- 100% of Group A promises map to verified code path OR explicitly accepted deferred exception
- 0 P0/P1 wiring bugs open at handover
- Homepage claims drift = 0 (any new gaps surface → fix copy or fix code)
- Final handover doc at `plans/reports/handover-260516-raas-zero-bug.md` signed off

## Out of Scope

- Building real SOC 2 compliance, real testimonials, real 99.99% SLA (months, separate workstream)
- Customer-side migration tooling
- Sentry sourcemap (doctrine OUT-OF-SCOPE) — stays out unless Phase 06 reopens with explicit override

## Files

- `phase-02-wiring-audit.md`
- `phase-03-perf-verification.md`
- `phase-04-wiring-fixes.md`
- `phase-05-smoke-test.md`
- `phase-06-final-handover-signoff.md`

## Unresolved Questions

1. Phase 04 budget cap before flipping NEEDS-BUILD items to "ship as-is and downgrade homepage further"?
2. Phase 05 — operator willing to spend ~$30-100 own money for one E2E smoke run, or stays deferred indefinitely?
3. Testimonial replacement strategy — abstract case studies vs "composite based on early users" disclosure?
