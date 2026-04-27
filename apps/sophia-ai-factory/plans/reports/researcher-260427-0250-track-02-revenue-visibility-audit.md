# Sophia AI Factory — Revenue Visibility Audit

**Audit Date:** 2026-04-27 02:50 UTC  
**Scope:** Production revenue tracking, payment data queryability, affiliate conversion visibility  
**Status:** STATIC ANALYSIS ONLY — Read-only investigation

---

## Executive Summary

**Core Finding:** Sophia has **2 disconnected DB layers** (Supabase + Cloudflare D1) with **INCOMPLETE revenue linkage**.

- ✅ **Payment receipt layer** exists: NOWPayments IPN webhook → `payment_events` table (D1)
- ✅ **Admin endpoints** exist: `/api/admin/billing/summary` (auth-gated, Basic Auth required)
- ✅ **Revenue query endpoint** exists: `/api/analytics/revenue` (ENTERPRISE+ tier required, auth-required)
- ❌ **NO conversion tracking** from generated videos to affiliate product clicks
- ❌ **Campaign ↔ Affiliate link** relationship NOT implemented (tables exist, schema not connected)
- ❌ **raas_licenses table** referenced in code but **ONLY defined in Supabase** (not in D1 migrations)

**Answer to "Did customer X earn revenue?":**
- Can verify: "Did customer X make a payment?" (via `payment_events` + `user_profiles.subscription_tier`)
- Cannot verify: "Did customer X's affiliate video generate conversions?" (no tracking table)
- Cannot verify: "What is Sophia's MRR today?" (queries reference `raas_licenses` which doesn't exist in D1 schema)

---

## DB Schema Snapshot

### Payment Layer (D1 / Cloudflare)

| Table | Columns | Purpose | Status |
|-------|---------|---------|--------|
| `payment_events` | `id, event_id, event_type, payload, processed, created_at` | NOWPayments IPN audit trail | ✅ Implemented |
| `user_profiles` | `user_id, subscription_tier ('free'\|'pro'\|'enterprise'), created_at` | User tier tracking | ✅ Implemented |
| `campaigns` | `id, user_id, status, video_url, created_at` | Video generation tracking | ✅ Implemented |
| `raas_api_keys` (D1) | `id, key_id, owner_id, created_at, expires_at` | API key audit | ✅ Implemented |

### Missing/Incomplete Links (Supabase Only)

| Table | Columns | Purpose | Status |
|-------|---------|---------|--------|
| `raas_licenses` | `nonce, tier, is_revoked, created_at, created_by` | **Code references this** for MRR calc (revenue-nowpayments.ts:122-124) | ❌ **NOT in D1 migrations** |
| `affiliate_products` | `network_id, title, affiliate_link, commission_rate` | Product intelligence | ✅ Supabase only |
| `user_integrations` | `user_id, network_id, api_key` | ClickBank/ShareASale keys | ✅ Supabase only |

**Critical Gap:** Code queries `raas_licenses` from D1, but table doesn't exist in `/migrations/` directory. Suggests **schema drift or incomplete migration**.

---

## Admin Endpoints (Public-Facing)

### Authentication

All admin endpoints require **Basic Auth** header:
```bash
Authorization: Basic base64(ADMIN_USER:ADMIN_PASS)
```
Credentials stored in env: `ADMIN_USER`, `ADMIN_PASS` (not documented which env file)  
Middleware: `src/app/api/admin/middleware.ts:23-26`

### Revenue Query Endpoint

**Endpoint:** `GET /api/admin/billing/summary`  
**Location:** `src/app/api/admin/billing/summary/route.ts:14-37`  
**Auth:** Basic Auth (admin credentials)  
**Query Params:** None  
**Response:**
```json
{
  "mrr": number,          // Calculated from dunning_settings
  "currency": "USD",
  "dunningStates": {
    "current": count,
    "past_due": count,
    "delinquent": count,
    "suspended": count
  },
  "unbilledOverageTotal": cents,
  "activeLicensesCount": number,
  "licensesWithIssues": number,
  "generatedAt": ISO timestamp
}
```
**Data Sources:** Query joins `dunning_settings` + `overage_events` (NOT `raas_licenses`)

### License Management Endpoint

**Endpoint:** `GET /api/admin/licenses?tier=PREMIUM&status=active&page=1&limit=20`  
**Location:** `src/app/api/admin/licenses/route.ts:27-60`  
**Auth:** Basic Auth  
**Query Params:** `tier` | `search` | `status` | `page` | `limit`  
**Response:** Paginated license list (calls `getLicenses()` from `@/lib/raas-audit`)

---

## Revenue Queryability

### Current Tier Tracking (USER PERSPECTIVE)

**User Dashboard:** `src/app/[locale]/dashboard/`  
**Component:** `src/app/actions/admin.ts:22-71` (`getAdminStats()`)  
**Queries:**
1. Count campaigns by status
2. Sum `payment_events.payload.amount` where `processed = 1`
3. Count unique users

**What it calculates:**
```typescript
const totalRevenue = payments.reduce((sum, p) => {
  const payload = JSON.parse(p.payload);
  return sum + (payload?.data?.amount || 0);  // Extracts amount from NOWPayments IPN
}, 0);
```

### Public Revenue API (ENTERPRISE+ ONLY)

**Endpoint:** `GET /api/analytics/revenue?period=30d`  
**Location:** `src/app/api/analytics/revenue/route.ts:36-103`  
**Auth:** Session cookie (via `getCurrentUser()`)  
**RBAC:**
- BASIC/PREMIUM: 403 (access denied)
- ENTERPRISE/MASTER/Admin: 200 (full data)

**Implementation:** `src/lib/analytics/queries/revenue-nowpayments.ts:113-180`  
**Query Logic:**
1. **MRR Calculation:** Queries `raas_licenses` (active, non-revoked) × tier price
2. **30d Trend:** Sums `payment_events` by day, parses `payload.pay_amount`
3. **MRR Growth %:** Compare current period MRR vs. prior-period MRR

**Result Shape:**
```json
{
  "arr": number,           // Annual Recurring Revenue
  "mrr": number,           // Monthly Recurring Revenue (in dollars)
  "mrrGrowthPct": number,  // % change vs. prior period
  "byTier": [
    { "tier": "BASIC", "customers": n, "mrr": $, "arr": $ },
    ...
  ],
  "trend30d": [
    { "date": "YYYY-MM-DD", "mrr": $, "arr": $ },
    ...
  ],
  "periodStart": ISO,
  "periodEnd": ISO,
  "metadata": { "queriedAt": ISO, "period": "30d", "isAdmin": bool }
}
```

---

## NOWPayments IPN Webhook Handler

**Endpoint:** `POST /api/webhooks/nowpayments`  
**Location:** `src/app/api/webhooks/nowpayments/route.ts:16-70`  
**Signature Verification:** HMAC-SHA512 against `x-nowpayments-sig` header  
**Secret:** `NOWPAYMENTS_IPN_SECRET` env var  

**Processing Flow:**
1. Verify signature (line 31)
2. Parse IPN payload (line 40)
3. Call `processNowPaymentsIpn(ipn)` handler (line 50)
4. **On success:** Emit `tier_upgraded` event + track `PAYMENT_SUCCESS` + `TIER_CONVERSION` (lines 62-66)

**Database Write:** IPN data stored in `payment_events` table (idempotent by `polar_event_id` unique constraint)

**Audit:** IPN receives are logged. **Has webhook ever been confirmed to receive REAL production payment?** UNKNOWN — requires prod logs query.

---

## Affiliate/Campaign Tracking Gap

### What Exists

**Affiliate Product Database:**
- `affiliate_products` table (Supabase): ClickBank/ShareASale/Amazon products indexed
- `user_integrations` table (Supabase): User's affiliate network API keys stored
- `campaigns` table (D1): User-created video campaigns tracked

### What's Missing

**No conversion tracking pipeline:**
- ❌ No table linking `campaigns` → `affiliate_products` (which products promoted in each campaign?)
- ❌ No table tracking clicks from videos → affiliate links (how many clicks per campaign?)
- ❌ No table tracking conversions → earnings (which campaigns generated revenue?)
- ❌ No webhook handler to ingest affiliate network conversion data (ClickBank/ShareASale callbacks)
- ❌ Code references `production-cost-calculator.tsx` shows UI mock of "affiliate conversion rate" (2% default) but no backend implementation

**Result:** Cannot answer: "Did customer X's video generate affiliate conversions?"

---

## CEO Revenue Query — Executable Commands

### Query 1: "How much revenue paid TODAY?"

```bash
# Endpoint: /api/analytics/revenue?period=30d
# Auth: Admin user (MASTER tier)
curl -X GET "https://sophia.agencyos.network/api/analytics/revenue?period=30d" \
  -H "Cookie: session=<session_cookie>" \
  -H "Content-Type: application/json"

# Response: { "arr": X, "mrr": Y, "mrrGrowthPct": Z, ... }
```

### Query 2: "How many paying customers?"

```bash
# Endpoint: /api/admin/billing/summary
# Auth: Basic Auth (ADMIN_USER:ADMIN_PASS)
CREDS=$(echo -n "$ADMIN_USER:$ADMIN_PASS" | base64)
curl -X GET "https://sophia.agencyos.network/api/admin/billing/summary" \
  -H "Authorization: Basic $CREDS"

# Response: { "activeLicensesCount": N, "dunningStates": {...}, ... }
```

### Query 3: "Which users completed campaigns?"

```bash
# Raw SQL (requires DB access):
SELECT 
  u.user_id,
  u.subscription_tier,
  COUNT(c.id) as completed_campaigns,
  MAX(c.updated_at) as last_campaign_date
FROM user_profiles u
LEFT JOIN campaigns c ON u.user_id = c.user_id AND c.status = 'completed'
WHERE u.subscription_tier IN ('pro', 'enterprise')
GROUP BY u.user_id
ORDER BY completed_campaigns DESC;
```

### Query 4: "Has NOWPayments webhook received ANY real payments?" (BLOCKED)

```bash
# Direct D1 query to payment_events table:
SELECT COUNT(*) as total_payments, 
       COUNT(DISTINCT payload) as unique_payments
FROM payment_events
WHERE processed = 1
  AND created_at >= date('now', '-30 days');

# Status: CANNOT EXECUTE — requires direct DB access (not exposed via API)
# Alternative: Check server logs for "[NOWPayments Webhook] IPN processing failed/success" entries
```

---

## Critical Findings

| Finding | Impact | Evidence |
|---------|--------|----------|
| `raas_licenses` table **not in D1** | **CRITICAL** — `/api/analytics/revenue` will fail if executed (queries undefined table) | `src/lib/analytics/queries/revenue-nowpayments.ts:122-124` references table not in `migrations/` |
| No affiliate conversion tracking | Medium — Can't verify if video campaigns → affiliate earnings | Supabase schema has `affiliate_products`, D1 schema has `campaigns`, but **no linking table** |
| NOWPayments IPN undocumented in prod | Medium — Unknown if webhook ever fired successfully | Handler exists, but production webhook delivery status unknown |
| Admin endpoint auth via env vars | Low — ADMIN_USER/ADMIN_PASS must be set, not documented | `src/app/api/admin/middleware.ts:19-22` |
| MRR calculation uses hardcoded tiers | Low — Tier pricing hardcoded, not derived from config | `src/app/api/admin/billing/summary/billing-summary-query.ts:62-67` |

---

## Recommended Next Steps (CEO/Finance)

1. **Verify DB migration state:** Run `SELECT * FROM raas_licenses LIMIT 1` in production. If fails, schema drift exists.
2. **Check webhook delivery:** Query server logs for NOWPayments IPN success/failure patterns since 2026-02-01.
3. **Confirm first paying customer:** Query `payment_events WHERE processed = 1` — if empty, no real payment received yet.
4. **Implement affiliate tracking (Phase 2):**
   - Create `campaign_affiliate_links` junction table linking `campaigns.id` → `affiliate_products.id`
   - Implement ClickBank/ShareASale webhook ingestors
   - Expose `/api/admin/campaigns/conversion-summary` for campaign-level earnings

---

## Unresolved Questions

1. Has the NOWPayments IPN webhook ever received a real production payment? (No API to query this without direct DB access)
2. What is the current D1 migration baseline? Is `raas_licenses` supposed to exist or is code incorrect?
3. Are `payment_events` records being inserted correctly, or is IPN signature verification failing silently?
4. Why does UI dashboard (`/admin/page.tsx:52-61`) show "Revenue" stat, but calculation is ad-hoc in `getAdminStats()` rather than via `/api/analytics/revenue`?
