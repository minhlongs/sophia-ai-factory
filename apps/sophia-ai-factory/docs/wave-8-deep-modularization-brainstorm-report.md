# Brainstorm & Architecture Report: Wave 8 Deep Modularization (All 13 Monoliths)

**Date**: 2026-10-09  
**Status**: Consensus Agreed ("cả 4" — All Clusters: 13 Monoliths > 500 LOC)  
**Target Constraint**: Strict `< 200 LOC` per module  
**Architecture Rules**: Sophia 4-Layer Clean Architecture (`seed` -> `tree` -> `forest` -> `land`), Zero `:any`, Zero `console.log`, 100% Backward-Compatible Facades & Barrel Exports.

---

## 1. Executive Summary & Problem Statement

Following the successful completion of Waves 1–7 (which modularized 45+ monolithic files across all layers), a comprehensive repository scan identified the final 13 production monolithic files exceeding 500 lines of code, totaling **~7,086 lines of code**:

### Target Monoliths by Layer:
1. **Frontend UI Views & Client Containers (5 files, 2,825 LOC)**
   - `src/app/components/deals/deals-admin-dashboard.tsx` (614 LOC)
   - `src/app/[locale]/portal/[agencySlug]/portal-client.tsx` (589 LOC)
   - `src/components/video/adaptive-video-player.tsx` (583 LOC)
   - `src/components/growth/arbitrage-card.tsx` (521 LOC)
   - `src/app/[locale]/ai-video/[niche]/page.tsx` (518 LOC)

2. **Backend Domain Services & Actions (4 files, 2,051 LOC)**
   - `src/tree/sales/enterprise-deal-repo.ts` (547 LOC)
   - `src/tree/marketplace/marketplace-service.ts` (502 LOC)
   - `src/land/ipo/ipo-management-actions.ts` (501 LOC)
   - `src/land/agency/agency-portal-actions.ts` (501 LOC)

3. **Foundational Core, RBAC & SDK Generator (4 files, 2,074 LOC)**
   - `src/sdk/index.ts` (550 LOC)
   - `src/seed/auth/workspace-access.ts` (514 LOC)
   - `src/seed/types/multi-asset-clearing.ts` (506 LOC)
   - `src/app/api/sdk/typescript/route.ts` (504 LOC)

The user confirmed consensus for **"cả 4"** (all 13 monolithic files across all layers).

---

## 2. Cluster Architectural Decomposition Strategy

### Cluster 1: Frontend UI Views & Client Containers (2,825 LOC)

1. **`src/app/components/deals/deals-admin-dashboard.tsx` (614 LOC → `src/app/components/deals/admin-dashboard/` + root facade)**
   - `src/app/components/deals/admin-dashboard/types.ts` (~50 LOC): Tab states, KPI filters, modal props.
   - `src/app/components/deals/admin-dashboard/kpi-summary-cards.tsx` (~130 LOC): ARR pipeline, win rate, deal count badges.
   - `src/app/components/deals/admin-dashboard/deal-table-view.tsx` (~150 LOC): Sortable table with stage badges and quick actions.
   - `src/app/components/deals/admin-dashboard/deals-admin-dashboard.tsx` (~140 LOC): Composed dashboard container.
   - `src/app/components/deals/admin-dashboard/index.ts` (~20 LOC): Barrel export.
   - **Root Facade**: `src/app/components/deals/deals-admin-dashboard.tsx` (~15 LOC).

2. **`src/app/[locale]/portal/[agencySlug]/portal-client.tsx` (589 LOC → `src/app/[locale]/portal/[agencySlug]/client/` + root facade)**
   - `src/app/[locale]/portal/[agencySlug]/client/types.ts` (~60 LOC): Client state, deliverable models, ratio tabs.
   - `src/app/[locale]/portal/[agencySlug]/client/portal-header.tsx` (~110 LOC): Agency branding header, language toggle, active tab bar.
   - `src/app/[locale]/portal/[agencySlug]/client/deliverables-grid.tsx` (~150 LOC): Video asset gallery, status pills, download triggers.
   - `src/app/[locale]/portal/[agencySlug]/client/video-request-form.tsx` (~135 LOC): Prompt generation form, aspect ratio selector.
   - `src/app/[locale]/portal/[agencySlug]/client/portal-client.tsx` (~120 LOC): Composed portal container.
   - `src/app/[locale]/portal/[agencySlug]/client/index.ts` (~20 LOC): Barrel export.
   - **Root Facade**: `src/app/[locale]/portal/[agencySlug]/portal-client.tsx` (~15 LOC).

