# Architecture Blueprint: Wave 18 Tri-Cluster Deep Modularization & Architecture Refactor

**Date:** 2026-10-10  
**Scope:** 15 Production Monoliths (~5,309 LOC total)  
**Target:** 100% compliance with `< 200 LOC` invariant, backward-compatible facades, 0 `:any`, 0 `console.log`, 0 layer violations.

---

## Executive Summary

Following the completion of Wave 17, Wave 18 decomposes the remaining 15 highest-risk monolith files into isolated, single-responsibility submodules strictly `< 200 LOC` each, while preserving 100% backward compatibility through root facade re-exports (`export * from './<subfolder>/index';`).

---

## Architectural Clusters & File Breakdown

### Cluster 1: Infrastructure, Security & AI Video Gateways (5 targets, ~1,772 LOC)
1. **`src/land/services/replicate/replicate-video-service.ts` (362L)** → `src/land/services/replicate/video/`
   - `types.ts` (<50L): Generation requests, prediction status, webhook payload schemas.
   - `prediction-poller.ts` (<130L): Async poll loop, exponential backoff, timeout handling.
   - `model-dispatcher.ts` (<130L): Replicate API client, version mapping, circuit breaker calls.
   - `replicate-video-service.ts` (<150L): Video synthesis service coordinator.
   - `index.ts` (<20L) + Root facade `replicate-video-service.ts` (<15L).

2. **`src/forest/middleware/rate-limiter.ts` (355L)** → `src/forest/middleware/rate-limiter/`
   - `types.ts` (<50L): Rate limit tiers, window configs, token bucket descriptors.
   - `token-bucket-store.ts` (<130L): In-memory and KV token bucket algorithms.
   - `sliding-window-evaluator.ts` (<130L): Request timestamp tracking and limit calculations.
   - `rate-limiter.ts` (<150L): Edge middleware coordinator and response header injector.
   - `index.ts` (<20L) + Root facade `rate-limiter.ts` (<15L).

3. **`src/seed/security/circuit-breaker.ts` (354L)** → `src/seed/security/breaker/`
   - `types.ts` (<50L): Circuit state (`CLOSED`, `OPEN`, `HALF_OPEN`), failure kind mapping.
   - `circuit-state-store.ts` (<120L): Failure counters, timestamp tracking, probe locks.
   - `probe-controller.ts` (<120L): Half-open state canary requests and recovery evaluation.
   - `circuit-breaker.ts` (<150L): Core `shouldAllowRequest`, `recordSuccess`, `recordFailure`.
   - `index.ts` (<20L) + Root facade `circuit-breaker.ts` (<15L).

4. **`src/seed/utils/logger-internals.ts` (356L)** → `src/seed/utils/logger/`
   - `types.ts` (<50L): Log levels, transport interfaces, metadata contracts.
   - `secret-redactor.ts` (<120L): Regex sanitizer for API keys, bearer tokens, passwords.
   - `log-formatter.ts` (<130L): JSON structured log serializing, timestamp formatting.
   - `logger-internals.ts` (<150L): Transport dispatch (stdout, Cloudflare tail, buffer).
   - `index.ts` (<20L) + Root facade `logger-internals.ts` (<15L).

5. **`src/forest/agent-chat/context-manager.ts` (345L)** → `src/forest/agent-chat/context/`
   - `types.ts` (<50L): Context window limits, conversation history contracts.
   - `token-budget-allocator.ts` (<120L): Model-specific context window quotas and limits.
   - `message-pruner.ts` (<130L): Sliding window trimming, system prompt preservation.
   - `context-manager.ts` (<150L): Dynamic prompt assembler and history manager.
   - `index.ts` (<20L) + Root facade `context-manager.ts` (<15L).

---

### Cluster 2: Domain Calculators, Allocators & Signals (5 targets, ~1,766 LOC)
6. **`src/tree/revenue/cohort-retention-calculator.ts` (351L)** → `src/tree/revenue/cohort/`
   - `types.ts` (<50L): Cohort periods, retention matrix, churn rate DTOs.
   - `matrix-builder.ts` (<130L): Cohort grid generation, monthly/weekly period bucket aggregation.
   - `decay-curve-fitter.ts` (<130L): Logarithmic & exponential churn curve calculations.
   - `cohort-retention-calculator.ts` (<150L): High-level cohort analytics coordinator.
   - `index.ts` (<20L) + Root facade `cohort-retention-calculator.ts` (<15L).

7. **`src/tree/localization/edge-mesh-router.ts` (357L)** → `src/tree/localization/mesh/`
   - `types.ts` (<50L): Region tags, edge node latency contracts, routing rules.
   - `latency-evaluator.ts` (<130L): Round-trip time telemetry and ranking.
   - `mesh-failover.ts` (<130L): Degraded node bypass and geo-fallback resolution.
   - `edge-mesh-router.ts` (<150L): Tenant request localization coordinator.
   - `index.ts` (<20L) + Root facade `edge-mesh-router.ts` (<15L).

