# Phase 05: Per-Video Analytics

**Priority:** P0 | **Status:** TODO | **Est:** 4-5 days
**Depends on:** Phase 04 (need published videos to collect analytics)

## Overview

Collect views, watch time, CTR, engagement per video from YouTube/TikTok/Instagram. Unified dashboard. AI feedback loop to improve future content.

## Requirements

### Functional
- Sync analytics from YouTube Analytics API (24h delayed)
- Normalized metrics: views, watch_time_sec, completion_rate, CTR, engagement_rate
- Per-video analytics card in video detail
- Analytics dashboard: top performers, trends (7d/30d), platform comparison
- AI insights: suggest script improvements based on high-performing patterns
- Scheduled sync: Inngest cron every 12h per user

### Non-functional
- YouTube Analytics API: 24h data delay
- D1 storage: 1 row per video per platform per day (daily snapshots)
- Rate limit: respect platform API quotas

## D1 Schema
```sql
CREATE TABLE video_analytics (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  user_id TEXT NOT NULL,
  video_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  platform_video_id TEXT NOT NULL,
  date TEXT NOT NULL, -- YYYY-MM-DD
  views INTEGER DEFAULT 0,
  watch_time_sec INTEGER DEFAULT 0,
  completion_rate REAL DEFAULT 0.0,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(video_id, platform, date)
);
```

## Files to Create/Modify

### Create
- `src/seed/db/migrations/NNNN_video_analytics.sql`
- `src/seed/db/repositories/video-analytics-repo.ts`
- `src/lib/analytics/youtube-analytics-fetcher.ts`
- `src/lib/analytics/analytics-normalizer.ts` (cross-platform normalization)
- `src/lib/analytics/content-insights-generator.ts` (LLM: top patterns → recommendations)
- `src/forest/inngest/functions/analytics-sync.ts` (cron every 12h)
- `src/app/actions/analytics-action.ts`
- `src/app/[locale]/dashboard/videos/analytics/page.tsx`
- `src/app/[locale]/dashboard/videos/analytics/components/analytics-dashboard.tsx`
- `src/app/[locale]/dashboard/videos/analytics/components/video-performance-card.tsx`

### Modify
- `src/app/[locale]/dashboard/videos/components/video-detail-client.tsx` — add analytics section
- `src/seed/config/tiers/video-quota-tiers.ts` — analytics access per tier

## Implementation Steps

- [ ] 1. D1 migration: video_analytics table
- [ ] 2. video-analytics-repo.ts: insert/query daily snapshots
- [ ] 3. youtube-analytics-fetcher.ts: fetch via YouTube Analytics Reporting API
- [ ] 4. analytics-normalizer.ts: compute CTR, engagement_rate from raw metrics
- [ ] 5. analytics-sync Inngest cron: per-user scheduled sync
- [ ] 6. Video performance card: sparklines, key metrics
- [ ] 7. Analytics dashboard: top videos, trend charts (Recharts), platform filter
- [ ] 8. content-insights-generator.ts: LLM analysis of top/bottom performers
- [ ] 9. Analytics action: query endpoint for dashboard data
- [ ] 10. Tests: normalizer, repo, sync function

## Success Criteria

- Published YouTube videos show views/watch time/CTR within 24h
- Dashboard shows top performers with trend sparklines
- AI insights suggest improvements based on engagement patterns
- Tier-gated: PREMIUM+ only
