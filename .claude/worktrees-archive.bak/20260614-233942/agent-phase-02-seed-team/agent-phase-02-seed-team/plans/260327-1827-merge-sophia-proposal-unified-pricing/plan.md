---
title: "Merge sophia-proposal into sophia-ai-factory with unified pricing"
description: "Consolidate RaaS proposal features into the deployed Video Factory app with single NOWPayments pricing"
status: pending
priority: P1
effort: 12h
branch: feat/merge-sophia-proposal
tags: [merge, pricing, raas, landing-page, cross-sell]
created: 2026-03-27
---

# Merge sophia-proposal into sophia-ai-factory

## Context

Two apps exist in the monorepo:
- **sophia-ai-factory** (deployed at sophia.agencyos.network) -- Video Factory + affiliate automation, NOWPayments USDT, 4 tiers
- **sophia-proposal** (NOT deployed) -- RaaS proposal generator + MCU credits + 17 AI commands, Polar.sh pricing

Goal: merge into 1 unified product. Agencies get Video + RaaS = cross-sell. Single NOWPayments billing.

## Key Findings

- ai-factory already has RaaS lib files (`raas-service.ts`, `raas-gate.ts`, `raas-key-generator.ts`, etc.) and worker middleware (`raas-auth-middleware.ts`)
- ai-factory has `[locale]` i18n with `messages/en.json` + `messages/vi.json`
- ai-factory landing page uses dynamic imports for sections (Hero, Workflow, Features, SocialProof, Pricing, etc.)
- proposal has 6 RaaS components (~850 LOC), 3 proposal components (~580 LOC), 14 landing components
- proposal pricing uses Polar.sh `POLAR_TIERS` -- must be replaced with NOWPayments tiers
- 3 proposal components exceed 200-line limit: `api-key-manager.tsx` (276), `ai-generate-form.tsx` (293) -- need splitting
- proposal RaaS API routes: missions CRUD, keys CRUD, templates, usage, execute

## Phases

| # | Phase | Effort | Status |
|---|-------|--------|--------|
| 1 | [Merge landing page sections](phase-01-merge-landing-page.md) | 3h | pending |
| 2 | [Merge RaaS components into dashboard](phase-02-merge-raas-dashboard.md) | 4h | pending |
| 3 | [Unify pricing config](phase-03-unify-pricing.md) | 2h | pending |
| 4 | [Cross-sell UI + cleanup](phase-04-cross-sell-cleanup.md) | 3h | pending |

## Dependencies

- Phase 2 depends on Phase 1 (shared types/imports)
- Phase 3 independent (can parallel with Phase 2)
- Phase 4 depends on all previous phases

## Risk Assessment

- **File conflicts**: ai-factory already has `social-proof.tsx` section -- merge proposal's `SocialProofSection` into existing one, don't replace
- **Polar references**: proposal code imports from `@/lib/billing/polar-client` -- must reroute to NOWPayments tier config
- **200-line limit**: 3 components need splitting during merge
- **i18n**: proposal has no i18n -- must add translation keys for merged components
