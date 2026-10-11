# Wave 20 Tri-Cluster Deep Modularization & Architecture Refactor Blueprint

## 1. Executive Summary & Objective
Following the user's directive for full-spectrum ("cả 4" / all clusters including Core Backend, Frontend Consoles, Shared Infra, and Domain Engines), Wave 20 targets the next 15 highest-debt production monoliths (~5,241 LOC total).

Every target will be systematically factored into dedicated submodules strictly under 200 LOC per file, preserving 100% backward-compatible root facades, zero `:any`, zero `console.log`, clean 4-layer boundaries, and green quality gates.

---

## 2. Target Matrix (15 Production Monoliths — 5,241 LOC)

### Cluster 1: Backend Routes, API Handlers & Crons (5 Targets ~ 1,773 LOC)
1. `src/app/api/creative-studio/scripts/templates/route.ts` (373 LOC)
   - Scope: Script templates search, filter, categorization, and prompt injection.
   - Target Submodules in `src/app/api/creative-studio/scripts/templates/modules/`:
     - `template-query-filter.ts` (<140 LOC): Category matching, search query parser, and sorting.
     - `template-prompt-injector.ts` (<130 LOC): Variable substitution, tone adaptation, and length formatting.
     - `template-response-formatter.ts` (<110 LOC): Pagination, DTO serialization, and caching headers.
     - `route.ts` (<120 LOC): HTTP GET/POST route orchestrator.
2. `src/app/api/v1/analytics/export/route.ts` (363 LOC)
   - Scope: Analytics report export, CSV/JSON stream generation, and rate limiting.
   - Target Submodules in `src/app/api/v1/analytics/export/modules/`:
     - `export-validator.ts` (<120 LOC): Date range validation, metrics filter schema, and auth checks.
     - `csv-stream-builder.ts` (<140 LOC): Chunked CSV formatting, header alignment, and UTF-8 BOM encoding.
     - `export-metrics-aggregator.ts` (<140 LOC): D1 usage metrics rollup, retention stats, and revenue query.
     - `route.ts` (<110 LOC): Route handler with streaming response.
3. `src/app/api/webhooks/telegram/route.ts` (357 LOC)
   - Scope: Telegram bot webhook ingress, command router, and security signature validation.
   - Target Submodules in `src/app/api/webhooks/telegram/modules/`:
     - `telegram-security.ts` (<100 LOC): Secret token verification and payload sanitization.
     - `telegram-command-router.ts` (<150 LOC): Dispatcher for `/campaign`, `/status`, `/results`, `/payout`.
     - `telegram-callback-handler.ts` (<140 LOC): Inline keyboard callbacks and user state persistence.
     - `route.ts` (<110 LOC): Route orchestrator.
4. `src/app/api/cron/video-status-sync/route.ts` (344 LOC)
   - Scope: Multi-provider video render status synchronization (D-ID, HeyGen, ElevenLabs).
   - Target Submodules in `src/app/api/cron/video-status-sync/modules/`:
     - `provider-sync-client.ts` (<140 LOC): Circuit breaker HTTP client polling provider endpoints.
     - `video-db-updater.ts` (<140 LOC): Batch state updates, retry counter increments, and completion events.
     - `video-notification-emitter.ts` (<120 LOC): Webhook dispatch and Telegram render alerts.
     - `route.ts` (<100 LOC): Cron route handler with secret guard.
5. `src/app/api/cron/scheduled-campaigns/route.ts` (336 LOC)
   - Scope: Batch campaign scheduler, budget gatekeeper, and Inngest dispatch.
   - Target Submodules in `src/app/api/cron/scheduled-campaigns/modules/`:
     - `campaign-due-scanner.ts` (<130 LOC): Query pending campaigns past target publish time.
     - `campaign-quota-validator.ts` (<130 LOC): MCU token balance verification and rate guard.
     - `campaign-dispatch-orchestrator.ts` (<140 LOC): Inngest event emission and execution logging.
     - `route.ts` (<100 LOC): Protected cron entrypoint.

