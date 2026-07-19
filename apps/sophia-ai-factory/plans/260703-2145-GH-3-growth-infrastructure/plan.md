---
title: "Phase 2: Growth Infrastructure"
description: "3 parallel tracks — (A) Conversion: annual billing + onboarding, (B) Growth Funnel: PostHog + landing pages + A/B runner, (C) Referral + Monitoring dashboard"
status: completed
priority: P1
branch: "feat/creator-marketplace-phase1"
tags: ["growth", "analytics", "conversion", "onboarding", "referral"]
blockedBy: []
blocks: []
created: "2026-07-03T14:53:44.605Z"
createdBy: "ck-cli"
source: cli
---

# Phase 2: Growth Infrastructure

## Overview

Activate the data-driven growth engine for Sophia AI Factory. Three independent sub-projects run in parallel. Total estimate: 2-3 weeks.

Based on brainstorm: `plans/reports/brainstorm-phase2-infrastructure-260703-2145-GH-3-infrastructure-report.md`

## Phases

| Phase | Name | Status | Est. Effort | Track |
|-------|------|--------|-------------|-------|
| 1 | [A1-Annual Billing](./phase-01-a1-annual-billing.md) | Pending | Medium (2-3d) | A: Conversion |
| 2 | [A2-Onboarding Optimization](./phase-02-a2-onboarding-optimization.md) | Pending | Medium (3-5d) | A: Conversion |
| 3 | [B1-PostHog Funnels](./phase-03-b1-posthog-funnels.md) | Pending | Small (1-2d) | B: Growth Funnel |
| 4 | [B2-Landing Page Expansion](./phase-04-b2-landing-page-expansion.md) | Pending | Small (hours) | B: Growth Funnel |
| 5 | [B3-AB Thumbnail Runner](./phase-05-b3-ab-thumbnail-runner.md) | Pending | Medium (3-5d) | B: Growth Funnel |
| 6 | [C1-Referral Dashboard](./phase-06-c1-referral-dashboard.md) | Pending | Medium (3-5d) | C: Referral + Monitoring |
| 7 | [C2-Sentry Honeycomb](./phase-07-c2-sentry-honeycomb.md) | Pending | Small (1-2d) | C: Referral + Monitoring |

## Dependencies

All 3 tracks (A, B, C) are independent and can execute in parallel.

**Within Track B:** B1 (PostHog) should precede B2 and B3 — analytics data informs landing page priorities and A/B experiment design.

## Key Decisions

- **Annual billing:** Wire NOWPayments yearly prices + fix IPN amount check
- **Onboarding:** Reduce minimum API keys to 1 (OpenRouter), add Magic Demo
- **PostHog:** 4 new funnels, 3 new event types
- **Landing pages:** Add slugs to NICHE_SLUGS (25→50+), LLM auto-generates content
- **A/B runner:** Unify 3 existing systems + add statistical significance gates
- **Referral:** New /dashboard/referral page with earnings stats
- **Sentry/Honeycomb:** Minor polish, no major changes
