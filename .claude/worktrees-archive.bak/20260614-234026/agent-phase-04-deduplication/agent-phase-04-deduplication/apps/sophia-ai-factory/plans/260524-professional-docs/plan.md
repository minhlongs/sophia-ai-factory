# Sophia AI Factory — Professional Documentation Restructure

**Date:** 2026-05-24
**Goal:** Transform feature-first guide into workflow-first professional docs
**Current State:** 90 pages, 7.2/10 docs score, feature-first org

## Strategy

Restructure existing `/guide` section from feature-first to **workflow-first** (matching Synthesia/Jasper/Descript pattern). No external service (GitBook) — build within existing Next.js app.

## Phase Architecture

```
PARALLEL WAVE 1 (Structure + Core Content):
├── Phase 01: Guide layout restructure — workflow-first sidebar with 8 sections
├── Phase 02: Workflow guides — "First Video in 5 Min", "Earn with Affiliate"
└── Phase 03: Payment & billing guides — USDT + VND + Annual plans

PARALLEL WAVE 2 (Use Cases + Search):
├── Phase 04: Use case library — 3 cases (CEO video marketing, e-commerce, real estate)
└── Phase 05: Guide search + progressive disclosure
```

## Phases

- [x] Phase 01: Guide layout restructure ([phase-01](phase-01-guide-layout.md)) — COMPLETE
- [x] Phase 02: Workflow guides ([phase-02](phase-02-workflow-guides.md)) — COMPLETE
- [x] Phase 03: Payment guides ([phase-03](phase-03-payment-guides.md)) — COMPLETE
- [x] Phase 04: Use case library ([phase-04](phase-04-use-case-library.md)) — COMPLETE
- [ ] Phase 05: Guide search ([phase-05](phase-05-guide-search.md)) — DEFERRED

## Constraints
- Bilingual (EN + VI) via next-intl
- No external service (no GitBook/Mintlify)
- Don't break existing guide URLs
- Reuse existing guide components (GuideStepCard, GuideCallout, etc.)
- Under 200 lines per file
