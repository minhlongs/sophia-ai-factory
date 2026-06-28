---
title: "Usage Metering Data Collection & Aggregation Pipeline"
description: "3-phase implementation: hourly/daily roll-up jobs, API gateway instrumentation, CRM customer linkage"
status: pending
priority: P1
effort: 8h
branch: main
tags: [usage-metering, cron, aggregation, api-gateway, polar-integration]
created: 2026-03-07
---

# Usage Metering Pipeline - Implementation Plan

## Overview

Build complete usage metering pipeline with 3 phases:
1. **Hourly/Daily Roll-up Jobs** - Automated aggregation via Vercel Cron
2. **API Gateway Instrumentation** - Middleware tracking all requests (including 429s)
3. **CRM Customer Linkage** - Ensure Polar webhook stores customer IDs for reconciliation

---

## Current State Summary

### What Exists (2026-03-07)
- `src/lib/usage-metering/` - Core tracking library (tracker.ts, aggregator.ts, types.ts)
- `src/lib/raas-gate.ts` - RaaS license validation middleware
- `src/lib/payments/polar-webhook-handler.ts` - Webhook processor (stores `polar_customer_id` in `raas_licenses.metadata`)
- `src/proxy.ts` - Global middleware (has RaaS gate, rate limiting)
- DB schema: `usage_events` table with `idempotency_key`, `external_customer_id`, `resource_type` columns
- DB schema: `raas_licenses` table with `polar_customer_id`, `polar_subscription_id` columns

### Gaps Identified
1. No automated roll-up jobs (hourly/daily aggregation)
2. API gateway doesn't emit usage events for rate-limited (429) requests
3. Customer linkage works but needs verification in production

---

## Phase 1: Hourly/Daily Roll-up Jobs

**Goal:** Automated cron jobs to aggregate `usage_events` → `usage_hourly_summary` → `usage_daily_summary`

### Files to Create

| File | Purpose | Complexity |
|------|---------|------------|
| `src/app/api/cron/hourly-rollup/route.ts` | Vercel Cron endpoint for hourly aggregation | Medium |
| `src/app/api/cron/daily-rollup/route.ts` | Vercel Cron endpoint for daily aggregation | Medium |
| `src/lib/usage-metering/rollup-service.ts` | Core rollup logic (extracted from aggregator) | Medium |
| `supabase/migrations/20260307-create-usage-summary-tables.sql` | Create `usage_hourly_summary`, `usage_daily_summary` tables | Simple |
| `src/lib/usage-metering/rollup-service.test.ts` | Unit tests for rollup logic | Medium |

### Files to Modify

| File | Change | Reason |
|------|--------|--------|
| `src/lib/usage-metering/index.ts` | Export new rollup functions | Public API |
| `vercel.json` | Add cron job configurations | Schedule hourly/daily jobs |

### Implementation Steps

1. **Create summary tables migration**
   - `usage_hourly_summary` table (hour_timestamp, license_nonce, service_name, total_credits, total_requests, etc.)
   - `usage_daily_summary` table (day_timestamp, license_nonce, service_name, total_credits, total_requests, etc.)
   - Add composite indexes for efficient querying

2. **Build rollup service**
   - `rollupHourlyUsage(startTimestamp, endTimestamp)` - aggregate events into hourly windows
   - `rollupDailyUsage(dayTimestamp)` - aggregate hourly summaries into daily windows
   - Use upsert (INSERT ... ON CONFLICT) for idempotent rollups
   - Track rollup progress/metadata in separate table

3. **Create API endpoints**
   - `POST /api/cron/hourly-rollup` - rollup last hour's events
   - `POST /api/cron/daily-rollup` - rollup yesterday's summaries
   - Add secret-based authentication (Vercel Cron secret header)

4. **Configure Vercel Cron**
   - Hourly job: `0 * * * *` (at minute 0)
   - Daily job: `0 0 * * *` (midnight UTC)
   - Add cron secrets to environment variables

### Success Criteria

- [ ] Migration creates `usage_hourly_summary` and `usage_daily_summary` tables with indexes
- [ ] Rollup service correctly aggregates events (tested with mock data)
- [ ] Cron endpoints require valid `Authorization: Bearer $CRON_SECRET`
- [ ] Vercel Cron configured in `vercel.json` with correct schedules
- [ ] Rollups are idempotent (running twice produces same result)
- [ ] Tests pass: rollup service unit tests + integration tests

### Estimated Complexity: **3h**

---

## Phase 2: API Gateway Instrumentation

**Goal:** Track ALL requests (including 429 rate-limited) with usage events for quota tracking

### Files to Create

| File | Purpose | Complexity |
|------|---------|------------|
| `src/lib/usage-metering/gateway-instrumentation.ts` | Middleware helper to emit usage events | Medium |
| `src/lib/usage-metering/gateway-instrumentation.test.ts` | Tests for gateway instrumentation | Medium |

### Files to Modify

| File | Change | Reason |
|------|--------|--------|
| `src/lib/raas-gate.ts` | Call `emitUsageEvent()` after RaaS validation | Track API access |
| `src/proxy.ts` | Add usage instrumentation after rate limiting | Track 429s |
| `src/lib/security/rate-limiting-middleware.ts` | Emit usage event when rate limit exceeded | Track rate-limited requests |

### Implementation Steps

1. **Build gateway instrumentation helper**
   - `emitUsageEvent(request, response, userId, licenseInfo)` - emit event for any API request
   - Track: endpoint, method, status code, response time, rate limit hits
   - Special handling for 429 responses (still count against quota)

