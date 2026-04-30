# Phase 10 — Multi-Channel Publisher

## Status: PENDING (after Phase 9)

## Goal
Publish video → TikTok Shop, YouTube Shorts, Instagram Reels with affiliate link injection.

## Deliverables
- [ ] OAuth + token refresh per platform
- [ ] Upload queue (Inngest) per channel
- [ ] Caption + hashtag generator (Qwen)
- [ ] FTC disclosure validator pre-publish
- [ ] Rate limit handler per platform API

## Files
- `apps/sophia-ai-factory/lib/publishers/{tiktok,youtube,instagram}.ts`
- `apps/sophia-ai-factory/app/api/publish/route.ts`

## Risk: High — platform ToS, shadowban, API quota

## Effort: 7-10 days
