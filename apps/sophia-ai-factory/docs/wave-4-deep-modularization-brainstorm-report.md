# Brainstorming Report: Deep Modularization of Wave 4 (All 3 Clusters — 12 Monolithic Files < 200 LOC)

## Executive Summary
Following the user command to refactor **All 3 Clusters (Comprehensive)**, this document outlines the architectural blueprint, decomposition strategy, layer boundaries, and testing regimen for refactoring 12 oversized files totaling ~8,251 lines of code in Sophia AI Factory.

Every file created will strictly observe:
1. **< 200 LOC Rule**: Every extracted submodule and root facade will be strictly under 200 lines.
2. **Sophia 4-Layer Clean Architecture**: Unidirectional dependencies `seed` -> `tree` -> `forest` -> `land`. Zero forbidden cross-layer imports.
3. **100% Backward Compatibility**: Root files preserved as thin facades re-exporting public functions, interfaces, and constants.
4. **Code Quality**: Zero `:any` types, zero `console.log` (use `@/seed/utils/logger-utility`), and zero unvalidated inputs.

---

## 1. Scope & Target Breakdown

### Cluster 1: Handover, Day 1 Verification & Runbook Architecture (~2,896 LOC)
1. **`src/tree/handover/day1-verification-engine.ts`** (750 LOC)
   - *Target Directory*: `src/tree/handover/day1/`
   - *Submodules*:
     - `types.ts` (< 100 LOC): Verification checks, execution report, status types
     - `constants.ts` (< 50 LOC): Timeout thresholds, critical SLAs, error codes
     - `byok-verifier.ts` (< 180 LOC): Verification of OpenRouter, ElevenLabs, D-ID, HeyGen keys
     - `webhook-verifier.ts` (< 160 LOC): Telegram bot, NOWPayments, CRM webhook checks
     - `db-pipeline-verifier.ts` (< 160 LOC): D1 connectivity, KV cache, R2 bucket checks
     - `scoring-reporter.ts` (< 140 LOC): Aggregation of readiness score & SLA compliance
     - `day1-engine.ts` (< 170 LOC): Main orchestrator executing checks in parallel
     - `index.ts` (< 30 LOC): Barrel export
   - *Facade*: `src/tree/handover/day1-verification-engine.ts` (< 30 LOC)

2. **`src/tree/handover/runbook-catalog-service.ts`** (611 LOC)
   - *Target Directory*: `src/tree/handover/runbook/`
   - *Submodules*:
     - `types.ts` (< 80 LOC): Runbook, incident step, execution log interfaces
     - `constants.ts` (< 40 LOC): Standard runbook categories & severity tags
     - `catalog-queries.ts` (< 160 LOC): D1 retrieval of runbooks & search filters
     - `step-validator.ts` (< 150 LOC): Input validation & parameter checking
     - `execution-tracker.ts` (< 160 LOC): D1 audit logging of step execution
     - `catalog-mutations.ts` (< 140 LOC): Create, update, archive runbook procedures
     - `index.ts` (< 30 LOC): Barrel export
   - *Facade*: `src/tree/handover/runbook-catalog-service.ts` (< 30 LOC)

3. **`src/forest/components/handover/handover-acceptance-client.tsx`** (817 LOC)
   - *Target Directory*: `src/forest/components/handover/acceptance/`
   - *Submodules*:
     - `types.ts` (< 70 LOC): Props, checklist items, acceptance state
     - `use-acceptance-state.ts` (< 180 LOC): Hook managing signature, checklist, and submission
     - `acceptance-header.tsx` (< 120 LOC): Hero card with milestone status & handover metadata
     - `checklist-section.tsx` (< 170 LOC): Interactive verification checklist table
     - `signature-pad-card.tsx` (< 160 LOC): Digital signature capture & consent agreement
     - `export-summary-card.tsx` (< 140 LOC): Download PDF/JSON handover packet card
     - `index.ts` (< 30 LOC): Barrel export
   - *Facade*: `src/forest/components/handover/handover-acceptance-client.tsx` (< 35 LOC)

