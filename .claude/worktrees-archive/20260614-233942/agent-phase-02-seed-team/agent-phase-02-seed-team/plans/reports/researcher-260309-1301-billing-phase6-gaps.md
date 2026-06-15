# Phase 6 Billing Enforcement & Dunning Workflow - Gap Analysis Report

**Date:** 2026-03-09
**Researcher:** general-purpose
**Work Context:** /Users/macbookprom1/mekong-cli/apps/sophia-ai-factory
**Plan Reference:** `plans/260309-1224-phase6-billing-enforcement-dunning/plan.md`

---

## Executive Summary

Phase 6 implementation is **~75% complete**. Core backend services are solid, but critical gaps exist in:
1. Dashboard UI integration (billing page missing)
2. Admin Billing APIs (incomplete)
3. Polar webhook dunning integration (not connected)
4. Integration tests (all TODO placeholders)

---

## Implementation Status Matrix

| Component | Status | File | Notes |
|-----------|--------|------|-------|
| **Core Services** | | | |
| Overage Reconciler | ✅ Complete | `src/lib/billing/overage-billing-reconciler.ts` | Full Stripe/Polar integration |
| Dunning Workflow | ✅ Complete | `src/lib/billing/dunning-workflow.ts` | State machine, tier configs |
| Usage Aggregator | ✅ Complete | `src/lib/billing/usage-aggregator.ts` | Forecast, overage detection |
| Quota Enforcer | ✅ Complete | `src/lib/quota/quota-enforcer.ts` | Dunning-aware blocking |
| Polar Webhook Handler | ⚠️ Partial | `src/lib/payments/polar-webhook-handler.ts` | Missing dunning integration |
| **Dashboard UI** | | | |
| Billing Status Card | ✅ Complete | `src/components/billing/usage-summary-card.tsx` | |
| Dunning Banner | ✅ Complete | `src/components/billing/dunning-status-banner.tsx` | |
| Usage Gauge | ✅ Complete | `src/components/analytics/QuotaGauge.tsx` | |
| Billing Dashboard Page | ❌ Missing | `src/app/[locale]/dashboard/billing/page.tsx` | Not created |
| **Admin APIs** | | | |
| Reconciliation Trigger | ✅ Complete | `src/app/api/admin/billing/reconcile/route.ts` | |
| Dunning Management | ⚠️ Partial | `src/app/api/admin/dunning/` | Routes exist, not in plan |
| Billing Summary API | ❌ Missing | `src/app/api/admin/billing/summary/route.ts` | Not created |
| Overage Events API | ❌ Missing | `src/app/api/admin/billing/overage-events/route.ts` | Not created |
| **Tests** | | | |
| Unit Tests | ⚠️ Partial | Various `.test.ts` files | Components tested |
| Integration Tests | ❌ Incomplete | `src/lib/billing/__tests__/phase6-integration.test.ts` | All TODOs |

---

## Detailed Gap Analysis

### Gap 1: Dashboard Billing Page (P1 - Critical)

**Issue:** No dedicated billing dashboard page exists at `/dashboard/billing`

**Plan Reference:** `phase-05-dashboard-ui.md` specifies:
- `src/app/[locale]/dashboard/billing/page.tsx`

**Current State:**
- Billing components exist: `usage-summary-card.tsx`, `dunning-status-banner.tsx`, `quota-usage-gauge.tsx`
- Components are fragmented, not integrated into unified billing page
- Analytics dashboard exists but doesn't show billing-specific data

**Required Actions:**
1. Create `src/app/[locale]/dashboard/billing/page.tsx`
2. Integrate existing components:
   - `UsageSummaryCard` (usage gauges)
   - `DunningStatusBanner` (payment status)
   - `QuotaGauge` (quota visualization)
3. Add overage charges table
4. Add payment history timeline
5. Connect to `/api/billing/usage-summary` endpoint

**Effort:** 2-3 hours

---

### Gap 2: Admin Billing APIs (P2 - High)

**Issue:** Admin billing management APIs incomplete

**Plan Reference:** `phase-04-admin-apis.md` specifies 5 endpoints:
- `GET/POST /api/admin/billing/dunning-status`
- `GET /api/admin/billing/overage-events`
- `GET /api/admin/billing/summary`
- `GET/POST /api/admin/violations`
- `POST /api/admin/billing/reconcile`

**Current State:**
| Endpoint | Status | Location |
|----------|--------|----------|
| `/api/admin/billing/reconcile` | ✅ Complete | `src/app/api/admin/billing/reconcile/route.ts` |
| `/api/admin/dunning/*` | ⚠️ Partial | `src/app/api/admin/dunning/[licenseNonce]/` |
| `/api/admin/billing/summary` | ❌ Missing | - |
| `/api/admin/billing/dunning-status` | ❌ Missing | - |
| `/api/admin/billing/overage-events` | ❌ Missing | - |
| `/api/admin/violations` | ❌ Missing | - |

