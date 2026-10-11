# Wave 24 Tri-Cluster Deep Modularization Architecture Blueprint

## Executive Summary
Following the complete delivery of Wave 23 (decomposing 15 monoliths into 60 submodules < 200 LOC, green tests), **Wave 24** targets the next 15 highest-density production monoliths (~4,450 LOC total, all between 292L and 313L) across 3 parallel architectural clusters:

1. **Cluster 1: Frontend Views, Client Screens & Marketplaces** (5 targets ~ 1,483 LOC)
2. **Cluster 2: Forest Orchestration, Middleware & Signal Processors** (5 targets ~ 1,472 LOC)
3. **Cluster 3: Billing, Payments, Clearing & Repositories** (5 targets ~ 1,493 LOC)

All 15 monoliths will be refactored using the **Strangler Facade Pattern**:
- Every original file path is retained as a lightweight root facade (`< 25 LOC`) re-exporting its decomposed submodules.
- Zero breaking changes to external callers, server actions, or test suites.
- Every new submodule is strictly `< 200 LOC` to prevent context window dilution and uphold single-responsibility clean architecture.

---

## Architectural Invariants & Quality Standards

- **File Budget Limit**: Strictly `< 200 LOC` per submodule; root facades strictly `< 25 LOC`.
- **Clean Layer Direction**: `seed` → `tree` → `forest` → `land`. Only Forest → Land orchestration permitted.
- **Zero Tech Debt**: Zero `:any` types, zero `console.log` (all logging via `@/seed/utils/logger-utility`).
- **Synchronous D1 Database Client**: Use `createServerClient()` synchronously (never `await createServerClient()`).
- **Quality Gates Protocol**:
  1. `npm run type-check` (0 errors)
  2. `npm run lint -- --quiet` (0 errors, 0 new suppressions)
  3. `bash scripts/check-layer-boundaries.sh` (0 violations)
  4. `npm run i18n:validate` (0 missing translation keys)
  5. `npm test` (100% green tests)

---

## Detailed Target Mapping

### Cluster 1: Frontend Views, Client Screens & Marketplaces (5 Targets ~ 1,483 LOC)

1. **`src/components/stitch/screens/affiliates/affiliate-discovery-panel.tsx` (313L)**
   - **Target Subdirectory**: `src/components/stitch/screens/affiliates/discovery/`
   - **Decomposition**:
     - `types.ts` (< 40L): Filter states, partner card props, search contracts.
     - `filter-bar.tsx` (< 110L): Search input, category dropdowns, tier filter pills.
     - `partner-card.tsx` (< 120L): Partner overview card, commission rate badge, quick invite action.
     - `discovery-panel-view.tsx` (< 140L): Layout grid, empty state, pagination, and data binding.
     - `index.ts` (< 10L): Barrel export.
   - **Root Facade**: `affiliate-discovery-panel.tsx` (< 15L).

2. **`src/components/stitch/screens/pricing/pricing-page.tsx` (292L)**
   - **Target Subdirectory**: `src/components/stitch/screens/pricing/view/`
   - **Decomposition**:
     - `types.ts` (< 40L): Tier card props, billing cycle enum, comparison feature contracts.
     - `billing-interval-toggle.tsx` (< 70L): Monthly vs Annual toggle with savings badge.
     - `tier-cards.tsx` (< 140L): SaaS subscription tier cards (Basic, Premium, Enterprise, Master).
     - `comparison-matrix.tsx` (< 130L): Feature comparison checklist table.
     - `pricing-page-view.tsx` (< 120L): Orchestrating pricing page layout and checkout navigation.
     - `index.ts` (< 10L): Barrel export.
   - **Root Facade**: `pricing-page.tsx` (< 15L).

3. **`src/land/marketplace/template-submit-modal.tsx` (292L)**
   - **Target Subdirectory**: `src/land/marketplace/template-submit/`
   - **Decomposition**:
     - `types.ts` (< 40L): Modal state, form submission schema, category tags.
     - `modal-header.tsx` (< 60L): Modal header, guideline tooltip, dismiss control.
     - `template-form-fields.tsx` (< 140L): Title, description, prompt inputs, tags, and preview URL.
     - `template-submit-modal-view.tsx` (< 130L): Modal wrapper, form submission handlers, toast feedback.
     - `index.ts` (< 10L): Barrel export.
   - **Root Facade**: `template-submit-modal.tsx` (< 15L).

