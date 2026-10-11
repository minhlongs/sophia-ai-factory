# Wave 19 Tri-Cluster Deep Modularization Architecture Blueprint

## Executive Summary
Wave 19 targets the decomposition of 15 high-risk monoliths (~4,928 LOC total) across the Sophia AI Factory platform (`apps/sophia-ai-factory/`). This refactoring establishes single-responsibility submodules strictly `< 200 LOC` per file, preserves 100% backward compatibility via root facades, and enforces unidirectional Clean Architecture boundaries (`seed` -> `tree` -> `forest` -> `land`).

---

## Target Matrix

### Cluster 1: Infrastructure, AI Inference & Background Workers (5 Targets ~ 1,705 LOC)
1. `src/seed/inference/openrouter-client.ts` (342L)
   - **Target**: `src/seed/inference/openrouter/` (5 submodules: `types.ts`, `circuit-guard.ts`, `request-builder.ts`, `response-parser.ts`, `openrouter-client.ts`, `index.ts`) + root facade.
   - **Responsibility**: BYOK OpenRouter inference, streaming chunks, retry backoff, and circuit breaker protection.
2. `src/forest/jobs/sla-refund-monitor-cron.ts` (344L)
   - **Target**: `src/forest/jobs/sla-refund/` (5 submodules: `types.ts`, `breach-detector.ts`, `refund-calculator.ts`, `monitor-runner.ts`, `index.ts`) + root facade.
   - **Responsibility**: Automated detection of degraded video rendering and SLA breach refund initiation.
3. `src/forest/inngest/functions/agent-rollback-cron.ts` (343L)
   - **Target**: `src/forest/inngest/functions/rollback/` (5 submodules: `types.ts`, `state-evaluator.ts`, `reversion-executor.ts`, `rollback-job.ts`, `index.ts`) + root facade.
   - **Responsibility**: Autonomous agent state rollback, dead-node consensus recovery, and D1 transaction rollback.
4. `src/tree/sovereignty/sovereign-zone-router.ts` (340L)
   - **Target**: `src/tree/sovereignty/zone/` (5 submodules: `types.ts`, `geo-evaluator.ts`, `jurisdiction-policy.ts`, `zone-router.ts`, `index.ts`) + root facade.
   - **Responsibility**: Sovereign data isolation routing, GDPR/PDPD jurisdiction enforcement, and region hashing.
5. `src/tree/webhooks/subscription-repo.ts` (336L)
   - **Target**: `src/tree/webhooks/subscription/` (5 submodules: `types.ts`, `query-builder.ts`, `event-recorder.ts`, `subscription-repo.ts`, `index.ts`) + root facade.
   - **Responsibility**: D1 persistence for webhook lifecycle events, idempotency keys, and tier activations.

### Cluster 2: Agent Protocol, Domain Calculators & Network Clients (5 Targets ~ 1,723 LOC)
6. `src/tree/mekong/tunnel-client.ts` (341L)
   - **Target**: `src/tree/mekong/tunnel/` (5 submodules: `types.ts`, `handshake.ts`, `frame-codec.ts`, `tunnel-client.ts`, `index.ts`) + root facade.
   - **Responsibility**: Mekong CLI bridge multiplexed WebSocket tunneling, keepalive heartbeats, and reconnection.
7. `src/tree/agent-protocol/agent-executor.ts` (341L)
   - **Target**: `src/tree/agent-protocol/executor/` (5 submodules: `types.ts`, `step-dispatcher.ts`, `state-machine.ts`, `agent-executor.ts`, `index.ts`) + root facade.
   - **Responsibility**: ReAct loop execution, tool invocation contracts, and timeout supervision.
8. `src/tree/sla/sla-degradation-calculator.ts` (342L)
   - **Target**: `src/tree/sla/degradation/` (5 submodules: `types.ts`, `latency-analyzer.ts`, `penalty-matrix.ts`, `sla-degradation-calculator.ts`, `index.ts`) + root facade.
   - **Responsibility**: Microsecond latency percentile calculation, penalty tier tiering, and credit issuance.
9. `src/land/analytics/funnel-stats.ts` (358L)
   - **Target**: `src/land/analytics/funnel/` (5 submodules: `types.ts`, `step-aggregator.ts`, `conversion-rates.ts`, `funnel-stats.ts`, `index.ts`) + root facade.
   - **Responsibility**: Video campaign conversion funnel aggregation, drop-off analytics, and ARR forecasting.
10. `src/land/payouts/nowpayments-mass-payout.ts` (341L)
    - **Target**: `src/land/payouts/mass/` (5 submodules: `types.ts`, `batch-validator.ts`, `payout-dispatcher.ts`, `nowpayments-mass-payout.ts`, `index.ts`) + root facade.
    - **Responsibility**: Multi-recipient crypto batch payouts, TRC20 address verification, and D1 ledger recording.

### Cluster 3: Land Actions, Payment Webhooks & App Routes (5 Targets ~ 1,825 LOC)
11. `src/land/contracts/enterprise-contract-actions.ts` (358L)
    - **Target**: `src/land/contracts/enterprise/` (5 submodules: `types.ts`, `contract-validator.ts`, `amendment-handler.ts`, `enterprise-contract-actions.ts`, `index.ts`) + root facade (`'use server'`).
    - **Responsibility**: Server Actions for custom enterprise contract generation, signature tracking, and SLA terms.
12. `src/land/admin/custom-domain-actions.ts` (358L)
    - **Target**: `src/land/admin/domain/` (5 submodules: `types.ts`, `dns-verifier.ts`, `ssl-provisioner.ts`, `custom-domain-actions.ts`, `index.ts`) + root facade (`'use server'`).
    - **Responsibility**: Server Actions for tenant custom domains, Cloudflare CNAME verification, and SSL status.
13. `src/land/operations/sop-video-generation.ts` (340L)
    - **Target**: `src/land/operations/video/` (5 submodules: `types.ts`, `script-compiler.ts`, `queue-dispatcher.ts`, `sop-video-generation.ts`, `index.ts`) + root facade (`'use server'`).
    - **Responsibility**: Video pipeline trigger orchestration, prompt token deduction, and Inngest job dispatch.
14. `src/app/api/checkout/route.ts` (404L)
    - **Target**: `src/app/api/checkout/modules/` (4 submodules: `types.ts`, `schema.ts`, `session-manager.ts`, `provider-router.ts`) + `route.ts` (< 150L).
    - **Responsibility**: Multi-provider checkout API route (NOWPayments crypto + PayOS domestic gateway).
15. `src/app/api/webhooks/payos/route.ts` (365L)
    - **Target**: `src/app/api/webhooks/payos/modules/` (4 submodules: `types.ts`, `signature-verifier.ts`, `payment-handler.ts`, `audit-logger.ts`) + `route.ts` (< 140L).
    - **Responsibility**: Domestic PayOS IPN webhook handler, HMAC-SHA256 signature verification, and atomic balance crediting.

---

## Architectural Invariants
- **File Length**: Every new file strictly `< 200 LOC`.
- **Facades**: Root files preserved as backward-compatible re-exports (`< 15 LOC`).
- **Clean Layers**: `seed` -> `tree` -> `forest` -> `land`. 0 upward or forbidden imports.
- **Next.js Directives**: Maintain `'use server'` on Server Action root facades.
- **Quality Gates**:
  1. `npm run type-check` (0 errors, 0 `:any`)
  2. `npm run lint` (0 errors)
  3. `bash scripts/check-layer-boundaries.sh` (0 violations)
  4. `npm run i18n:validate` (0 missing keys)
  5. `npx vitest run` (100% green tests)
