# Documentation Update: Polar→NOWPayments Migration (2026-04-10)

## Summary
Updated 5 documentation files to reflect the complete migration from Polar.sh to NOWPayments (USDT TRC20) as the primary payment provider, with PayOS as backup for Vietnam domestic payments.

## Files Updated

### 1. docs/project-changelog.md
**Changes:**
- Added v1.9.0 entry documenting the migration
- Listed 35+ deleted files (Polar SDK, Stripe integration, admin billing routes)
- Documented new NOWPayments components (IPN handler, signature verification)
- Noted test impact (47 removed, 52 added)
- Status: Version bumped from 1.8.0 → 1.9.0

### 2. docs/system-architecture.md
**Changes:**
- Replaced Section 5 "Payment Infrastructure (Polar)" with "Payment Infrastructure (NOWPayments)"
- Updated architecture details:
  - Provider: NOWPayments.io (crypto/USDT TRC20)
  - Backup: PayOS for Vietnam domestic payments
  - New webhook path: `/api/webhooks/nowpayments`
  - Security: HMAC-SHA512 signature verification on `x-nowpayments-sig` header
  - Order ID format: `sophia_{orgId}_{timestamp}` for idempotency
- Documented tier-to-invoice-ID mapping

### 3. docs/project-overview-pdr.md
**Changes:**
- Updated Tech Stack section:
  - Added Supabase to primary database (was missing)
  - Updated payment provider: "NOWPayments (Primary, USDT TRC20) + PayOS (Backup, Vietnam domestic)"
  - Removed Airtable-only reference

### 4. docs/deployment-guide.md
**Changes:**
- Step 5 (Production Setup Wizard):
  - Changed "Polar.sh" → "NOWPayments"
  - Updated wizard responsibilities (removed Polar product syncing, kept IPN webhook verification)
- Advanced Configuration Section:
  - Replaced Polar env vars with NOWPayments:
    - `POLAR_*` → `NOWPAYMENTS_API_KEY` and `NOWPAYMENTS_IPN_SECRET`
  - Added PayOS backup provider env vars
  - Removed references to `setup-polar-products.ts` script

### 5. docs/project-roadmap.md
**Changes:**
- Updated header:
  - Version: 1.8.0 → 1.9.0
  - Last Updated: 2026-03-07 → 2026-04-10
- Expanded Phase 4 (Monetization):
  - Added phase evolution: Polar (v1.2-v1.8) → NOWPayments (v1.9+)
  - Documented new 4-tier pricing: BASIC ($199), PREMIUM ($399), ENTERPRISE ($799), MASTER ($4999)
  - Added NOWPayments-specific details: pre-created invoices, HMAC verification, idempotency tracking
  - Documented code cleanup (35+ deleted files)
  - Added PayOS backup configuration

## Files Deleted
- docs/polar-configuration.md (obsolete, replaced by nowpayments-configuration.md)

## Files Created
- docs/nowpayments-configuration.md (NEW) — Comprehensive NOWPayments setup guide:
  - Environment variable requirements
  - Tier → Invoice ID mapping table
  - IPN webhook setup instructions
  - Payment flow walkthrough
  - IPN status handlers (finished, partially_paid, expired, failed, refunded)
  - Idempotency explanation
  - PayOS fallback configuration
  - Testing procedures (local, staging, production)
  - Troubleshooting guide

## Key Architectural Changes Documented

1. **Payment Provider**
   - Primary: NOWPayments (USDT TRC20 stablecoin, no credit card required)
   - Backup: PayOS (Vietnam domestic, bank transfer/Momo/ZaloPay)
   - Removed: Polar.sh (rejected product for "wellness/health" classification)

2. **Webhook Architecture**
   - Old: `/api/webhooks/polar` → Polar.sh standard-webhooks signature
   - New: `/api/webhooks/nowpayments` → HMAC-SHA512 on `x-nowpayments-sig` header
   - Idempotency tracking via `order_id` format: `sophia_{orgId}_{timestamp}`

3. **Tier Pricing**
   - Old: 3-tier (Starter, Growth, Premium at $1200, $2000, $3000)
   - New: 4-tier (BASIC $199, PREMIUM $399, ENTERPRISE $799, MASTER $4999)
   - Payment: Monthly subscription (not one-time)

4. **Code Impact**
   - Deleted: 35+ Polar SDK files, Stripe metered-billing integration, admin billing routes
   - Modified: 15+ files (middleware, subscription gate, payment service layer)
   - Added: NOWPayments client, IPN handlers, signature verification

