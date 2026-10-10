# Wave 15 Tri-Cluster Deep Modularization: Architecture & Strategy Blueprint

## Executive Summary
Wave 15 decomposes 15 production monoliths (~6,160 LOC total) across 3 parallel architectural clusters to enforce the strict `< 200 LOC` file budget invariant, eliminate context window dilution, and ensure single-responsibility modularity.

---

## Target Candidates (15 Monoliths across 3 Clusters)

### Cluster 1: Core Domain Intelligence & AI Compute (~2,060 LOC)
1. `src/tree/predictive/predictive-ltv-engine.ts` (421L) → `src/tree/predictive/ltv/`
   - Churn probability modeling, cohort LTV decay calculation, customer lifetime valuation, and D1 persistence.
2. `src/tree/cultural-adaptation/dialect-normalizer.ts` (419L) → `src/tree/cultural-adaptation/normalizer/`
   - Vietnamese regional phonetic shifts (Bac, Trung, Nam), tone mark sanitization, and colloquial dialect normalization.
3. `src/tree/memory/memory-consolidator.ts` (411L) → `src/tree/memory/consolidator/`
   - Cross-session memory compaction, episodic semantic graph merging, and memory pruning triggers.
4. `src/tree/ai/multimodal-cost-router.ts` (401L) → `src/tree/ai/router/`
   - Multi-model token cost arbitrage, vision vs text complexity analyzer, and budget ceiling guard.
5. `src/tree/youtube-strategy/learning-engine.ts` (389L) → `src/tree/youtube-strategy/engine/`
   - CTR performance feedback weighting, thumbnail title mutation learner, and strategy recommendation engine.

### Cluster 2: Edge Workflow Handlers & Business Operations (~2,010 LOC)
6. `src/forest/inngest/functions/generate-campaign.ts` (418L) → `src/forest/inngest/functions/campaign/`
   - Multi-step campaign generation state machine, AI prompt synthesizer, asset creation dispatch, and step retrier.
7. `src/land/openclaw-telegram/openclaw-handlers.ts` (413L) → `src/land/openclaw-telegram/handlers/`
   - Telegram bot command routing, webhook update payload parser, auth gating, and interactive keyboard responder.
8. `src/land/partners/reseller-actions.ts` (400L) → `src/land/partners/actions/`
   - Server Actions for reseller tier assignment, white-label client onboarding, revenue split mutations, and commission payout claims.
9. `src/land/video/generation/campaign-orchestrator.ts` (396L) → `src/land/video/generation/orchestrator/`
   - Video generation job lifecycle coordinator, rendering queue dispatcher, webhook callback processor, and asset upload sync.
10. `src/forest/sops/sop-executor.ts` (390L) → `src/forest/sops/executor/`
    - Autonomous SOP step runner, verification check evaluator, tool execution harness, and execution history writer.

### Cluster 3: Infrastructure, Client Gateways & Fault Tolerance (~2,090 LOC)
11. `src/tree/email/lifecycle-email-rules.ts` (417L) → `src/tree/email/rules/`
    - User journey event trigger conditions, email cadence throttle, localized drip copy resolver, and anti-spam limits.
12. `src/tree/clients/nowpayments-client.ts` (413L) → `src/tree/clients/nowpayments/`
    - Crypto invoice generation, IPN signature HMAC-SHA512 verification, currency rate fetcher, and circuit breaker.
13. `src/tree/cdn/thumbnail-generator.ts` (409L) → `src/tree/cdn/generator/`
    - Dynamic canvas rendering, WebP optimization, R2 cache asset uploader, and thumbnail dimension normalizer.
14. `src/tree/queue/gpu-mesh-failover.ts` (396L) → `src/tree/queue/failover/`
    - Cross-region GPU worker failure detector, cold-start fallback dispatch, heartbeat monitor, and queue re-enqueue logic.
15. `src/tree/audit/enterprise-audit-vault.ts` (389L) → `src/tree/audit/vault/`
    - Tamper-evident cryptographic log chaining, Merkle tree root generator, D1 append-only batch writer, and compliance exporter.

---

## Architectural Invariants & Rules

1. **Strict File Budget**: Every single newly created file must be `< 200 LOC`.
2. **Root Facade Strangler Pattern**: Every original entry point is maintained as a `< 20 LOC` facade re-exporting its submodule directory (`export * from './<submodule>/index';`).
3. **Layer Hierarchy**: Unidirectional boundaries (`seed` → `tree` → `forest` → `land`).
4. **Zero Regression**: Zero `:any`, zero `console.log`, 100% green tests, and 0 lint/type errors.
