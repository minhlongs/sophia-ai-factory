---
agent: cmo
date: 2026-04-17
slug: seed-experiments-registry
---

## Action
Bootstrap A/B experiments registry per DeepSeek PDF strategic pillar #3 (Signals).

## Decision
Created src/lib/signals/experiments-registry.ts with 2 seeded experiments: hero-cta-copy-v1 (CMO) + pricing-tier-order-v1 (CSO). Owner-agent metadata + hypothesis required per definition. PostHog flag name MUST match registry name (single source of truth).

## Outcome
Registry shipped (66 LOC). Two experiments queryable via getExperiment(name) + getActiveExperiments(). UI wiring deferred to founder approval (Hero + pricing pages production-critical).

## Lessons
Hypothesis field forces marketing/sales discipline: cannot register experiment without stating what we expect to learn. Prevents 'random A/B' anti-pattern.

