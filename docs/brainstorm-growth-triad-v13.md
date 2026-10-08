# Brainstorm Report — Growth Triad v13: Multi-Armed Bandit, Creative Deliberation & Shapley Profit Ledger

**Date:** 2026-10-08  
**Status:** Brainstorming & Architecture Blueprint  
**Doctrine:** Clean Architecture (5-layer), Zero `:any`, No-Code / No-Tech (BYOK, zero operator crons), Full D1 atomic idempotency.

---

## 1. Problem Statement & Core Objectives

Sophia AI Factory has achieved autonomous video generation and multi-platform publishing. However, three key monetization and production efficiency frontiers remain to complete the full autonomous enterprise loop:

1. **A/B Performance Drift (Multi-Armed Bandit Optimization)**:
   - *Problem*: Static A/B tests split traffic 50/50 evenly, burning compute and audience attention on sub-optimal hooks.
   - *Objective*: Implement dynamic Thompson Sampling & UCB1 multi-armed bandit allocation to rapidly exploit high-converting hooks while exploring variants, with automated promotion of winners to multi-platform syndication.

2. **Pre-Render Compute Waste (Multi-Agent Creative Deliberation)**:
   - *Problem*: Submitting scripts directly to video rendering providers (fal.ai, D-ID, HeyGen) without automated pre-flight editorial critique risks burning expensive GPU MCUs on low-engagement or non-compliant content.
   - *Objective*: Establish an Inngest-orchestrated 3-lens deliberation consensus panel (Hook Analyst, Retention Critic, Compliance Guard) to grade, critique, and autonomously refine scripts before rendering.

3. **Attribution Opacity (Shapley Value Profitability Ledger)**:
   - *Problem*: Simple last-click attribution overlooks upstream touchpoints (e.g. initial discovery Short vs closing Reel) and fails to calculate true net margin against render MCU costs.
   - *Objective*: Deliver game-theoretic Shapley Value multi-touch attribution on Cloudflare D1, linking video views across user journeys to affiliate payouts and exact MCU unit economics.

---

## 2. Clean Architecture 5-Layer Design

```
src/
├── seed/
│   ├── types/growth-triad-v13.ts                 # Zod schemas for MAB, Deliberation, Shapley attribution
│   ├── config/growth/bandit-weights.ts           # Priors, exploration factors, confidence intervals
│   └── inngest/event-types.ts                   # Inngest event keys (96 keys exactness guard)
├── tree/growth-v13/                              # Pure algorithmic domain logic (<200 LOC, 0 IO)
│   ├── thompson-bandit.ts                        # Beta distribution sampling & UCB1 score calculator
│   ├── deliberation-consensus.ts                 # Multi-lens weighted scoring & verdict aggregator
│   └── shapley-attribution.ts                    # Cooperative game theory Shapley value attribution
├── forest/growth-v13/                            # Inngest workers & orchestrators
│   ├── bandit-traffic-worker.ts                  # Background traffic reallocation & winner promoter
│   └── creative-deliberation-worker.ts           # Pre-render 3-lens deliberation evaluator
├── land/growth-v13/                              # D1 persistence, transactions & Server Actions
│   ├── bandit-coordinator.ts                     # D1 CAS operations for MAB arms & attribution
│   └── flywheel-v13-actions.ts                   # Authenticated Server Actions for CEO HUD
└── components/growth/                            # Executive UI presentation
    └── flywheel-v13-hud.tsx                      # Obsidian Cyber-Glass telemetry cockpit card
```

---

## 3. Evaluated Approaches & Trade-Offs

| Pillar | Approach A (Rejected) | Approach B (Selected) | Rationale |
|---|---|---|---|
| **Bandit Optimization** | $\epsilon$-greedy static split | Beta-Binomial Thompson Sampling with Bayesian updates | Thompson sampling naturally handles cold-start variants and dynamically shifts traffic to winning hooks without hard exploration thresholds. |
| **Creative Review** | Synchronous LLM pre-prompt during request | Asynchronous Inngest 3-lens deliberation with consensus threshold | Inngest avoids request timeouts on Cloudflare Workers, allows structured multi-agent scoring, and supports auto-refinement loops. |
| **Attribution** | Last-Touch attribution | Shapley Value cooperative game attribution | Shapley values mathematically guarantee fair, additive allocation of conversion credit across multi-platform discovery touchpoints. |

---

## 4. D1 Database Schema Design

```sql
-- Migration: 0470_growth_v13_mab_shapley.sql

CREATE TABLE IF NOT EXISTS growth_bandit_experiments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  experiment_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, CONVERGED, PAUSED
  winning_arm_id TEXT,
  total_pulls INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS growth_bandit_arms (
  id TEXT PRIMARY KEY,
  experiment_id TEXT NOT NULL,
  hook_text TEXT NOT NULL,
  alpha_successes REAL NOT NULL DEFAULT 1.0,
  beta_failures REAL NOT NULL DEFAULT 1.0,
  pull_count INTEGER NOT NULL DEFAULT 0,
  conversion_count INTEGER NOT NULL DEFAULT 0,
  weight REAL NOT NULL DEFAULT 0.0,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS growth_shapley_touchpoints (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  conversion_id TEXT NOT NULL,
  video_manifest_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  touchpoint_order INTEGER NOT NULL,
  shapley_weight REAL NOT NULL DEFAULT 0.0,
  attributed_revenue_usd REAL NOT NULL DEFAULT 0.0,
  mcu_cost_usd REAL NOT NULL DEFAULT 0.0,
  created_at INTEGER NOT NULL
);
```

---

## 5. Implementation Roadmap & Next Steps

1. **Seed & Migrations**: Add TypeScript/Zod definitions, D1 migration `0470_growth_v13_mab_shapley.sql`, and Inngest event keys (`growth/v13.bandit.evaluate`, `growth/v13.deliberation.request`).
2. **Tree Domain Engines**: Implement pure algorithmic functions for Thompson Sampling, Deliberation Consensus, and Shapley Value.
3. **Forest Inngest Functions**: Build workers for dynamic traffic reweighting and script deliberation.
4. **Land Operations & Actions**: D1 atomic state operations and authenticated Server Actions.
5. **Presentation**: Obsidian Cyber-Glass HUD card with real-time conversion weights, Shapley ROAS telemetry, and active MAB arms.
6. **Testing & Validation**: Complete Vitest test suite with 100% green coverage, 0 TS errors, 0 layer boundary violations.
