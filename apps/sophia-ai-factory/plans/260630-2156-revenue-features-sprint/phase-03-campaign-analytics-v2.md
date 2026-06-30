---
title: "Phase 03 — Campaign Analytics Dashboard v2"
description: "Xây dựng /dashboard/analytics với recharts + D1 data source, hiển thị campaign performance metrics"
status: pending
priority: P2
effort: 6h
phase: 03
depends_on: []
blocks: []
---

# Phase 03: Campaign Analytics Dashboard v2

## Overview

Implement `/dashboard/analytics` page hiển thị campaign performance. Plan gốc (`260205-1503-campaign-analytics-dashboard`) ref Supabase — bản này dùng D1 + recharts, viết mới hoàn toàn.

## Key Insights

- **Data source**: D1 `campaigns` table (đã migrate từ Supabase)
- **Chart library**: `recharts` (đã có trong project — check package.json)
- **Pattern**: Server Component fetch data, client component render charts
- **i18n**: bilingual vi/en bắt buộc
- **Layer**: UI components → `forest/components/dashboard/`, page → `app/[locale]/dashboard/analytics/`
- **Existing code**: `src/forest/dashboard/campaign/types.ts` + `src/app/[locale]/dashboard/campaigns/page.tsx`

## Architecture

```
/dashboard/analytics
  → Server Component (page.tsx) — fetch từ D1
    → StatsCards (tổng campaigns, success rate, avg completion time)
    → StatusChart (pie chart — phân bố trạng thái campaign)
    → PerformanceChart (bar chart — completion time theo campaign)
    → RecentCampaigns (table — 10 campaigns gần nhất)
```

## Files to Create

| File | Purpose |
|------|---------|
| `src/app/[locale]/dashboard/analytics/page.tsx` | Server component — data fetching + render |
| `src/forest/dashboard/campaign/analytics-stats-cards.tsx` | 3 stat cards component |
| `src/forest/dashboard/campaign/analytics-status-chart.tsx` | Pie chart — campaign status distribution |
| `src/forest/dashboard/campaign/analytics-performance-chart.tsx` | Bar chart — completion times |
| `src/forest/dashboard/campaign/analytics-recent-campaigns.tsx` | Table — recent campaigns |

## Files to Modify

| File | Action |
|------|--------|
| `src/forest/dashboard/campaign/types.ts` | Add analytics-specific types |
| `messages/vi.json` | Add analytics i18n keys |
| `messages/en.json` | Add analytics i18n keys |

## Implementation Steps

### Step 1: Verify Dependencies
```bash
# Check recharts installed
npm ls recharts 2>/dev/null || npm install recharts
```

### Step 2: Create Analytics Types
```typescript
// src/forest/dashboard/campaign/types.ts (add)
export interface CampaignAnalytics {
  totalCampaigns: number
  successRate: number        // %
  avgCompletionTimeHours: number
  statusDistribution: Record<string, number>
  recentCampaigns: CampaignSummary[]
}

export interface CampaignSummary {
  id: string
  name: string
  status: string
  platform: string
  createdAt: string
  completedAt: string | null
}
```

### Step 3: Create StatsCards Component
- 3 cards: Tổng campaigns, Tỷ lệ thành công, Thời gian TB
- Mỗi card: icon + value + label
- Responsive grid: 3 cols desktop, 1 col mobile
- i18n labels

### Step 4: Create StatusChart Component
- Pie chart từ recharts `PieChart`
- Data: status distribution từ D1 query
- Màu: xanh (completed), vàng (processing), đỏ (failed), xám (draft)
- Legend + tooltip

### Step 5: Create PerformanceChart Component
- Bar chart từ recharts `BarChart`
- Data: completion time theo campaign (top 10)
- Trục X: campaign name, trục Y: hours
- Tooltip hiển thị chi tiết

### Step 6: Create RecentCampaigns Component
- Table: name, platform, status, created, completed
- Sortable columns
- Link đến campaign detail page
- Max 10 rows

### Step 7: Create Analytics Page
- Server Component: fetch data từ D1 `campaigns` table
- SQL: `SELECT status, platform, created_at, completed_at FROM campaigns WHERE user_id = ? ORDER BY created_at DESC`
- Tính toán metrics trong server (KISS — không cần complex SQL)
- Render các component con

### Step 8: Add i18n Keys
- `messages/vi.json`: analytics.title, analytics.totalCampaigns, analytics.successRate, etc.
- `messages/en.json`: tương tự tiếng Anh

### Step 9: Add to Sidebar Navigation
- Thêm link `/dashboard/analytics` vào `dashboard-sidebar-nav.tsx`
- Icon: chart/analytics icon

### Step 10: Test + Build
- Unit test: mỗi component render đúng với mock data
- Integration test: page fetch data + render
- `npm test` — all pass
- `npm run build` — 0 errors

## Todo List

- [ ] Verify recharts installed
- [ ] Add analytics types to `types.ts`
- [ ] Create `analytics-stats-cards.tsx` + unit test
- [ ] Create `analytics-status-chart.tsx` + unit test
- [ ] Create `analytics-performance-chart.tsx` + unit test
- [ ] Create `analytics-recent-campaigns.tsx` + unit test
- [ ] Create `page.tsx` server component
- [ ] Add i18n keys (vi/en)
- [ ] Add sidebar nav link
- [ ] Run `npm test` — all pass
- [ ] Run `npm run build` — 0 errors

## Success Criteria

- `/dashboard/analytics` hiển thị real data từ D1
- Stats cards hiển thị đúng số liệu
- Charts render không lỗi, có tooltip + legend
- Responsive: mobile 1 col, desktop 3 cols
- Bilingual: vi/en switch hoạt động
- 0 `:any` types
- Build + test pass

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| recharts không tương thích Next.js 16 | Low | High | Verify sớm ở Step 1; fallback về chart.js |
| D1 campaigns table schema khác plan cũ | Medium | Medium | Đọc schema thực tế từ migration files |
| Performance với nhiều campaigns | Low | Medium | LIMIT query, tính toán server-side |
| i18n thiếu key | Low | Low | i18n:validate trong pretest |

## Security Considerations

- Page required auth (qua middleware dashboard pipeline)
- Chỉ hiển thị campaigns của user hiện tại (user_id filter)
- Không expose campaign data của user khác

## Next Steps

- Track 01 (Wave 20) — independent, parallel
- Track 02 (Usage Metering) — independent, parallel
