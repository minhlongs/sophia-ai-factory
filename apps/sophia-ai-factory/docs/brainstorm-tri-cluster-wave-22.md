# Brainstorm: Wave 22 Tri-Cluster Deep Modularization & Architecture Refactor

**Date:** 2026-10-10  
**Status:** PROPOSED & READY FOR PARALLEL EXECUTION  
**Scope:** 15 High-Density Production Monoliths (~4,700 LOC total, all between 304L and 322L)  
**File Budget:** Strictly `< 200 LOC` per submodule | Root facades `< 25 LOC`

---

## 1. Executive Summary & Problem Statement

Following the successful completion and verification of Waves 1–21, the codebase retains ~400 files exceeding the `< 200 LOC` threshold. These remaining monoliths, specifically in growth orchestration, agent loops/tool registries, and enterprise domain services, create context dilution in autonomous agent pipelines, blur single-responsibility boundaries, and heighten risk on edge deployment paths.

Wave 22 targets the next 15 highest-density domain monoliths across 3 architectural clusters:
1. **Cluster 1: Growth, Marketing & Content Assembly (5 files ~1,567 LOC)**
2. **Cluster 2: Agent Protocols, Streaming & Mission Dispatch (5 files ~1,560 LOC)**
3. **Cluster 3: Domain Intelligence, Routing, Tax & Security (5 files ~1,564 LOC)**

---

## 2. Tri-Cluster Architectural Decomposition

### Cluster 1: Growth, Marketing & Content Assembly (5 Targets ~ 1,567 LOC)
- **`src/land/growth/actions/growth-triad-actions.ts` (322L)** → `src/land/growth/actions/triad/`:
  - `types.ts` (<50L): Action payloads, execution status, and response types.
  - `triad-execution-actions.ts` (<140L): Triad run triggers, step evaluations, and batch executions.
  - `triad-metrics-actions.ts` (<130L): Triad analytics, performance counters, and ROI metrics.
  - `index.ts` (<15L) + Root facade `growth-triad-actions.ts` (<12L).
- **`src/land/video/assembly/composer-ffmpeg.ts` (315L)** → `src/land/video/assembly/ffmpeg/`:
  - `types.ts` (<50L): FFmpeg command parameters, filter graph configs, and output targets.
  - `filtergraph-builder.ts` (<140L): Video/audio scale, crop, overlay, and text burned-in subtitle filter chains.
  - `ffmpeg-executor.ts` (<150L): Process runner, probe validation, and render pipeline error handling.
  - `index.ts` (<15L) + Root facade `composer-ffmpeg.ts` (<12L).
- **`src/land/publish/actions/schedule-whatsapp.ts` (311L)** → `src/land/publish/actions/whatsapp/`:
  - `types.ts` (<50L): WhatsApp schedule request DTOs, delivery window schemas, and message templates.
  - `template-resolver.ts` (<130L): Variable interpolation, media attachment links, and compliance validation.
  - `whatsapp-scheduler.ts` (<150L): D1 schedule queue persistence and status transitions.
  - `index.ts` (<15L) + Root facade `schedule-whatsapp.ts` (<12L).
- **`src/land/promo/bulk-generator.ts` (311L)** → `src/land/promo/generator/`:
  - `types.ts` (<50L): Bulk promo campaign options, discount rules, and code patterns.
  - `code-pattern-builder.ts` (<130L): Cryptographic collision-resistant code generator and entropy formatting.
  - `bulk-promo-engine.ts` (<150L): Batch D1 transaction writer with deduplication guards.
  - `index.ts` (<15L) + Root facade `bulk-generator.ts` (<12L).
- **`src/land/affiliates/promo-library.ts` (308L)** → `src/land/affiliates/library/`:
  - `types.ts` (<50L): Promo asset types, affiliate tier permissions, and creative bundles.
  - `asset-search.ts` (<130L): Category filtering, localization querying, and search scoring.
  - `promo-library-service.ts` (<150L): Asset retrieval, download link generation, and usage tracking.
  - `index.ts` (<15L) + Root facade `promo-library.ts` (<12L).

### Cluster 2: Agent Protocols, Streaming & Mission Dispatch (5 Targets ~ 1,560 LOC)
- **`src/forest/middleware/agy-tenant-isolation.ts` (318L)** → `src/forest/middleware/isolation/`:
  - `types.ts` (<50L): Tenant context, isolation policies, and violation audit types.
  - `tenant-validator.ts` (<130L): Header/token extraction, tenant slug resolution, and status checking.
  - `isolation-enforcer.ts` (<150L): Database namespace injection, R2 bucket scoping, and security guard middleware.
  - `index.ts` (<15L) + Root facade `agy-tenant-isolation.ts` (<12L).
- **`src/forest/missions/dispatcher.ts` (317L)** → `src/forest/missions/dispatcher-ops/`:
  - `types.ts` (<50L): Mission dispatch requests, worker queue states, and retry strategies.
  - `queue-router.ts` (<130L): Priority-weighted routing, concurrency limit checking, and backpressure handling.
  - `mission-dispatch-engine.ts` (<150L): Inngest event emission, status tracking, and execution logging.
  - `index.ts` (<15L) + Root facade `dispatcher.ts` (<12L).
