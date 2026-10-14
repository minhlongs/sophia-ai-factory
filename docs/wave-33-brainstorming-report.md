# Wave 33 Deep Modularization & Architectural Decomposition Report

## Executive Summary
Wave 33 targets **15 mission-critical monoliths (~3,308 LOC total, 212L–226L)** across three balanced architectural clusters in `apps/sophia-ai-factory/src/`. Following the Full-Spectrum Tri-Cluster decomposition pattern established in Waves 28–32, each monolith will be decomposed into single-responsibility submodules strictly complying with the `< 200 LOC` invariant, preserving root facades (`< 25 LOC`) for 100% backward compatibility and zero regressions across all caller files and automated tests.

---

## Target Breakdown (15 Files ~ 3,308 LOC)

### Cluster 1: Edge Routes & OAuth Integration Engine (5 Files ~ 1,088 LOC)
1. **`src/app/api/welcome/validate/[token]/route.ts` (225 LOC)**
   - **Current Concerns**: Magic link token validation, Better Auth session establishment, D1 customer lookup, cookie signing, rate limiting, audit logging.
   - **Decomposition**: `src/app/api/welcome/validate/[token]/core/`
     - `types.ts` (< 40 LOC): Validation request/response interfaces, session cookie options.
     - `token-validator.ts` (< 90 LOC): Magic link verification and expiration checks.
     - `session-issuer.ts` (< 90 LOC): D1 user retrieval, Better Auth session creation, and secure cookie formatting.
     - `route-handler.ts` (< 90 LOC): Edge runtime coordinator with audit logging and error mapping.
     - `index.ts` (< 15 LOC) + Root Route Facade `route.ts` (< 20 LOC).

2. **`src/app/api/cron/affiliate-scout/route.ts` (221 LOC)**
   - **Current Concerns**: Cron authentication, affiliate network opportunity discovery, offer indexing in D1, Telegram alerting.
   - **Decomposition**: `src/app/api/cron/affiliate-scout/core/`
     - `types.ts` (< 40 LOC): Scout run options, network payload models, alert summaries.
     - `scout-runner.ts` (< 95 LOC): Coordinates network sweeps and candidate evaluation.
     - `opportunity-indexer.ts` (< 90 LOC): Batch persists verified offers into D1 ledger.
     - `cron-handler.ts` (< 85 LOC): Handles CRON_SECRET auth, execution metrics, and notification dispatch.
     - `index.ts` (< 15 LOC) + Root Route Facade `route.ts` (< 20 LOC).

3. **`src/app/api/cdn/discover/route.ts` (217 LOC)**
   - **Current Concerns**: CDN edge discovery, asset hashing, metadata extraction, cache-control headers, error handling.
   - **Decomposition**: `src/app/api/cdn/discover/core/`
     - `types.ts` (< 40 LOC): Asset discovery params, manifest schemas, edge cache configurations.
     - `asset-scanner.ts` (< 95 LOC): Scans R2/CDN distribution and extracts content metadata.
     - `manifest-builder.ts` (< 85 LOC): Formats cache manifests and hash signatures.
     - `route-handler.ts` (< 85 LOC): Validates query filters, sets edge cache headers, and dispatches JSON.
     - `index.ts` (< 15 LOC) + Root Route Facade `route.ts` (< 20 LOC).

4. **`src/app/api/oauth/zalo/callback/route.ts` (213 LOC)**
   - **Current Concerns**: Zalo OAuth token exchange, creator profile binding in D1, credential encryption, CSRF state verification.
   - **Decomposition**: `src/app/api/oauth/zalo/callback/core/`
     - `types.ts` (< 40 LOC): Zalo token response schemas, user profile interfaces.
     - `token-client.ts` (< 85 LOC): Exchanges auth code for access/refresh tokens with Zalo OpenAPI.
     - `account-binder.ts` (< 90 LOC): Encrypts credentials and links Zalo OA creator accounts in D1.
     - `route-handler.ts` (< 85 LOC): Validates state parameters and handles redirect logic.
     - `index.ts` (< 15 LOC) + Root Route Facade `route.ts` (< 20 LOC).

5. **`src/app/api/oauth/linkedin/callback/route.ts` (212 LOC)**
   - **Current Concerns**: LinkedIn OAuth token retrieval, organization permissions checks, encrypted credential storage in D1, redirect response handling.
   - **Decomposition**: `src/app/api/oauth/linkedin/callback/core/`
     - `types.ts` (< 40 LOC): LinkedIn token payload models, organization member schemas.
     - `token-client.ts` (< 85 LOC): Requests token pair from LinkedIn OAuth endpoints.
     - `account-binder.ts` (< 90 LOC): Links LinkedIn company pages and creators in D1.
     - `route-handler.ts` (< 85 LOC): Validates CSRF tokens and sets post-auth redirects.
     - `index.ts` (< 15 LOC) + Root Route Facade `route.ts` (< 20 LOC).

---

