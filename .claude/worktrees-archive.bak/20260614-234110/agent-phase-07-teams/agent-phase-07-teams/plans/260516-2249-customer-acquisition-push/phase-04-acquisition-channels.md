---
title: "Phase 04 — Acquisition Channels (Affiliate + Content seed)"
description: "Two parallel channels to drive first-100 visitors: Sophia's own affiliate program live + content seed (5 VN + 5 EN long-form)."
status: pending
priority: P1
effort: "8-12h"
dependencies: [phase-01-tracking-analytics-setup]
created: 2026-05-16
---

# Phase 04 — Acquisition Channels

## Overview

- **Priority:** P1 — primary lever for visitor flow
- **Goal:** Launch 2 channels that fit no-tech doctrine (no paid-ads ops). Affiliate self-serve + content seed. Bonus: 3 outreach DMs/day to Telegram creators in `agency` + `content-creator` niches.

## Requirements

### Functional

**Channel A — Sophia's Affiliate Program (self-serve):**
- Public `/affiliates` page explaining 30% recurring commission (12-month window)
- Affiliate signup form: name + email + payout wallet (USDT)
- Unique referral link per affiliate (e.g., `?ref=<slug>`)
- Tracking: `signup_complete` events tag `referrer_affiliate_id` from cookie
- Commission ledger entry on each successful tier upgrade by referred customer
- Monthly payout via NOWPayments mass-send (manual operator-triggered)

**Channel B — Content Seed:**
- 5 VN articles: "Cách dùng Sophia chạy 5 agency clients trong 1 ngày", "BYOK setup 5 phút", "ROI calculator giải thích", "30-day refund tại sao quan trọng", "Telegram bot dùng FSM thế nào"
- 5 EN articles: parallel topics
- All hosted at `/blog/*` (next-intl, bilingual via locale switch)
- Each article ends with "Try Sophia free" CTA → `/signup?ref=blog-<slug>`
- SEO: meta tags, JSON-LD article schema, sitemap.xml entry

**Channel C — Telegram Creator Outreach (low-volume, manual):**
- Operator picks 3 creators/day from existing follow-list
- Sends Telegram DM template (bilingual, max 80 words, 1 link)
- Tracking: separate `?ref=outreach-tg-<creator>` codes
- Cap: 20 DMs/week (avoid spam classifier)

### Non-Functional

- Affiliate program respects existing `land/affiliates/` + `affiliate-programs.json` infrastructure
- Content articles use existing `next-mdx-remote` or similar (verify before scaffolding)
- No operator-managed paid SEO tools — manual Google Search Console only

## Architecture

```
/affiliates (signup form) → POST /api/affiliates/signup
                          → creates row in affiliate_partners table
                          → returns unique slug
                          ↓
visitor with ?ref=<slug> → cookie set
                          ↓
signup_complete event tags referrer_affiliate_id
                          ↓
tier upgrade → commission_ledger row (+30% of MRR for 12mo)
                          ↓
monthly: operator runs payout script → NOWPayments mass-send
```

## Related Code Files

### Create
- `apps/sophia-ai-factory/src/app/[locale]/affiliates/page.tsx` (landing)
- `apps/sophia-ai-factory/src/app/api/affiliates/signup/route.ts`
- `apps/sophia-ai-factory/migrations/01XX-affiliate-partners.sql`
- `apps/sophia-ai-factory/src/land/affiliates/commission-calculator.ts` (extend existing if present)
- `apps/sophia-ai-factory/src/app/[locale]/blog/[slug]/page.tsx` (MDX renderer)
- `content/blog/vi/*.mdx` (5 articles)
- `content/blog/en/*.mdx` (5 articles)
- `scripts/affiliate-payout.ts` (operator-run monthly NOWPayments mass-send)

### Modify
- `apps/sophia-ai-factory/src/app/sitemap.ts` (add /blog + /affiliates)
- `apps/sophia-ai-factory/src/seed/analytics/track-event.ts` (referrer cookie tagging)

## Implementation Steps

1. Affiliate schema + signup route + tests
2. `/affiliates` page (bilingual, terms + signup form)
3. Referrer cookie tagging in track-event helper
4. Commission ledger extension (or new table if needed)
5. Operator payout script (CLI, NOWPayments mass-send)
6. MDX blog renderer at `/blog/[slug]`
7. 5 VN articles drafted (operator owns content; LLM-assist with operator review)
8. 5 EN articles drafted
9. Sitemap + JSON-LD article schema
10. Telegram outreach DM template (Notion or markdown file)
11. Deploy + verify each surface

## Todo List

- [ ] Affiliate schema migration
- [ ] /affiliates page + signup route
- [ ] Referrer cookie tagging
- [ ] Commission ledger code
- [ ] Operator payout script
- [ ] MDX blog renderer
- [ ] 5 VN articles
- [ ] 5 EN articles
- [ ] Sitemap + SEO meta
- [ ] Outreach DM template doc
- [ ] Deploy + verify

## Success Criteria

- /affiliates live + first 3 affiliate signups
- 10 blog articles published, indexed by Google within 2 weeks
- First 20 outreach DMs sent + measured (response rate baseline established)
- Per-channel referrer events flowing into Phase 01 analytics