4. **`src/land/sop-marketplace/creator-onboarding.ts` (294L)**
   - **Target Subdirectory**: `src/land/sop-marketplace/onboarding/`
   - **Decomposition**:
     - `types.ts` (< 45L): Creator profile, verification state, onboarding step types.
     - `creator-verification.ts` (< 130L): Identity validation, KYC / portfolio verification, payout checks.
     - `onboarding-service.ts` (< 150L): Creator onboarding lifecycle orchestrator and D1 updates.
     - `index.ts` (< 10L): Barrel export.
   - **Root Facade**: `creator-onboarding.ts` (< 15L).

5. **`src/land/reality-loop/feedback-store.ts` (310L)**
   - **Target Subdirectory**: `src/land/reality-loop/feedback/`
   - **Decomposition**:
     - `types.ts` (< 45L): Video feedback record, viewer sentiment signal, outcome event types.
     - `feedback-queries.ts` (< 140L): D1 SQL queries for feedback ingestion, aggregation, and querying.
     - `feedback-store-service.ts` (< 150L): Feedback store client, retention calculation, event emission.
     - `index.ts` (< 10L): Barrel export.
   - **Root Facade**: `feedback-store.ts` (< 15L).

---

### Cluster 2: Forest Orchestration, Middleware & Signal Processors (5 Targets ~ 1,472 LOC)

6. **`src/forest/middleware/auth-guard.ts` (298L)**
   - **Target Subdirectory**: `src/forest/middleware/guard/`
   - **Decomposition**:
     - `types.ts` (< 40L): Auth guard options, route permission criteria, session payload.
     - `route-whitelist.ts` (< 90L): Public routes, static assets, and bypass route matchers.
     - `token-validator.ts` (< 130L): Bearer token parsing, session cookie validation, CSRF checks.
     - `auth-guard-service.ts` (< 140L): Edge middleware request handler and redirect router.
     - `index.ts` (< 10L): Barrel export.
   - **Root Facade**: `auth-guard.ts` (< 15L).

7. **`src/forest/publishing/instagram-metrics-harvester.ts` (294L)**
   - **Target Subdirectory**: `src/forest/publishing/instagram/`
   - **Decomposition**:
     - `types.ts` (< 45L): Instagram video metrics, API payload, harvesting task contracts.
     - `rate-limiter.ts` (< 90L): Graph API token bucket, backoff scheduler, circuit breaker.
     - `metrics-parser.ts` (< 130L): View counts, likes, comments, save rate extractor and normalizer.
     - `instagram-harvester-service.ts` (< 140L): Batch harvesting job executor and database update.
     - `index.ts` (< 10L): Barrel export.
   - **Root Facade**: `instagram-metrics-harvester.ts` (< 15L).

8. **`src/forest/memory/context-window-service.ts` (294L)**
   - **Target Subdirectory**: `src/forest/memory/context/`
   - **Decomposition**:
     - `types.ts` (< 40L): Message role, context window size, token threshold options.
     - `token-counter.ts` (< 90L): Token estimation, message length heuristics, budget checks.
     - `context-pruner.ts` (< 140L): Conversation history pruning, sliding window, and summary compressor.
     - `context-window-service.ts` (< 140L): Main context window manager and LLM prompt assembler.
     - `index.ts` (< 10L): Barrel export.
   - **Root Facade**: `context-window-service.ts` (< 15L).

9. **`src/forest/marketplace/blueprint-service.ts` (292L)**
   - **Target Subdirectory**: `src/forest/marketplace/blueprint/`
   - **Decomposition**:
     - `types.ts` (< 40L): AI video blueprint schema, step definitions, node configuration.
     - `blueprint-validator.ts` (< 120L): Zod schema validator, dependency cycle detection.
     - `blueprint-registry.ts` (< 130L): Built-in blueprint registry and D1 custom blueprint store.
     - `blueprint-service.ts` (< 130L): Blueprint compilation, variable substitution, and job builder.
     - `index.ts` (< 10L): Barrel export.
   - **Root Facade**: `blueprint-service.ts` (< 15L).

