# Phase 04: Affiliate + Growth Engine

**Status:** In Progress
**Priority:** P1
**Depends on:** Phase 03 (marketplace + creator mode)

---

## Context Links
- [Strategy Plan](./plan.md)
- [Phase 03](./phase-03-marketplace-creator-mode.md) — Marketplace + creator mode

## Discovery: Existing Affiliate System

The codebase has a **mature affiliate engine** already:
- ✅ `affiliate_links` table with code + sub_id + campaign_name
- ✅ `click_events` + `conversion_events` tables with GDPR-compliant tracking
- ✅ `commission_ledger` with tier multipliers (0.7x BASIC → 1.3x MASTER)
- ✅ `land/affiliates/` — commission-calculator, leaderboard, click-recorder, promo-library
- ✅ `forest/inngest/functions/conversion-to-ledger.ts` — async commission processing
- ✅ `/dashboard/affiliate` — stats, conversions, payouts, CSV export
- ✅ `/api/affiliate/*` — earnings, conversions, promo-assets, payout-method
- ✅ Admin leaderboard at `/dashboard/admin/affiliate-leaderboard`
- ✅ Promo library with tier-gated copy templates (twitter, linkedin, instagram, tiktok)

**Phase 4 scope (revised):** Connect SOP marketplace to affiliate engine + add growth UI features.

## Tasks

### Task A: SOP Affiliate Link Generation
Connect SOP marketplace to existing affiliate_links table.
- [ ] Create `land/sop-marketplace/sop-affiliate-links.ts`
  - `generateSopAffiliateLink(db, userId, templateId)` → creates affiliate_links row with `offer_id=sop_{templateId}`
  - `getSopAffiliateLink(db, userId, templateId)` → lookup existing link
- [ ] Add "Get Affiliate Link" button on SOP detail page (`sop-marketplace/[slug]/page.tsx`)
- [ ] Server action `generateSopLinkAction` in marketplace actions
- **Files:** `land/sop-marketplace/sop-affiliate-links.ts`, `app/[locale]/dashboard/sop-marketplace/[slug]/page.tsx`, `app/[locale]/dashboard/sop-marketplace/actions.ts`

### Task B: Share UI Components
- [ ] Create `forest/components/share/share-buttons.tsx` — client component
  - Copy link to clipboard button
  - Twitter/X share with pre-filled text
  - Facebook share
  - LinkedIn share
  - WhatsApp share
  - Telegram share
- [ ] Create `forest/components/share/share-results-card.tsx` — shareable SOP execution result
  - Shows: SOP name, steps completed, time taken, "Powered by Sophia AI"
  - "Share my results" button opens share modal with affiliate link
- **Files:** `forest/components/share/`

### Task C: User-Facing Leaderboard Page
- [ ] Create `/dashboard/leaderboard/page.tsx` — public leaderboard
  - Top 50 creators by SOP sales (total_sales from sop_listings)
  - Top 50 affiliates by commission earned (from existing leaderboard.ts)
  - Tabs: "Top Creators" | "Top Affiliates"
  - Current user's rank highlighted
  - Time filter: 7d / 30d / All time
- [ ] Add i18n keys for leaderboard (en + vi)
- **Files:** `app/[locale]/dashboard/leaderboard/`, `messages/`

### Task D: Monthly Challenges System
- [ ] D1 migration: `sop_challenges` table (id, title_en, title_vi, description, goal_type, goal_value, reward_type, reward_value, starts_at, ends_at, status)
- [ ] D1 migration: `user_challenge_progress` table (id, user_id, challenge_id, current_value, completed_at)
- [ ] Create `land/sop-marketplace/challenges.ts` — CRUD + progress tracking
  - `listActiveChallenges(db)`
  - `getUserProgress(db, userId, challengeId)`
  - `incrementProgress(db, userId, challengeId, amount)`
  - `checkCompletion(db, userId, challengeId)`
- [ ] Create `/dashboard/challenges/page.tsx` — challenges list with progress bars
- [ ] Seed 3 initial challenges: "Ship 10 Videos" (30 days), "First SOP Sale", "Earn $100 Commission"
- [ ] i18n keys for challenges (en + vi)
- **Files:** `seed/db/migrations/`, `land/sop-marketplace/challenges.ts`, `app/[locale]/dashboard/challenges/`, `messages/`

### Task E: Referral Landing Page
- [ ] Create `/ref/[code]/page.tsx` — public referral landing page
  - Shows: Sophia AI branding, SOP marketplace highlights, CTA to sign up
  - Tracks click via existing `click-recorder.ts`
  - Sets `ref` cookie for attribution on sign-up
  - OG metadata for social preview (title, description, image)
- **Files:** `app/ref/[code]/page.tsx`

## File Ownership (Parallel Agents)

| Agent | Owns | Reads |
|-------|------|-------|
| Agent A (Affiliate Links) | `land/sop-marketplace/sop-affiliate-links.ts`, marketplace actions | affiliate_links schema |
| Agent B (Share UI) | `forest/components/share/` | — |
| Agent C (Leaderboard) | `app/[locale]/dashboard/leaderboard/`, messages | leaderboard.ts, sop-repo |
| Agent D (Challenges) | migrations, `land/sop-marketplace/challenges.ts`, `app/[locale]/dashboard/challenges/`, messages | — |
| Agent E (Referral Page) | `app/ref/[code]/page.tsx` | click-recorder.ts |

## Success Criteria
- [ ] SOP affiliate links generate from marketplace detail page
- [ ] Share buttons work with pre-filled social text + affiliate link
- [ ] User-facing leaderboard shows top creators + affiliates
- [ ] 3 seed challenges with progress tracking
- [ ] Referral landing page with OG metadata + click tracking
- [ ] `npm run build` passes
- [ ] tsc clean

## Risk Assessment
- **Affiliate link routing**: Existing `affiliate_links` uses `offer_id` for network offers. SOP links need `offer_id=sop_{templateId}` convention — must not collide.
- **Challenge progress tracking**: Needs hooks into SOP execution + sales events. Will connect via Inngest in Phase 5.
- **Referral attribution**: Cookie-based — won't work if user clears cookies between click and sign-up.
