# Tech Stack Architecture — Video Analytics & Net ROI Attribution Engine

**Date:** 2026-10-08  
**Scope:** Cross-Platform Performance Normalization, Net Margin / ROI Accounting, Closed-Loop Bayesian Feedback  
**Runtime:** Cloudflare Workers (OpenNext) + Next.js 16 App Router + Cloudflare D1 + Inngest  

---

## 1. Core Technology Selection

| Domain | Technology | Justification & Architectural Role |
|---|---|---|
| **Edge Compute** | Cloudflare Workers (`@opennextjs/cloudflare`) | Sub-15ms edge compute running analytics aggregations without server infrastructure. |
| **Relational Storage** | Cloudflare D1 (SQLite) | Atomic time-series storage via `video_analytics_snapshots` with compound indexes. |
| **Workflow Engine** | Inngest SDK v3.x | Scheduled edge cron polling (`T+2h, T+6h, T+24h, T+48h, T+7d`) with step memoization and retry backoff. |
| **Optimization Math** | Bayesian Thompson Sampling | Beta($\alpha, \beta$) conjugate prior updating using Marsaglia-Tsang Gamma sampling for hook arm routing. |
| **Memory Store** | Sophia `creative_memory` | Edge-persisted prompt blue-printing updating when bandit arms hit statistical significance ($N \ge 30$). |
| **Circuit Breakers** | Edge Circuit Breaker State Machine | Prevents quota exhaustion (YouTube 10,000 units/day, TikTok QPS, Meta Graph 200 calls/hr). |
| **UI Design System** | Obsidian Cyber-Glass (Tailwind CSS 4) | Warm Amber / Deep Indigo tokens (`globals.css`), safe-zone 9:16 retention drop-off curves. |
| **Localization** | `next-intl` (`[locale]`) | Bilingual English + Vietnamese across all analytics metrics, charts, and table headers. |

---

## 2. 4-Layer Clean Architecture & Module Mapping

```
seed (Foundational primitives & math schemas)
  ├── src/seed/types/video-analytics-types.ts       — Platform metrics, Hook/Retention scores, Net ROI contracts
  └── src/seed/security/circuit-breaker.ts         — In-memory edge circuit breaker for youtube/tiktok/instagram

tree (Domain calculators & normalization logic)
  ├── src/tree/analytics/metrics-normalizer.ts     — Heterogeneous platform metrics -> unified Hook & Retention indices
  ├── src/tree/analytics/roi-calculator.ts         — Cost aggregation (MCU + BYOK) vs conversion revenue -> Net Margin/ROI
  └── src/tree/affiliate/optimization/             — Thompson Sampling optimizer & Marsaglia-Tsang Gamma sampling

forest (Background orchestration & durable workflows)
  ├── src/forest/inngest/functions/social-analytics-collector.ts  — Scheduled Inngest poller (2h/6h/24h/48h/7d)
  └── src/forest/inngest/functions/flywheel-feedback-dispatcher.ts — High-confidence signal promotion into creative_memory

land (Server Actions, D1 persistence & UI Cockpit)
  ├── src/land/analytics/video-analytics-store.ts  — Multi-tenant D1 persistence & time-series snapshot queries
  ├── src/land/analytics/actions/analytics-actions.ts — 'use server' authenticated actions for analytics dashboard
  ├── src/components/analytics-cockpit/            — Retention curves, hook score cards, ROI tables, bilingual labels
  └── src/app/(app)/dashboard/analytics-roi/page.tsx — Executive Video Analytics & Net ROI Cockpit page
```

---

## 3. Mathematical Foundations & Normalization Algebra

1. **Composite Hook Score (0–100):**
   $$\text{Hook Score} = \text{clamp}\left(100 \times \left(0.70 \times R_{3s} + 0.30 \times \min\left(1, \frac{V_{p25}}{0.60}\right)\right), 0, 100\right)$$
   Evaluates top-of-funnel capture via 3-second hold rate ($R_{3s}$) and first-quartile survival ($V_{p25}$).

2. **Composite Retention Score (0–100):**
   $$\text{Retention Score} = \text{clamp}\left(100 \times \left(0.50 \times \min\left(1.5, \frac{\text{AVP}}{100}\right) + 0.35 \times C_{\text{full}} + 0.15 \times \min\left(1, \frac{\text{EngRate}}{0.10}\right)\right), 0, 100\right)$$
   Weighs loop-credited average view percentage (AVP capped at 150%), full completion rate ($C_{\text{full}}$), and engagement density.

3. **Financial Attribution & Net Margin:**
   $$\text{Cost}_{\text{job}} = \text{MCU}_{\text{render}} \times P_{\text{MCU}} + \text{BYOK}_{\text{inference\_cost}} + \text{Asset}_{\text{cost}}$$
   $$\text{Net Margin (USD)} = \text{Revenue}_{\text{attributed}} - \text{Cost}_{\text{job}}$$
   $$\text{ROI per MCU} = \frac{\text{Revenue}_{\text{attributed}} - \text{Cost}_{\text{byok}}}{\max(\text{MCU}_{\text{render}}, 1)} \quad (\text{USD / MCU})$$

---

## 4. Operational Guarantees & Constraints

- **Strict File Size Bound**: Every code module strictly $< 200$ LOC with zero `:any` types.
- **Operator-Zero Infrastructure**: BYOK platform doctrine; uses user OAuth credentials resolved via `OAuthTokenVault`.
- **Zero-Join Fast Dashboard Queries**: Aggregate snapshot columns updated on `social_publish_jobs` table to eliminate expensive real-time joins.
- **Fail-Safe Circuit Breakers**: Immediate 300s open on 401/403 authorization failures; 60s cooldown on 429 rate limit errors.
