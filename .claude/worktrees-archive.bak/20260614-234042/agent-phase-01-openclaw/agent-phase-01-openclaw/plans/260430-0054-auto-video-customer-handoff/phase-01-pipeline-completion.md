# Phase 01: Pipeline Completion (4 stubs → real)

**Status:** ✅ done | **Date:** 2026-04-30

## Summary

Replaced 4 stub Inngest functions with real implementations:

| Function | Before | After |
|----------|--------|-------|
| video-scripting.ts | Stub placeholder text | Real OpenRouter API call (gpt-4o-mini) |
| video-visual.ts | Stub R2 key | HeyGen video generation + polling |
| video-compose.ts | Stub R2 key | Pass-through (HeyGen outputs complete mp4) |
| video-upload.ts | Stub upload | Verify video URL accessible |

## Key Decisions

- **HeyGen replaces HunyuanVideo** — already integrated, creates complete video (TTS+visual in one call)
- **Compose pass-through** — Remotion impossible on CF Workers, HeyGen output is already final
- **Default avatar/voice** — Anna_public avatar + standard voice; configurable later

## Files Changed

- `src/lib/inngest/functions/video-scripting.ts` — real OpenRouter script generation
- `src/lib/inngest/functions/video-visual.ts` — HeyGen video creation with polling
- `src/lib/inngest/functions/video-compose.ts` — pass-through compose
- `src/lib/inngest/functions/video-upload.ts` — verify video accessibility