2. **Integrate with RaaS gate**
   - After `raasGate()` validates, extract `tier` from result
   - Call `emitUsageEvent()` with license tier info
   - Handle async emission (don't block response)

3. **Integrate with rate limiter**
   - When `checkRateLimit()` returns `success: false`
   - Emit usage event with `status: 429`, `action: 'rate_limited'`
   - Track rate limit events separately for analytics

4. **Add configuration**
   - `USAGE_METERING_ENABLED=true` env var to toggle
   - `USAGE_METERING_EXCLUDED_ENDPOINTS` comma-separated list
   - `USAGE_METERING_SAMPLE_RATE` (0-1) for high-volume endpoints

### Success Criteria

- [ ] All API requests (including 429s) create `usage_events` records
- [ ] RaaS gate integration extracts tier and tracks usage
- [ ] Rate limiter emits events when blocking requests
- [ ] No response time degradation (<50ms overhead per request)
- [ ] Gateway instrumentation tests pass (mock requests)
- [ ] Debug endpoint shows recent gateway events

### Estimated Complexity: **2.5h**

---

## Phase 3: CRM Customer Linkage

**Goal:** Ensure `polar-webhook-handler.ts` stores customer IDs correctly for `resolveExternalCustomerId()` queries

### Files to Modify

| File | Change | Reason |
|------|--------|--------|
| `src/lib/payments/polar-webhook-handler.ts` | Store `polar_customer_id` in BOTH `raas_licenses` columns AND `metadata` JSON | Dual storage for backward compatibility |
| `src/lib/usage-metering/tracker.ts` | Add debug logging for customer resolution | Troubleshooting |
| `src/app/api/admin/usage/customer-linkage/route.ts` | Admin endpoint to audit/fix linkage | Data reconciliation |

### Implementation Steps

1. **Audit current webhook handler**
   - Verify `generateLicenseOnPayment()` stores `polarCustomerId` in:
     - `raas_licenses.polar_customer_id` (column)
     - `raas_licenses.metadata.polar_customer_id` (JSON field)
   - Check `handleCheckoutSuccess()`, `handleSubscriptionCreated()`, `handleOrderCreated()`

2. **Fix any gaps**
   - Ensure all payment success handlers store customer IDs in BOTH places
   - Add migration to backfill `polar_customer_id` column from `metadata` JSON

3. **Add customer linkage audit endpoint**
   - `GET /api/admin/usage/customer-linkage` - show licenses missing customer IDs
   - `POST /api/admin/usage/customer-linkage/fix` - backfill missing IDs from Polar API
   - Admin-only (Basic Auth required)

4. **Add debug logging**
   - `resolveExternalCustomerId()` logs when called
   - Log resolution source (column vs metadata)
   - Log failures for troubleshooting

### Success Criteria

- [ ] All payment webhook handlers store `polar_customer_id` in column AND metadata
- [ ] Migration backfills existing records from metadata to column
- [ ] `resolveExternalCustomerId()` finds customer ID for 100% of paid licenses
- [ ] Admin endpoint shows 0 licenses missing customer linkage
- [ ] Debug logging helps troubleshoot resolution failures
- [ ] Integration tests verify customer linkage end-to-end

### Estimated Complexity: **2.5h**

---

## Dependencies & Risks

### Dependencies
| Item | Impact | Mitigation |
|------|--------|------------|
| Vercel Cron availability | Phase 1 requires Vercel Cron (paid feature) | Fallback: GitHub Actions scheduled workflow |
| Polar webhook delivery | Phase 3 depends on Polar sending webhooks | Manual backfill script for missing data |
| Database performance | Rollup queries on large `usage_events` table | Add indexes, limit query windows |

### Risks
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Rollup job timeout (Vercel 10s limit) | Medium | High | Use batching, track progress, allow resumption |
| Duplicate rollups (cron runs twice) | Low | Medium | Idempotent upsert with unique constraints |
| Rate limit instrumentation slows API | Low | Medium | Async event emission, buffer batching |
| Customer ID not in webhook payload | Low | High | Fallback: query Polar API by subscription ID |

---

## Testing Strategy

### Unit Tests
- Rollup service: aggregation logic, edge cases (empty windows, DST)
- Gateway instrumentation: event emission, 429 handling
- Customer linkage: resolution from column vs metadata

### Integration Tests
- Cron endpoints: invoke with test data, verify summaries created
- Gateway: mock API requests, verify events in database
- Webhook: replay Polar events, verify customer IDs stored

### Load Tests
- Rollup: process 10K events in single run
- Gateway: 100 req/s sustained, measure overhead
- Customer resolution: batch lookup 1K licenses

---

## Unresolved Questions

1. **Vercel Cron vs GitHub Actions**: Which scheduler to use? Vercel Cron is simpler but requires Pro plan. GitHub Actions is free but more complex.

2. **Rollup retention**: How long to keep hourly/daily summaries? 1 year? Indefinite?

3. **Gateway sampling**: Should high-volume endpoints use sampling (e.g., track 10% of requests) to reduce database writes?

4. **Customer linkage backfill**: For existing licenses without customer IDs, should we query Polar API to backfill, or accept historical gap?

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Rollup completeness | 100% of hours/days | Count gaps in summary tables |
| Gateway coverage | 100% of API requests | Compare `usage_events` count to access logs |
| Customer linkage rate | 95%+ of paid licenses | Audit endpoint report |
| API overhead | <50ms per request | P95 latency comparison before/after |
| Cron reliability | 99.9% on-time execution | Vercel Cron dashboard / GitHub Actions logs |

---

## Related Files

- **Existing:** `src/lib/usage-metering/`, `src/lib/raas-gate.ts`, `src/lib/payments/polar-webhook-handler.ts`
- **Reports:** `plans/reports/summary-usage-metering-implementation-260307.md`
- **Schema:** `supabase/migrations/20260307-usage-metering-schema-updates.sql`
