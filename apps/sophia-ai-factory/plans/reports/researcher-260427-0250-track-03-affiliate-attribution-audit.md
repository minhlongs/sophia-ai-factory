# Affiliate Link Attribution Chain Audit — Sophia AI Factory

**Date:** 2026-04-27 | **Scope:** Read-only analysis | **Finding:** BROKEN (critical gaps)

---

## Summary

Sophia AI Factory's affiliate revenue attribution chain is **non-functional**. The system has affiliate product discovery and storage but **completely lacks**:
1. Affiliate link injection into video descriptions
2. Click tracking infrastructure  
3. Conversion webhook handlers from affiliate networks
4. User payout calculation from conversions

**RaaS model cannot work:** Users cannot earn money from affiliate links in videos they generate today.

---

## Affiliate Chain Map (6 Stages)

| Stage | Name | Status | Evidence |
|-------|------|--------|----------|
| 1 | **Discovery** | ✅ REAL | `src/lib/inngest/functions/auto-discover-affiliates.ts` runs daily, fetches ClickBank programs, scores & stores in `affiliate_products` table |
| 2 | **Product Selection** | ❌ MISSING | Campaign form has no product picker; user cannot choose which offer to promote |
| 3 | **Link Injection** | ❌ MISSING | `generate-campaign.ts:104` hardcodes description as `"AI-generated video content for {audience}"` — no affiliate URL |
| 4 | **Click Tracking** | ❌ MISSING | No `/api/r/[code]` redirect handler; no redirect tracking table; no click log |
| 5 | **Conversion Webhook** | ❌ STUB | ShareASale adapter has placeholder (lines 56-60: `// Placeholder for actual API request`); no postback handler |
| 6 | **Payout Attribution** | ❌ MISSING | Zero code linking conversions → user earnings; no `user_earnings` or `commission` table update logic |

---

## Per-Stage Reality Check

### Stage 1: Discovery ✅ REAL
**`src/lib/inngest/functions/auto-discover-affiliates.ts` (lines 26-174)**
- Inngest cron runs daily at 8 AM UTC
- Calls `getAllPrograms()`, `getCategories()` from `@/lib/affiliates`
- Scores programs via `scoreAffiliates()` (niche relevance 0-100)
- Inserts into `affiliate_products` table with: `external_id`, `network_id`, `title`, `affiliate_link`, `commission_rate`, `sps_score`
- ✅ Works. Stores clickbank links like `https://[vendor].hop.clickbank.net`

### Stage 2: Product Selection ❌ MISSING
**`src/app/[locale]/dashboard/components/create-campaign/campaign-form.tsx`**
- Campaign form inputs: `title`, `topic`, `audience` only (lines 12-15)
- Zero form fields for selecting an affiliate offer
- ❌ User cannot pick which product to promote → chain breaks immediately

### Stage 3: Link Injection ❌ MISSING  
**`src/lib/inngest/functions/generate-campaign.ts` (line 104)**
```typescript
description: `AI-generated video content for ${audience || 'general audience'}`
```
- YouTube/TikTok adapters receive hardcoded description
- `src/lib/gateway/adapters/youtube-channel-adapter.ts` and `tiktok-channel-adapter.ts` publish with this description
- ❌ No affiliate link in video description. Videos post to social media with generic description, zero revenue tracking ability

### Stage 4: Click Tracking ❌ MISSING
- No redirect endpoint found (searched for `/api/r/*`, `/api/click/*`, `/api/link/*`)
- No click tracking table in schema
- No short-link generation code
- ❌ Even IF affiliate link was in description, clicks would go directly to merchant — Sophia cannot intercept or log them

### Stage 5: Conversion Webhook ❌ STUB
**`src/lib/ingestion/adapters/shareasale-adapter.ts` (lines 44-61)**
```typescript
private async fetchCategory(categoryKeyword: string): Promise<RawProduct[]> {
  // Placeholder for actual API request
  // const response = await fetch(...)
  return []
}
```
- ClickBank adapter: imports feed, parses products (real)
- ShareASale adapter: **STUB**. Config reads env vars `SHAREASALE_API_TOKEN`, `SHAREASALE_API_SECRET`, but fetchCategory returns empty array
- No postback URL handler for conversion webhooks (searched `/api/webhooks/*` — found Telegram, NOWPayments, but no affiliate)
- ❌ Cannot receive conversion data from affiliate networks even if links were live

### Stage 6: Payout Attribution ❌ MISSING
- Searched for: `payout`, `user.*balance`, `earnings.*calculate`, `commission.*user`, `convert.*money`
- Found: `commission_rate` and `avg_earnings_usd` fields stored in `affiliate_products`, but **zero code uses them**
- No `user_earnings` table; no update logic that links (conversion event) → (user balance change)
- Referral code endpoint exists (`src/app/api/referral/generate/route.ts`) but it's for Sophia tier referrals, not affiliate payouts
- ❌ No mechanism to credit user wallet when conversion occurs

---

## Critical Gaps (Blocking)

1. **No product selection in campaign flow** — User creates campaign but never selects an offer to promote
2. **No link injection** — Affiliate URL never reaches video description
3. **No tracking redirect** — Clicks go directly to merchant, Sophia has no telemetry
4. **No conversion webhook handler** — Affiliate network postbacks have nowhere to land
5. **No earnings calculation** — Conversions cannot transfer to user balance (no code path exists)

**If user generates a video with affiliate link today:**
- Video posts to YouTube/TikTok with generic description
- Viewer clicks external link (if it existed) → goes to merchant
- Merchant tracks conversion in their system
- Conversion **never reaches** Sophia's infrastructure
- User's wallet **never updates**
- User sees $0 earnings

---

## Verdict

**BROKEN — RaaS model non-functional**

```
Discovery:          ✅ Works
Product Selection:  ❌ Missing
Link Injection:     ❌ Missing
Click Tracking:     ❌ Missing
Conversion Handler: ❌ Stub
Payout Logic:       ❌ Missing
═════════════════════════════════════════
OVERALL:            ❌ BROKEN (0/6 stages functional)
```

**Revenue attribution chain is 100% incomplete.** Sophia has discovered affiliates and stored them, but has zero integration to inject affiliate links into videos or track conversions back to users.

---

## Unresolved Questions

1. Was affiliate revenue attribution ever planned as Phase 2+ work, or was discovery-only the scope?
2. Should campaign creation require selecting an `affiliate_product_id` before generating script?
3. Which affiliate networks should postback to Sophia (ClickBank, ShareASale, Amazon, others)?
4. What's the commission split model: Sophia keeps % or passes 100% to user?
5. Should earnings appear in user wallet immediately on conversion or after payout period (30 days)?