4. **`src/forest/components/handover/handover-admin-console-client.tsx`** (718 LOC)
   - *Target Directory*: `src/forest/components/handover/admin-console/`
   - *Submodules*:
     - `types.ts` (< 70 LOC): Admin console props, filter criteria, log items
     - `use-admin-console-data.ts` (< 175 LOC): Data fetching, polling, status updates hook
     - `tenant-filter-bar.tsx` (< 120 LOC): Search, tenant select, status dropdown
     - `handover-status-table.tsx` (< 180 LOC): Paginated handover pipeline table
     - `handover-actions-modal.tsx` (< 160 LOC): Override, re-trigger, or force-sign modal
     - `index.ts` (< 30 LOC): Barrel export
   - *Facade*: `src/forest/components/handover/handover-admin-console-client.tsx` (< 35 LOC)

---

### Cluster 2: Unit Economics & Affiliate Ledger (~2,677 LOC)
5. **`src/tree/affiliates/affiliate-ledger-service.ts`** (690 LOC)
   - *Target Directory*: `src/tree/affiliates/ledger/`
   - *Submodules*:
     - `types.ts` (< 80 LOC): Ledger entry, commission tier, referral conversion types
     - `constants.ts` (< 40 LOC): Default commission rates, lockup duration, payout minimums
     - `commission-calculator.ts` (< 160 LOC): Tiered commission calculation, multi-level splits
     - `ledger-writer.ts` (< 170 LOC): D1 atomic transaction logging with idempotency
     - `ledger-queries.ts` (< 160 LOC): Balance, pending payouts, transaction history queries
     - `clawback-handler.ts` (< 140 LOC): Refund & chargeback commission reversal
     - `index.ts` (< 30 LOC): Barrel export
   - *Facade*: `src/tree/affiliates/affiliate-ledger-service.ts` (< 30 LOC)

6. **`src/forest/actions/affiliate-actions.ts`** (632 LOC)
   - *Target Directory*: `src/forest/actions/affiliates/`
   - *Submodules*:
     - `types.ts` (< 70 LOC): Action inputs, DTOs, validation schemas
     - `referral-actions.ts` (< 160 LOC): Generate referral link, track click & attribution
     - `payout-request-actions.ts` (< 170 LOC): Affiliate payout request submission & status
     - `affiliate-query-actions.ts` (< 160 LOC): Dashboard summary & earnings metrics actions
     - `index.ts` (< 30 LOC): Barrel export
   - *Facade*: `src/forest/actions/affiliate-actions.ts` (< 25 LOC)

7. **`src/land/economics/unit-economics-service.ts`** (628 LOC)
   - *Target Directory*: `src/land/economics/service/`
   - *Submodules*:
     - `types.ts` (< 80 LOC): MCU cost, COGS breakdown, customer lifetime gross margin
     - `constants.ts` (< 40 LOC): GPU tier pricing, inference cost models
     - `cogs-calculator.ts` (< 170 LOC): Compute, storage, bandwidth, and API provider COGS
     - `margin-analyzer.ts` (< 160 LOC): Customer-level & tier-level gross margin aggregation
     - `economics-reporter.ts` (< 150 LOC): Monthly & cohort unit economics summary
     - `index.ts` (< 30 LOC): Barrel export
   - *Facade*: `src/land/economics/unit-economics-service.ts` (< 30 LOC)

8. **`src/forest/economics/unit-economics-dashboard.tsx`** (727 LOC)
   - *Target Directory*: `src/forest/economics/dashboard/`
   - *Submodules*:
     - `types.ts` (< 70 LOC): Dashboard props, period filter, metric models
     - `use-unit-economics-data.ts` (< 160 LOC): Hook fetching COGS and margin timeseries
     - `economics-kpi-grid.tsx` (< 140 LOC): CAC, LTV, Gross Margin %, Blended MCU Cost cards
     - `cogs-breakdown-chart.tsx` (< 160 LOC): Visual breakdown of GPU, TTS, Video costs
     - `customer-margin-table.tsx` (< 180 LOC): Top customers by consumption & margin table
     - `index.ts` (< 30 LOC): Barrel export
   - *Facade*: `src/forest/economics/unit-economics-dashboard.tsx` (< 35 LOC)