### Cluster 2: Frontend Views & Client Configurators (5 Files ~ 1,095 LOC)
6. **`src/forest/components/byok/byok-provider-picker.tsx` (221 LOC)**
   - **Current Concerns**: Multi-provider selection (OpenRouter, ElevenLabs, D-ID, HeyGen), connection status badges, modal triggers, error banners.
   - **Decomposition**: `src/forest/components/byok/provider-picker/`
     - `types.ts` (< 40 LOC): Provider card props, validation state interfaces.
     - `provider-card.tsx` (< 90 LOC): Visual provider tile with status indicator and icon (`'use client'`).
     - `provider-modal-trigger.tsx` (< 80 LOC): Modal dialog trigger and configuration launcher (`'use client'`).
     - `provider-picker-view.tsx` (< 95 LOC): Grid layout orchestrating provider list and active state (`'use client'`).
     - `index.ts` (< 15 LOC) + Root Facade `byok-provider-picker.tsx` (< 20 LOC, `'use client'`).

7. **`src/app/creator/listings/listings-client.tsx` (220 LOC)**
   - **Current Concerns**: Marketplace listings filter controls, price range slider, status tabs, pagination, card layout.
   - **Decomposition**: `src/app/creator/listings/client/`
     - `types.ts` (< 40 LOC): Listing item models, filter query interfaces.
     - `listing-filters.tsx` (< 85 LOC): Search bar, category dropdown, price filter controls (`'use client'`).
     - `listing-card-grid.tsx` (< 95 LOC): Responsive grid of creator listing items (`'use client'`).
     - `listings-view.tsx` (< 90 LOC): Orchestrating view managing client state and pagination (`'use client'`).
     - `index.ts` (< 15 LOC) + Root Facade `listings-client.tsx` (< 20 LOC, `'use client'`).

8. **`src/app/(app)/dashboard/analytics/cross-platform/CrossPlatformAnalyticsClient.tsx` (219 LOC)**
   - **Current Concerns**: Cross-platform video analytics aggregation, date range selection, metric stat cards, platform breakdown charts.
   - **Decomposition**: `src/app/(app)/dashboard/analytics/cross-platform/components/`
     - `types.ts` (< 40 LOC): Platform metric contracts, date window options.
     - `metric-stat-cards.tsx` (< 90 LOC): Top-level stat cards (Views, Revenue, Engagement) (`'use client'`).
     - `platform-breakdown-chart.tsx` (< 95 LOC): Visual chart comparing YouTube, TikTok, and Instagram performance (`'use client'`).
     - `cross-platform-view.tsx` (< 90 LOC): Main analytics dashboard container (`'use client'`).
     - `index.ts` (< 15 LOC) + Root Facade `CrossPlatformAnalyticsClient.tsx` (< 20 LOC, `'use client'`).

9. **`src/forest/components/auth/signup-form.tsx` (218 LOC)**
   - **Current Concerns**: Email/password registration fields, invitation code validation, social auth buttons, loading/error states.
   - **Decomposition**: `src/forest/components/auth/signup/`
     - `types.ts` (< 40 LOC): Signup form state, submission payload interfaces.
     - `social-auth-buttons.tsx` (< 80 LOC): Google/GitHub OAuth login trigger buttons (`'use client'`).
     - `credentials-fields.tsx` (< 90 LOC): Email, password, confirmation inputs with validation feedback (`'use client'`).
     - `signup-form-view.tsx` (< 95 LOC): Form container orchestrating Better Auth submission (`'use client'`).
     - `index.ts` (< 15 LOC) + Root Facade `signup-form.tsx` (< 20 LOC, `'use client'`).

10. **`src/forest/components/campaign/campaign-pipeline-timeline.tsx` (217 LOC)**
    - **Current Concerns**: Video campaign pipeline stages (Script → Voice → Render → Review → Publish), active stage pulsing indicator, retry button, logs viewer.
    - **Decomposition**: `src/forest/components/campaign/timeline/`
      - `types.ts` (< 40 LOC): Pipeline stage enums, transition event interfaces.
      - `stage-step-item.tsx` (< 85 LOC): Individual pipeline stage circle with icon, timestamp, and status badge (`'use client'`).
      - `stage-action-bar.tsx` (< 80 LOC): Retry, cancel, and log drawer action buttons (`'use client'`).
      - `timeline-view.tsx` (< 95 LOC): Interactive timeline track container (`'use client'`).
      - `index.ts` (< 15 LOC) + Root Facade `campaign-pipeline-timeline.tsx` (< 20 LOC, `'use client'`).

---

