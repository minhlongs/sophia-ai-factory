# Tech Stack Architecture — Growth Triad v12: Autonomous Monetization Flywheel

**Date:** 2026-10-08  
**Scope:** Performance Re-seeding Flywheel, Live Platform Adapters & Affiliate Revenue Attribution  
**Runtime:** Cloudflare Workers (OpenNext) + Next.js 16 App Router + Inngest SDK v3.x  

---

## 1. Core Technology Selection

| Domain | Technology | Justification & Architectural Role |
|---|---|---|
| **Edge Compute** | Cloudflare Workers (`@opennextjs/cloudflare`) | Lightweight edge runtime executing Z-score evaluations & attribution parsing <5ms. |
| **Relational Data** | Cloudflare D1 (SQLite) | Synchronous persistence (`createServerClient()`) for flywheel state, OAuth locks, and ledger. |
| **Durable Jobs** | Inngest SDK v3.x | Decoupled background queue for Darwinian hook reseeding, token refresh, and webhook ingest. |
| **Circuit Breakers** | Sophia Resilient Circuit Breaker | Per-tenant protection (`@/seed/security/circuit-breaker`) handling upstream platform limits. |
| **Mathematical Engine** | Pure TypeScript Algorithms | Zero-IO Z-score classification, Jensen-Shannon hook divergence, anti-cannibalization pacing. |
| **Validation** | Zod v3.24+ | Fail-closed runtime validation for webhook payloads, reseed triggers, and token data. |
| **Presentation** | Next.js Server Components + Tailwind | Non-technical CEO HUD using Sophia amber primary (`globals.css`) and Lucide icons. |

---

## 2. 5-Layer Clean Architecture Fit

```
seed (Foundational primitives & schemas)
  ├── src/seed/types/growth-triad-v12.ts           — Zod schemas for FlywheelConfig, ReseedJob, LiveMetrics
  ├── src/seed/config/growth/flywheel-weights.ts  — Z-score thresholds, token refresh intervals, pacing limits
  └── migrations/0469_growth_v12_flywheel.sql     — D1 schema for flywheel_reseed_jobs, conversion_attributions

tree (Pure zero-IO domain algorithms)
  ├── src/tree/growth-v12/zscore-classifier.ts    — Statistical Z-score classification & alpha viral detection
  ├── src/tree/growth-v12/hook-mutator.ts         — Darwinian token mutation engine preserving semantic curiosity
  └── src/tree/growth-v12/affiliate-matcher.ts    — UTM parameter & manifest ID deterministic attribution parser

forest (Infrastructure orchestration & background jobs)
  ├── src/forest/growth/token-refresh-scheduler.ts — Proactive OAuth token auto-rotation state machine
  ├── src/forest/inngest/functions/growth/growth-v12-reseed-worker.ts — Inngest Darwinian reseed pipeline worker
  └── src/forest/inngest/functions/growth/growth-v12-webhook-worker.ts — Conversion webhook processor & DLQ retry

land (Business domain workflows & Server Actions)
  ├── src/land/growth/flywheel-coordinator.ts     — State machine coordinating reseed lifecycle & ledger credits
  └── src/land/growth/flywheel-actions.ts         — 'use server' Server Actions with Better Auth session check

presentation (User interfaces & metrics dashboard)
  ├── src/components/growth/flywheel-card.tsx     — Visual breakdown of autonomous reseed loop & revenue yield
  └── src/app/[locale]/(dashboard)/growth/flywheel/ — Bilingual CEO cockpit with real-time flywheel telemetry
```

---

## 3. Strict Compliance with Sophia Principles

1. **Zero Operator Infrastructure (Strict No-Tech Doctrine)**:
   - Does NOT require external Redis, Celery, or dedicated worker servers.
   - All state, lease locks, and queues leverage Cloudflare D1 with atomic status leasing.
2. **Deterministic BYOK Guardrails**:
   - Customer API keys (OpenRouter, ElevenLabs, D-ID) and OAuth tokens stay isolated per tenant.
   - Quota exhaustion trips tenant-specific circuit breakers without cross-tenant impact.
3. **No Edge Blocking**:
   - Edge Worker threads only compute mathematical routing directives. Heavy transcoding, AI calls, and external polling are dispatched to Inngest background jobs.