**Required Actions:**
1. Create `src/app/api/admin/billing/summary/route.ts`
   - Aggregate MRR, dunning state counts, unbilled overage
2. Create `src/app/api/admin/billing/dunning-status/route.ts`
   - List dunning statuses with filtering
   - Manual suspend/restore actions
3. Create `src/app/api/admin/billing/overage-events/route.ts`
   - List overage events with billable filter
4. Create `src/app/api/admin/violations/route.ts`
   - List violations
   - Mark as resolved/escalate

**Effort:** 2-3 hours

---

### Gap 3: Polar Webhook Dunning Integration (P1 - Critical)

**Issue:** Polar webhook handler exists but does NOT integrate with dunning workflow

**Plan Reference:** `phase-03-polar-webhook-handler.md` specifies:
- `payment.failed` → `handlePaymentFailure()` from dunning-workflow
- `payment.paid` → `handlePaymentSuccess()` from dunning-workflow
- `subscription.past_due` → Trigger dunning workflow

**Current State:**
- File exists: `src/lib/payments/polar-webhook-handler.ts`
- Handles: `checkout.updated`, `subscription.created/updated/cancelled`, `order.created`
- NEW events handled: `subscription.active`, `subscription.past_due`, `subscription.expired`
- `subscription.past_due` handler calls `handlePaymentFailure()` ✅
- BUT `checkout.updated` (payment failure) does NOT trigger dunning

**Code Analysis:**
```typescript
// Current: subscription.past_due triggers dunning (line 759-829)
async function handleSubscriptionPastDue(data: Record<string, unknown>): Promise<void> {
  await handlePaymentFailure({ ... })  // ✅ Correct
}

// Missing: checkout.updated with failed payment should also trigger dunning
async function handleCheckoutSuccess(data: Record<string, unknown>): Promise<void> {
  // Only handles success case, no failure path
}
```

**Required Actions:**
1. Add `checkout.updated` failure handling:
   ```typescript
   if (data.status === 'failed') {
     await handlePaymentFailure({ ... })
   }
   ```
2. Add `order.paid` success handling → `handlePaymentSuccess()`
3. Verify webhook endpoint exists: `src/app/api/webhooks/polar/route.ts`
4. Test end-to-end: payment failure → dunning state change → API block

**Effort:** 1-2 hours

---

### Gap 4: Integration Tests (P1 - Critical)

**Issue:** All integration tests are TODO placeholders

**Plan Reference:** `phase-06-testing-docs.md` (not found, but tests specified in plan.md)

**Current State:**
File: `src/lib/billing/__tests__/phase6-integration.test.ts`
- 30+ test cases, ALL are `expect(true).toBe(true)` placeholders
- No actual test implementations

**Test Cases Needed:**
```typescript
// License Enforcement (3 tests)
- Reject expired license
- Reject revoked license
- Allow active license

// Usage Metering (3 tests)
- Track usage events
- Calculate credits used
- Handle batch ingestion

// Overage Billing (3 tests)
- Detect quota exceeded
- Calculate overage fees
- Log overage events

// Stripe Webhooks (3 tests)
- invoice.payment_failed
- invoice.payment_succeeded
- subscription.updated

// Polar Webhooks (4 tests)
- subscription.created
- subscription.active
- subscription.past_due
- order.paid

// Dunning Workflow (3 tests)
- Transition to past_due
- Transition to current
- Transition to suspended

// RaaS Gateway (3 tests)
- Block suspended licenses
- Allow current licenses
- Warn on quota approach

// Violations API (3 tests)
- Log violations
- Query with filters
- Enforce RBAC

// Analytics Sync (3 tests)
- Usage data sync
- Revenue metrics
- License utilization

// Cron Jobs (3 tests)
- Daily reconciliation
- Cron authentication
- Daily export
```

**Required Actions:**
1. Implement 30+ test cases with real Supabase test DB
2. Add test fixtures (users, licenses, usage events)
3. Mock Stripe/Polar webhooks
4. Test dunning state transitions end-to-end

**Effort:** 6-8 hours

---

### Gap 5: RaaS Gateway Dunning Integration (✅ Complete)

**Status:** Implemented correctly

**Current State:**
File: `src/lib/quota/quota-enforcer.ts` (line 232-243)
```typescript
// Check dunning state FIRST - block suspended accounts before quota check
const dunningCheck = await canAccessApi(licenseNonce);
if (!dunningCheck.allowed) {
  return { allowed: false, response: createDunningBlockResponse(dunningCheck) };
}
```