### Cluster 3: Core Domain Services, Repositories & Adapters (5 Files ~ 1,125 LOC)
11. **`src/land/affiliates/scout/scoring.ts` (226 LOC)**
    - **Current Concerns**: Multi-criteria scoring algorithm for affiliate campaigns, EPC calculation, conversion rate volatility weighting, risk tiering.
    - **Decomposition**: `src/land/affiliates/scout/scoring/`
      - `types.ts` (< 40 LOC): Score weight configs, evaluation input models, score breakdown types.
      - `epc-calculator.ts` (< 85 LOC): Earnings-per-click and traffic volume normalization.
      - `risk-evaluator.ts` (< 85 LOC): Volatility penalty and network reliability rating.
      - `scoring-engine.ts` (< 90 LOC): Aggregates weights and outputs composite opportunity score.
      - `index.ts` (< 15 LOC) + Root Facade `scoring.ts` (< 20 LOC).

12. **`src/tree/compute/sub-planck-scheduler-domain-engine.ts` (225 LOC)**
    - **Current Concerns**: Micro-task scheduling, priority queue management, tick coordinator, concurrency limit enforcement.
    - **Decomposition**: `src/tree/compute/scheduler/`
      - `types.ts` (< 40 LOC): Task priority levels, tick intervals, execution tokens.
      - `priority-queue.ts` (< 90 LOC): Binary heap / sorted task queue implementation.
      - `tick-coordinator.ts` (< 85 LOC): Interval timer, backpressure monitor, and tick loop runner.
      - `scheduler-engine.ts` (< 90 LOC): Main domain service exposing schedule/cancel/drain API.
      - `index.ts` (< 15 LOC) + Root Facade `sub-planck-scheduler-domain-engine.ts` (< 20 LOC).

13. **`src/seed/ai/provider-certification.ts` (225 LOC)**
    - **Current Concerns**: AI provider capability matrix (vision, audio, streaming, context limits), blocking validation rules, failover routing policies.
    - **Decomposition**: `src/seed/ai/certification/`
      - `types.ts` (< 40 LOC): Provider capability enums, certification record schemas.
      - `capability-matrix.ts` (< 90 LOC): Static definition of supported model parameters and tier gates.
      - `policy-evaluator.ts` (< 85 LOC): Evaluates whether a provider is certified or blocking for given task.
      - `certification-service.ts` (< 85 LOC): Unified interface for checking model compatibility and health.
      - `index.ts` (< 15 LOC) + Root Facade `provider-certification.ts` (< 20 LOC).

14. **`src/land/monitoring/d1-capacity-monitor.ts` (223 LOC)**
    - **Current Concerns**: Cloudflare D1 SQLite storage telemetry, row count estimation, growth projections, capacity exhaustion alert thresholds.
    - **Decomposition**: `src/land/monitoring/capacity/`
      - `types.ts` (< 40 LOC): Storage metrics, growth rate structs, warning threshold configs.
      - `storage-calculator.ts` (< 90 LOC): Computes table sizes, index overhead, and page counts.
      - `growth-projector.ts` (< 85 LOC): Estimates days-to-capacity exhaustion based on recent write deltas.
      - `capacity-monitor.ts` (< 85 LOC): Orchestrator running scheduled health scans and firing alert events.
      - `index.ts` (< 15 LOC) + Root Facade `d1-capacity-monitor.ts` (< 20 LOC).

15. **`src/forest/ai/anthropic-adapter.ts` (223 LOC)**
    - **Current Concerns**: Anthropic SDK client instantiation, token streaming handler, circuit breaker integration, error classification, retry logic.
    - **Decomposition**: `src/forest/ai/anthropic/`
      - `types.ts` (< 40 LOC): Prompt request options, stream chunk contracts, token usage metadata.
      - `stream-handler.ts` (< 90 LOC): SSE stream consumer, delta accumulator, and abort signal listener.
      - `error-classifier.ts` (< 80 LOC): Maps Anthropic API HTTP errors to domain FailureKind classifications.
      - `anthropic-adapter-service.ts` (< 95 LOC): Main adapter implementing AI provider interface with circuit breaker.
      - `index.ts` (< 15 LOC) + Root Facade `anthropic-adapter.ts` (< 20 LOC).

---

## Architectural Invariants & Quality Contract
1. **File Budget**: Every newly created file is strictly `< 200 LOC` (target average 60–90 LOC). Root facades strictly `< 25 LOC`.
2. **Backward Compatibility**: All existing import paths preserved via root facades. No broken external or test imports.
3. **Clean Architecture Boundaries**:
   - `seed` imports nothing from higher layers.
   - `tree` imports only `seed`.
   - `forest` imports `seed` and `tree` (orchestration calls to `land` allowed via one-way rule).
   - `land` imports `seed`, `tree`, and `forest`.
4. **i18n Namespace Markers**: Client components must include `// i18n-namespace: <namespace>` at line 1 to satisfy `scripts/validate-i18n-keys.mjs`.
5. **Quality Gates**:
   - `npm run type-check` (0 errors)
   - `npm run lint -- --quiet` (0 errors, 0 new suppressions)
   - `bash scripts/check-layer-boundaries.sh` (0 violations)
   - `npm run i18n:validate` (0 missing keys)
   - `npm test` (100% green test suite)
