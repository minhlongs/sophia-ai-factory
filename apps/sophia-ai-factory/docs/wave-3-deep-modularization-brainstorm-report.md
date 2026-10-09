# Brainstorm & Architecture Report: Wave 3 Deep Modularization (Clusters A, B, & C)

**Date**: 2026-10-09  
**Status**: Consensus Agreed ("cả 3" — All 3 Clusters)  
**Target File Constraint**: Strict `< 200 LOC` per module  
**Architecture Rules**: Sophia 4-Layer Clean Architecture (`seed` -> `tree` -> `forest` -> `land`), Zero `:any`, Zero `console.log`, 100% Backward-Compatible Facades & Barrel Exports.

---

## 1. Executive Summary & Problem Statement

Following the successful completion of Wave 1 (5 domain services) and Wave 2 (5 core monolithic files), a secondary codebase scan identified 11 remaining monolithic files (>650 LOC each) totaling **8,870 lines of code** across three distinct functional domains:

1. **Cluster A: Core Domain & Infrastructure Engines** (3,302 LOC)
   - `src/tree/finance/financial-close-orchestrator.ts` (835 LOC)
   - `src/tree/cdn/cache-mesh-service.ts` (836 LOC)
   - `src/tree/clearing/multi-asset-clearing-engine.ts` (790 LOC)
   - `src/tree/partners/export-formatter.ts` (841 LOC)
2. **Cluster B: Heavy Client Portals & App Router Screens** (3,750 LOC)
   - `src/app/[locale]/partner/partner-portal-client.tsx` (985 LOC)
   - `src/components/stitch/screens/dashboard/playbook-page.tsx` (955 LOC)
   - `src/app/[locale]/(app)/creator/studio/page.tsx` (944 LOC)
   - `src/app/[locale]/admin/integrations/integrations-portal-client.tsx` (866 LOC)
3. **Cluster C: End-to-End Partner Ecosystem Slice** (2,111 LOC)
   - `src/tree/partners/co-op-engine.ts` (751 LOC)
   - `src/tree/partners/payout-batcher.ts` (692 LOC)
   - `src/land/partners/co-op-actions.ts` (668 LOC)

The user selected **"cả 3"** (execute all 3 clusters in an end-to-end phased sequence).

---

## 2. Cluster Architectural Decomposition Strategy

### Cluster A: Core Domain & Infrastructure Engines
*Goal: Decompose into clean, stateless algorithmic modules + D1 repository mappers, isolating financial idempotency and caching mechanics.*

#### A1. `src/tree/finance/financial-close-orchestrator.ts` (835 LOC → `src/tree/finance/close/`)
- `types.ts`: Close period models, balance rollups, reconciliation ledger records (<80 LOC).
- `constants.ts`: Reconciliation tolerances, currency decimals, close period statuses (<40 LOC).
- `period-validator.ts`: Status transition guards (OPEN -> RECONCILING -> CLOSED -> LOCKED) (<120 LOC).
- `balance-rollup-calculator.ts`: Ledger debit/credit summation and variance verification (<150 LOC).
- `reconciliation-journal.ts`: D1 idempotency transaction checks and period closing lock records (<160 LOC).
- `unposted-entries-sweeper.ts`: Detects unposted invoices, pending payouts, or unverified refunds (<140 LOC).
- `audit-trail-generator.ts`: Cryptographic SHA-256 hash chaining of closing balance snapshots (<130 LOC).
- `index.ts`: Public API re-export (<30 LOC).
- **Facade**: `src/tree/finance/financial-close-orchestrator.ts` (<20 LOC).

#### A2. `src/tree/cdn/cache-mesh-service.ts` (836 LOC → `src/tree/cdn/mesh/`)
- `types.ts`: Cache node definitions, invalidation routes, purge payloads (<80 LOC).
- `constants.ts`: TTL defaults, edge POP zones, retry backoffs (<40 LOC).
- `invalidation-router.ts`: Fast tag-based and path-based purge routing (<140 LOC).
- `cache-key-builder.ts`: Deterministic hashing of multi-tenant query params and headers (<110 LOC).
- `edge-warmup-crawler.ts`: Pre-warming CDN endpoints post-deploy or post-invalidation (<150 LOC).
- `purge-circuit-breaker.ts`: Circuit breaker protection against Cloudflare/Fastly rate limits (<130 LOC).
- `mesh-telemetry.ts`: Hit/miss ratio aggregation and latency telemetry recorder (<120 LOC).
- `index.ts`: Public API re-export (<25 LOC).
- **Facade**: `src/tree/cdn/cache-mesh-service.ts` (<20 LOC).

