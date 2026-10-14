# Wave 34 Deep Modularization & Architectural Decomposition Report

## Executive Summary
Wave 34 targets **15 mission-critical monoliths (~3,212 LOC total, 201L–227L)** across three balanced architectural clusters in `apps/sophia-ai-factory/src/`. Following the Full-Spectrum Tri-Cluster decomposition pattern established in Waves 28–33, each monolith will be decomposed into single-responsibility submodules strictly complying with the `< 100 LOC` invariant, preserving root facades (`< 25 LOC`) for 100% backward compatibility and zero regressions across all caller files and automated tests.

---

## Target Breakdown (15 Files ~ 3,212 LOC)

### Cluster 1: Video Generation & Publishing Pipeline Engine (5 Files ~ 1,058 LOC)
1. **`src/land/i18n/caption-translator.ts` (227 LOC)**
   - **Current Concerns**: Subtitle SRT/VTT parsing, bilingual Vietnamese/English translation, timing alignment, and subtitle styling.
   - **Decomposition Target**: `src/land/i18n/caption-translator/`
     - `types.ts` (< 35 LOC): Subtitle cue interfaces, translation options, language pairs.
     - `subtitle-parser.ts` (< 85 LOC): SRT and VTT format parser and serializer.
     - `timing-aligner.ts` (< 75 LOC): Audio/visual duration synchronization and timestamp re-indexing.
     - `translation-engine.ts` (< 85 LOC): AI translation coordinator with bilingual locale caching.
     - `index.ts` (< 15 LOC) + Root Facade `caption-translator.ts` (< 20 LOC).

2. **`src/land/video/publishing/publish-upload.ts` (216 LOC)**
   - **Current Concerns**: Multi-platform video chunking, presigned R2/S3 upload negotiation, and retry mechanics.
   - **Decomposition Target**: `src/land/video/publishing/upload/`
     - `types.ts` (< 35 LOC): Chunk upload contracts, presigned URL requests, upload state.
     - `chunk-splitter.ts` (< 80 LOC): File slicing, byte-range partitioning, and checksum calculation.
     - `presigned-negotiator.ts` (< 85 LOC): R2/S3 presigned URL generation and authorization verification.
     - `upload-orchestrator.ts` (< 90 LOC): Exponential backoff retry loop and multipart completion.
     - `index.ts` (< 15 LOC) + Root Facade `publish-upload.ts` (< 20 LOC).

3. **`src/forest/ab/thumbnail-ab-runner.ts` (212 LOC)**
   - **Current Concerns**: Thumbnail variation generation, impression tracking, and Bayesian CTR comparison.
   - **Decomposition Target**: `src/forest/ab/thumbnail/`
     - `types.ts` (< 35 LOC): A/B test parameters, impression metrics, variant scoring models.
     - `variant-generator.ts` (< 85 LOC): Thumbnail candidate creation and prompt customization.
     - `ctr-evaluator.ts` (< 80 LOC): Bayesian multi-armed bandit statistical comparison.
     - `ab-runner-service.ts` (< 90 LOC): Test lifecycle management, allocation switcher, and winner rollout.
     - `index.ts` (< 15 LOC) + Root Facade `thumbnail-ab-runner.ts` (< 20 LOC).

4. **`src/land/video/generation/kling-client.ts` (202 LOC)**
   - **Current Concerns**: Kling AI video generation API client, polling loop, and circuit breaker.
   - **Decomposition Target**: `src/land/video/generation/kling/`
     - `types.ts` (< 35 LOC): Request/response schemas, task status enums, generation options.
     - `request-signer.ts` (< 75 LOC): JWT authorization header generation and request signing.
     - `status-poller.ts` (< 85 LOC): Polling loop with exponential backoff and timeout safeguards.
     - `kling-client-service.ts` (< 90 LOC): Main client integrating circuit breaker and task dispatch.
     - `index.ts` (< 15 LOC) + Root Facade `kling-client.ts` (< 20 LOC).

5. **`src/land/video/assembly/clip-boundary-merger.ts` (201 LOC)**
   - **Current Concerns**: Boundary alignment, audio sync crossfades, and timeline concatenation.
   - **Decomposition Target**: `src/land/video/assembly/merger/`
     - `types.ts` (< 35 LOC): Clip timeline contracts, transition configs, audio envelope types.
     - `boundary-aligner.ts` (< 80 LOC): Frame-accurate boundary normalization and gap filling.
     - `audio-crossfader.ts` (< 80 LOC): Volume interpolation, fade-in/fade-out envelope calculation.
     - `timeline-merger.ts` (< 85 LOC): Sequence concatenation and export payload builder.
     - `index.ts` (< 15 LOC) + Root Facade `clip-boundary-merger.ts` (< 20 LOC).

