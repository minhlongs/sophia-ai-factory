# Brainstorming Report: Full-Spectrum Modularization & Architecture Refactor (Wave 13)

**Date**: 2026-10-10  
**Target**: Sophia AI Factory (`apps/sophia-ai-factory/src/`)  
**Scope**: Full-Spectrum ("Cả 3"): Core Engines, Frontend Views, and Hybrid Shared Infrastructure  
**Invariant**: Strictly `< 200 LOC` per file, Zero `:any`, Zero `console.log`, 100% Backward-Compatible Facades, 0 Quality Gate Failures.

---

## 1. Problem Statement & Context
The codebase currently contains 503 production files exceeding the strict 200 LOC threshold, creating context dilution and high maintenance overhead for autonomous agent pipelines. Specifically:
1. **Core Engines (Backend)**: Critical orchestrators (`viral-distributor.ts`, `enterprise-proposal-service.ts`, `affiliate-attribution.ts`, `scoring.ts`, `memory-extractor.ts`, `revenue-recognition-engine.ts`) bundle multiple responsibilities (parsing, database queries, mathematical modeling, external dispatch) in single files > 430 LOC.
2. **Frontend Views (UI/UX)**: Complex client dashboards and drawer modals (`dashboard-overview.tsx`, `checkout-page.tsx`, `affiliate-offer-drawer.tsx`, `invite-affiliate-modal.tsx`, `agent-team-configurator.tsx`) combine data fetching, state machine transitions, form validation, and multi-tier rendering in single files > 420 LOC.
3. **Shared Infrastructure & Platform**: Authentication and localized assets (`better-auth-server.ts`, `localized-profiles.ts`, `right-to-be-forgotten-engine.ts`) mix cryptographic operations, storage persistence, and locale matrices.

---

## 2. Evaluated Approaches

| Strategy | Pros | Cons | Verdict |
| :--- | :--- | :--- | :--- |
| **Option A: Mega Big-Bang (All 500+ files at once)** | Reaches 100% compliance in one massive sweep | Extreme merge conflict risk, huge diff, high regression probability | ❌ Rejected (Violates KISS & YAGNI) |
| **Option B: Isolated Single Cluster (Engines only)** | Lower immediate risk, focused scope | Leaves oversized UI components untouched, partial architectural debt | ❌ Rejected (User opted for "Cả 3") |
| **Option C: Phased Tri-Cluster Wave 13 (Top 15 High-Risk Monoliths: 5 Engines + 5 Frontend + 5 Infra)** | Delivers "Cả 3" across backend, frontend, and infra; keeps backward-compatible facades; ensures zero build breakages and passes all quality gates cleanly | Requires disciplined facade patterns and meticulous sub-module factoring | ✅ **Recommended** |

---

## 3. Wave 13 Target Matrix (15 Targets ~ 6,550 LOC)

### Cluster 1: Core Backend Engines (5 Targets)
1. **`src/forest/publishing/viral-distributor.ts` (448L)** → `src/forest/publishing/distributor/`:
   - `types.ts`, `platform-formatter.ts`, `schedule-optimizer.ts`, `viral-distributor.ts`, `index.ts` + root facade.
2. **`src/tree/sales/enterprise-proposal-service.ts` (446L)** → `src/tree/sales/proposal/`:
   - `types.ts`, `pricing-calculator.ts`, `terms-generator.ts`, `proposal-service.ts`, `index.ts` + root facade.
3. **`src/tree/affiliates/affiliate-attribution.ts` (446L)** → `src/tree/affiliates/attribution/`:
   - `types.ts`, `cookie-parser.ts`, `decay-calculator.ts`, `attribution-engine.ts`, `index.ts` + root facade.
4. **`src/tree/performance/scoring.ts` (445L)** → `src/tree/performance/scoring/`:
   - `types.ts`, `engagement-scorer.ts`, `retention-scorer.ts`, `performance-scorer.ts`, `index.ts` + root facade.
