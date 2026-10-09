# Brainstorm Contract: Unified Growth Architecture & Real-World Feedback Engine (Growth Triad v15)

**Date:** 2026-10-09  
**Scope:** Ecosystem Consolidation, Unified Obsidian Cockpit, D1 Concurrency Hardening & Closed-Loop Performance Ingestion (Growth Triad v15)  
**Runtime:** Cloudflare Workers (OpenNext) + Next.js 16 App Router + Inngest SDK v3.x + Cloudflare D1  
**Architecture:** 5 Clean Layers (`seed` → `tree` → `forest` → `land` → `presentation`)  

---

## 1. Problem Statement & System Audit

1. **Presentation Layer Fragmentation:**
   - 8 disconnected legacy growth directories (`src/components/growth-triad-v2` through `v9`) with over 24 individual polling cards create UI cognitive load and inconsistent theme tokens.
   - The newly shipped `UnifiedGrowthCockpit` (v14) needs a canonical, bilingual (VN/EN) home mounted at `/dashboard/growth` and `/admin/growth-analytics`.
2. **Backend Concurrency Debt:**
   - Historical coordinators (v5–v13) use ad-hoc locks instead of the standardized `src/seed/db/atomic-cas-lock.ts` and lack unified fail-closed circuit breaker protection.
3. **Open-Loop Creative Blindspot:**
   - Speculative video rendering (v14) and Thompson MAB split-testing (v13) rely on initial heuristic priors. Real-world post-publish metrics (retention curve, completion rate, CTR from TikTok/YouTube) are not automatically ingested to update Bayesian priors $\text{Beta}(\alpha, \beta)$ for future iterations.

---

## 2. Synthesized 3-Phase Strategic Roadmap

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Phase 1: Presentation Layer Consolidation (Obsidian Cyber-Glass)             │
│ • Mount UnifiedGrowthCockpit at `/dashboard/growth` & `/admin/growth-analytics` │
│ • Consolidate legacy cards (v2-v9) into shared primitives (MetricGauge, etc.)│
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼───────────────────────────────────────┐
│ Phase 2: D1 Concurrency & Circuit Breaker Hardening                          │
│ • Backport `atomic-cas-lock.ts` (OCC 5-min stale recovery) across v5-v13     │
│ • Apply fail-closed `growth-circuit-breaker.ts` to all external integrations │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼───────────────────────────────────────┐
│ Phase 3: Growth Triad v15 Real-World Feedback & Prior Auto-Tuning            │
│ • Social Analytics Ingestion Worker (YouTube Data API / TikTok API)          │
│ • Bayesian Beta-Binomial Prior Update Engine: (α_new = α + views*retention)  │
│ • Closed-Loop Feedback: Real Audience Retention → Prior → MAB → Kelly Render │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Technical Specifications by Layer

### Layer 1: Seed Layer Primitives & Schemas
- `src/seed/types/growth-triad-v15.ts`:
  - `SocialPerformanceIngestEvent`: Real-time post-publish telemetry payload.
  - `BayesianPriorUpdateRecord`: Posterior adjustment contracts for MAB arms and hook archetypes.
- `migrations/0472_growth_v15_performance_feedback.sql`:
  - `growth_social_feedback_events`: Immutable log of fetched retention metrics.
  - `growth_bayesian_priors`: State store tracking updated $\alpha, \beta$ parameters per hook archetype.

### Layer 2: Tree Layer Pure Mathematical Domain (< 200 LOC, zero IO)
- `src/tree/growth-v15/prior-updater.ts`:
  - Mathematical Bayesian conjugate update:
    $$\alpha_{\text{post}} = \alpha_{\text{prior}} + \text{effectiveCompletions}$$
    $$\beta_{\text{post}} = \beta_{\text{prior}} + (\text{impressions} - \text{effectiveCompletions})$$
  - Variance dampening factor to prevent hyper-skewing on low-sample viral spikes.
- `src/tree/growth-v15/audience-retention-normalizer.ts`:
  - Normalizes heterogeneous platform metrics (TikTok avg watch time, YouTube relative retention curve) into normalized $[0, 1]$ completion probability.

### Layer 3: Forest Layer Durable Orchestrators
- `src/forest/growth-v15/social-telemetry-ingest-worker.ts`:
  - Inngest cron function (`growth/v15.telemetry.poll`) triggering periodic metric sync for published videos at T+2h, T+12h, T+24h, T+72h.
- `src/forest/growth-v15/prior-recalibration-worker.ts`:
  - Consumes ingested metrics and recomputes prior parameters for MAB arms (`growth/v15.prior.updated`).

### Layer 4: Land Layer Workflows & Coordinators
- `src/land/growth-v15/feedback-coordinator.ts`:
  - D1 persistence coordinator with `acquireCasLock` idempotency.
- `src/land/growth-v15/feedback-actions.ts`:
  - Authenticated Server Actions for manual sync triggers and prior inspections.

### Layer 5: Presentation Layer UI Cockpit
- `src/components/growth/primitives/`:
  - `metric-gauge.tsx`, `signal-stream-badge.tsx`, `retention-curve-chart.tsx`.
- `src/app/[locale]/(dashboard)/growth/page.tsx`:
  - Unified Executive Growth Center hosting `UnifiedGrowthCockpit`, MAB Explorer, and Bayesian Prior Health monitor.

---

## 4. Evaluated Approaches & Trade-Offs

| Approach | Pros | Cons | Verdict |
|---|---|---|---|
| **A. Pure UI Facelift Only** | Fast, immediate visual improvement for CEOs. | Doesn't solve open-loop rendering blindspot. | Rejected as standalone |
| **B. Backend Pipeline Only (v15)** | Deep algorithmic automation and intelligence. | Leaves UI fragmented across 8 legacy tabs. | Rejected as standalone |
| **C. Integrated 3-Phase Roadmap (Recommended)** | Solves UI debt, hardens concurrency, closes feedback loop completely. | Requires disciplined phase staging. | **Selected (100% Alignment)** |

---

## 5. Success Metrics & Validation Gates

1. **Quality Gates:**
   - 0 TypeScript errors (`npm run type-check`).
   - 0 ESLint errors / warnings (`npm run lint`).
   - 0 Layer boundary violations (`scripts/check-layer-boundaries.sh`).
   - 100% green Vitest test suite.
2. **Architectural Invariants:**
   - All modules strictly < 200 LOC, zero `:any` types.
   - Synchronous D1 client access (`createServerClient()`, no `await`).
   - Protected flows (Setup Wizard, Telegram Bot, NOWPayments) 100% untouched.
