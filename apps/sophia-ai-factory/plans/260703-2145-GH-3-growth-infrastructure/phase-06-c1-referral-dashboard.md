---
phase: 6
title: "C1-Referral Dashboard"
status: completed
effort: "Medium (3-5d)"
priority: P2
dependencies: []
track: C
---

# Phase 6: C1-Referral Dashboard

## Overview

Build a referral dashboard with earnings stats and reward ledger. API routes exist (generate code, apply code), referral_rewards table stores data, but there is zero UI for earnings/stats. Build `/dashboard/referral` page.

## Context

- Referral API: `POST /api/referral/generate`, `POST /api/referral/apply` — exist
- Rewards table: `referral_rewards` — exists, written by IPN on referred payment
- Share widget: `forest/components/dashboard/referral-share-widget.tsx` — copies link, hardcoded VN strings
- Zero UI for: earnings total, referral count, reward history, payout flow

## Related Code Files

- **Create:** `src/app/[locale]/dashboard/referral/page.tsx` — referral stats server component
- **Create:** `src/forest/components/dashboard/referral-stats-section.tsx` — stats client component
- **Modify:** `src/app/api/referral/generate/route.ts` — make reward amount configurable
- **Modify:** `src/forest/components/dashboard/referral-share-widget.tsx` — bilingual i18n

## Implementation Steps

1. Create `/dashboard/referral` server component querying referral_rewards + referral_codes tables
2. Build stats dashboard: total referrals, total rewards, pending rewards, shareable link
3. Add reward ledger display (history of earned rewards with statuses)
4. Fix bilingual gap in existing share widget (hardcoded VN → useTranslations)
5. Make reward amount configurable (read from env or tier config, not hardcoded $19.90)
6. Add native share buttons (WhatsApp, Telegram, email in addition to clipboard)

## Success Criteria

- [ ] `/dashboard/referral` page shows referral stats
- [ ] Reward ledger displays history with dates and statuses
- [ ] Share widget is bilingual (VI + EN)
- [ ] Reward amount is configurable
- [ ] All existing tests pass