3. **`src/components/video/adaptive-video-player.tsx` (583 LOC → `src/components/video/player/` + root facade)**
   - `src/components/video/player/types.ts` (~50 LOC): Track definitions, playback options, quality ladders.
   - `src/components/video/player/video-controls.tsx` (~145 LOC): Seek bar, time display, play/pause, volume slider.
   - `src/components/video/player/quality-subtitle-menus.tsx` (~130 LOC): Popover menus for quality and APAC subtitles.
   - `src/components/video/player/forensic-watermark-overlay.tsx` (~120 LOC): Canvas-based dynamic anti-leak overlay.
   - `src/components/video/player/adaptive-video-player.tsx` (~140 LOC): Root HLS video player.
   - `src/components/video/player/index.ts` (~20 LOC): Barrel export.
   - **Root Facade**: `src/components/video/adaptive-video-player.tsx` (~15 LOC).

4. **`src/components/growth/arbitrage-card.tsx` (521 LOC → `src/components/growth/arbitrage/` + root facade)**
   - `src/components/growth/arbitrage/types.ts` (~60 LOC): Arbitrage metrics, HUD structs, platform rows.
   - `src/components/growth/arbitrage/compute-hud.tsx` (~120 LOC): Provider capacity gauge, circuit breaker status.
   - `src/components/growth/arbitrage/platform-matrix.tsx` (~140 LOC): Multi-platform virality score comparison table.
   - `src/components/growth/arbitrage/arbitrage-card.tsx` (~130 LOC): Composed card container with KPI badges.
   - `src/components/growth/arbitrage/index.ts` (~20 LOC): Barrel export.
   - **Root Facade**: `src/components/growth/arbitrage-card.tsx` (~15 LOC).

5. **`src/app/[locale]/ai-video/[niche]/page.tsx` (518 LOC → `src/app/[locale]/ai-video/[niche]/components/` + page)**
   - `src/app/[locale]/ai-video/[niche]/components/types.ts` (~45 LOC): Niche page content, params, and metadata interfaces.
   - `src/app/[locale]/ai-video/[niche]/components/niche-hero.tsx` (~110 LOC): Hero banner with dynamic niche title, CTA and video preview.
   - `src/app/[locale]/ai-video/[niche]/components/niche-features.tsx` (~125 LOC): 3-column benefit grid with icons.
   - `src/app/[locale]/ai-video/[niche]/components/niche-faq.tsx` (~110 LOC): Collapsible FAQ accordion.
   - `src/app/[locale]/ai-video/[niche]/page.tsx` (~140 LOC): Static params generation, server data fetch, fallback handler.

---

### Cluster 2: Backend Domain Services & Server Actions (2,051 LOC)

6. **`src/tree/sales/enterprise-deal-repo.ts` (547 LOC → `src/tree/sales/deals/` + root facade)**
   - `src/tree/sales/deals/deal-queries.ts` (~145 LOC): D1 select queries, filters, pagination, and sorting.
   - `src/tree/sales/deals/deal-mutations.ts` (~140 LOC): Create, update, stage transition, and deletion in D1.
   - `src/tree/sales/deals/deal-metrics.ts` (~130 LOC): Pipeline valuation, BANT distribution, and win-rate aggregations.
   - `src/tree/sales/deals/index.ts` (~30 LOC): Barrel export.
   - **Root Facade**: `src/tree/sales/enterprise-deal-repo.ts` (~20 LOC).

7. **`src/tree/marketplace/marketplace-service.ts` (502 LOC → `src/tree/marketplace/service/` + root facade)**
   - `src/tree/marketplace/service/ranking-algorithms.ts` (~110 LOC): Trending score decay and Bayesian review accrual algorithms.
   - `src/tree/marketplace/service/catalog-queries.ts` (~145 LOC): Catalog search, category filtering, and sorting queries.
   - `src/tree/marketplace/service/template-lifecycle.ts` (~140 LOC): Template submission, AI auto-scoring, review submissions, and royalty triggers.
   - `src/tree/marketplace/service/index.ts` (~25 LOC): Barrel export.
   - **Root Facade**: `src/tree/marketplace/marketplace-service.ts` (~20 LOC).

8. **`src/land/ipo/ipo-management-actions.ts` (501 LOC → `src/land/ipo/actions/` + root facade)**
   - `src/land/ipo/actions/filing-period-actions.ts` (~135 LOC): Create, update, list S-1 filing periods in D1.
   - `src/land/ipo/actions/cta-consolidation-actions.ts` (~140 LOC): Multi-entity ASC 830 consolidation trigger and verification.
   - `src/land/ipo/actions/sox-audit-actions.ts` (~145 LOC): SOX 404 test execution, attestation certificate signing, and quarantine gate.
   - `src/land/ipo/actions/index.ts` (~25 LOC): Barrel export.
   - **Root Facade**: `src/land/ipo/ipo-management-actions.ts` (~20 LOC).

