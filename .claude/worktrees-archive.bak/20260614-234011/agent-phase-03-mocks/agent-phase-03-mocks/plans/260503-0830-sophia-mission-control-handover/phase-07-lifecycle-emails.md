# Phase 07 — Lifecycle Email Sequence (D+0 / D+1 / D+7)

## Context Links
- `apps/sophia-ai-factory/src/app/api/cron/email-drip/route.ts` — existing day 1/3/7 nurture
- `apps/sophia-ai-factory/src/lib/handover/handover-types.ts` — milestones (login/sop_install/run)
- `src/lib/email/templates/` — Phase 01 template registry
- `src/lib/email/email-outbox.ts` — Phase 02 outbox

## Overview
- **Priority:** P2
- **Status:** pending
- **Effort:** 30m

Existing drip is signup-based and time-only. Replace with milestone-aware sequence:
- **D+0** (immediate): welcome + magic link (already done, Phase 02 makes durable)
- **D+1** (only if `customer_first_login_at` is null): "haven't seen you yet — magic link still valid"
- **D+7** (only if user logged in): first-week summary — calls made, top SOPs, suggested next step

Skip drip if user already on healthy trajectory (e.g. has run their first SOP) to avoid spam.

## Key Insights
- Existing `email-drip` cron template files (`drip_day1`, `drip_day3`, `drip_day7`) generic-marketing — replace with milestone-aware variants
- Use `customer_handovers` milestones as gate — no new tracking table needed
- Outbox flush from Phase 02 handles delivery + retry, so this phase just enqueues

## Requirements
- D+1 email only if user hasn't completed step 1 of onboarding (no first login)
- D+7 email only if user logged in AND has at least 1 API call (data-rich enough to summarize)
- All sends idempotent on `(user_id, template)` pair — no duplicate sends
- i18n vi/en
- Templates in registry from Phase 01

## Architecture
```
Cron /api/cron/email-drip (existing, REWRITE)
  Runs daily at 04:00 UTC
  
  For each user with handover row:
    daysSinceCreated = (now - handover.created_at) / DAY_MS
    
    If daysSinceCreated == 1 AND !customer_first_login_at:
      enqueueEmail(template='onboarding-nudge', user, {magicLink: ...})
    
    If daysSinceCreated == 7 AND customer_first_login_at:
      stats = computeWeekStats(userId)
      enqueueEmail(template='first-week-summary', user, {stats})
  
  Dedup via lifecycle_email_log table
  
D1 table lifecycle_email_log
  user_id TEXT, template TEXT, sent_at INTEGER
  PRIMARY KEY (user_id, template)
```

## Related Files
**Create:**
- `migrations/0069-lifecycle-email-log.sql`
- `src/lib/email/lifecycle-email-rules.ts` — milestone-gated decision
- `src/lib/email/week-stats.ts` — compute calls/SOPs/top-of-week for D+7

**Modify:**
- `src/app/api/cron/email-drip/route.ts` — replace template loop with `lifecycle-email-rules.evaluate(user)`
- `src/lib/email/templates/onboarding-nudge.ts` (Phase 01 created)
- `src/lib/email/templates/first-week-summary.ts` (Phase 01 created)

## Implementation Steps
1. Migration 0069: `lifecycle_email_log (user_id TEXT, template TEXT, sent_at INTEGER, PRIMARY KEY (user_id, template))`
2. `week-stats.ts`: query `usage_events` last 7d for `userId` → `{totalCalls, topSop, daysActive, biggestUploadDay}`
3. `lifecycle-email-rules.ts`: pure function `evaluate(handover, now): EmailDecision[]` returning array of `{template, payload}`
4. Rewrite `email-drip` route:
   - Query users with handover where `created_at` between `now - 7.5d` and `now - 0.5d`
   - For each → call `evaluate` → for each decision check `lifecycle_email_log`, if absent: `enqueueWelcomeEmail` (Phase 02 outbox) + INSERT log row
5. Templates already exist from Phase 01 — verify rendering with snapshot test

## Todo
- [ ] Migration 0069
- [ ] `week-stats.ts` with unit test
- [ ] `lifecycle-email-rules.ts` pure function with unit test (matrix of milestone states)
- [ ] `email-drip` cron rewritten
- [ ] Dedup verified (run cron twice, only one log row)

## Success Criteria
- Stub user with `created_at = 24h ago, no login` → D+1 nudge enqueued
- Same user 12h later → no duplicate enqueue (log row blocks)
- User with `login + 5 API calls, created_at = 7d ago` → D+7 summary enqueued with stats
- User who completed first SOP within day 1 → never gets D+1 (skip)

## Risk Assessment
- **Stats query slow** if `usage_events` huge: cap by `LIMIT 1000` or pre-rollup table
- **Email fatigue**: no more than 3 lifecycle emails per user (D+0, D+1 OR D+7) — enforced by rules

## Security Considerations
- `magicLink` in D+1 email reuses existing token if still valid (within 24h), otherwise issue new — handled in `handover-magic-link.ts`
- Stats payload contains no PII outside user's own data

## Next
Phase 08 wires up tests across all phases.