- **`src/forest/agent-chat/tool-registry.ts` (310L)** → `src/forest/agent-chat/registry/`:
  - `types.ts` (<60L): Agent tool definitions, parameter schemas, and execution contexts.
  - `tool-catalog.ts` (<140L): Tool categorization, capability filtering, and permission scoping.
  - `tool-registry-service.ts` (<140L): Dynamic registration, tool invocation dispatch, and error formatting.
  - `index.ts` (<15L) + Root facade `tool-registry.ts` (<12L).
- **`src/forest/publishing/scheduler.ts` (309L)** → `src/forest/publishing/scheduler-ops/`:
  - `types.ts` (<50L): Publishing task schemas, schedule windows, and queue priorities.
  - `slot-calculator.ts` (<130L): Audience active hour optimization and platform rate limit windows.
  - `publishing-scheduler-engine.ts` (<150L): Next execution scheduling, D1 queue polling, and dispatch triggering.
  - `index.ts` (<15L) + Root facade `scheduler.ts` (<12L).
- **`src/forest/agent-chat/tool-use-loop.ts` (306L)** → `src/forest/agent-chat/loop/`:
  - `types.ts` (<50L): Tool execution turns, step results, and conversation states.
  - `step-evaluator.ts` (<140L): Model response parsing, tool call extraction, and termination condition validation.
  - `loop-runner.ts` (<150L): Iterative ReAct execution loop, timeout monitoring, and state aggregation.
  - `index.ts` (<15L) + Root facade `tool-use-loop.ts` (<12L).

### Cluster 3: Domain Intelligence, Routing, Tax & Security (5 Targets ~ 1,564 LOC)
- **`src/tree/bi/metrics-aggregator.ts` (318L)** → `src/tree/bi/aggregator/`:
  - `types.ts` (<50L): Aggregation windows, metric dimension schemas, and rollup models.
  - `time-series-rollup.ts` (<140L): Hourly/daily rollup math, EMA smoothing, and quantile computation.
  - `metrics-aggregator-service.ts` (<150L): Multi-tenant metric ingestion and D1 aggregation caching.
  - `index.ts` (<15L) + Root facade `metrics-aggregator.ts` (<12L).
- **`src/tree/multicloud/multicloud-router.ts` (315L)** → `src/tree/multicloud/router/`:
  - `types.ts` (<50L): Cloud provider endpoints, health stats, and failover policy types.
  - `health-evaluator.ts` (<130L): Latency probing, error rate threshold checking, and provider circuit states.
  - `multicloud-router-engine.ts` (<150L): Dynamic route resolution, priority hedging, and dispatch orchestration.
  - `index.ts` (<15L) + Root facade `multicloud-router.ts` (<12L).
- **`src/tree/byok/byok-crypto.ts` (315L)** → `src/tree/byok/crypto/`:
  - `types.ts` (<50L): Key cipher text schemas, salt derivation parameters, and envelope formats.
  - `envelope-encryption.ts` (<140L): Web Crypto AES-256-GCM encryption/decryption routines and key wrapping.
  - `byok-crypto-service.ts` (<140L): Key rotation re-encryption, key validation, and fingerprint generation.
  - `index.ts` (<15L) + Root facade `byok-crypto.ts` (<12L).
- **`src/tree/admin/synthetic-fulfillment-runner.ts` (312L)** → `src/tree/admin/synthetic/`:
  - `types.ts` (<50L): Synthetic fulfillment scenarios, mock order contracts, and verification outcomes.
  - `scenario-builder.ts` (<130L): Order simulation data factory and state permutation generator.
  - `synthetic-fulfillment-service.ts` (<150L): End-to-end dry-run executor, ledger assertion, and report generation.
  - `index.ts` (<15L) + Root facade `synthetic-fulfillment-runner.ts` (<12L).
- **`src/tree/tax/tax-compliance-engine.ts` (304L)** → `src/tree/tax/compliance/`:
  - `types.ts` (<50L): Jurisdictional tax rates, nexus rules, and VAT/sales tax schemas.
  - `rate-resolver.ts` (<130L): Geo-IP/billing country lookup, tax exemption rules, and digital service categorization.
  - `tax-compliance-service.ts` (<150L): Transaction tax computation, invoice line item generation, and audit trail writer.
  - `index.ts` (<15L) + Root facade `tax-compliance-engine.ts` (<12L).

---

## 3. Strict Architectural Invariants & Quality Gates
1. **File Budget Invariant**: Strictly `< 200 LOC` per submodule. Root facades `< 25 LOC`.
2. **Clean Layer Boundaries**: `seed` → `tree` → `forest` → `land`. Zero forbidden upward or cross-layer imports.
3. **Public Contract Parity**: 100% backward-compatible root facades re-exporting submodules.
4. **Zero Quality Regressions**:
   - `npm run type-check`: 0 errors.
   - `npm run lint -- --quiet`: 0 errors.
   - `bash scripts/check-layer-boundaries.sh`: 0 violations.
   - `npm run i18n:validate`: 0 missing keys.
   - `npm test`: 100% green tests.