9. **`src/land/agency/agency-portal-actions.ts` (501 LOC → `src/land/agency/portal-actions/` + root facade)**
   - `src/land/agency/portal-actions/onboarding-actions.ts` (~140 LOC): Step-by-step agency onboarding validation and submission.
   - `src/land/agency/portal-actions/subaccount-provisioning-actions.ts` (~145 LOC): Atomic subaccount creation, MCU allocation, seed agent deploy.
   - `src/land/agency/portal-actions/dashboard-metrics-actions.ts` (~135 LOC): Client list, campaign summary, and usage telemetry.
   - `src/land/agency/portal-actions/index.ts` (~25 LOC): Barrel export.
   - **Root Facade**: `src/land/agency/agency-portal-actions.ts` (~20 LOC).

---

### Cluster 3: Foundational Core, RBAC & SDK (2,074 LOC)

10. **`src/sdk/index.ts` (550 LOC → `src/sdk/client/` + root facade)**
    - `src/sdk/client/types.ts` (~80 LOC): Client options, token, request config, error classes.
    - `src/sdk/client/http-transport.ts` (~120 LOC): Fetch wrapper, auth headers, timeout, error mapping.
    - `src/sdk/client/missions-api.ts` (~130 LOC): Mission lifecycle and streaming SSE event handlers.
    - `src/sdk/client/credits-ai-api.ts` (~140 LOC): MCU credits, translation, voice clone, SEO script algorithms.
    - `src/sdk/client/sophia-client.ts` (~110 LOC): Unified `SophiaClient` class composition.
    - `src/sdk/client/index.ts` (~25 LOC): Barrel export.
    - **Root Facade**: `src/sdk/index.ts` (~20 LOC).

11. **`src/seed/auth/workspace-access.ts` (514 LOC → `src/seed/auth/workspace/` + root facade)**
    - `src/seed/auth/workspace/roles.ts` (~80 LOC): Roles enum, hierarchy weights, normalization helpers.
    - `src/seed/auth/workspace/d1-tenant-resolver.ts` (~135 LOC): D1 membership query, fail-closed tenant lookup.
    - `src/seed/auth/workspace/access-verifier.ts` (~145 LOC): Multi-tenant isolation verification and permission checks.
    - `src/seed/auth/workspace/index.ts` (~25 LOC): Barrel export.
    - **Root Facade**: `src/seed/auth/workspace-access.ts` (~20 LOC).

12. **`src/seed/types/multi-asset-clearing.ts` (506 LOC → `src/seed/types/multi-asset-clearing/` + root facade)**
    - `src/seed/types/multi-asset-clearing/enums-constants.ts` (~90 LOC): Asset list, status enums, tolerances, heartbeat thresholds.
    - `src/seed/types/multi-asset-clearing/db-models.ts` (~110 LOC): Raw D1 SQLite table interfaces.
    - `src/seed/types/multi-asset-clearing/domain-models.ts` (~130 LOC): Clean domain models for pools, batches, ledgers, consensus nodes.
    - `src/seed/types/multi-asset-clearing/service-types.ts` (~130 LOC): Input/output contracts for settlement and rebalancing.
    - `src/seed/types/multi-asset-clearing/index.ts` (~20 LOC): Barrel export.
    - **Root Facade**: `src/seed/types/multi-asset-clearing.ts` (~15 LOC).

13. **`src/app/api/sdk/typescript/route.ts` (504 LOC → template extraction + thin route)**
    - `src/app/api/sdk/typescript/sdk-template.ts` (~170 LOC): Generated SDK client source template.
    - `src/app/api/sdk/typescript/route.ts` (~50 LOC): Edge handler with caching and content headers.

---

## 3. Verification & Quality Gates
- **Line Count**: 100% of newly created files and facades strictly `< 200 LOC`.
- **TypeScript**: `npm run type-check` (0 errors).
- **ESLint**: `npm run lint` (0 errors, 0 new suppressions).
- **Layer Boundary Script**: `bash scripts/check-layer-boundaries.sh` (0 violations).
- **i18n Completeness**: `npm run i18n:validate` (0 missing keys).
- **Vitest Suite**: `npm test` passing with 100% green tests.
- **Protected Flows**: Zero regressions on BYOK Setup Wizard, Telegram Bot (`@Sophia_Bbot`), and NOWPayments IPN.
