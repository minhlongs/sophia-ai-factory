# Phase 1: Analytics Dashboard Implementation

## Context
- **Goal**: Create `/dashboard/analytics` with stats and charts.
- **Data**: Fetch from `campaigns` table.
- **Viz**: Use `recharts` (installed).

## Steps

1.  **Create Page Component**
    - File: `src/app/dashboard/analytics/page.tsx`
    - Fetch campaigns server-side using `createServerClient`.
    - Pass data to a client component `AnalyticsView`.

2.  **Create Analytics View Client Component**
    - File: `src/app/dashboard/analytics/components/analytics-view.tsx`
    - Props: `campaigns: Campaign[]`
    - Logic: Calculate stats.

3.  **Implement Stats Cards**
    - UI: Grid of 3 cards (Total Campaigns, Success Rate, Avg Duration).
    - Style: Tailwind CSS.

4.  **Implement Charts**
    - File: `src/app/dashboard/analytics/components/charts.tsx`
    - **Status Distribution**: `PieChart` from Recharts.
    - **Duration Metrics**: `BarChart` showing duration of last 5-10 completed campaigns.
    - **Tier/Type**: `PieChart` grouping by `template_id` (proxy for type) if available, or just a placeholder.

5.  **Update Navigation**
    - Add "Analytics" link in Dashboard Sidebar/Header if exists (check `layout.tsx`).

## Technical Details

### Calculating Duration
```typescript
const duration = (new Date(updated_at).getTime() - new Date(created_at).getTime()) / 1000 / 60; // minutes
```

### Recharts Example
```tsx
<ResponsiveContainer width="100%" height={300}>
  <BarChart data={data}>
    <XAxis dataKey="name" />
    <YAxis />
    <Tooltip />
    <Bar dataKey="duration" fill="#8884d8" />
  </BarChart>
</ResponsiveContainer>
```

## Definition of Done
- Page loads at `/dashboard/analytics`.
- Displays correct count of campaigns.
- Displays charts.
- Responsive design.
