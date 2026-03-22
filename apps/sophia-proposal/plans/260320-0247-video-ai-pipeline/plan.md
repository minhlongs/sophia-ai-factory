---
title: "Video AI Pipeline — Implementation Plan"
description: "HeyGen integration for AI video generation in proposals with MCU billing"
status: pending
priority: P2
effort: 12h
branch: main
tags: [video, heygen, ai, mcu-billing, async]
created: 2026-03-20
---

# Video AI Pipeline — Overview Plan

## Phases

| Phase | Status | Effort | Description |
|-------|--------|--------|-------------|
| [Phase 1: Architecture](./phase-01-architecture.md) | ✅ Complete | 4h | Database schema, API design, MCU pricing, flow diagrams |
| Phase 2: Database Migration | Pending | 2h | Migration 005: video_assets, video_templates tables |
| Phase 3: HeyGen Client | Pending | 2h | API client library with error handling |
| Phase 4: API Routes | Pending | 2h | /api/video/generate, /[id], /webhook |
| Phase 5: UI Components | Pending | 2h | Video player, generator, list components |

## Dependencies

- **Requires**: Supabase database (existing)
- **Requires**: Polar billing integration (existing)
- **External**: HeyGen API key + webhook secret
- **Blocks**: Video proposal features, custom avatar uploads

## Key Decisions

1. **Provider**: HeyGen (selected over D-ID for better API + pricing)
2. **Processing**: Async webhook-based (never block proposal generation)
3. **Billing**: MCU deduction AFTER successful generation via webhook
4. **Storage**: Video URLs stored in DB, served from HeyGen CDN

## Architecture Summary

```
User → POST /api/video/generate → Balance Check → HeyGen API → Webhook → MCU Deduct
                                     ↓
                              video_assets (pending)
                                     ↓
                              video_assets (ready) + URL
```

## MCU Pricing (Final)

| Video Type | Duration | Starter | Growth | Premium | Master |
|-----------|----------|---------|--------|---------|--------|
| Intro | 30s | 100 | 90 | 80 | 70 |
| Section | 60s | 250 | 225 | 200 | 175 |
| Full Proposal | 2-3min | 500 | 450 | 400 | 350 |
| Custom Avatar | +50% | +50 | +45 | +40 | +35 |

## Files to Create

```
lib/video/heygen-client.ts
lib/video/video-templates.ts
lib/validators/video.ts
app/api/video/generate/route.ts
app/api/video/[id]/route.ts
app/api/video/proposal/[proposalId]/route.ts
app/api/video/webhook/route.ts
components/video/video-player.tsx
components/video/video-generator.tsx
components/video/video-list.tsx
types/video.ts
lib/supabase/migrations/005_video_tables.sql
```

## Files to Modify

```
lib/billing/mcu-pricing.ts (add video MCU costs)
app/api/proposals/[id]/route.ts (include video URLs)
```

## Success Metrics

- [ ] Video generation completes in <60 seconds
- [ ] Webhook receives + processes 100% of completion events
- [ ] MCU deducted correctly for all video types
- [ ] No balance overdrafts (pre-check enforced)
- [ ] Video player renders in proposal view

## Risks

| Risk | Mitigation |
|------|------------|
| HeyGen API rate limits | Queue + retry with backoff |
| Webhook delivery failures | Polling fallback every 30s |
| Video URL expiration | Refresh logic + local cache |
| Cost overruns | Strict balance check before generation |

---

_Next: Proceed to Phase 2 (Database Migration) when ready_
