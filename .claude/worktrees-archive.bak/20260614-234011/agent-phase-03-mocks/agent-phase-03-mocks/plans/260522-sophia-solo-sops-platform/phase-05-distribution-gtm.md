# Phase 05: Distribution & Go-to-Market

**Status:** ✅ DONE (code tasks)
**Priority:** P1
**Depends on:** Phase 04 (affiliate + growth engine)

---

## Context Links
- [Strategy Plan](./plan.md)
- [Phase 04](./phase-04-affiliate-growth-engine.md) — Affiliate + growth engine

## Overview

Phase 5 has two halves: **code** (platform features supporting distribution) and **marketing** (content creation, community building). This plan covers the CODE half.

## Tasks (Code)

### Task A: Beta Creator Invite System
- [x] D1 migration: `beta_invites` table (id, code, email, commission_override_pct, max_uses, used_count, expires_at, created_by, created_at)
- [x] `land/sop-marketplace/beta-invites.ts` — generate invite codes, validate, redeem
- [x] On invite redeem: set user's SOP commission to 50% (override) for 60 days
- [x] `/dashboard/admin/invites/page.tsx` — admin page to create/manage invite codes
- [x] i18n keys (en + vi)
- **Files:** `migrations/`, `land/sop-marketplace/`, `app/[locale]/dashboard/admin/invites/`

### Task B: SOP Marketplace Promo Assets
- [x] Extend existing `land/affiliates/promo-library.ts` with SOP marketplace templates
  - Twitter/X post templates for SOP creators (en + vi)
  - Facebook group post templates
  - Reddit r/entrepreneur post template
  - Telegram group message template (en + vi)
  - Email outreach template for beta creator recruitment
- [x] Expose via existing `/api/affiliate/promo-assets` endpoint (add `?niche=sop_marketplace`)
- **Files:** `land/affiliates/promo-library.ts`, `app/api/affiliate/promo-assets/route.ts`

### Task C: Dashboard Community CTA
- [x] Add "Join Community" banner to dashboard layout
  - Telegram group link (Vietnamese)
  - Discord link (English)
  - Dismissible (stores preference in localStorage)
- [x] i18n keys
- **Files:** `forest/components/community-cta-banner.tsx`, `app/[locale]/dashboard/layout.tsx`, `messages/`

## Tasks (Marketing — Non-Code)

These are documented for reference but NOT implemented in code:

- [ ] ProductHunt launch page preparation (screenshots, description, maker story)
- [ ] YouTube: 4 tutorial videos (faceless channel SOP, UGC agency SOP, AI avatar SOP, platform walkthrough)
- [ ] TikTok: "SOP of the day" content format
- [ ] Reddit: posts to r/entrepreneur, r/YouTubers, r/SaaS, r/passive_income
- [ ] Recruit 10-20 beta creators via email + Telegram DMs
- [ ] Telegram community setup and moderation

## Success Criteria
- [x] Beta invite system generates codes with 50% commission override
- [x] SOP promo templates available via promo-assets API (`?niche=sop_marketplace`)
- [x] Community CTA visible in dashboard
- [x] `npm run build` passes
- [x] tsc clean
