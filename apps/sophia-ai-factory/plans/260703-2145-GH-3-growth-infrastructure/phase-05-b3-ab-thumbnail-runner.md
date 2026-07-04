---
phase: 5
title: "B3-AB Thumbnail Runner"
status: completed
effort: "Medium (3-5d)"
priority: P2
dependencies: []
track: B
---

# Phase 5: B3-AB Thumbnail Runner

## Overview

Unify 3 parallel A/B systems (thumbnail variants D1, ab_experiments D1, PostHog feature flags) into a single thumbnail runner with statistical significance gates, PostHog experiment events, and dedicated experiments dashboard.

## Context

- Thumbnail variants D1 table: generates 5 strategy variants (key-frame, text-overlay, etc.)
- ab_experiments D1 table: A vs B CRUD with winner selection cron
- PostHog experiments: 2 active (hero-cta-copy, pricing-tier-order)
- No statistical significance gates — risk of false positives
- No PostHog event emission for experiment assignment
- Experiments dashboard: only a proof-of-concept widget, no full route

## Implementation Steps

1. Add statistical significance gate (chi-square or Bayesian) to winner-selector cron
2. Wire PostHog experiment assignment events to captureServer pipeline
3. Extend thumbnail-variant-generator to render actual thumbnails (currently outputs strategy metadata only)
4. Create full `/dashboard/experiments` route with unified experiments page
5. Add campaign-level A/B creation workflow

## Success Criteria

- [ ] Winner selection uses minimum sample size + statistical significance before declaring winner
- [ ] Experiment assignment events flow to PostHog
- [ ] Dedicated experiments dashboard route exists
- [ ] All existing tests pass
