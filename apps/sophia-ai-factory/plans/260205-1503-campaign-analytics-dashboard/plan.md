---
title: "Campaign Analytics Dashboard Implementation"
description: "Implementation of analytics page with charts and statistics"
status: pending
priority: P2
effort: 1h
branch: master
tags: [analytics, dashboard, ui]
created: 2026-02-05
---

# Campaign Analytics Dashboard Plan

## 1. Overview
Implement a new page at `/dashboard/analytics` to visualize campaign performance and statistics for the user. Use `recharts` for visualization.

## 2. Components
1.  **AnalyticsPage** (`src/app/dashboard/analytics/page.tsx`): Main container.
2.  **StatsCards**: 3 cards for Total, Success Rate, Avg Time.
3.  **StatusChart**: Pie chart showing campaign status distribution.
4.  **PerformanceChart**: Bar chart showing completion times.
5.  **TierChart**: (Optional/Placeholder) Distribution of tiers.

## 3. Data Strategy
- Fetch all campaigns for the user from Supabase.
- Compute metrics on the client (or server) to avoid complex SQL for now (KISS).
- `Total`: `campaigns.length`
- `Success Rate`: `completed / total * 100`
- `Avg Time`: `Average(updated_at - created_at)` for completed campaigns.
- `Step Breakdown`: currently not tracked. Will show Total Time.

## 4. Phases
- **Phase 1**: Setup Page & Data Fetching
- **Phase 2**: Implement Charts & UI

## 5. Risks
- **Missing Data**: Step-by-step timing is not in DB.
- **Mitigation**: Display total duration only for now.

## 6. Questions
- Should "Tier Distribution" be for Admin? (Assuming User view for now, will hide or show template types instead).