---

### Cluster 2: Security, Auth & Clearing Infrastructure (5 Files ~ 1,078 LOC)
6. **`src/seed/auth/jwt-nonce-tracker.ts` (217 LOC)**
   - **Current Concerns**: Replay protection, distributed D1 nonce store, and sliding window expiration pruning.
   - **Decomposition Target**: `src/seed/auth/nonce/`
     - `types.ts` (< 35 LOC): Nonce record schemas, verification result interfaces.
     - `nonce-store.ts` (< 85 LOC): D1 insert with conflict detection and read queries.
     - `sliding-window-pruner.ts` (< 80 LOC): TTL expiration checks and background cleanup queries.
     - `jwt-nonce-tracker-service.ts` (< 85 LOC): High-level nonce assertion and validation API.
     - `index.ts` (< 15 LOC) + Root Facade `jwt-nonce-tracker.ts` (< 20 LOC).

7. **`src/forest/webhooks/signature.ts` (216 LOC)**
   - **Current Concerns**: Multi-provider HMAC verification (NOWPayments, PayOS, Telegram), timing-safe comparison.
   - **Decomposition Target**: `src/forest/webhooks/signature/`
     - `types.ts` (< 35 LOC): Webhook provider types, signature header schemas, validation flags.
     - `crypto-verifier.ts` (< 80 LOC): Web Crypto API HMAC computation and timing-safe equal.
     - `provider-strategies.ts` (< 90 LOC): Per-provider signature extraction and payload canonicalization.
     - `signature-validator-service.ts` (< 85 LOC): Dispatcher mapping incoming requests to provider strategies.
     - `index.ts` (< 15 LOC) + Root Facade `signature.ts` (< 20 LOC).

8. **`src/tree/clearing/iso20022-clearing-engine.ts` (215 LOC)**
   - **Current Concerns**: ISO 20022 pacs.008 message validation, remittance structuring, and clearing records.
   - **Decomposition Target**: `src/tree/clearing/iso20022/`
     - `types.ts` (< 40 LOC): ISO 20022 message models, credit transfer contracts, status enums.
     - `pacs008-parser.ts` (< 85 LOC): XML/JSON parser and structural field validator.
     - `remittance-structurer.ts` (< 85 LOC): Structured remittance information builder and creditor agent binder.
     - `clearing-engine-service.ts` (< 85 LOC): Clearing reconciliation engine and audit ledger writer.
     - `index.ts` (< 15 LOC) + Root Facade `iso20022-clearing-engine.ts` (< 20 LOC).

9. **`src/forest/middleware/rate-limit-wrapper.ts` (214 LOC)**
   - **Current Concerns**: Edge rate limiter, tiered IP/user throttling, and header generation.
   - **Decomposition Target**: `src/forest/middleware/rate-limit/`
     - `types.ts` (< 35 LOC): Rate limit config, tier quotas, rate check results.
     - `token-bucket-evaluator.ts` (< 85 LOC): Sliding window token bucket counter and cooldown logic.
     - `rate-header-builder.ts` (< 75 LOC): Standard X-RateLimit-* and Retry-After response header generator.
     - `rate-limit-middleware-service.ts` (< 85 LOC): Request wrapper dispatching tier checks and short-circuiting 429s.
     - `index.ts` (< 15 LOC) + Root Facade `rate-limit-wrapper.ts` (< 20 LOC).

10. **`src/seed/db/repositories/confidence-escalation-repo.ts` (214 LOC)**
    - **Current Concerns**: Confidence escalation logging, review queue queries, and threshold triggers.
    - **Decomposition Target**: `src/seed/db/repositories/confidence-escalation/`
      - `types.ts` (< 35 LOC): Escalation record models, filter params, status transitions.
      - `escalation-queries.ts` (< 85 LOC): D1 SELECT and pagination queries for review queue.
      - `escalation-mutations.ts` (< 85 LOC): D1 INSERT and status UPDATE queries.
      - `confidence-escalation-service.ts` (< 85 LOC): Repository facade orchestrating queries and validations.
      - `index.ts` (< 15 LOC) + Root Facade `confidence-escalation-repo.ts` (< 20 LOC).

---

