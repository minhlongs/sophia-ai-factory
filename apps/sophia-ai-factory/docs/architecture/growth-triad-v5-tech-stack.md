# Growth Triad v5 Tech Stack & System Architecture

## Overview
Growth Triad v5 completes the automated growth, creator partnership, and conversion loop for Sophia AI Factory:
1. **Pillar 1: Dynamic LTV Price Elasticity & Thompson Sampling Paywall Engine**
   - Demand price elasticity formulation: $\epsilon = \frac{\Delta Q / Q_0}{\Delta P / P_0}$.
   - Optimal price with 60% gross margin protection floor ($P^* = \frac{MC}{1 + 1/\epsilon}$).
   - Willingness-to-Pay (WTP) RFM Bayesian prior scoring.
   - Thompson Sampling (Bernoulli-Beta conjugate prior with Box-Muller / Gamma approximation) for dynamic paywall tier selection.
2. **Pillar 2: Creator Recruitment & High-Conversion Outreach Pipeline**
   - KOL Quality & Engagement Rate ($ER$) filter ($3.0\% \le ER \le 18.0\%$).
   - Automated Revenue Split Negotiation FSM with sigmoid step-up ($S_{\text{counter}}$ bounded between 20% and 40%).
   - CAN-SPAM & RFC 8058 One-Click Unsubscribe HMAC compliance.
3. **Pillar 3: AI Dynamic Thumbnail & Hook A/B Auto-Tester**
   - Beta-Binomial Bayesian Posterior Updating for multi-variant CTR ($P(\theta_B > \theta_A) \ge 0.95$).
   - Pearson Chi-Square with Yates' continuity correction.
   - Auto-Promotion Winner FSM (`DRAFT` -> `ACTIVE_TESTING` -> `CALCULATING_SIGNIFICANCE` -> `WINNER_PROMOTED`).

## Clean Architecture 5-Layer Stack
- **Seed Layer**: `src/seed/types/growth-triad-v5-types.ts`, `migrations/0462_growth_triad_v5.sql`, `src/seed/inngest/event-types.ts`.
- **Tree Layer**: `src/tree/monetization/paywall-mab-engine.ts`, `src/tree/creator/recruitment-fsm-engine.ts`, `src/tree/ab-testing/bayesian-ctr-tester.ts`.
- **Forest Layer**: `src/forest/inngest/functions/paywall-mab-recalibration-job.ts`, `src/forest/inngest/functions/kol-outreach-sequencer-job.ts`, `src/forest/inngest/functions/ab-auto-promotion-job.ts`.
- **Land Layer**: `src/land/growth/actions/paywall-mab-actions.ts`, `src/land/growth/actions/kol-outreach-actions.ts`, `src/land/growth/actions/ab-testing-actions.ts`, `src/land/growth/actions/growth-triad-v5-actions.ts`.
- **Presentation Layer**: `src/components/growth-triad-v5/paywall-mab-cockpit.tsx`, `src/components/growth-triad-v5/creator-outreach-cockpit.tsx`, `src/components/growth-triad-v5/ab-testing-cockpit.tsx`, `src/components/growth-triad-v5/index.ts`.