#### A3. `src/tree/clearing/multi-asset-clearing-engine.ts` (790 LOC → `src/tree/clearing/multi-asset/`)
- `types.ts`: Settlement transactions, asset classes, clearing vouchers (<80 LOC).
- `constants.ts`: Settlement cutoffs, haircut percentages, exchange rate tolerance (<40 LOC).
- `netting-calculator.ts`: Multilateral obligation netting and bilateral counterparty offsets (<160 LOC).
- `collateral-evaluator.ts`: Margin requirements, haircut calculations, and collateral sufficiency (<150 LOC).
- `escrow-allocation-service.ts`: Atomic D1 allocation of escrow vouchers (<170 LOC).
- `settlement-batcher.ts`: Batched clearing transaction generation with CAS checks (<150 LOC).
- `index.ts`: Public API re-export (<25 LOC).
- **Facade**: `src/tree/clearing/multi-asset-clearing-engine.ts` (<20 LOC).

#### A4. `src/tree/partners/export-formatter.ts` (841 LOC → `src/tree/partners/export/`)
- `types.ts`: Export request, stream options, row serialization formats (<70 LOC).
- `csv-serializer.ts`: Escaped RFC 4180 CSV generation with chunk streaming (<140 LOC).
- `json-serializer.ts`: NDJSON / formatted JSON generator (<110 LOC).
- `excel-formatter.ts`: Styled XML/XLSX builder with multi-sheet workbook support (<175 LOC).
- `pdf-summary-builder.ts`: Text-table summary layout for statements (<165 LOC).
- `sanitizer-utility.ts`: Strips formula injection hazards (`=`, `+`, `-`, `@`) (<90 LOC).
- `index.ts`: Public API re-export (<25 LOC).
- **Facade**: `src/tree/partners/export-formatter.ts` (<20 LOC).

---

### Cluster B: Heavy Client Portals & App Router Screens
*Goal: Decouple monolithic React client views into container-presentational components, dedicated custom hooks, and isolated UI sub-cards.*

#### B1. `src/app/[locale]/partner/partner-portal-client.tsx` (985 LOC → `src/forest/partner/portal/`)
- `types.ts`: Props, partner dashboard views, tab definitions (<70 LOC).
- `use-partner-portal-state.ts`: Active tabs, date filtering, query mutations hook (<160 LOC).
- `partner-header.tsx`: Header title, profile summary, balance pill, export CTA (<110 LOC).
- `payouts-tab.tsx`: Historical payouts table, pending withdrawal requests, method selector (<170 LOC).
- `analytics-tab.tsx`: Conversion rates, traffic charts, referral links breakdown (<165 LOC).
- `co-op-campaigns-tab.tsx`: Active co-op marketing programs, budget usage, claim submissions (<175 LOC).
- `settings-tab.tsx`: Webhook URLs, notification preferences, payout settings (<140 LOC).
- `index.ts`: Barrel export (<30 LOC).
- **Facade**: `src/app/[locale]/partner/partner-portal-client.tsx` (<80 LOC).

#### B2. `src/components/stitch/screens/dashboard/playbook-page.tsx` (955 LOC → `src/components/stitch/screens/dashboard/playbook/`)
- `types.ts`: Playbook step models, active run state, agent prompt configs (<70 LOC).
- `use-playbook-runner.ts`: Execution state machine, step advancement, error recovery hook (<170 LOC).
- `playbook-header.tsx`: Title, status badge, estimated run duration, trigger button (<120 LOC).
- `playbook-timeline.tsx`: Stepper diagram showing dependencies and real-time execution node status (<165 LOC).
- `step-detail-card.tsx`: Inspector drawer showing prompt, parameters, logs, outputs (<170 LOC).
- `playbook-metrics.tsx`: Token consumption, generation speed, cost tracker card (<130 LOC).
- `index.ts`: Barrel export (<25 LOC).
- **Facade**: `src/components/stitch/screens/dashboard/playbook-page.tsx` (<60 LOC).

#### B3. `src/app/[locale]/(app)/creator/studio/page.tsx` (944 LOC → `src/forest/creator/studio/`)
- `types.ts`: Studio canvas state, timeline tracks, asset library filters (<70 LOC).
- `use-studio-project.ts`: Video draft state, auto-save debounce, render trigger hook (<165 LOC).
- `studio-toolbar.tsx`: Undo/redo, aspect ratio picker (9:16 vs 16:9), preview resolution, render CTA (<130 LOC).
- `timeline-editor.tsx`: Multi-track scrubber (voiceover, B-roll, captions, background audio) (<180 LOC).
- `script-editor-card.tsx`: AI prompt generator, scene breakdown, text-to-speech selector (<170 LOC).
- `preview-player.tsx`: Canvas preview player with timecode overlay (<145 LOC).
- `index.ts`: Barrel export (<30 LOC).
- **Facade**: `src/app/[locale]/(app)/creator/studio/page.tsx` (<80 LOC).