### Cluster 2: Frontend Consoles, Layouts & Admin Views (5 Targets ~ 1,798 LOC)
6. `src/components/stitch/layouts/dashboard-layout.tsx` (367 LOC)
   - Scope: Master dashboard shell, navigation sidebar, header actions, and user profile drawer.
   - Target Submodules in `src/components/stitch/layouts/dashboard/`:
     - `dashboard-sidebar.tsx` (<140 LOC): Collapsible navigation, tier-gated links, and badge counters.
     - `dashboard-header.tsx` (<130 LOC): Breadcrumb bar, locale switcher, and notifications dropdown.
     - `dashboard-user-menu.tsx` (<120 LOC): User avatar, logout trigger, and workspace switch.
     - `dashboard-layout.tsx` (<110 LOC): Client layout orchestrator + root facade.
7. `src/forest/components/sop/marketplace-stitch-section.tsx` (365 LOC)
   - Scope: SOP marketplace catalog, search bar, category chips, and purchase modals.
   - Target Submodules in `src/forest/components/sop/marketplace/`:
     - `marketplace-filter-bar.tsx` (<120 LOC): Search input, tag chips, and sorting dropdown.
     - `marketplace-sop-grid.tsx` (<140 LOC): Responsive card layout, rating badges, and pricing display.
     - `marketplace-buy-dialog.tsx` (<130 LOC): Checkout confirmation modal and token deduction.
     - `marketplace-stitch-section.tsx` (<110 LOC): Orchestrating section + root facade.
8. `src/app/(app)/dashboard/admin/sop-reviews/page.tsx` (360 LOC)
   - Scope: Admin approval table for community-submitted SOPs and rejection feedback.
   - Target Submodules in `src/app/(app)/dashboard/admin/sop-reviews/modules/`:
     - `sop-review-table.tsx` (<140 LOC): Submission rows, status tags, author metadata, and action buttons.
     - `sop-review-detail-modal.tsx` (<150 LOC): SOP step inspector, tool schema preview, and safety score.
     - `sop-review-actions.ts` (<120 LOC): Server actions for approve, reject, and request revisions.
     - `page.tsx` (<100 LOC): Admin page loader and filter state.
9. `src/app/(app)/dashboard/sop-creator/[id]/page.tsx` (354 LOC)
   - Scope: Visual drag-and-drop SOP workflow creator, step editor, and prompt builder.
   - Target Submodules in `src/app/(app)/dashboard/sop-creator/[id]/modules/`:
     - `sop-editor-header.tsx` (<120 LOC): Workflow title input, save status indicator, and publish button.
     - `sop-step-list.tsx` (<150 LOC): Reorderable step cards, tool selectors, and dependency links.
     - `sop-step-config-drawer.tsx` (<140 LOC): Tool-specific parameter editor and input schema JSON validator.
     - `page.tsx` (<110 LOC): Page wrapper and draft state machine.
10. `src/app/[locale]/dashboard/publish/queue/PublishQueueClient.tsx` (352 LOC)
    - Scope: Real-time video publishing queue, retry controls, and platform status indicators.
    - Target Submodules in `src/app/[locale]/dashboard/publish/queue/modules/`:
      - `queue-filter-controls.tsx` (<110 LOC): Platform toggles (YouTube, TikTok, Shorts) and state filter.
      - `queue-item-card.tsx` (<140 LOC): Video thumbnail, upload progress bar, scheduled time, and logs.
      - `queue-action-bar.tsx` (<120 LOC): Bulk cancel, pause, and force-publish triggers.
      - `PublishQueueClient.tsx` (<120 LOC): Live SSE/polling client orchestrator.

