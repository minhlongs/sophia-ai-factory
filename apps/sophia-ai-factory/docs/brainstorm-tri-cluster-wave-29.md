# Brainstorming: Wave 29 Tri-Cluster Deep Modularization & Architecture Refactor

## 1. Problem Statement & Scope
Following the successful completion of Wave 28 (commit `6dfb8aecb`), the codebase still contains production monoliths exceeding the strict `< 200 LOC` invariant.
In accordance with our Clean Architecture principles (`seed` → `tree` → `forest` → `land`), YAGNI, KISS, and DRY, Wave 29 focuses on decomposing the next top 15 highest-density production monoliths (~3,934 LOC total) into single-responsibility submodules strictly `< 200 LOC`, backed by zero-regression lightweight root facades (`< 25 LOC`).

---

## 2. Target Candidates (15 Monoliths ~ 3,934 LOC)

### Cluster 1: Frontend Views, Charts & Settings UI (5 targets ~ 1,298 LOC)
1. **`src/forest/components/analytics/unified-revenue-chart.tsx` (261L)**: High-density revenue and MRR chart with tooltips and time-series aggregation.
   - *Target Decomposition*: `src/forest/components/analytics/unified-revenue/` (`types.ts`, `chart-tooltip.tsx`, `time-series-aggregator.ts`, `chart-view.tsx`, `index.ts`).
2. **`src/components/autonomy-settings.tsx` (261L)**: Autonomy level and agent safety configuration panel.
   - *Target Decomposition*: `src/components/autonomy/` (`types.ts`, `safety-sliders.tsx`, `autonomy-settings-view.tsx`, `index.ts`).
3. **`src/forest/dashboard/dashboard-activity-table.tsx` (260L)**: Multi-agent and render activity feed table.
   - *Target Decomposition*: `src/forest/dashboard/activity-table/` (`types.ts`, `activity-row.tsx`, `activity-filters.tsx`, `table-view.tsx`, `index.ts`).
4. **`src/app/[locale]/dashboard/system-health/components/harness-health-card.tsx` (259L)**: Edge worker and D1 health status card.
   - *Target Decomposition*: `src/app/[locale]/dashboard/system-health/components/harness-health/` (`types.ts`, `metric-gauge.tsx`, `health-status-badge.tsx`, `card-view.tsx`, `index.ts`).
5. **`src/forest/components/pricing/pricing-card.tsx` (257L)**: Billing tier pricing card with currency formatting and CTA states.
   - *Target Decomposition*: `src/forest/components/pricing/card/` (`types.ts`, `pricing-features-list.tsx`, `pricing-cta-button.tsx`, `pricing-card-view.tsx`, `index.ts`).

### Cluster 2: Workflow Handlers, Webhooks & Disaster Recovery (5 targets ~ 1,316 LOC)
6. **`src/tree/handover/auto-handover.ts` (271L)**: Automated client handover packager and credential scrubber.
   - *Target Decomposition*: `src/tree/handover/auto/` (`types.ts`, `credential-scrubber.ts`, `handover-packager.ts`, `index.ts`).
7. **`src/tree/handover/dr-drill-executor.ts` (265L)**: Disaster recovery drill orchestrator and simulation runner.
   - *Target Decomposition*: `src/tree/handover/dr/` (`types.ts`, `drill-runner.ts`, `status-reporter.ts`, `index.ts`).
8. **`src/land/billing/nowpayments-ipn-dead-letter.ts` (265L)**: Failed IPN webhook queue, retry processor and alert dispatcher.
   - *Target Decomposition*: `src/land/billing/dead-letter/` (`types.ts`, `dead-letter-queue.ts`, `retry-processor.ts`, `index.ts`).
9. **`src/forest/inngest/functions/market-signals-ingest-cron.ts` (262L)**: Cron function polling market and social trend signals.
   - *Target Decomposition*: `src/forest/inngest/functions/market-signals/` (`types.ts`, `signal-poller.ts`, `signal-sanitizer.ts`, `index.ts`).
10. **`src/app/api/webhooks/heygen/route.ts` (258L)**: HeyGen video generation webhook endpoint with HMAC signature validation.
    - *Target Decomposition*: `src/app/api/webhooks/heygen/service/` (`types.ts`, `signature-verifier.ts`, `video-event-processor.ts`, `index.ts`).

### Cluster 3: Domain Protocol, Routing & Data Access (5 targets ~ 1,320 LOC)
11. **`src/tree/agent-protocol/graph-agents.ts` (265L)**: Multi-agent graph coordination and edge traversal protocol.
    - *Target Decomposition*: `src/tree/agent-protocol/graph/` (`types.ts`, `graph-traversal.ts`, `agent-coordinator.ts`, `index.ts`).
12. **`src/tree/mekong/hybrid-router.ts` (261L)**: Routing requests across local LLMs, edge models, and cloud providers.
    - *Target Decomposition*: `src/tree/mekong/router/` (`types.ts`, `cost-evaluator.ts`, `route-selector.ts`, `index.ts`).
13. **`src/tree/sales/sandbox-provisioner.ts` (260L)**: Ephemeral sandbox tenant provisioning and seeding.
    - *Target Decomposition*: `src/tree/sales/sandbox/` (`types.ts`, `tenant-seeder.ts`, `provisioning-runner.ts`, `index.ts`).
14. **`src/forest/publishing/bundle-publisher.ts` (260L)**: Multi-channel batch publishing engine.
    - *Target Decomposition*: `src/forest/publishing/bundle/` (`types.ts`, `channel-batcher.ts`, `bundle-dispatcher.ts`, `index.ts`).
15. **`src/seed/db/org-membership.ts` (258L)**: Tenant organization membership queries and role mutation primitives.
    - *Target Decomposition*: `src/seed/db/membership/` (`types.ts`, `membership-queries.ts`, `role-mutations.ts`, `index.ts`).

---

## 3. Evaluated Approaches & Architectural Trade-offs

| Dimension | Option A: In-Place Helper Extraction | Option B: Tri-Cluster Strangler Pattern (Recommended) |
|---|---|---|
| **Structure** | Keep monoliths, extract miscellaneous utils to arbitrary helper folders. | Decompose each monolith into dedicated sub-folders (`<subfolder>/`) with explicit barrel export `index.ts` and root facade. |
| **Maintainability** | Poor: High coupling, confusing barrel scopes. | Excellent: Clean domain boundaries, files strictly `< 200 LOC`, single responsibility. |
| **Backward Compatibility** | Risky: Can introduce import regressions. | 100%: Root facades re-export identical surface area (`export * from './<subfolder>/index'`). |
| **Test Impact** | Low changes, but doesn't fix cognitive debt. | Zero test breakages, existing tests continue importing from original paths seamlessly. |

---

## 4. Invariants & Quality Standards
- **File Budget**: Every single decomposed file strictly `< 200 LOC`.
- **Root Facades**: Kept `< 25 LOC` (`export * from './...'`).
- **Directives**: Preserve `'use client'` and `'use server'` on relevant view/action files.
- **Logging**: Zero `console.log`; strictly `@/seed/utils/logger-utility`.
- **Types**: Zero `:any`. Strict TypeScript contracts.
- **Layer Cleanliness**: `seed` → `tree` → `forest` → `land` strictly maintained.
