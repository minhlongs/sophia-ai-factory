# Mission 02: Video Generation Pipeline E2E

**Priority:** P0 — CRITICAL
**Stage:** Zero → PSF
**Layer:** Engineering
**Status:** 95% COMPLETE
**MCU Budget:** 30

## Objective

Prove the full video generation pipeline works end-to-end:
User prompt → MuAPI/HeyGen → Video URL → Dashboard preview → Download

## Current State (2026-04-10)

### HeyGen Pipeline — COMPLETE
Full 6-stage Inngest workflow working:
1. Script generation (OpenRouter LLM) ✅
2. Audio generation (ElevenLabs TTS) ✅
3. Video generation (HeyGen avatar) ✅
4. Video polling (5s intervals, 120 attempts) ✅
5. Channel distribution (YouTube, TikTok, Telegram) ✅
6. Campaign finalization (DB + notification) ✅

### MuAPI Pipeline — API READY
- `/api/media/generate` POST endpoint ✅
- `/api/media/status` GET polling endpoint ✅
- `muapi-media-client.ts` REST client ✅
- NOT yet wired into Inngest campaign workflow (future enhancement)

### Dashboard UI — COMPLETE
- Campaign creation form with template selector ✅
- VideoPreview component with progress bar ✅
- Download button (native browser download) ✅
- Retry/resume actions ✅
- Error states with user-friendly messages ✅

## Success Criteria

- [x] HeyGen: avatar video with custom script
- [x] Campaign dashboard shows generated video
- [x] User can download/share video URL
- [x] Error handling: clear message when API key missing/invalid
- [ ] MuAPI: text-to-video (Kling 3.0) — API ready, needs MUAPI_API_KEY + E2E test

## Remaining

- Set `MUAPI_API_KEY` in CF Worker secrets when account created
- Wire MuAPI as alternative video backend in Inngest workflow (optional, HeyGen works)
- Video URL persistence to R2 before HeyGen temp URLs expire
