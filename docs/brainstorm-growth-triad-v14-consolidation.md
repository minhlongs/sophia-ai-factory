# Brainstorm: Growth Triad v14 & Unified Architectural Consolidation

**Date:** 2026-10-08  
**Scope:** Unified Growth Triad v14, Frontend Cockpit Consolidation, D1 & Queue Hardening  
**Authors:** Sophia Core Architecture Team (Claude Fable 5 & Engineering Leads)  
**Status:** In Review (Consensus Phase)

---

## 1. Problem Statement & Context

Sophia AI Factory has rapidly evolved from Growth Triad v2 to v13, shipping specialized quantitative and algorithmic modules across Thompson MAB split-testing, 3-lens deliberation, and Shapley attribution. However, this velocity introduces three distinct architectural challenges:

1. **GPU MCU Compute Inefficiency (Growth Triad v14 Opportunity):**  
   - Currently, once a script passes deliberation, rendering proceeds unconditionally to completion.
   - Even if early scene frames or preliminary audience signals show poor retention probability, full GPU MCU budget is consumed.
   - Budget allocation between exploration (testing new creative variants) and exploitation (scaling proven winners) lacks an analytical capital preservation framework.

2. **Frontend Cockpit Fragment Splatter (Consolidation Debt):**  
   - 10+ separate directories in `src/components/growth-triad-vX/` with duplicated cards, fragmented badge components, and divergent polling loops.
   - Multiple cards poll or fetch telemetry independently on mount, creating edge request amplification.
   - Token divergence between Amber primary (`globals.css`), Emerald accents, and legacy dark mode styles.

3. **Storage & Queue Concurrency Hardening (D1 & Inngest Resilience):**  
   - Over 18 incremental migration files (0453-0470) have accumulated.
   - Idempotency CAS lock conventions (`ON CONFLICT DO NOTHING`) and stale lock recovery (5-min timeout) are implemented across multiple coordinators, but require unified utility patterns to prevent copy-paste drift.
   - Inngest background workers need unified circuit breaker handling and Dead-Letter Queue (DLQ) fail-closed classification.

---

## 2. Core Architectural Pillars

### Pillar A: Growth Triad v14 — Predictive Rendering Pipeline
- **Fractional Kelly Criterion Budget Allocator (`kelly-allocator.ts`):**
  - Uses Thompson Sampling winning probability $p$ and estimated payout odds $b = \frac{\text{Projected ROAS} - 1.0}{1.0}$.
  - Optimal unconstrained fraction: $f^* = \frac{p \cdot b - (1 - p)}{b}$.
  - Enforces Half-Kelly dampening ($f = 0.5 \cdot f^*$) and strict allocation bounds ($[0.05, 0.40]$) to protect bankroll against estimation noise.
- **Bayesian Early-Halt Survival Predictor (`survival-halt-predictor.ts`):**
  - Evaluates interim scene synthesis milestones against Weibull hazard rate / Bayesian retention prior.
  - If predicted completion retention percentile drops below critical cutoff ($< 25\%$) at Stage 1 (frame generation), halts rendering pipeline immediately, saving up to 60-70% of total MCU render costs.
- **Zero-Waste Batch Scheduler (`render-batch-scheduler.ts`):**
  - Prioritizes pending render jobs by Expected Value: $\text{EV} = f_{\text{Kelly}} \times \text{Deliberation Score} \div \text{Estimated MCU}$.
  - Groups jobs for batch dispatch to optimize provider quota and rate limits.

### Pillar B: Frontend Cockpit Consolidation & Executive Hub
- **Unified Growth Cockpit Shell (`src/components/growth/unified-growth-cockpit.tsx`):**
  - Aggregates metrics from MAB (v13), Monetization Flywheel (v12), and Predictive Rendering (v14) into a single cohesive Obsidian Cyber-Glass container.
  - Replaces isolated component directories (`growth-triad-v2..v9`) with reusable, token-compliant primitives (`MetricGauge`, `SignalStreamBadge`, `AttributionWaterfall`).
- **Telemetry Batch Poller Hook (`use-growth-telemetry.ts`):**
  - Single centralized SWR/React Query-style polling hook with Exponential Backoff + Jitter.
  - Eliminates thundering-herd API calls from multiple individual sub-cards.
- **Design Token & WCAG 2.1 AA Compliance:**
  - Strict adherence to `globals.css` (`--primary: 35 80% 44%`).
  - Minimum 44px touch targets on mobile viewports.

### Pillar C: D1 & Inngest Resilience Hardening
- **Standardized CAS Lock Primitive (`src/seed/db/atomic-cas-lock.ts`):**
  - Extracts the battle-tested `INSERT INTO locks ... ON CONFLICT DO NOTHING` + 5-minute stale timestamp recovery into a clean, zero-dependency helper.
  - Enforces atomic ownership verification via `meta.changes === 1`.
- **Unified DLQ & Failure Classifier (`src/seed/security/growth-circuit-breaker.ts`):**
  - Standardizes error classification (`AUTH_FAILURE`, `RATE_LIMIT`, `DOWNSTREAM_TIMEOUT`, `UNRECOVERABLE_PAYLOAD`) for all growth Inngest functions.
- **Migration Verification & Hygiene:**
  - Schema validation test ensuring all migration scripts from 0450 to 0471 execute cleanly and idempotently against fresh test databases.

---

## 3. Evaluation of Approaches & Trade-Offs

| Dimension | Monolithic Mega-Release (All-at-once) | Staged Tri-Phase Delivery (Recommended) | Decoupled Parallel Waves |
|---|---|---|---|
| **Description** | Build, refactor, and harden everything in a single massive pull request. | Stage 1: D1 & Engine Primitives (Seed/Tree) → Stage 2: Forest & Land Hardening → Stage 3: Unified HUD & UI Consolidation. | Separate branches developed independently by isolated subagents. |
| **Risk / Blast Radius** | **CRITICAL HIGH**: Potential regression in existing MAB/Inngest pipelines. | **MINIMAL**: Verified layer-by-layer with green test gates at each step. | **MEDIUM**: High risk of merge conflicts in shared types and migration numbers. |
| **Architectural Cohesion** | High theoretical alignment, but difficult to isolate test failures. | High: Clean Architecture `seed -> tree -> forest -> land -> presentation` flow. | Moderate: Divergence across branches. |
| **Rule Compliance** | Breaks LOC < 200 rule if consolidating too aggressively in single files. | Fully adheres to LOC < 200, zero `:any`, YAGNI, KISS, DRY. | May duplicate bridge code across branches. |

---

## 4. Key Architectural Invariants & Anti-Patterns to Avoid

1. **NO Over-Engineered Math (YAGNI/KISS):**  
   - Avoid complex numerical integration for Kelly Criterion; use closed-form Beta-binomial expectation and bounded half-Kelly fractions.
2. **NO Land -> Forest Imports:**  
   - Strictly respect the layer boundary rule. Land persists and exposes Server Actions; Forest orchestrates workflows.
3. **NO UI Breakage of Existing Routes:**  
   - Preserve existing pages like `/dashboard/growth` while seamlessly embedding the consolidated cockpit.
4. **NO Hardcoded Credentials or Operator Infrastructure:**  
   - Respect Sophia's No-Code / No-Tech doctrine (BYOK, zero operator crons).

---

## 5. Next Steps

1. Review and align on the **Staged Tri-Phase Delivery** approach.
2. Proceed to formal plan generation (`/plan:parallel` or `/plan:fast`) documenting file ownership and test matrices.