8. **`src/tree/market-signals/store.ts` (360L)** → `src/tree/market-signals/store/`
   - `types.ts` (<50L): Signal schema, time-series points, source identifiers.
   - `signal-query-builder.ts` (<130L): D1 SQL generator for time-window signal queries.
   - `signal-deduplicator.ts` (<130L): Hash-based deduplication and anomaly detection.
   - `store.ts` (<150L): Atomic D1 storage coordinator and TTL cache.
   - `index.ts` (<20L) + Root facade `store.ts` (<15L).

9. **`src/tree/sales/bant-scoring-service.ts` (356L)** → `src/tree/sales/bant/`
   - `types.ts` (<50L): BANT criteria (Budget, Authority, Need, Timeline) DTOs.
   - `criteria-evaluator.ts` (<130L): Weighted scoring logic and confidence intervals.
   - `lead-tier-ranker.ts` (<130L): Enterprise classification (P0, P1, P2) and SLA assignment.
   - `bant-scoring-service.ts` (<150L): BANT scoring coordinator and CRM export.
   - `index.ts` (<20L) + Root facade `bant-scoring-service.ts` (<15L).

10. **`src/tree/gpu-mesh/dedicated-lane-allocator.ts` (347L)** → `src/tree/gpu-mesh/allocator/`
    - `types.ts` (<50L): Lane configurations, GPU cluster status, tenant priority.
    - `capacity-checker.ts` (<130L): Cluster saturation checks and quota tracking.
    - `lane-scheduler.ts` (<130L): Dedicated vs shared GPU lane scheduler and eviction.
    - `dedicated-lane-allocator.ts` (<150L): Lane allocator orchestrator.
    - `index.ts` (<20L) + Root facade `dedicated-lane-allocator.ts` (<15L).

---

### Cluster 3: Land Operations, Swarm & Affiliate Governance (5 targets, ~1,771 LOC)
11. **`src/land/growth/arbitrage-coordinator.ts` (361L)** → `src/land/growth/arbitrage/`
    - `types.ts` (<50L): Arbitrage campaign DTOs, pacing metrics, ROI limits.
    - `traffic-pacer.ts` (<130L): Hourly spend pacing, budget curve enforcement.
    - `roi-calculator.ts` (<130L): Cost per lead vs revenue yield metrics.
    - `arbitrage-coordinator.ts` (<150L): Growth campaign arbitrage coordinator.
    - `index.ts` (<20L) + Root facade `arbitrage-coordinator.ts` (<15L).

12. **`src/land/affiliates/affiliate-webhook-verifier.ts` (356L)** → `src/land/affiliates/verifier/`
    - `types.ts` (<50L): Provider signature schemas, verification results.
    - `hmac-validator.ts` (<130L): Constant-time HMAC comparison (ClickBank, PayOS, CJ).
    - `replay-guard.ts` (<130L): Nonce and timestamp freshness checks.
    - `affiliate-webhook-verifier.ts` (<150L): Webhook verifier coordinator.
    - `index.ts` (<20L) + Root facade `affiliate-webhook-verifier.ts` (<15L).

13. **`src/land/admin/org-manager.ts` (354L)** → `src/land/admin/org/`
    - `types.ts` (<50L): Organization entity, seat quotas, role permissions.
    - `role-guard.ts` (<130L): Master/Admin permission checks and audit tracking.
    - `seat-manager.ts` (<130L): Seat quota enforcement, member invitation lifecycle.
    - `org-manager.ts` (<150L): Organization management coordinator.
    - `index.ts` (<20L) + Root facade `org-manager.ts` (<15L).

14. **`src/tree/handover/customer-handover-service.ts` (352L)** → `src/tree/handover/service/`
    - `types.ts` (<50L): Tenant handover DTOs, credential export bundle.
    - `credential-packager.ts` (<130L): Encrypted secret packaging and export.
    - `migration-verifier.ts` (<130L): Target database connectivity and integrity checks.
    - `customer-handover-service.ts` (<150L): Customer handover service coordinator.
    - `index.ts` (<20L) + Root facade `customer-handover-service.ts` (<15L).

15. **`src/land/swarm/swarm-management-actions.ts` (348L)** → `src/land/swarm/actions/`
    - `types.ts` (<50L): Action payloads, execution status, response types.
    - `swarm-validator.ts` (<130L): Task schema validation, quota checks.
    - `worker-dispatcher.ts` (<130L): Swarm worker execution and result aggregation.
    - `swarm-management-actions.ts` (<150L): `'use server'` action entrypoints.
    - `index.ts` (<20L) + Root facade `swarm-management-actions.ts` (<15L).

---

## Quality Gates Protocol
1. **LOC Check**: Every new file strictly `< 200 LOC`.
2. **Type Check**: `npm run type-check` (0 errors, 0 `:any`).
3. **ESLint**: `npm run lint -- --quiet` (0 errors).
4. **Layer Boundaries**: `bash scripts/check-layer-boundaries.sh` (0 violations: `seed` → `tree` → `forest` → `land`).
5. **i18n Validation**: `npm run i18n:validate` (0 missing keys).
6. **Vitest Suite**: `npx vitest run ...` (100% green).
