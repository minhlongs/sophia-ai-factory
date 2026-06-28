---
title: "Phase 01 — Tracking + Analytics Setup"
description: "Instrument the acquisition funnel before driving traffic. Without measurement, every Phase 04 channel decision is guesswork."
status: pending
priority: P0
effort: "3-5h"
dependencies: []
created: 2026-05-16
---

# Phase 01 — Tracking + Analytics Setup

## Context Links

- Upstream plan: `../plan.md`
- Doctrine: no operator-managed paid analytics (e.g., Mixpanel paid tier OK only if operator owns the account, not platform-tenant)

## Overview

- **Priority:** P0 — gates Phase 02+04 decisions
- **Goal:** every funnel step emits a structured event we can query later. CF Workers Analytics Engine + D1 `events` table is enough — no third-party paid SaaS required.

## Requirements

### Functional

- Funnel events captured: `landing_view` → `signup_start` → `signup_complete` → `wizard_step_X` → `wizard_complete` → `mission_first_run` → `paid_first_tx`
- Event payload: `user_id` (when present), `session_id` (cookie), `event_name`, `params` (JSON), `ts`
- Aggregation query: weekly funnel report (count per step, conversion %)
- Dashboard surface: `/admin/funnel` page (operator-only, behind ENTERPRISE+admin guard)

### Non-Functional

- Zero PII leak — no emails/IPs in event payload (hash if needed)
- Sample rate: 100% for early phase (low volume), revisit when ≥ 1000 sessions/day

## Architecture

```
Client (next-intl pages) → POST /api/events → D1 events table
                                            → CF Analytics Engine (Workers)
                                                                 ↓
                                    /admin/funnel queries D1 + AE
```

## Related Code Files

### Create
- `apps/sophia-ai-factory/migrations/01XX-events-funnel.sql` (events table)
- `apps/sophia-ai-factory/src/app/api/events/route.ts` (POST handler)
- `apps/sophia-ai-factory/src/seed/analytics/track-event.ts` (client helper)
- `apps/sophia-ai-factory/src/app/[locale]/admin/funnel/page.tsx` (dashboard)

### Modify
- Add `trackEvent()` calls in landing, signup, setup-wizard, mission-launcher

## Implementation Steps

1. Schema migration: `events` table — `id, session_id, user_id?, event_name, params (JSON), ts INTEGER, ip_hash?`
2. POST `/api/events` route — zod-validated, rate-limited, async insert (no blocking client)
3. Client helper `trackEvent(name, params)` — fire-and-forget with session_id cookie
4. Sprinkle `trackEvent()` in 6 funnel locations
5. Admin funnel page — D1 aggregation queries grouped by week
6. Tests: events insert, rate-limit, admin guard
7. Deploy + verify event flow with operator's own session

## Todo List

- [ ] events table migration
- [ ] POST /api/events route + tests
- [ ] trackEvent client helper
- [ ] Wire 6 funnel locations
- [ ] /admin/funnel page + queries
- [ ] Deploy + smoke

## Success Criteria

- All 7 funnel events fire correctly during operator's own walkthrough
- /admin/funnel shows non-zero counts for each step
- Zero PII in `events.params` (audit query verifies)