## Cross-References Verified
- All docs reference correct webhook paths: `/api/webhooks/nowpayments`
- All docs reference correct tier names: BASIC, PREMIUM, ENTERPRISE, MASTER
- Pricing page links updated to reflect NOWPayments checkout flow
- Environment variable references consistent across all docs

## Quality Checklist
- [x] Removed obsolete Polar-specific documentation
- [x] Created comprehensive NOWPayments setup guide
- [x] Updated all existing docs to reference new system
- [x] Verified no stale references to Polar remain
- [x] Documented tier pricing changes
- [x] Explained IPN webhook architecture
- [x] Included troubleshooting section
- [x] Added PayOS backup configuration details

## Notes
- All changes are documentation-only (no code changes in this update)
- NOWPayments implementation was completed on 2026-04-10 (code already deployed)
- PayOS integration is configured but marked as "backup" for future activation
- Sophia production URL: https://sophia.agencyos.network (Cloudflare Worker, not Vercel)


## Additional Files Updated (Post-Initial Update)

### 6. docs/GO-LIVE-DEPLOYMENT-GUIDE.md
**Changes:**
- Phase 2.1: Updated Polar → NOWPayments credentials setup
- Phase 3: Updated wizard to verify NOWPayments connectivity
- Phase 4.3: Replaced Polar env vars with NOWPayments env vars
- Phase 5.1: Changed webhook configuration from Polar to NOWPayments IPN
- Phase 6.1: Updated test checkout flow to reference NOWPayments hosted page
- Phase 7: Updated health check to reference NOWPayments instead of Polar

### 7. docs/testing-guide.md
**Changes:**
- Section 4: Updated webhook test reference from `polar/route.test.ts` → `nowpayments/route.test.ts`
- Noted HMAC-SHA512 signature verification for IPN events

### 8. docs/usage-metering.md
**Changes:**
- Updated customer linkage documentation: Polar/Stripe → NOWPayments
- Updated external_customer_id field descriptions (all 2 occurrences)
- Updated reconciliation endpoint filter descriptions
- Updated resolveExternalCustomerId() behavior to reference nowpayments_customer_id
- Maintained CSV export format unchanged (still compatible)

### 9. docs/security-hardening-implementation.md
**Changes:**
- Section 5 (Webhook Verification): Updated function references
- Changed `verifyPolarWebhookSignature()` → `verifyNowpaymentsWebhookSignature()`
- Updated usage example to show NOWPayments x-nowpayments-sig header verification
- Noted HMAC-SHA512 signature verification method

## Final Verification

All documentation files have been updated to reflect the Polar→NOWPayments migration:

✅ **Core Documentation** (5 files)
- project-changelog.md (added v1.9.0 entry)
- system-architecture.md (replaced Section 5)
- project-overview-pdr.md (updated tech stack)
- deployment-guide.md (updated setup instructions)
- project-roadmap.md (updated version and Phase 4)

✅ **Support Documentation** (4 files)
- GO-LIVE-DEPLOYMENT-GUIDE.md (5+ changes)
- testing-guide.md (webhook reference)
- usage-metering.md (payment provider references)
- security-hardening-implementation.md (webhook verification functions)

✅ **New Documentation** (1 file)
- nowpayments-configuration.md (comprehensive setup guide)

✅ **Deleted Documentation** (1 file)
- polar-configuration.md (obsolete)

## Remaining References to Polar

Legacy documentation files still mention Polar (informational only, not actionable):
- docs/usage-metering.md (historical context in roadmap sections) ← Updated
- docs/project-changelog.md (historical context for v1.2-v1.8) ← Updated
- docs/project-roadmap.md (historical context for Phase 4a) ← Updated
- docs/security-hardening-implementation.md (webhook types) ← Updated

These are intentional historical references that document the migration path.

## Consistency Checks Performed

✅ All main docs now reference `/api/webhooks/nowpayments` (not `/api/webhooks/polar`)
✅ All main docs reference NOWPAYMENTS_* environment variables
✅ All tier names consistent: BASIC, PREMIUM, ENTERPRISE, MASTER
✅ All pricing updated: $199, $399, $799, $4999
✅ PayOS backup documented in all relevant sections
✅ HMAC-SHA512 signature verification documented
✅ Order ID idempotency format documented: sophia_{orgId}_{timestamp}

## Status: Complete

All documentation has been updated to reflect the Polar→NOWPayments full code migration completed on 2026-04-10. The documentation is now accurate and deployment-ready.

**Next Steps:**
- Monitor production for any webhook issues (check Sentry)
- Test IPN webhook delivery with NOWPayments test endpoint
- Verify tier activation workflow (payment → webhook → tier update)
- Update client-facing documentation in Sophia handbook if applicable

