---
agent: cso
date: 2026-04-17
slug: pricing-anchor-experiment
---

## Action
Validate PREMIUM-first pricing experiment hypothesis (anchor-effect uplift on ARPU).

## Decision
Registered pricing-tier-order-v1 with metric tier_upgraded_to_premium_or_above. Variant 'premium-first' anchors on  tier before showing  BASIC. Hypothesis: anchoring lifts ARPU 15-25% per Cialdini priming research.

## Outcome
Experiment registered. Awaiting Hero/pricing UI wiring + PostHog secret provisioning before traffic split goes live. Display-only — never affects money flow (Red Team #11 enforced).

## Lessons
Tier funnel KPI 'tier_upgraded_to_premium_or_above' is server-side event; A/B layer is purely client display. Decoupling protects revenue from experiment bugs.

