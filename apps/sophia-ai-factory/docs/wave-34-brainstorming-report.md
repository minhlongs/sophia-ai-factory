# Brainstorming Report: Wave 34 Tri-Cluster Deep Modularization

## 1. Problem Statement & Context
Following Wave 33 (17,260 tests green, 0 type/lint errors), an audit reveals 15 mission-critical production monoliths (218L–227L, ~3,310 LOC total) across the codebase. These files span Server Actions, Edge Pages, Domain Repositories, Security Primitives, and Multi-Platform Publishing Adapters.

## 2. Core Architectural Principles
- **Strict File Budget Invariant**: Every submodule must be strictly `< 200 LOC`.
- **Root Facades**: Original root files become lightweight backward-compatible facades strictly `< 25 LOC`.
- **Clean Architecture Hierarchy**: Enforce `seed` → `tree` → `forest` → `land` unidirectional flow.
- **Directives & Conventions**: Preserve `'use server'` and `'use client'` where appropriate. Add `// i18n-namespace: <ns>` at line 1 of UI components.

## 3. Wave 34 Target Inventory (15 Monoliths ~ 3,310 LOC)

### Cluster 1: Edge Routes, Web Pages & Server Actions (5 Targets ~ 1,102 LOC)
1. `src/app/actions/billing/subscription.ts` (220L) → `src/app/actions/billing/subscription/` (types, checkout-action, portal-action, cancel-action, index) + facade `< 20L`
2. `src/app/actions/agent-team-config.ts` (219L) → `src/app/actions/agent-team-config/` (types, member-config, permission-action, team-action, index) + facade `< 20L`
3. `src/app/[locale]/affiliate/page.tsx` (221L) → `src/app/[locale]/affiliate/components/` (types, hero-banner, commission-tier-cards, affiliate-portal-view, index) + facade `< 20L`
4. `src/app/(app)/dashboard/admin/monitoring/page.tsx` (219L) → `src/app/(app)/dashboard/admin/monitoring/components/` (types, metric-cards, alert-table, admin-monitoring-view, index) + facade `< 20L`
5. `src/land/cdn/cdn-actions.ts` (222L) → `src/land/cdn/actions/` (types, purge-actions, config-actions, edge-rules, index) + facade `< 20L`

### Cluster 2: Enterprise Repositories & Domain Engines (5 Targets ~ 1,114 LOC)
6. `src/land/affiliates/scout/writer.ts` (227L) → `src/land/affiliates/scout/writer/` (types, opportunity-formatter, d1-writer, writer-service, index) + facade `< 20L`
7. `src/land/sop-marketplace/leaderboard-ext.ts` (224L) → `src/land/sop-marketplace/leaderboard/` (types, ranking-calculator, badge-evaluator, leaderboard-service, index) + facade `< 20L`
8. `src/forest/agents/repository.ts` (222L) → `src/forest/agents/repository/` (types, agent-queries, agent-mutations, agent-repository, index) + facade `< 20L`
9. `src/seed/db/repositories/sop-execution-analytics/sop-execution-metrics-repo.ts` (218L) → `src/seed/db/repositories/sop-execution-analytics/` (subdivided into modular queries/mutations) + facade `< 20L`
10. `src/land/graphs/actions.ts` (218L) → `src/land/graphs/actions/` (types, topology-actions, node-actions, edge-actions, index) + facade `< 20L`

### Cluster 3: Security, Video Publishing & Core Platform (5 Targets ~ 1,094 LOC)
11. `src/seed/i18n/caption-translator.ts` (227L) → `src/seed/i18n/caption-translator/` (types, timing-parser, chunk-translator, translation-service, index) + facade `< 20L`
12. `src/tree/api/agent-api-auth.ts` (220L) → `src/tree/api/agent-auth/` (types, key-validator, rate-limiter, auth-middleware, index) + facade `< 20L`
13. `src/tree/mekong/crypto.ts` (219L) → `src/tree/mekong/crypto/` (types, key-derivation, aes-cipher, signature-verifier, index) + facade `< 20L`
14. `src/land/video/publishing/providers/zalo-publisher.ts` (217L) → `src/land/video/publishing/providers/zalo/` (types, payload-builder, zalo-api-client, zalo-publisher-service, index) + facade `< 20L`
15. `src/land/affiliates/providers/amazon.ts` (218L) → `src/land/affiliates/providers/amazon/` (types, paapi-client, product-parser, amazon-provider-service, index) + facade `< 20L`

## 4. Quality Gate Protocol
- File size `< 200 LOC` per submodule; root facades `< 25 LOC`
- TypeScript check (`npm run type-check`) 0 errors
- ESLint (`npm run lint -- --quiet`) 0 errors, 0 new suppressions
- Layer boundary checks (`bash scripts/check-layer-boundaries.sh`) 0 violations
- i18n validator (`npm run i18n:validate`) 0 missing keys
- Vitest suite (`npm test`) 100% green
