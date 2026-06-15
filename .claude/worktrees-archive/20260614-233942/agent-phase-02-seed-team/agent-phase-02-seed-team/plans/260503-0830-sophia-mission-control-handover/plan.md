---
title: "Sophia Mission Control + Automated Handover (GAP 3 Forest)"
description: "Replace manual admin handholding with self-driving onboarding, dashboard widgets, status page, and lifecycle email sequence."
status: complete
completed: 2026-05-03
priority: P2
effort: 4h
branch: kai/feat/mission-control-handover
tags: [forest, onboarding, dashboard, status-page, email, api-keys]
created: 2026-05-03
---

# Sophia Mission Control + Automated Handover

a16z **Forest** layer — payment flow already plants the seed (GAP2); this plan grows the canopy so a paying user reaches first-value with zero ops touch.

## Hard Dependency

> **GAP2 self-serve checkout** (`plans/260503-0830-sophia-self-serve-checkout-flow/`) **MUST land first**. Welcome trigger lives inside the NOWPayments IPN handler refactored by GAP2. The auto-handover orchestrator (`src/lib/handover/auto-handover.ts`) and magic-link infra (`src/lib/handover/handover-magic-link.ts`) already exist from `260502-2350-auto-handover-from-payment` — this plan layers on top.

## Scope (what this plan adds vs already-built)

| Capability | Status | This Plan |
|------------|--------|-----------|
| Magic-link welcome email | EXISTS (`handover-email-service.ts`) | Audit + DKIM/SPF/template polish |
| `/welcome/[token]` validate + session | EXISTS | Reuse |
| API key generate + revoke | EXISTS (`api-key-validator-db.ts`) | Wire into onboarding step |
| Dashboard quota widget | EXISTS (`quota-usage-bar.tsx`) | Bind to real D1 quota counter |
| Health indicator | EXISTS (`health-indicator.tsx`) | Reuse |
| Drip emails day 1/3/7 | EXISTS (`/api/cron/email-drip`) | Add D+0 first-week summary, gate on milestone |
| `/onboarding` 3-step UI | MISSING | BUILD |
| Public `/status` page | MISSING | BUILD |
| Mission-control dashboard widget (tier+quota+activity) | PARTIAL | BUILD composite |
| Cloudflare Analytics → status feed | MISSING | BUILD cron poller |
| Inline `/support` page | EXISTS (basic) | Add FAQ + contact |

## Phases

| Phase | File | Effort | Status |
|-------|------|--------|--------|
| 01 — Email infra audit + template hardening | phase-01-email-infra-audit.md | 30m | complete |
| 02 — Post-payment welcome trigger | phase-02-welcome-trigger.md | 30m | complete |
| 03 — `/onboarding` 3-step resumable flow | phase-03-onboarding-flow.md | 60m | complete |
| 04 — API key issuance + rotate UI | phase-04-api-key-onboarding-step.md | 30m | complete |
| 05 — Mission control dashboard widget | phase-05-dashboard-mission-control.md | 30m | complete |
| 06 — Public `/status` page + uptime cron | phase-06-status-page.md | 45m | complete |
| 07 — Lifecycle email sequence (D+0/+1/+7) | phase-07-lifecycle-emails.md | 30m | complete |
| 08 — Tests (vitest unit + Playwright E2E) | phase-08-tests.md | 25m | complete (vitest; Playwright deferred) |

## Success Criteria
- Paying user receives welcome email < 60s after IPN `finished`
- `/onboarding` completes in 3 steps, resumable across sessions
- Dashboard mission-control widget shows tier, quota %, last 7d calls in one glance
- `/status` is public (no auth), shows uptime + last 5 incidents
- 0 `:any`, all API inputs zod-validated, API keys sha256-hashed at rest
- Playwright E2E green: pay → email → magic-link → onboarding done → dashboard

## Reports
- `reports/scout-260503-0830-existing-handover-infra.md`
- `reports/researcher-260503-0830-cloudflare-analytics-status.md`
