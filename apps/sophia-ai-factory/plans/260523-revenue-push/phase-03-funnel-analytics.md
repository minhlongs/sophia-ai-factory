# Phase 03: Funnel Analytics Setup

**Priority:** HIGH | **Impact:** Enables data-driven optimization
**Status:** COMPLETE

## Problem
- No GA4 — zero external analytics
- No UTM parameter capture through signup flow
- No checkout abandonment tracking
- No conversion pixels (Facebook, TikTok)
- Internal funnel-stats.ts tracks signup→video but misses tier conversion + abandonment

## Tasks

- [x] 3.1 Add GA4 script to root layout (gtag.js)
- [x] 3.2 Implement UTM parameter capture: parse utm_source/medium/campaign/content from URL, persist in cookie/session
- [x] 3.3 Add conversion events: signup_complete, checkout_started, payment_success, tier_upgrade
- [x] 3.4 Track checkout abandonment: log "user reached /api/checkout" without completing payment
- [x] 3.5 Add tier conversion tracking to funnel-stats.ts: free→BASIC, BASIC→PREMIUM upgrade rates
- [x] 3.6 Add promo code effectiveness: reserved → redeemed success rate

## Files to Modify
- `src/app/[locale]/layout.tsx` — GA4 script injection
- `src/lib/analytics/` — new utm-capture.ts, conversion-events.ts
- `src/land/analytics/funnel-stats.ts` — add tier conversion queries
- `src/app/api/checkout/route.ts` — log checkout_started event

## Success Criteria
- GA4 receiving pageview + custom events
- UTM params persisted through signup→checkout flow
- Checkout abandonment rate measurable
- Tier upgrade funnel visible in admin analytics
