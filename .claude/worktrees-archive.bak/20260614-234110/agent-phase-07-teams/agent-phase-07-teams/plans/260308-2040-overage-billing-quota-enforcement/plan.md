---
title: "Phase 6: Overage Billing & Quota Enforcement - Implementation Plan"
description: "Complete implementation plan for overage billing, quota enforcement, and analytics dashboard integration"
status: pending
priority: P1
effort: 8h
branch: main
tags: [billing, quota, overage, analytics, phase-6]
created: 2026-03-08
---

# Phase 6: Overage Billing & Quota Enforcement

## Executive Summary

Hệ thống overage billing và quota enforcement đã có sẵn **~90% functionality**. Plan này tập trung hoàn thiện 10% còn lại:

1. **Admin API endpoints** đã có nhưng cần enhancement
2. **Analytics dashboard** cần admin page để hiển thị metrics
3. **Audit logging** cần bổ sung violation-specific events
4. **Testing & verification** cho toàn bộ flow

## Current State Analysis

### ✅ Completed Components (90%)

| Component | Files | Status |
|-----------|-------|--------|
| **Quota Core** | `lib/quota/quota-checker.ts`, `quota-enforcer.ts`, `overage-logger.ts` | ✅ Complete |
| **RaaS Gateway** | `lib/raas-gate.ts`, `lib/raas-service.ts` | ✅ Complete |
| **Polar Integration** | `lib/payments/polar-webhook-handler.ts`, `polar-subscription-service.ts` | ✅ Complete |
| **UI Components** | `components/quota/quota-usage-dashboard.tsx`, `analytics/*` | ✅ Complete |
| **User APIs** | `GET /api/quota/overage-events`, `GET /api/quota/status` | ✅ Complete |
| **Admin APIs** | `POST /api/admin/quota/adjust`, `GET /api/admin/quota/overage-summary`, `POST /api/admin/quota/mark-billable` | ✅ Complete |
| **Cron Jobs** | `api/cron/overage-billing/route.ts` | ✅ Complete |
| **Database** | `overage_events`, `quota_limits` tables | ✅ Complete |

### ⚠️ Gaps Identified (10%)

| Gap | Description | Priority | Effort |
|-----|-------------|----------|--------|
| **G1** | Admin analytics page UI | HIGH | 2h |
| **G2** | Violation audit logger enhancement | MEDIUM | 1h |
| **G3** | Integration tests for full flow | HIGH | 2h |
| **G4** | Documentation & runbooks | MEDIUM | 1h |
| **G5** | Alert system for critical overages | LOW | 2h |

## Implementation Phases

### Phase 1: Admin Analytics Dashboard UI (HIGH Priority)

**Goal:** Tạo admin page để hiển thị overage metrics, quota utilization, và billing summary.

#### Tasks

1. **Create Admin Analytics Page**
   - File: `src/app/[locale]/(admin)/admin/analytics/page.tsx`
   - Components:
     - `QuotaGauge` (existing) - Reuse for overall utilization
     - `UsageChart` (existing) - Show usage trends
     - `OverageEventsTable` (new) - List recent overage events
     - `BillingSummary` (new) - Show billable overages, estimated revenue
   - API calls:
     - `GET /api/admin/quota/overage-summary` - Fetch global summary
     - `GET /api/analytics/usage` - Fetch usage trends
     - `GET /api/analytics/licenses` - Fetch license metrics

2. **Enhance Existing Components**
   - File: `src/components/analytics/UsageChart.tsx`
     - Add overage events overlay
     - Add billing projection line
   - File: `src/components/analytics/LicenseMetricsTable.tsx`
     - Add quota utilization column
     - Add overage count column

3. **Add Navigation**
   - File: `src/app/[locale]/(admin)/admin/layout.tsx`
     - Add "Analytics" link to admin sidebar
   - File: `src/app/[locale]/(admin)/admin/admin-sidebar.tsx`
     - Highlight active nav item

**Success Criteria:**
- Admin analytics page accessible at `/admin/analytics`
- Displays real-time quota utilization
- Shows overage events with billable flags
- Displays billing summary with estimated revenue
- Responsive design, matches existing admin UI

---

### Phase 2: Audit Logging Enhancement (MEDIUM Priority)

**Goal:** Bổ sung violation-specific audit events cho compliance reporting.

#### Tasks

