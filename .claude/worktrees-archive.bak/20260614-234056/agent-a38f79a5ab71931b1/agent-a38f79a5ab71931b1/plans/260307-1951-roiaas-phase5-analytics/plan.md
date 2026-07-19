---
title: "ROIaaS Phase 5 — Analytics Dashboard"
description: "Hoàn thiện analytics dashboard với ROI calculator, data visualizations, và premium tier gating"
status: pending
priority: P2
effort: 8h
branch: main
tags: [analytics, roi, dashboard, tier-gating, recharts]
created: 2026-03-07
---

# ROIaaS Phase 5 Analytics — Overview Plan

**Research:** `plans/reports/researcher-260307-1943-roiaas-analytics.md`

**Mục tiêu:** Hoàn thiện ROIaaS analytics dashboard với ROI calculator, revenue tracking, và premium visualizations.

---

## Phases

| Phase | File | Status | Effort |
|-------|------|--------|--------|
| 1 | [phase-01-api-analytics.md](./phase-01-api-analytics.md) | pending | 2h |
| 2 | [phase-02-dashboard-ui.md](./phase-02-dashboard-ui.md) | pending | 2h |
| 3 | [phase-03-roi-calculator.md](./phase-03-roi-calculator.md) | pending | 2h |
| 4 | [phase-04-data-viz.md](./phase-04-data-viz.md) | pending | 1.5h |
| 5 | [phase-05-tier-gating.md](./phase-05-tier-gating.md) | pending | 0.5h |

---

## Key Deliverables

1. **Revenue API** — MRR, revenue by tier, trend data
2. **ROI Calculator** — ROI %, payback period, cost per request
3. **Dashboard UI** — Usage + Revenue tabs với SWR caching
4. **Charts** — Recharts area/bar/line cho time-series
5. **Tier Gating** — BASIC vs PREMIUM+ features

---

## Dependencies

- ✅ `raas_licenses` table với tier, metadata
- ✅ `usage_events` table với credits_used, tokens
- ✅ `payment_events` table cho revenue tracking
- ✅ RBAC helpers (`src/lib/analytics/rbac.ts`)
- ✅ Polar.sh webhook integration

---

## Success Criteria

- [ ] `/api/analytics/revenue` returns MRR, byTier, trend
- [ ] ROI calculator hiển thị ROI %, payback months
- [ ] Dashboard có usage + revenue tabs
- [ ] Charts render correctly với Recharts
- [ ] BASIC tier bị giới hạn features
- [ ] PREMIUM+解锁 export, custom date range, ROI

---

## Unresolved Questions

1. **ROI Calculation Logic:** Hiện tại dùng $0.01/credit làm baseline — có cần config từ admin?
2. **Data Retention:** `usage_events` table có nên archive data > 90 ngày?
3. **Real-time Updates:** SWR 60s deduping — có cần WebSocket cho live dashboard?
4. **PNG Export:** Chart-to-PNG chưa implement — dùng library nào (html2canvas, recharts export)?