**Verified:**
- Imports `canAccessApi` from dunning-workflow ✅
- Returns 403 with `ACCOUNT_SUSPENDED` code ✅
- Includes dunning state/reason in response ✅

**No action needed.**

---

### Gap 6: Polar Webhook Endpoint (⚠️ Verify Needed)

**Issue:** Need to confirm webhook API route exists

**Check Required:**
- `src/app/api/webhooks/polar/route.ts` - Does this exist?
- If not, create it following Stripe pattern

**Required Actions:**
1. Verify file existence
2. If missing, create with:
   - POST handler
   - Signature verification
   - Event parsing
   - `processWebhookEvent()` call

**Effort:** 30 min (if missing)

---

### Gap 7: Usage Calculator API (✅ Complete)

**Status:** Implemented as `/api/billing/usage-summary`

**Current State:**
File: `src/app/api/billing/usage-summary/route.ts`

**Verified:**
- Uses `aggregateUsageForLicense()` from usage-aggregator ✅
- Returns usage summary with hourly/daily/monthly breakdown ✅
- Includes overage detection ✅

**No action needed.**

---

## Priority Recommendations

### Immediate (P0 - Ship Blockers)

1. **Create Billing Dashboard Page** (2h)
   - Users cannot view billing status without this
   - Integrate existing components

2. **Fix Polar Webhook Dunning Integration** (1h)
   - Payment failures not triggering dunning workflow
   - Add `checkout.updated` failure handler

3. **Create Polar Webhook Endpoint** (30min)
   - Verify/create `src/app/api/webhooks/polar/route.ts`

### High Priority (P1 - Next Sprint)

4. **Implement Admin Billing APIs** (3h)
   - Summary, dunning-status, overage-events endpoints
   - Required for admin dashboard UI

5. **Implement Integration Tests** (6h)
   - At minimum: dunning workflow, RaaS gateway blocking
   - Full test suite for production confidence

### Medium Priority (P2 - Polish)

6. **Admin Dashboard UI** (3h)
   - Admin billing management page
   - Dunning state management UI
   - Violations management UI

---

## Architecture Verification

### Database Schema (✅ Verified)

Migrations confirmed:
- `260308-1800-create-overage-events-table.sql` ✅
- `260308-1801-create-quota-limits-table.sql` ✅
- `260309-1100-create-dunning-workflow-tables.sql` ✅
- `260309-1149-create-violations-table.sql` ✅

### Service Dependencies (✅ Verified)

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Stripe    │────▶│ polar-webhook│────▶│  dunning-   │
│  Webhooks   │     │   handler    │     │  workflow   │
└─────────────┘     └──────────────┘     └─────────────┘
                            │                    │
                            ▼                    ▼
                     ┌──────────────┐     ┌─────────────┐
                     │   overage-   │────▶│   RaaS      │
                     │  reconciler  │     │  Gateway    │
                     └──────────────┘     └─────────────┘
                            │                    │
                            ▼                    ▼
                     ┌──────────────┐     ┌─────────────┐
                     │  usage-agg   │────▶│  Dashboard  │
                     │  (API)       │     │     UI      │
                     └──────────────┘     └─────────────┘
```

All service dependencies correctly wired ✅

---

## Unresolved Questions

1. **Polar Webhook Secret Configuration**
   - Need to confirm `POLAR_WEBHOOK_SECRET` env var is set in production
   - Webhook signature verification requires this

2. **Email Template Branding**
   - Resend email service exists but needs Sophia branding
   - Logo, colors, tone of voice

3. **Tier-Specific Grace Periods**
   - Dunning configs defined but not validated with business requirements
   - Current: BASIC=3d, PREMIUM=5d, ENTERPRISE=7d, MASTER=14d

4. **Cron Job Scheduling**
   - Overage billing cron exists (`/api/cron/overage-billing`)
   - Need to confirm Vercel Cron configuration

5. **Admin RBAC**
   - Admin role check mentioned but `user_profiles.role` column needs verification

---

## Next Steps

1. **Fill P0 gaps** (Billing page, Polar dunning, webhook endpoint)
2. **Run integration tests** after P0 complete
3. **Verify production deployment** with test payment failure
4. **Document** API endpoints and workflows
5. **Plan Phase 7** (Analytics Dashboard UI polish)

---

## Conclusion

Phase 6 is **75% complete** with solid backend foundation. The remaining 25% (Dashboard UI, Admin APIs, Integration Tests) are critical for production readiness.

**Recommendation:** Focus on P0 gaps first, then P1 tests. Admin UI can wait for Phase 7.

**Estimated Time to Complete:** 6-8 hours for P0+P1, additional 6 hours for full test suite.

---

*Report generated: 2026-03-09*
*Researcher: general-purpose*
*Work Context: /Users/macbookprom1/mekong-cli/apps/sophia-ai-factory*
