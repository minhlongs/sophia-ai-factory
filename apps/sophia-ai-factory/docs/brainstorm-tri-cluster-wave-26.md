# Brainstorm: Wave 26 Tri-Cluster Deep Modularization & Architecture Refactor

## Context & Problem Statement
Following Wave 25 (15 monoliths decomposed into 75 submodules strictly `< 200 LOC`), the codebase retains 30+ production files (excluding test suites) that exceed the `< 200 LOC` threshold.

Large files (275L - 290L) in production code create:
1. Context window saturation during autonomous agent code-generation and debugging loops.
2. High coupling between database mutations, validation schemas, external webhooks, and UI presentations.
3. Elevated regression risks during high-frequency production updates.

## Tri-Cluster Decomposition Targets (Top 15 Production Monoliths, ~4,180 LOC)

### Cluster 1: Frontend Views, Forms & Admin Workflows (~1,398 LOC)
1. `src/components/creator/ListingForm.tsx` (276L) → `src/components/creator/listing-form/`
   - Goal: Split form fields, pricing inputs, media uploads, and form validation state.
2. `src/forest/components/analytics/metrics-cards.tsx` (276L) → `src/forest/components/analytics/metrics-cards/`
   - Goal: Split KPI calculations, stat card visuals, trend percentage indicators, and filter state.
3. `src/land/account/cascade-delete.ts` (290L) → `src/land/account/cascade-delete/`
   - Goal: Separate R2 asset deletion, D1 relational cascading cleanup, and audit logging.
4. `src/land/autonomy/actions.ts` (287L) → `src/land/autonomy/actions/`
   - Goal: Modularize server actions for agent autonomy levels, safety gates, and policy approvals.
5. `src/land/billing/hedging-admin-actions.ts` (274L) → `src/land/billing/hedging-admin/`
   - Goal: Decompose currency risk management, rate lock execution, and manual hedge triggers.

### Cluster 2: Forest Jobs, Gateways & Video Pipeline Infrastructure (~1,396 LOC)
6. `src/forest/jobs/payout-batcher.ts` (288L) → `src/forest/jobs/payout-batcher/`
   - Goal: Separate batch aggregation, threshold verification, D1 payout state machine, and ledger entries.
7. `src/tree/gateway/openclaw-gateway.ts` (279L) → `src/tree/gateway/openclaw/`
   - Goal: Extract OpenClaw client, payload signing, circuit breaker handling, and response transformation.
8. `src/land/fulfillment/complete-video-from-webhook.ts` (278L) → `src/land/fulfillment/webhook-completer/`
   - Goal: Separate webhook signature check, asset transfer to R2, rendering metadata update, and notification firing.
9. `src/app/api/cron/fulfillment-retry/route.ts` (278L) → `src/app/api/cron/fulfillment-retry/service/`
   - Goal: Extract retry query logic, exponential backoff runner, DLQ threshold alerting, and API route handler.
10. `src/forest/help/help-video-store.ts` (277L) → `src/forest/help/video-store/`
    - Goal: Separate video metadata queries, indexing, storage synchronization, and cache layer.

### Cluster 3: Domain Intelligence, Trend Scouting & Security Primitives (~1,385 LOC)
11. `src/tree/contracts/contract-generator.ts` (279L) → `src/tree/contracts/generator/`
    - Goal: Decompose contract clauses, PDF/markdown template rendering, and signature anchors.
12. `src/tree/listing/dual-listing-engine.ts` (277L) → `src/tree/listing/dual-listing/`
    - Goal: Separate cross-platform sync, pricing parity enforcement, and inventory state machine.
13. `src/tree/trend-intelligence/trend-scout.ts` (276L) → `src/tree/trend-intelligence/scout/`
    - Goal: Modularize trend query collectors, velocity scoring, keyword cluster matching, and cache stores.
14. `src/seed/security/signed-url.ts` (276L) → `src/seed/security/signed-url/`
    - Goal: Decompose HMAC signing, expiration verifier, R2 presigned URL generator, and token parsers.
15. `src/forest/bi/email-digest-sender.ts` (276L) → `src/forest/bi/digest/`
    - Goal: Decompose digest metric aggregation, HTML email assembly, and batch dispatch queueing.

---

## Architectural Invariants & Quality Standards
- **File Budget**: Strictly `< 200 LOC` per file for all submodules.
- **Root Facade**: Root files preserved as backward-compatible re-export facades `< 25 LOC` (`export * from './...'`).
- **Zero Regression**: Clean layer boundaries (`seed` → `tree` → `forest` → `land`).
- **Quality Gates**:
  - `npm run type-check` (0 errors)
  - `npm run lint -- --quiet` (0 errors)
  - `bash scripts/check-layer-boundaries.sh` (0 violations)
  - `npm run i18n:validate` (passed)
  - Vitest test suites green
