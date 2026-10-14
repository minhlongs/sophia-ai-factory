---
title: Wave 33 Deep Modularization & Architecture Refactor
status: pending
date: 2026-10-12
targets: 15
clusters: 3
loc_budget: "< 200 LOC per file, facades < 25 LOC"
---

# Wave 33 Tri-Cluster Deep Modularization Plan

## Overview
Decompose 15 mission-critical production monoliths (~3,308 LOC total) across 3 parallel architectural clusters to maintain strict `< 200 LOC` compliance, 100% backward compatibility via `< 25 LOC` facades, clean layer boundaries, and 0 type/lint errors.

---

## Phase 1: Cluster 1 — Edge Routes & OAuth Engine (5 Targets ~ 1,088 LOC)
### File Ownership
- `src/app/api/welcome/validate/[token]/route.ts` (225L) → `src/app/api/welcome/validate/[token]/core/` (types, token-validator, session-issuer, route-handler, index) + facade `route.ts` (< 20L)
- `src/app/api/cron/affiliate-scout/route.ts` (221L) → `src/app/api/cron/affiliate-scout/core/` (types, scout-runner, opportunity-indexer, cron-handler, index) + facade `route.ts` (< 20L)
- `src/app/api/cdn/discover/route.ts` (217L) → `src/app/api/cdn/discover/core/` (types, asset-scanner, manifest-builder, route-handler, index) + facade `route.ts` (< 20L)
- `src/app/api/oauth/zalo/callback/route.ts` (213L) → `src/app/api/oauth/zalo/callback/core/` (types, token-client, account-binder, route-handler, index) + facade `route.ts` (< 20L)
- `src/app/api/oauth/linkedin/callback/route.ts` (212L) → `src/app/api/oauth/linkedin/callback/core/` (types, token-client, account-binder, route-handler, index) + facade `route.ts` (< 20L)

### Execution Steps
1. Create core directories and submodules strictly `< 200 LOC`.
2. Convert root route files into lightweight facades (`< 20 LOC`) re-exporting handlers and configs (`export const dynamic = 'force-dynamic'`).
3. Verify type-check on Cluster 1 routes.

---

## Phase 2: Cluster 2 — Frontend Views & Client Configurators (5 Targets ~ 1,095 LOC)
### File Ownership
- `src/forest/components/byok/byok-provider-picker.tsx` (221L) → `src/forest/components/byok/provider-picker/` (types, provider-card, provider-modal-trigger, provider-picker-view, index) + facade (< 20L)
- `src/app/creator/listings/listings-client.tsx` (220L) → `src/app/creator/listings/client/` (types, listing-filters, listing-card-grid, listings-view, index) + facade (< 20L)
- `src/app/(app)/dashboard/analytics/cross-platform/CrossPlatformAnalyticsClient.tsx` (219L) → `src/app/(app)/dashboard/analytics/cross-platform/components/` (types, metric-stat-cards, platform-breakdown-chart, cross-platform-view, index) + facade (< 20L)
- `src/forest/components/auth/signup-form.tsx` (218L) → `src/forest/components/auth/signup/` (types, social-auth-buttons, credentials-fields, signup-form-view, index) + facade (< 20L)
- `src/forest/components/campaign/campaign-pipeline-timeline.tsx` (217L) → `src/forest/components/campaign/timeline/` (types, stage-step-item, stage-action-bar, timeline-view, index) + facade (< 20L)

### Execution Steps
1. Preserve `'use client'` on interactive components.
2. Add `// i18n-namespace: <ns>` comments at line 1 of every extracted UI subcomponent to satisfy static namespace verification.
3. Replace original root files with re-exporting facades (`< 20 LOC`).
4. Validate i18n keys and linting on UI components.

---

## Phase 3: Cluster 3 — Core Domain Services, Repositories & Adapters (5 Targets ~ 1,125 LOC)
### File Ownership
- `src/land/affiliates/scout/scoring.ts` (226L) → `src/land/affiliates/scout/scoring/` (types, epc-calculator, risk-evaluator, scoring-engine, index) + facade (< 20L)
- `src/tree/compute/sub-planck-scheduler-domain-engine.ts` (225L) → `src/tree/compute/scheduler/` (types, priority-queue, tick-coordinator, scheduler-engine, index) + facade (< 20L)
- `src/seed/ai/provider-certification.ts` (225L) → `src/seed/ai/certification/` (types, capability-matrix, policy-evaluator, certification-service, index) + facade (< 20L)
- `src/land/monitoring/d1-capacity-monitor.ts` (223L) → `src/land/monitoring/capacity/` (types, storage-calculator, growth-projector, capacity-monitor, index) + facade (< 20L)
- `src/forest/ai/anthropic-adapter.ts` (223L) → `src/forest/ai/anthropic/` (types, stream-handler, error-classifier, anthropic-adapter-service, index) + facade (< 20L)

### Execution Steps
1. Extract mathematical calculations, query builders, and adapters into single-responsibility submodules (`< 200 LOC`).
2. Maintain clean architecture import directions (`seed` → `tree` → `forest` → `land`).
3. Replace root files with lightweight re-exporting facades (`< 20 LOC`).

---

## Phase 4: Full Quality Gate Verification & Handover
### Verification Steps
1. **File Budget Invariant**: Verify all new submodules are strictly `< 200 LOC` and facades `< 25 LOC`.
2. **TypeScript Compilation**: Run `npm run type-check` (0 errors).
3. **ESLint Static Analysis**: Run `npm run lint -- --quiet` (0 errors, 0 new suppressions).
4. **Layer Boundaries**: Run `bash scripts/check-layer-boundaries.sh` (0 violations).
5. **i18n Validation**: Run `npm run i18n:validate` (0 missing keys).
6. **Full Vitest Suite**: Run `npm test` (all tests passing).