#### B4. `src/app/[locale]/admin/integrations/integrations-portal-client.tsx` (866 LOC → `src/forest/admin/integrations/`)
- `types.ts`: Integration provider interfaces, credential test statuses (<70 LOC).
- `use-integrations-state.ts`: Active provider, API key tests, modal visibility hook (<150 LOC).
- `provider-card.tsx`: Individual integration card (OpenRouter, ElevenLabs, D-ID, HeyGen, NOWPayments) (<160 LOC).
- `provider-filter-bar.tsx`: Search input, category filter chips (AI Video, Voice, Payments, CRM) (<110 LOC).
- `key-rotation-dialog.tsx`: Modal for securely updating & testing API keys (<175 LOC).
- `health-status-badge.tsx`: Latency status, circuit breaker state, error tooltip (<120 LOC).
- `index.ts`: Barrel export (<25 LOC).
- **Facade**: `src/app/[locale]/admin/integrations/integrations-portal-client.tsx` (<60 LOC).

---

### Cluster C: End-to-End Partner Ecosystem Slice
*Goal: Cleanly decouple co-op marketing fund rules, batch payouts, and Server Actions into granular domain units.*

#### C1. `src/tree/partners/co-op-engine.ts` (751 LOC → `src/tree/partners/co-op/`)
- `types.ts`: Co-op fund claims, allocation tiers, audit proofs (<70 LOC).
- `constants.ts`: Maximum match rates, claim verification window (<35 LOC).
- `eligibility-checker.ts`: Evaluates partner tier, rolling GMV, compliance standing (<150 LOC).
- `budget-allocator.ts`: Calculates match amounts based on matching tiers (<140 LOC).
- `claim-verifier.ts`: Verifies invoice receipts and campaign deliverables (<160 LOC).
- `ledger-recorder.ts`: D1 records insertion for co-op credit/debit reserves (<165 LOC).
- `index.ts`: Barrel export (<25 LOC).
- **Facade**: `src/tree/partners/co-op-engine.ts` (<20 LOC).

#### C2. `src/tree/partners/payout-batcher.ts` (692 LOC → `src/tree/partners/payouts/`)
- `types.ts`: Batch payout requests, rail types (SEPA, ACH, Crypto, PayPal) (<75 LOC).
- `constants.ts`: Minimum payout thresholds, batch limits (<35 LOC).
- `threshold-filter.ts`: Groups eligible partner balances exceeding threshold (<130 LOC).
- `fee-deductor.ts`: Calculates transfer fees by payment method rail (<120 LOC).
- `batch-lock-manager.ts`: Atomic D1 lock reservation to prevent double payouts (<160 LOC).
- `payout-instruction-builder.ts`: Formats banking/crypto transfer payloads (<150 LOC).
- `index.ts`: Barrel export (<25 LOC).
- **Facade**: `src/tree/partners/payout-batcher.ts` (<20 LOC).

#### C3. `src/land/partners/co-op-actions.ts` (668 LOC → `src/land/partners/actions/`)
- `types.ts`: Action result types and client input schemas (<65 LOC).
- `submit-claim-action.ts`: Server action for submitting new co-op funding claims (<150 LOC).
- `approve-claim-action.ts`: Server action for partner managers to approve claims (<160 LOC).
- `allocate-budget-action.ts`: Server action for programmatic quarterly budget allocation (<140 LOC).
- `query-co-op-summary.ts`: Server action fetching partner co-op balance and history (<135 LOC).
- `index.ts`: Re-export all server actions (<25 LOC).
- **Facade**: `src/land/partners/co-op-actions.ts` (<30 LOC).

---

## 3. Implementation Phasing & Quality Gates

| Phase | Scope | Total Original LOC | Target Submodules | Verification Gate |
|---|---|---|---|---|
| **Phase 1** | Cluster A: Core Domain & Infra (`financial-close`, `cache-mesh`, `clearing-engine`, `export-formatter`) | 3,302 LOC | ~24 files (<200 LOC) | `npm run type-check`, `scripts/check-layer-boundaries.sh`, Vitest core suite |
| **Phase 2** | Cluster B: Client Portals & App Router (`partner-portal`, `playbook-page`, `creator/studio`, `integrations-portal`) | 3,750 LOC | ~26 files (<200 LOC) | `npm run type-check`, `npm run i18n:validate`, Vitest UI tests |
| **Phase 3** | Cluster C: Partner Vertical Slice (`co-op-engine`, `payout-batcher`, `co-op-actions`) | 2,111 LOC | ~18 files (<200 LOC) | `npm run type-check`, `scripts/check-layer-boundaries.sh`, Vitest partner suite |
| **Phase 4** | Final Repository Quality Gate & Git Commit | 8,870 LOC | 68 files (<200 LOC) | Full test suite green, 0 `:any`, 0 `console.log`, clean commit |

---

## 4. Risks & Mitigations

1. **Next.js App Router Page Boundaries**:
   - `creator/studio/page.tsx` is an App Router entry point. We keep the default export in `page.tsx` thin (<80 LOC), rendering container components extracted under `forest/creator/studio/`.
2. **Server Actions (`'use server'`)**:
   - `land/partners/co-op-actions.ts` contains Server Actions. In Next.js, each file re-exporting actions must declare `'use server'` at top or export async functions cleanly without leaking client state.
3. **Financial Math & Rounding**:
   - Integer-cent precision must be preserved across all balance calculations in `financial-close` and `clearing-engine` to prevent float precision drift.
