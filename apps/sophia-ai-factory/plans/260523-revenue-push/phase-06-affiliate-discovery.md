# Phase 06: Affiliate Program Discovery

**Priority:** MEDIUM | **Impact:** Unlock viral growth loop
**Status:** TODO

## Problem
- Affiliate program offers generous 70/30 split + tier multipliers
- But program is INVISIBLE: no landing page CTA shows earnings potential
- Dashboard has affiliate section but no prominent "Earn $70/referral" banner
- No affiliate onboarding flow for new users
- AffiliateDiscovery component exists on landing but doesn't show earnings examples

## Existing Infrastructure
- `src/land/affiliates/` — commission calculator, dashboard stats, conversion attributor
- `src/forest/components/` — AffiliateDiscovery component on landing
- `src/app/[locale]/affiliate/page.tsx` — affiliate page exists
- `src/app/[locale]/affiliate-discovery/page.tsx` — discovery page exists
- Admin affiliate leaderboard at `/dashboard/admin/affiliate-leaderboard`
- Commission: 70% to affiliate, 30% platform. Tier multipliers: BASIC 0.7x, PREMIUM 1.0x, ENTERPRISE 1.3x

## Tasks

- [ ] 6.1 Update AffiliateDiscovery component on landing page to show concrete earnings
      - "Earn $139/referral on Growth tier" (= $399 × 1.0x × 70% × 50% base commission ≈ $139)
      - Or simpler: "Earn up to 70% commission on every referral"
      - Add earnings calculator or example table
      - Must be bilingual

- [ ] 6.2 Add affiliate CTA banner on user dashboard
      - After login, show banner: "Share Sophia, earn 70% commission"
      - Link to `/affiliate` page
      - Dismissible (store dismissed state)
      - File: new component or update existing dashboard layout

- [ ] 6.3 Update affiliate page with clear onboarding steps
      - Step 1: Get your referral link (auto-generated)
      - Step 2: Share with your network
      - Step 3: Track earnings in real-time
      - Show commission structure table (tier × multiplier × 70% split)
      - Add CTA: "Copy Your Referral Link"

- [ ] 6.4 Add "Refer & Earn" link in site navigation/footer
      - Visible to both logged-in and logged-out users
      - Links to `/affiliate-discovery` (logged out) or `/affiliate` (logged in)

## Files to Modify
- `src/forest/components/` — AffiliateDiscovery component (or landing section)
- `src/app/[locale]/affiliate/page.tsx` — enhance with onboarding steps
- Dashboard layout — add affiliate CTA banner
- Navigation/footer component — add "Refer & Earn" link
- `messages/en.json` + `messages/vi.json` — i18n keys

## Constraints
- Use existing commission calculator logic for accurate earnings examples
- Bilingual (EN + VI)
- Don't break existing affiliate tracking/attribution
- Keep dashboard banner dismissible (don't annoy users)

## Success Criteria
- Landing page shows concrete affiliate earnings example
- Dashboard shows affiliate CTA banner (dismissible)
- Affiliate page has clear 3-step onboarding
- Navigation has "Refer & Earn" link
- Build passes
