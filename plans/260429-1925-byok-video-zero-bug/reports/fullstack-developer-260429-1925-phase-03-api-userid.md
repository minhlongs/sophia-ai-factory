# Phase 03 Implementation Report — API userId + ByokProvider Widening

## Executed Phase
- Phase: phase-03-api-userid-byok-provider
- Plan: plans/260429-1925-byok-video-zero-bug/
- Status: completed

## ByokProvider Union (new type)
```ts
export type ByokProvider = 'openrouter' | 'anthropic' | 'elevenlabs' | 'd-id' | 'heygen' | 'muapi'
```

## Files Modified: 12

| File | Change |
|------|--------|
| `src/lib/byok/user-api-key-store.ts` | Added `'heygen' \| 'muapi'` to ByokProvider union |
| `src/components/byok/byok-key-form.tsx` | Widened local `Provider` type to match ByokProvider |
| `src/lib/services/factory.ts` | Removed `heygen as any` cast; pass `userId` to `new RealVideoService(userId)` |
| `src/lib/heygen/heygen-client.ts` | Removed `'heygen' as any` cast; cleaned stale TODO comment |
| `src/app/api/setup/save/route.ts` | Removed `as ByokProvider` casts on `heygen` and `muapi` entries |
| `src/app/api/heygen/create-video/route.ts` | `await ServiceFactory.getVideoService(user.id)` |
| `src/app/api/heygen/status/[id]/route.ts` | `await ServiceFactory.getVideoService(user.id)` |
| `src/app/api/heygen/avatars/route.ts` | `await ServiceFactory.getVideoService(user.id)` |
| `src/app/api/heygen/voices/route.ts` | `await ServiceFactory.getVideoService(user.id)` |
| `src/lib/services/real/video-service.ts` | Added `userId` constructor param; all `getHeyGenClient()` calls now `await getHeyGenClient(this.userId)` |
| `src/lib/ai/video-generator.ts` | Added `userId?` to `GenerateVideoInput`; `await ServiceFactory.getVideoService(userId)` in both functions |
| `src/lib/inngest/functions/generate-campaign.ts` | `await ServiceFactory.getScriptService(userId)` and `await ServiceFactory.getVoiceService(userId)`; `startVideoGeneration({ ..., userId })` |
| `src/app/api/videos/route.ts` | R2 read-side URL preference: prefers `${R2_PUBLIC_BASE_URL}/${r2_key}` when `r2_key` present |
| `src/app/api/heygen/api-routes.test.ts` | `mockReturnValue` → `mockResolvedValue`; mock throws → `mockRejectedValue` |
| `src/lib/heygen/heygen-client.test.ts` | Made both init tests `async`, added `await getHeyGenClient()` |

## Callsites Updated: 9
- 4 heygen API routes (create-video, status, avatars, voices) — session userId threaded
- 4 calls inside `RealVideoService` (createVideo, getVideoStatus, listAvatars, listVoices) — via constructor
- 1 `video-generator.ts` `startVideoGeneration` / `checkVideoGenerationStatus`
- 2 inngest campaign steps (scriptService, voiceService)

## Casts Removed: 3
- `factory.ts`: `'heygen' as any`
- `heygen-client.ts`: `'heygen' as any`
- `setup/save/route.ts`: `'heygen' as ByokProvider`, `'muapi' as ByokProvider`

## R2 Read-Side Preference
- File: `src/app/api/videos/route.ts` — lines 43-50 (map over results)
- Logic: if `R2_PUBLIC_BASE_URL` env set AND `v.r2_key` non-null → override `video_url` with `${r2Base}/${v.r2_key}`. Else pass through original `video_url`.

## tsc Final: 0 errors confirmed

## Test Suite
- 1696 passed | 31 skipped | 0 failed
- All 153 test files passed (1 skipped)

## Bottom Line
API ROUTES BYOK-AWARE END-TO-END ✅