5. **`src/tree/finance/revenue-recognition-engine.ts` (439L)** → `src/tree/finance/recognition/`:
   - `types.ts`, `amortization-schedule.ts`, `compliance-audit.ts`, `revenue-engine.ts`, `index.ts` + root facade.

### Cluster 2: Frontend Monoliths (5 Targets)
6. **`src/components/stitch/screens/dashboard-overview/dashboard-overview.tsx` (446L)** → `src/components/stitch/screens/dashboard-overview/`:
   - `types.ts`, `metrics-summary.tsx`, `quick-actions.tsx`, `recent-activity.tsx`, `dashboard-view.tsx`, `index.ts`.
7. **`src/components/stitch/screens/checkout/checkout-page.tsx` (435L)** → `src/components/stitch/screens/checkout/`:
   - `types.ts`, `order-summary.tsx`, `payment-methods.tsx`, `checkout-form.tsx`, `index.ts`.
8. **`src/forest/components/missions/agent-team-configurator.tsx` (434L)** → `src/forest/components/missions/team-config/`:
   - `types.ts`, `persona-selector.tsx`, `budget-allocator.tsx`, `team-configurator-view.tsx`, `index.ts` + root facade.
9. **`src/components/stitch/screens/affiliates/affiliate-offer-drawer.tsx` (426L)** → `src/components/stitch/screens/affiliates/drawer/`:
   - `types.ts`, `offer-details.tsx`, `payout-terms.tsx`, `drawer-view.tsx`, `index.ts`.
10. **`src/components/stitch/screens/affiliates/invite-affiliate-modal.tsx` (420L)** → `src/components/stitch/screens/affiliates/invite/`:
    - `types.ts`, `email-input.tsx`, `tier-assignment.tsx`, `invite-modal-view.tsx`, `index.ts`.

### Cluster 3: Shared Infrastructure & Security Primitives (5 Targets)
11. **`src/seed/voices/localized-profiles.ts` (445L)** → `src/seed/voices/profiles/`:
    - `types.ts`, `vietnamese-profiles.ts`, `english-profiles.ts`, `profile-resolver.ts`, `index.ts` + root facade.
12. **`src/tree/memory/memory-extractor.ts` (440L)** → `src/tree/memory/extractor/`:
    - `types.ts`, `entity-extractor.ts`, `semantic-summarizer.ts`, `memory-extractor.ts`, `index.ts` + root facade.
13. **`src/tree/sovereignty/right-to-be-forgotten-engine.ts` (439L)** → `src/tree/sovereignty/forgotten/`:
    - `types.ts`, `tombstone-writer.ts`, `cascading-purger.ts`, `rtbf-engine.ts`, `index.ts` + root facade.
14. **`src/seed/auth/better-auth-server.ts` (437L)** → `src/seed/auth/server/`:
    - `types.ts`, `d1-adapter-helpers.ts`, `plugin-configs.ts`, `auth-instance.ts`, `index.ts` + root facade.
15. **`src/land/affiliates/affiliate-partner-service.ts` (434L)** → `src/land/affiliates/partners/`:
    - `types.ts`, `partner-registration.ts`, `commission-calculator.ts`, `partner-service.ts`, `index.ts` + root facade.

---

## 4. Architectural Invariants & Quality Contract
1. **File Budget**: Zero files $\ge$ 200 LOC in newly modularized directories.
2. **Clean Layer Rules**:
   - `seed` (primitives) $\rightarrow$ `tree` (reusable domain) $\rightarrow$ `forest` (orchestrators) $\rightarrow$ `land` (workflows).
   - Only Forest $\rightarrow$ Land orchestration is allowed.
3. **Backward Compatibility**: Every original file path retains a thin facade (`export * from './<subfolder>/index';`) so no imports break anywhere across tests or apps.
4. **Code Quality**: Zero `:any` types; Zero `console.log` (logger utility only); Zod validation where applicable.
5. **Quality Gates**:
   - `npm run type-check` (0 errors)
   - `npm run lint` (0 errors)
   - `bash scripts/check-layer-boundaries.sh` (0 violations)
   - `npm run i18n:validate` (0 missing keys)
   - `npm test` (100% green)