---

### Cluster 3: Core Mission, Scoring CAS & Quote-to-Cash (~2,678 LOC)
9. **`src/tree/mission/preflight-check.ts`** (695 LOC)
   - *Target Directory*: `src/tree/mission/preflight/`
   - *Submodules*:
     - `types.ts` (< 80 LOC): Preflight criteria, validation results, readiness status
     - `quota-checker.ts` (< 150 LOC): MCU balance and concurrency limits check
     - `key-checker.ts` (< 160 LOC): BYOK key validity & quota reachability
     - `asset-checker.ts` (< 150 LOC): Input assets, aspect ratios, script prompt lengths
     - `preflight-orchestrator.ts` (< 170 LOC): Parallel preflight execution & verdict
     - `index.ts` (< 30 LOC): Barrel export
   - *Facade*: `src/tree/mission/preflight-check.ts` (< 30 LOC)

10. **`src/tree/learning-loop/scoring-cas.ts`** (695 LOC)
    - *Target Directory*: `src/tree/learning-loop/cas/`
    - *Submodules*:
      - `types.ts` (< 70 LOC): CAS score record, conflict status, versioning
      - `constants.ts` (< 35 LOC): Max CAS retries, backoff parameters
      - `cas-comparator.ts` (< 150 LOC): Optimistic concurrency comparison & version matching
      - `cas-updater.ts` (< 170 LOC): Atomic D1 compare-and-swap score updates with exponential backoff
      - `scoring-history.ts` (< 140 LOC): Audit trail of iterative model/prompt score changes
      - `index.ts` (< 30 LOC): Barrel export
    - *Facade*: `src/tree/learning-loop/scoring-cas.ts` (< 30 LOC)

11. **`src/tree/integrations/webhook-dispatcher.ts`** (644 LOC)
    - *Target Directory*: `src/tree/integrations/dispatcher/`
    - *Submodules*:
      - `types.ts` (< 75 LOC): Webhook payload, endpoint config, delivery attempt
      - `constants.ts` (< 35 LOC): Default timeout, retry schedule, signature headers
      - `signature-signer.ts` (< 120 LOC): HMAC-SHA256 signature generation and timing-safe verify
      - `delivery-client.ts` (< 165 LOC): Circuit breaker HTTP POST with retry backoff
      - `delivery-logger.ts` (< 140 LOC): D1 delivery log & status tracking
      - `dispatcher-engine.ts` (< 165 LOC): Fan-out queue & batch dispatching
      - `index.ts` (< 30 LOC): Barrel export
    - *Facade*: `src/tree/integrations/webhook-dispatcher.ts` (< 30 LOC)

12. **`src/land/contracts/quote-to-cash-workflow.ts`** (644 LOC)
    - *Target Directory*: `src/land/contracts/q2c/`
    - *Submodules*:
      - `types.ts` (< 80 LOC): Quote, Order, Invoice, Payment lifecycle types
      - `constants.ts` (< 35 LOC): State machine transitions, expiration timeouts
      - `quote-generator.ts` (< 160 LOC): Pricing estimation & quote creation
      - `order-converter.ts` (< 155 LOC): Signed quote to active contract/order conversion
      - `billing-trigger.ts` (< 160 LOC): NOWPayments/PayOS invoice creation & webhook reconciliation
      - `workflow-state-machine.ts` (< 170 LOC): Lifecycle state machine transitions & guards
      - `index.ts` (< 30 LOC): Barrel export
    - *Facade*: `src/land/contracts/quote-to-cash-workflow.ts` (< 30 LOC)

---

## 2. Risk Mitigation & Verification Strategy
- **Layer Boundary Enforcement**: All files in `src/tree/` only import `seed`. Files in `src/forest/` only import `seed` and `tree` (and `land` for orchestration). Files in `src/land/` only import `seed`, `tree`, and `forest`.
- **Pre-commit Quality Gates**:
  1. `npm run type-check` (0 errors)
  2. `bash scripts/check-layer-boundaries.sh` (0 violations)
  3. `npm run i18n:validate` (0 missing keys)
  4. `npm test` / Vitest runs on associated domains
