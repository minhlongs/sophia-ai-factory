# Brainstorm: Wave 27 Tri-Cluster Deep Modularization & Architecture Refactor

## Context & Problem Statement
Following Wave 26 (15 monoliths decomposed into 67 submodules strictly `< 200 LOC`), 290 production files (excluding tests) remain above the `< 200 LOC` threshold.

Large files (268L - 287L) in high-traffic production paths present:
1. Context window saturation during autonomous agent coding and debugging loops.
2. Tight coupling between database mutations, external webhooks, UI rendering, and business logic.
3. Elevated regression risks during daily feature iteration.

## Tri-Cluster Decomposition Targets (Top 15 Production Monoliths, ~4,171 LOC)

### Cluster 1: Business Operations, Marketplaces & Missions (~1,376 LOC)
1. `src/land/marketplace/marketplace-actions.ts` (285L) → `src/land/marketplace/actions/`
   - Goal: Extract listing mutations, template purchasing, licensing verification, and creator royalty settlement.
2. `src/land/missions/auto-video-mission.ts` (282L) → `src/land/missions/auto-video/`
   - Goal: Decompose mission scheduling, prompt synthesis, batch runner, and mission telemetry.
3. `src/land/billing/actions/change-tier-action.ts` (270L) → `src/land/billing/actions/tier-change/`
   - Goal: Separate tier transition validation, proration calculation, and D1 state update.
4. `src/land/marketplace/creator-template-card.tsx` (269L) → `src/land/marketplace/template-card/`
   - Goal: Split UI card presentation, preview modal launcher, pricing badge, and action handlers.
5. `src/app/api/webhooks/nowpayments/route.ts` (270L) → `src/app/api/webhooks/nowpayments/service/`
   - Goal: Extract IPN signature verification, tier upgrade execution, top-up credit allocation, and route handler.

### Cluster 2: Forest Automation, Intelligence & Communications (~1,374 LOC)
6. `src/forest/bi/telegram-digest-sender.ts` (287L) → `src/forest/bi/telegram-digest/`
   - Goal: Decompose daily metrics aggregation, markdown message formatter, rate-limited bot dispatch, and error handling.
7. `src/tree/queue/dlq-alert-dispatcher.ts` (274L) → `src/tree/queue/dlq-alerts/`
   - Goal: Extract DLQ threshold evaluation, alert payload formatting, webhook dispatcher, and deduplication.
8. `src/tree/telegram/telegram-client.ts` (273L) → `src/tree/telegram/client/`
   - Goal: Extract HTTP transport, circuit breaker protection, retry mechanics, and response parsing.
9. `src/forest/inngest/functions/analytics-sync.ts` (272L) → `src/forest/inngest/functions/analytics/`
   - Goal: Separate event batch collection, D1 bulk persistence, rollup computation, and retry handling.
10. `src/forest/agents/daily-briefing/briefing-generator.ts` (268L) → `src/forest/agents/daily-briefing/generator/`
    - Goal: Split briefing prompt assembly, AI model dispatch, audio script generation, and queue publishing.

### Cluster 3: Platform Primitives, Tenant Tokens & Domain Engines (~1,421 LOC)
11. `src/tree/autonomy/autonomy-repo.ts` (286L) → `src/tree/autonomy/repo/`
    - Goal: Decompose D1 CRUD operations, policy record management, execution logs, and transaction queries.
12. `src/tree/agy/tenant-token-engine.ts` (286L) → `src/tree/agy/token-engine/`
    - Goal: Separate token issuance, quota verification, JWT signing, and token revocation.
13. `src/tree/billing/annual-commitment-engine.ts` (285L) → `src/tree/billing/annual-commitment/`
    - Goal: Extract annual commitment math, discount modeling, renewal scheduling, and spend enforcement.
14. `src/tree/predictive/account-expansion-engine.ts` (283L) → `src/tree/predictive/account-expansion/`
    - Goal: Separate usage velocity scoring, expansion threshold triggers, recommendation builder, and D1 persistence.
15. `src/tree/branding/theme-resolver.ts` (281L) → `src/tree/branding/theme-resolver/`
    - Goal: Extract theme color derivation, CSS custom property injection, tenant override resolution, and defaults.

---

## Architectural Invariants & Quality Standards
- **File Budget**: Strictly `< 200 LOC` per file across all newly created submodules.
- **Root Facade Strangler Pattern**: Root files preserved as backward-compatible facades (`< 25 LOC`), preserving all public types, functions, and server action directives (`'use server'`).
- **Clean Layer Boundaries**: `seed` → `tree` → `forest` → `land`. No illegal cross-layer or upward imports (only Forest → Land orchestration permitted).
- **Quality Gates**:
  1. `npm run type-check` (0 errors)
  2. `npm run lint -- --quiet` (0 errors)
  3. `bash scripts/check-layer-boundaries.sh` (0 violations)
  4. `npm run i18n:validate` (passed)
  5. `npx vitest run` (100% green tests)
  6. Zero `:any` types, zero `console.log` statements in production code.
