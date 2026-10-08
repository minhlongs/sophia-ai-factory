# Tech Stack Architecture — Growth Triad v11: Cross-Platform Virality & Compute Arbitrage

**Date:** 2026-10-08  
**Scope:** Cross-Platform Reach Multiplier, Hook Re-alignment & Opportunistic Compute Cost Arbitrage  
**Runtime:** Cloudflare Workers (OpenNext) + Next.js 16 App Router + Inngest SDK v3.x  

---

## 1. Core Technology Selection

| Domain | Technology | Justification & Architectural Role |
|---|---|---|
| **Edge Compute** | Cloudflare Workers (`@opennextjs/cloudflare`) | Lightweight edge runtime executing Zero-IO algebraic scoring engines in <5ms. |
| **Relational Data** | Cloudflare D1 (SQLite) | Synchronous persistence (`createServerClient()`) for arbitrage decisions & telemetry logs. |
| **Durable Jobs** | Inngest SDK v3.x | Decoupled background queue for off-peak batch render coordination & webhook ingest. |
| **Circuit Breakers** | Sophia Resilient Circuit Breaker | Per-provider protection (`@/seed/security/circuit-breaker`) handling upstream 429/500/auth faults. |
| **Mathematical Engine** | Pure TypeScript Algorithms | Zero-IO Jensen-Shannon divergence, platform survival curves, and utility maximization. |
| **Validation** | Zod v3.24+ | Fail-closed runtime validation for platform metric profiles and render payloads. |
| **Presentation** | Next.js Server Components + Tailwind | Non-technical CEO HUD using Sophia amber primary (`globals.css`) and Lucide icons. |

---

## 2. 5-Layer Clean Architecture Fit

```
seed (Foundational primitives & schemas)
  ├── src/seed/types/growth-triad-v11.ts           — Zod schemas for ArbitrageRequest, ComputeSpec, ProviderScores
  ├── src/seed/config/virality-weights.ts         — Platform weight vectors (TikTok, Shorts, Reels)
  └── migrations/0468_growth_v11_arbitrage.sql    — D1 schema for platform_arbitrage_logs & compute_jobs

tree (Pure zero-IO domain algorithms)
  ├── src/tree/growth-v11/virality-arbitrage.ts   — Jensen-Shannon Hook Divergence & Platform Multiplier Math
  └── src/tree/growth-v11/compute-arbitrage.ts    — Marginal Utility Objective Function & Dynamic Model Degradation

forest (Infrastructure orchestration & background jobs)
  ├── src/forest/growth/opportunistic-scheduler.ts — Off-peak window & circuit breaker route selector
  └── src/forest/inngest/functions/growth-v11/     — Inngest background event consumers with retry/backoff

land (Business domain workflows & Server Actions)
  ├── src/land/growth/arbitrage-coordinator.ts    — State machine executing cross-platform re-targeting
  └── src/land/growth/arbitrage-actions.ts        — 'use server' Server Actions with Better Auth session check

presentation (User interfaces & metrics dashboard)
  ├── src/components/growth/arbitrage-card.tsx    — Visual breakdown of cost savings & reach multipliers
  └── src/app/[locale]/(dashboard)/growth/v11/    — Bilingual CEO cockpit with real-time arbitrage KPIs
```

---

## 3. Trade-Off Matrix & Compliance with Sophia Doctrine

1. **Zero Operator Infrastructure (Strict No-Tech Doctrine)**:
   - Does NOT require external Redis, RabbitMQ, or dedicated GPU server instances.
   - All batch holds and off-peak queues live within Cloudflare D1 with atomic status leasing.
2. **Deterministic BYOK Guardrails**:
   - Customer API keys (OpenRouter, ElevenLabs, D-ID, HeyGen) are utilized exclusively in customer scope.
   - Rate limits and quota exhaustion trip tenant-specific circuit breakers without cascading to other accounts.
3. **No Synchronous Media Transcoding on Request Thread**:
   - Edge Worker threads only compute mathematical routing directives. Heavy transcoding or video assembly is dispatched strictly to Inngest background jobs.
