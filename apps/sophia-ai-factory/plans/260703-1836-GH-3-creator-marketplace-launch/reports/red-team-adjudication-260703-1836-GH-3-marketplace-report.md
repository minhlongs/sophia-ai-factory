# Red Team Adjudication — Creator Marketplace Plan

**Date:** 2026-07-03  
**Reviewers:** Security Adversary, Assumption Destroyer, Failure Mode Analyst  
**Total raw findings:** 24 → **Deduplicated & Capped:** 14

---

## Adjudication Summary

| # | Finding | Severity | Disposition | Source |
|---|---------|----------|-------------|--------|
| 1 | `isBetaInviteApproved` function doesn't exist — build will fail | Critical | **Accept** | All 3 |
| 2 | Tree→land layer violation in `creator-access.ts` | High | **Accept** | Security + Assumptions |
| 3 | Phase 1 misses 4th MASTER gate in `[id]/page.tsx` | Critical | **Accept** | Failure Mode |
| 4 | Self-publish vulnerability — no admin review gate | Critical | **Accept** | Security |
| 5 | Locale-aware marketplace already exists at `dashboard/sop-marketplace/` | Critical | **Accept** | Assumptions |
| 6 | Request payout button has no API endpoint | High | **Accept** | Security + Failure |
| 7 | No user-to-invite mapping in beta-invites DB schema | High | **Accept** | Security |
| 8 | API response fields don't match plan claims (installCount vs totalSales) | High | **Accept** | Failure Mode |
| 9 | "9 Stitch-redesigned screens" reference is false | High | **Accept** | Assumptions |
| 10 | Rating/install UI already exists in old client — port, don't build from scratch | High | **Accept** | Assumptions |
| 11 | Wallet tier gate blocks payout data for non-MASTER | High | **Accept** | Failure Mode |
| 12 | Phase 2 creates duplicate payout page (existing at /dashboard/affiliate/payouts/) | High | **Accept** | Failure Mode |
| 13 | Phase 2 payout page requires tab layout — effort underestimated | Medium | **Accept** | Assumptions |
| 14 | Phase 3 marketplace component at wrong directory (new `marketplace/` instead of `sop/`) | Medium | **Accept** | Assumptions |

**Rejected findings** (redundant, out of scope, or not actionable):
- "No CSRF tokens" — pre-existing issue, not introduced by this plan. Fix separately.
- "bank_account method not processed" — pre-existing, not scope of this plan.
- "Test count stale (6772 vs 6694)" — cosmetic, plan references current live count.
- "Middleware already blocks old route" — true, simplifies cleanup.

---

## Detailed Adjudication

### Finding 1: `isBetaInviteApproved` does not exist — Critical
**Flaw:** The plan's `hasCreatorAccess()` imports `isBetaInviteApproved` from `@/land/sop-marketplace` but this function doesn't exist. The beta-invites module has no user-ID-based approval check.

**Fix:** Replace with a new function that queries `beta_invites` for the user's email or add a proper user-invite mapping table.

### Finding 2: Tree→land layer violation — High
**Flaw:** Plan puts `creator-access.ts` in `tree/sop/` but it imports from `land/sop-marketplace/`. Tree layer can only import from seed.

**Fix:** Move to `land/sop-marketplace/creator-access.ts` or `forest/sop/creator-access.ts`.

### Finding 3: Missing 4th MASTER gate in [id]/page.tsx — Critical
**Flaw:** Plan lists 3 files to update but misses `[id]/page.tsx:57` which also gates at MASTER.

**Fix:** Add this file to Phase 1's Related Code Files.

### Finding 4: Self-publish vulnerability — Critical
**Flaw:** `submitForReviewAction` sets status directly to `published` with no admin review gate. Expanding access beyond MASTER without moderation is risky.

**Fix:** Change publish flow to `pending_review → admin_approve → published`. Create admin review queue.

### Finding 5: Dashboard marketplace already exists — Critical
**Flaw:** Full locale-aware marketplace already at `[locale]/dashboard/sop-marketplace/`. Creating a new public marketplace without defining the relationship creates fragmentation.

**Fix:** Either (a) share components between public and dashboard versions, or (b) make dashboard marketplace serve as public with auth-gated install, or (c) define clear routing hierarchy.

### Finding 6: Request payout has no API — High
**Flaw:** Payouts are cron-driven (Inngest weekly batcher). There's no user-facing "request payout" endpoint.

**Fix:** Scope out the "Request payout" button — payouts are automatic weekly. Show "Next scheduled payout" date instead.

### Finding 7: No user-to-invite mapping — High
**Flaw:** `beta_invites` table has no `redeemed_by_user_id` column. No way to query "did user X redeem an invite?"

**Fix:** Add DB migration for user-invite mapping. Or use email-based lookup since invites store `email`.

### Finding 8: API field name mismatch — High
**Flaw:** Plan uses `installCount` but API returns `totalSales`. Also `authorName`, `thumbnailUrl`, `shortDescription` not in API response.

**Fix:** Align all field references to match actual API response schema. Add missing fields to API query if needed.

### Finding 9: "9 Stitch screens" claim false — High
**Flaw:** Only `pricing-stitch-section.tsx` exists as a Stitch component. The "9 redesigned screens" reference is misleading.

**Fix:** Remove false numerical claim. Reference the actual amber design pattern from PricingStitchSection.

### Finding 10: Rating/install UI already exists — High
**Flaw:** Old marketplace-client.tsx already renders stars(), ratingAvg, installCount.

**Fix:** Port these to the new Stitch component, don't rebuild from scratch.

### Finding 11: Wallet tier gate — High
**Flaw:** Wallet page at `/dashboard/wallet/` gated to MASTER. Payout data may be blocked for lower-tier beta creators.

**Fix:** Ensure wallet/payout data access uses same `hasCreatorAccess()` check from Phase 1.

### Finding 12: Duplicate payout page — High
**Flaw:** Full payout UI exists at `/dashboard/affiliate/payouts/`. Creating another at `/dashboard/sop-creator/payouts/` duplicates.

**Fix:** Add a "Payouts" link to the existing payout page, or build SOP-creator-specific payout page that reuses components from the existing one.

### Finding 13: Tab layout needed — Medium
**Flaw:** Creator dashboard is flat, not tabbed. Adding a "Payouts tab" requires restructuring the entire page.

**Fix:** Update effort estimate. Add tab-navigation step to Phase 2.

### Finding 14: Wrong directory for new component — Medium
**Flaw:** Plan creates `forest/components/marketplace/` but existing SOP components live in `forest/components/sop/`.

**Fix:** Place new component in `forest/components/sop/marketplace-stitch-section.tsx`.

---

## Updated Plan

These findings should be applied as updates to the plan files before implementation begins. Key changes:

1. **Phase 1:** Fix helper function, fix layer violation, add [id] gate, add admin review gate, add DB migration
2. **Phase 2:** Remove request-payout button, reuse existing payout page/API, add tab restructuring, update wallet gate
3. **Phase 3:** Remove false "9 screens" claim, alias field names to API, use sop/ directory, resolve dashboard marketplace relationship
4. **Phase 4:** Port existing rating/install UI, align with actual API schema
