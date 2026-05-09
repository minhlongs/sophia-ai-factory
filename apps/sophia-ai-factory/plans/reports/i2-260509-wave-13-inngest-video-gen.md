# Wave 13 Group I2 — Inngest video-generate Registration

**Date:** 260509
**Status:** COMPLETE

## Files Modified

| File | Change |
|---|---|
| `src/forest/inngest/client.ts` | Added `VideoGenerateRequestedEvent` type + `"video/generate.requested"` to Events map |
| `src/forest/inngest/functions/video-generate.ts` | Removed `videoInngest` cast + manual `InngestStepTools`/`InngestFunctionContext` interfaces; now uses typed `inngest.createFunction` directly |
| `src/forest/inngest/functions/index.ts` | Added `export { videoGenerate }` at line 36 |

## Files Created

| File | LOC |
|---|---|
| `src/app/api/v1/missions/[id]/generate-video/route.ts` | 106 |
| `src/app/api/v1/missions/[id]/generate-video/route.test.ts` | 131 |

## Task Checklist

- [x] Event schema `video/generate.requested` added to `client.ts` with full typed payload
- [x] `videoGenerate` registered in `functions/index.ts`
- [x] `as any[]` cast removed — function uses typed `inngest.createFunction` via registered Events
- [x] Trigger endpoint POST `/api/v1/missions/[id]/generate-video` created
  - Auth: `getCurrentUser()` → 401 if missing
  - D1 read: fetch mission by id, app-level user_id ownership check
  - Status guard: blocks trigger for `failed`/`cancelled` missions (409)
  - Zod validation: prompt required, optional voiceoverText/aspectRatio/durationSec/language
  - `inngest.send('video/generate.requested', ...)` → 202 Accepted with jobId
  - Wrapped with `withRateLimit` (5 req/min)
- [x] 4 unit tests added (happy path, 404, 403, 400)

## Test Results

- tsc: 0 new errors (pre-existing `webhook-notification-service.ts` errors unchanged)
- vitest: **2898 passed** (293 test files, 294 including 1 skipped)
- New tests: 4/4 pass
- video-generate.test.ts (existing): 4/4 pass

## No `as any` in video-generate.ts

Verified via Grep — 0 matches for `as any` or `any[]`.