### Cluster 3: Shared Infra, Governance & Domain Engines (5 Targets ~ 1,670 LOC)
11. `src/app/api/payos/ipn/route.ts` (345 LOC)
    - Scope: Legacy PayOS IPN bridge, signature verify, and redirect fallback.
    - Target Submodules in `src/app/api/payos/ipn/modules/`:
      - `legacy-payos-verifier.ts` (<110 LOC): Fallback signature validation.
      - `legacy-payos-sync.ts` (<130 LOC): Pending order resolution and webhook deduplication.
      - `route.ts` (<100 LOC): Forwarder to unified PayOS webhook orchestrator.
12. `src/land/governance/agy-actions.ts` (333 LOC)
    - Scope: AGY token staking, governance vote submission, and proposal lifecycle.
    - Target Submodules in `src/land/governance/agy/`:
      - `agy-types.ts` (<90 LOC): Vote types, proposal schemas, and staking contracts.
      - `agy-staking-engine.ts` (<140 LOC): Staking deposit, lock duration calculation, and APY accrual.
      - `agy-proposal-voting.ts` (<150 LOC): Signature-verified ballot cast, quorum checking, and tallying.
      - `agy-actions.ts` (<30 LOC): Facade re-exporting public actions.
13. `src/tree/governance/sovereign-conclave-domain-engine.ts` (332 LOC)
    - Scope: Sovereign Conclave multi-sig consensus, quorum checks, and veto thresholds.
    - Target Submodules in `src/tree/governance/conclave/`:
      - `conclave-types.ts` (<80 LOC): Threshold parameters, signatory roles, and quorum schemas.
      - `conclave-ballot-signer.ts` (<140 LOC): Multi-agent Ed25519 signature aggregator and validity check.
      - `conclave-consensus-evaluator.ts` (<140 LOC): Borda count tally, veto rule evaluation, and ratification.
      - `sovereign-conclave-domain-engine.ts` (<30 LOC): Facade re-exporting domain engine.
14. `src/tree/viral/hook-generator.ts` (330 LOC)
    - Scope: Algorithmic hook score predictor, pattern library, and emotional hook synthesizer.
    - Target Submodules in `src/tree/viral/hook/`:
      - `hook-types.ts` (<80 LOC): Hook category, retention weight, and pattern templates.
      - `hook-patterns.ts` (<140 LOC): High-performing viral hook archetypes (Curiosity Gap, Negativity Bias).
      - `hook-scoring-model.ts` (<140 LOC): Linguistic feature extractor and viral probability estimator.
      - `hook-generator.ts` (<30 LOC): Facade re-exporting generator.
15. `src/tree/publishing/apac-peak-optimizer.ts` (330 LOC)
    - Scope: APAC time zone publisher optimization, audience peak matrix, and jitter offset.
    - Target Submodules in `src/tree/publishing/apac/`:
      - `apac-types.ts` (<80 LOC): Market timezones (VN, TH, ID, PH, JP, KR), peak slots, and weights.
      - `apac-peak-matrix.ts` (<140 LOC): Hour-by-hour audience engagement distribution curves.
      - `apac-scheduler-engine.ts` (<140 LOC): Timezone normalization, optimal slot picker, and jitter injector.
      - `apac-peak-optimizer.ts` (<30 LOC): Facade re-exporting optimizer.

---

## 3. Strict Invariants
- **File Budget**: Strictly `< 200 LOC` per file across all 60+ generated submodules.
- **Root Facades**: 100% backward-compatible facades at all 15 original paths (`export * from './...'`).
- **Clean Layers**: Strictly enforce `seed` → `tree` → `forest` → `land` directionality.
- **Zero `:any` & Zero `console.log`**: Standardize on `@/seed/utils/logger-utility`.
- **Quality Gates**:
  1. `npm run type-check` (0 errors)
  2. `npm run lint -- --quiet` (0 errors)
  3. `bash scripts/check-layer-boundaries.sh` (0 violations)
  4. `npm run i18n:validate` (0 missing keys)
  5. `npm test` (100% green test suites)