1. **Create Violation Audit Logger**
   - File: `src/lib/audit/violation-logger.ts`
   - Functions:
     - `logQuotaViolation()` - Log quota exceeded events
     - `logThrottlingEvent()` - Log rate limiting events
     - `logBillingEvent()` - Log overage billing events
     - `getViolationHistory()` - Fetch violation history for audit
   - Database: Extend `audit_logs` table với new event types

2. **Integrate with Quota Enforcer**
   - File: `src/lib/quota/quota-enforcer.ts`
     - Call `logQuotaViolation()` when quota exceeded
     - Include context: IP, user agent, endpoint, tier

3. **Integrate with RaaS Gate**
   - File: `src/lib/raas-gate.ts`
     - Call `logThrottlingEvent()` when request blocked
     - Link to existing receipt logging

**Success Criteria:**
- All quota violations logged to `audit_logs`
- Admin can query violation history via API
- Compliance reports include violation data
- Zero performance impact on request path

---

### Phase 3: Integration Testing (HIGH Priority)

**Goal:** Viết integration tests cho toàn bộ overage billing flow.

#### Tasks

1. **Quota Enforcement Tests**
   - File: `src/lib/quota/quota-enforcer.test.ts`
   - Test cases:
     - `should allow requests under quota`
     - `should block requests when quota exceeded (fail-closed)`
     - `should allow overage when enableOverageBilling=true`
     - `should log overage event when exceeded`
     - `should return 429 with retry-after header`

2. **Overage Logger Tests**
   - File: `src/lib/quota/overage-logger.test.ts`
   - Test cases:
     - `should buffer events for batch write`
     - `should flush buffer on timer`
     - `should handle immediate logging`
     - `should retry on DB error`

3. **Admin API Tests**
   - File: `src/app/api/admin/quota/overage-summary/route.test.ts`
   - File: `src/app/api/admin/quota/mark-billable/route.test.ts`
   - File: `src/app/api/admin/quota/adjust/route.test.ts`
   - Test cases:
     - Authentication required
     - Valid request/response
     - Invalid input handling
     - Audit logging

4. **End-to-End Flow Test**
   - File: `tests/integration/overage-billing-flow.test.ts`
   - Scenario:
     1. User makes requests until quota exceeded
     2. Overage event logged
     3. Cron job marks event as billable
     4. Admin API shows billing summary
     5. Polar webhook triggers license update

**Success Criteria:**
- All unit tests pass (>90% coverage)
- Integration tests pass
- E2E flow test passes
- Tests run in CI/CD pipeline

---

### Phase 4: Documentation & Runbooks (MEDIUM Priority)

**Goal:** Tạo documentation cho ops team và customers.

#### Tasks

1. **Internal Runbook**
   - File: `docs/runbooks/overage-billing-ops.md`
   - Contents:
     - How to monitor overage events
     - How to adjust quota limits
     - How to handle billing disputes
     - Escalation procedures

2. **API Documentation**
   - File: `docs/api/quota-api.md`
   - Contents:
     - `/api/quota/overage-events` - User overage events
     - `/api/quota/status` - Quota status
     - `/api/admin/quota/*` - Admin endpoints
     - Request/response examples

3. **Customer FAQ**
   - File: `docs/faq/quota-billing.md`
   - Contents:
     - How quota limits work
     - What happens when I exceed quota
     - How overage billing works
     - How to upgrade tier

**Success Criteria:**
- Ops team can manage overage billing
- API docs complete with examples
- Customer FAQ answers common questions

---

### Phase 5: Alert System (LOW Priority - Optional)

**Goal:** Thêm alert system cho critical overages.

#### Tasks

1. **Alert Configuration**
   - File: `src/lib/alerts/overage-alerts.ts`
   - Triggers:
     - User exceeds 100% quota
     - User has >10 overage events in 1 hour
     - Total billable overages > $100/day

2. **Notification Channels**
   - Telegram: Send alert to admin Telegram bot
   - Email: Send email digest to billing team
   - Slack: Post to #billing-alerts channel

3. **Alert Dashboard**
   - File: `src/app/[locale]/(admin)/admin/alerts/page.tsx`
   - Show active alerts, alert history, acknowledge alerts

**Success Criteria:**
- Alerts triggered on configured thresholds
- Notifications sent to configured channels
- Admin can view and acknowledge alerts

---

## File Structure

