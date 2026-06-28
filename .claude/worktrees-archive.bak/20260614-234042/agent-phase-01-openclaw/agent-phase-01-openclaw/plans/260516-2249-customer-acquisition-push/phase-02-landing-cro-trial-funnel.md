---
title: "Phase 02 — Landing CRO + Trial Funnel"
description: "Convert visitors to trial signups. Tune copy + CTA placement against honest-pivot baseline."
status: pending
priority: P1
effort: "5-8h"
dependencies: [phase-01-tracking-analytics-setup]
created: 2026-05-16
---

# Phase 02 — Landing CRO + Trial Funnel

## Overview

- **Priority:** P1 — first revenue lever
- **Goal:** lift `landing_view → signup_complete` conversion to ≥ 5% baseline. Test 2 trial models: free-7-day vs $1-trial-then-tier.

## Requirements

### Functional

- Hero CTA: explicit "Start free 7-day trial" OR "$1 test for 30 days" (A/B)
- Pricing page surfaces ROI calculator output above tiers (already exists at `production-cost-calculator.tsx:28`)
- Signup form: email + Google OAuth options; max 2 fields visible
- Setup Wizard introduction screen: explains BYOK doctrine in 3 bullets ("you own the keys, we run the platform, refund 30d")
- Trial trigger: NOWPayments small invoice ($1) for $1-trial variant OR no payment for free variant
- Lifecycle email D+1: "How was your first mission?" with troubleshooting links
- Lifecycle email D+3: case-study email (composite, with disclosure per Phase 01)

### Non-Functional

- All variants instrumented per Phase 01 events
- Mobile-first (existing landing already responsive)
- Page load < 2s (CF edge caching unchanged from current)

## Architecture

```
A/B split via cookie sticky → 2 hero variants
  ↓ signup
  ↓ Setup Wizard intro screen (NEW)
  ↓ trial activation (free OR $1)
  ↓ funnel events to Phase 01 analytics
```

## Related Code Files

### Modify
- `apps/sophia-ai-factory/src/app/components/sections/hero.tsx` (CTA copy variants)
- `apps/sophia-ai-factory/messages/en.json` + `vi.json` (new keys: `hero.cta_free_trial`, `hero.cta_one_dollar`, `wizard.intro.*`)
- `apps/sophia-ai-factory/src/app/[locale]/onboarding/page.tsx` (intro screen)
- `apps/sophia-ai-factory/src/forest/inngest/functions/lifecycle-emails.ts` (D+1, D+3 templates)

### Create
- `apps/sophia-ai-factory/src/lib/ab-test/variant-resolver.ts` (cookie-sticky split)

## Implementation Steps

1. Define variant table (cookie key, 50/50 split)
2. Hero copy in en.json + vi.json (4 new keys × 2 langs)
3. Wizard intro screen — bilingual 3-bullet doctrine reminder
4. Lifecycle emails D+1 + D+3 with troubleshooting deep-links
5. Wire trial activation (free path: skip payment until end of trial; $1 path: NOWPayments $1 invoice)
6. Tests: variant resolution, email send, no fake claims (lint with Phase 01 baseline)
7. Deploy + verify both variants visible from 2 separate browser sessions

## Todo List

- [ ] Variant resolver lib + tests
- [ ] Hero CTA copy (en+vi, 4 keys)
- [ ] Wizard intro screen
- [ ] D+1 email template
- [ ] D+3 email template
- [ ] Trial activation paths
- [ ] Deploy + verify

## Success Criteria

- 2 variants live + measurable per Phase 01 events
- Wizard intro reduces "BYOK confusion" friction (qualitative — early feedback from Phase 05 customers)
- Lifecycle emails deliver in test runs