### Cluster 3: Autonomous SOP & Creator Growth Operations (5 Files ~ 1,076 LOC)
11. **`src/tree/sop/experiment-framework.ts` (216 LOC)**
    - **Current Concerns**: Multi-variant SOP prompt evaluation, statistical significance scoring, and rollout state machine.
    - **Decomposition Target**: `src/tree/sop/experiment/`
      - `types.ts` (< 35 LOC): Experiment state contracts, variant definitions, outcome metrics.
      - `statistical-calculator.ts` (< 85 LOC): P-value, sample size variance, and confidence interval scoring.
      - `rollout-state-machine.ts` (< 80 LOC): Draft → Active → Winner Selected → Promoted state transitions.
      - `experiment-framework-service.ts` (< 90 LOC): Domain orchestrator for managing variant life cycles.
      - `index.ts` (< 15 LOC) + Root Facade `experiment-framework.ts` (< 20 LOC).

12. **`src/land/creators/creator-royalty-actions.ts` (215 LOC)**
    - **Current Concerns**: Creator revenue calculation, escrow hold management, and payout generation.
    - **Decomposition Target**: `src/land/creators/royalty/`
      - `types.ts` (< 35 LOC): Royalty calculation parameters, payout record schemas, hold states.
      - `royalty-calculator.ts` (< 85 LOC): Tiered revenue split and platform fee deduction logic.
      - `escrow-manager.ts` (< 85 LOC): Hold period validation and release schedules in D1.
      - `royalty-actions-service.ts` (< 85 LOC): Server actions for viewing and releasing creator earnings.
      - `index.ts` (< 15 LOC) + Root Facade `creator-royalty-actions.ts` (< 20 LOC).

13. **`src/forest/analytics/queries/content-roi-resolver.ts` (213 LOC)**
    - **Current Concerns**: Multi-touch video attribution, conversion tracking, and D1 aggregation queries.
    - **Decomposition Target**: `src/forest/analytics/queries/content-roi/`
      - `types.ts` (< 35 LOC): Attribution window models, ROI metrics, aggregation query params.
      - `attribution-modeler.ts` (< 85 LOC): First-touch, last-touch, and linear decay weight calculator.
      - `roi-query-builder.ts` (< 85 LOC): SQL query generator for D1 impression, click, and conversion logs.
      - `content-roi-resolver-service.ts` (< 85 LOC): Service aggregating analytics and hydrating dashboards.
      - `index.ts` (< 15 LOC) + Root Facade `content-roi-resolver.ts` (< 20 LOC).

14. **`src/land/predictive/predictive-dashboard-actions.ts` (212 LOC)**
    - **Current Concerns**: Forecast generation, trend extrapolation, and dashboard D1 hydration.
    - **Decomposition Target**: `src/land/predictive/dashboard/`
      - `types.ts` (< 35 LOC): Forecast options, trend data models, prediction intervals.
      - `trend-extrapolator.ts` (< 85 LOC): Holt-Winters exponential smoothing and trend analysis.
      - `dashboard-hydrator.ts` (< 85 LOC): Historical metric fetcher and forecast projection combiner.
      - `predictive-actions-service.ts` (< 85 LOC): Server actions providing hydrated charts to UI.
      - `index.ts` (< 15 LOC) + Root Facade `predictive-dashboard-actions.ts` (< 20 LOC).

15. **`src/app/actions/brand-kit-action.ts` (212 LOC)**
    - **Current Concerns**: Brand palette validation, typography binding, and asset upload orchestration.
    - **Decomposition Target**: `src/app/actions/brand-kit/`
      - `types.ts` (< 35 LOC): Brand kit schema, palette validation types, typography tokens.
      - `palette-validator.ts` (< 80 LOC): WCAG contrast checker and hex/hsl format validation.
      - `asset-orchestrator.ts` (< 85 LOC): Logo/font upload to R2 and D1 record linkage.
      - `brand-kit-action-service.ts` (< 85 LOC): Server actions handling get, update, and reset brand kits.
      - `index.ts` (< 15 LOC) + Root Facade `brand-kit-action.ts` (< 20 LOC).

---

## Architectural Invariants & Quality Contract
1. **File Budget**: Every newly created file is strictly `< 100 LOC` (target average 60–85 LOC). Root facades strictly `< 25 LOC`.
2. **Backward Compatibility**: All existing import paths preserved via root facades. No broken external or test imports.
3. **Clean Architecture Boundaries**:
   - `seed` imports nothing from higher layers.
   - `tree` imports only `seed`.
   - `forest` imports `seed` and `tree` (orchestration calls to `land` allowed via one-way rule).
   - `land` imports `seed`, `tree`, and `forest`.
4. **Quality Gates**:
   - `npm run type-check` (0 errors)
   - `npm run lint -- --quiet` (0 errors, 0 new suppressions)
   - `bash scripts/check-layer-boundaries.sh` (0 violations)
   - `npm run i18n:validate` (0 missing keys)
   - `npm test` (100% green test suite)