10. **`src/tree/telegram/handlers/campaign-handler.ts` (294L)**
    - **Target Subdirectory**: `src/tree/telegram/handlers/campaign/`
    - **Decomposition**:
      - `types.ts` (< 40L): Telegram campaign command context, reply markup, state.
      - `command-parser.ts` (< 100L): Parameter parsing, target topic, duration, and prompt extractors.
      - `campaign-response-formatter.ts` (< 120L): Telegram markdown response builder and status keyboard.
      - `campaign-handler-service.ts` (< 150L): Command routing, campaign launch trigger, and error handling.
      - `index.ts` (< 10L): Barrel export.
    - **Root Facade**: `campaign-handler.ts` (< 15L).

---

### Cluster 3: Billing, Payments, Clearing & Repositories (5 Targets ~ 1,493 LOC)

11. **`src/tree/partners/cross-border-ledger.ts` (302L)**
    - **Target Subdirectory**: `src/tree/partners/ledger/`
    - **Decomposition**:
      - `types.ts` (< 45L): Cross-border transaction, currency enum, ledger entry types.
      - `fx-converter.ts` (< 110L): Exchange rate lookup, spread calculation, rounding rules.
      - `ledger-reconciler.ts` (< 130L): Multi-currency balance reconciliation and audit entry builder.
      - `cross-border-ledger-service.ts` (< 140L): Partner ledger service and balance queries.
      - `index.ts` (< 10L): Barrel export.
    - **Root Facade**: `cross-border-ledger.ts` (< 15L).

12. **`src/seed/db/repositories/landing-pages-repo.ts` (302L)**
    - **Target Subdirectory**: `src/seed/db/repositories/landing-pages/`
    - **Decomposition**:
      - `types.ts` (< 45L): Landing page row, creation inputs, filter queries.
      - `landing-page-queries.ts` (< 150L): D1 SQL queries (insert, findBySlug, updateStats, listByUser).
      - `landing-pages-repository.ts` (< 130L): Repository wrapper class, validation, and error mapping.
      - `index.ts` (< 10L): Barrel export.
   - **Root Facade**: `landing-pages-repo.ts` (< 15L).

13. **`src/land/billing/nowpayments-ipn-handlers.ts` (297L)**
    - **Target Subdirectory**: `src/land/billing/ipn-handlers/`
    - **Decomposition**:
      - `types.ts` (< 40L): IPN payload, status handler results, activation payload.
      - `payment-activation.ts` (< 130L): Tier upgrade execution, subscription record update, event emitting.
      - `status-dispatcher.ts` (< 130L): Handler routing for finished, partially_paid, failed, expired statuses.
      - `nowpayments-ipn-handlers-service.ts` (< 120L): Main IPN webhook dispatcher.
      - `index.ts` (< 10L): Barrel export.
   - **Root Facade**: `nowpayments-ipn-handlers.ts` (< 15L).

14. **`src/land/billing/enterprise-invoice-actions.ts` (297L)**
    - **Target Subdirectory**: `src/land/billing/invoices/`
    - **Decomposition**:
      - `types.ts` (< 40L): Enterprise invoice input, tax breakdown, PDF metadata types.
      - `tax-calculator.ts` (< 100L): Regional VAT/sales tax computation, tax exemption rules.
      - `invoice-builder.ts` (< 140L): Line item generator, invoice numbering, payment term formatting.
      - `enterprise-invoice-actions-service.ts` (< 140L): Server actions for generating, fetching, sending invoices.
      - `index.ts` (< 10L): Barrel export.
   - **Root Facade**: `enterprise-invoice-actions.ts` (< 15L).

15. **`src/land/clearing/clearing-actions.ts` (295L)**
    - **Target Subdirectory**: `src/land/clearing/actions/`
    - **Decomposition**:
      - `types.ts` (< 40L): Clearing cycle, escrow release payload, payout batch item.
      - `escrow-releaser.ts` (< 120L): Holding period evaluation, fraud check clearance, escrow release.
      - `batch-transfer-builder.ts` (< 130L): Payout batch grouping, TRC20 recipient formatting, fee deduction.
      - `clearing-actions-service.ts` (< 140L): Server actions for executing affiliate clearing cycles.
      - `index.ts` (< 10L): Barrel export.
   - **Root Facade**: `clearing-actions.ts` (< 15L).
