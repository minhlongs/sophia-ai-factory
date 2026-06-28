---
title: "Handover Funnel — 6 Critical Bug Fixes"
description: "Restore signup → wizard → dashboard funnel; unblock RaaS handover to non-tech CEO."
status: done
priority: P1
effort: 10-16h
branch: main
tags: [bug-fix, handover, routing, react-query, ssr, sse]
created: 2026-05-19
---

# Plan — Handover Funnel Critical Fixes

Source audits (READ FIRST):
- `plans/reports/ui-ux-designer-260519-0240-dashboard-usability.md`
- `plans/reports/tester-260519-0240-handover-journey-specs.md`

Production SHA at audit: `523b012e` · https://sophia.agencyos.network

## Execution order (dependency-driven)

| # | Phase | Severity | Effort | Depends on |
|---|---|---|---|---|
| 01 | [Signup 404 redirect](phase-01-signup-404-redirect.md) | 🔴 | 30m | — |
| 02 | [Setup-wizard locale routing](phase-02-setup-wizard-locale-routing.md) | 🔴 | 1-2h | — |
| 03 | [Magic link session + redirect](phase-03-magic-link-session-redirect.md) | 🔴 | 2h | 02 |
| 04 | [Billing useQuery missing queryFn](phase-04-billing-query-fn.md) | 🔴 | 2-3h | — |
| 05 | [Analytics page error handling](phase-05-analytics-error-handling.md) | 🔴 | 2-3h | — |
| 06 | [Create page renderer crash](phase-06-create-renderer-crash.md) | 🔴 | 3-6h | 04, 05 |

Phases 02+03 sequential chain. Phases 01, 04, 05 can run in parallel. Phase 06 last (needs Chrome devtools profile).

## Architecture mapping (4-layer)

| Bug | Layer touched | Files changed |
|---|---|---|
| 01 | App routes only | `src/app/[locale]/auth/signup/` (new) |
| 02 | Middleware + app routes | `src/middleware.ts`, `src/app/[locale]/setup-wizard/` |
| 03 | App API + tree handover | `src/app/api/welcome/validate/[token]/route.ts` |
| 04 | Forest providers + dashboard client | `src/forest/components/providers/query-provider.tsx`, `src/app/[locale]/dashboard/billing/billing-client.tsx`, `src/forest/components/license/*.tsx` |
| 05 | App route + lib | `src/app/[locale]/dashboard/analytics/page.tsx` |
| 06 | Forest components | `src/forest/components/agent-sidebar/*`, `src/forest/components/dashboard/health-indicator.tsx`, `src/app/[locale]/dashboard/create/page.tsx` |

## Protected flows (DO NOT BREAK)
- Setup Wizard end-to-end (Phase 02 + 03 touch — extra E2E test required)
- Telegram Bot webhook (untouched)
- NOWPayments IPN (untouched)

## Key risks
1. Phase 02 middleware change may regress dashboard-onboarding redirect chain (test BASIC + MASTER signup flows)
2. Phase 03 cookie domain mismatch (CF Workers Secure prefix) may differ between dev/prod — verify both
3. Phase 04 adding global default queryFn changes behavior for license-status-card, license-alert-panel — verify those panels still load
4. Phase 06 reducing polling cadence may make health indicator feel sluggish — UX trade-off

## Doctrine compliance
All 6 fixes are PLATFORM code — zero operator third-party setup. Compatible with `sophia-no-tech-doctrine.md`.

## Verify after all phases
```bash
npm run build && npm test
npm run deploy:full
curl -s https://sophia.agencyos.network/api/version | jq .shortSha  # must match git HEAD
npx playwright test tests/e2e/handover-journey-260519.spec.ts tests/e2e/ux-usability-260519.spec.ts
```