```
apps/sophia-ai-factory/
├── src/
│   ├── app/
│   │   ├── [locale]/(admin)/admin/analytics/
│   │   │   └── page.tsx                    # NEW: Admin analytics page
│   │   └── api/
│   │       └── admin/quota/
│   │           ├── adjust/route.ts         # EXISTING
│   │           ├── overage-summary/route.ts # EXISTING
│   │           └── mark-billable/route.ts   # EXISTING
│   ├── components/
│   │   ├── analytics/
│   │   │   ├── UsageChart.tsx              # ENHANCE: Add overage overlay
│   │   │   └── LicenseMetricsTable.tsx     # ENHANCE: Add utilization columns
│   │   └── quota/
│   │       └── quota-usage-dashboard.tsx   # EXISTING
│   └── lib/
│       ├── audit/
│       │   └── violation-logger.ts         # NEW: Violation-specific logging
│       └── quota/
│           ├── quota-checker.ts            # EXISTING
│           ├── quota-enforcer.ts           # EXISTING
│           └── overage-logger.ts           # EXISTING
├── tests/
│   └── integration/
│       └── overage-billing-flow.test.ts    # NEW: E2E flow test
└── docs/
    ├── runbooks/
    │   └── overage-billing-ops.md          # NEW: Ops runbook
    ├── api/
    │   └── quota-api.md                    # NEW: API docs
    └── faq/
        └── quota-billing.md                # NEW: Customer FAQ
```

---

## Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| Supabase database | External | ✅ Available |
| Polar.sh webhooks | External | ✅ Available |
| RaaS Gateway | Internal | ✅ Available |
| Usage metering | Internal | ✅ Available |
| Admin authentication | Internal | ✅ Available |

---

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Polar API rate limits | HIGH | LOW | Implement caching, batch requests |
| DB performance under load | MEDIUM | MEDIUM | KV caching already implemented |
| Billing calculation errors | HIGH | LOW | Unit tests, manual verification |
| Alert fatigue | LOW | MEDIUM | Configurable thresholds, digest mode |

---

## Testing Strategy

### Unit Tests
- Quota checker logic
- Overage logger buffering
- Billing calculations
- Audit logging

### Integration Tests
- RaaS gate middleware
- Admin API endpoints
- Polar webhook handling
- Cron job execution

### E2E Tests
- Full overage billing flow
- User quota exceeded → overage logged → billing triggered
- Admin adjusts quota → user quota updated

### Manual Testing
- Admin analytics page UI
- Quota gauges and charts
- Alert notifications

---

## Success Criteria (Definition of Done)

### Functional
- [ ] Admin analytics page displays real-time quota data
- [ ] Overage events logged and displayed correctly
- [ ] Billing summary shows accurate calculations
- [ ] Audit trail captures all violation events
- [ ] Integration tests pass (>90% coverage)

### Non-Functional
- [ ] Quota check latency <10ms (with KV caching)
- [ ] Admin API response time <100ms
- [ ] No performance degradation under load
- [ ] All error scenarios handled gracefully

### Documentation
- [ ] API documentation complete
- [ ] Ops runbook published
- [ ] Customer FAQ available
- [ ] Code comments for complex logic

---

## Timeline Estimate

| Phase | Effort | Dependencies |
|-------|--------|--------------|
| Phase 1: Admin Analytics UI | 2h | Existing components |
| Phase 2: Audit Enhancement | 1h | Phase 1 complete |
| Phase 3: Integration Testing | 2h | Phase 1-2 complete |
| Phase 4: Documentation | 1h | Phase 3 complete |
| Phase 5: Alert System | 2h | Optional |
| **Total** | **8h** (6h without Phase 5) | |

---

## Unresolved Questions

1. **Alert thresholds:** Cần xác định ngưỡng cụ thể cho alert system (Phase 5)?
2. **Billing周期:** Overage billing chu kỳ nào (daily/weekly/monthly)?
3. **Price per credit:** Giá mỗi overage credit cho từng tier?
4. **Stripe support:** Có cần support Stripe usage billing không, hay chỉ Polar?

---

## Related Documents

- Existing Report: `plans/reports/fullstack-developer-260308-1944-overage-billing-verification.md`
- Database Schema: `supabase/migrations/260308-1800-create-overage-events-table.sql`
- Quota Schema: `supabase/migrations/260308-1801-create-quota-limits-table.sql`
- Polar Webhooks: `src/lib/payments/polar-webhook-handler.ts`
- Quota Checker: `src/lib/quota/quota-checker.ts`
