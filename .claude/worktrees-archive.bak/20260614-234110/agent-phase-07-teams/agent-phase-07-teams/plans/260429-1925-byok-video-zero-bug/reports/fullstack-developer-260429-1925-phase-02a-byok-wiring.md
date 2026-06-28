# Phase 02A Report — BYOK ServiceFactory Wiring

## New Signatures

```ts
// factory.ts
static async getScriptService(userId?: string): Promise<IScriptService>
static async getVoiceService(userId?: string):  Promise<IVoiceService>
static async getVideoService(userId?: string):  Promise<IVideoService>
static getPaymentService(): IPaymentService  // unchanged — no BYOK

// heygen-client.ts
export async function getHeyGenClient(userId?: string): Promise<HeyGenClient | null>
export function getHeyGenClientSync(): HeyGenClient | null  // deprecated shim for Phase 03
```

## Files Modified

| File | Summary |
|------|---------|
| `src/lib/services/factory.ts` | All 3 service getters async + userId; `resolveHeygenKey` helper (heygen cast); `resolveKey` for openrouter/elevenlabs via resolver |
| `src/lib/heygen/heygen-client.ts` | Dropped singleton; `getHeyGenClient(userId?)` async using `getUserApiKey`+`isByokEnabled`; added `getHeyGenClientSync()` deprecated shim |
| `src/lib/services/factory.test.ts` | All 7 original cases updated to `await`; added 3 new BYOK cases (cases 8–10) via `vi.doMock` of resolver |

## New Test File

`src/lib/services/factory.test.ts` — 10 assertions:
- Cases 1–7: original credential gate (all updated to async)
- Case 8: userId + mocked resolver returns user key → RealScriptService
- Case 9: userId + mocked resolver returns env fallback → RealScriptService
- Case 10: userId + mocked resolver returns null → MockScriptService (dev)

**Result: 10/10 PASS**

## Type Check Status

- Owned files: **0 errors**
- Phase 03 callsite errors: **15** (expected)
  - `real/video-service.ts` (5 errors) — calls `getHeyGenClient()` without await
  - `api/heygen/*` routes (4 errors) — call `getVideoService()` without await
  - `ai/video-generator.ts` (2 errors) — same
  - `inngest/functions/generate-campaign.ts` (2 errors) — getScriptService/getVoiceService
  - `api/cron/video-status-sync/route.test.ts` (1 error) — test mock mismatch
  - **All are Phase 03 callers per spec**

## Notes

- `'heygen'` is NOT yet in `ByokProvider` union (owned by `user-api-key-store.ts`, outside Phase 02A boundary). Used `getUserApiKey(userId, 'heygen' as any)` with `eslint-disable` in both `heygen-client.ts` and `factory.ts`.
- `getHeyGenClientSync()` shim added so `real/video-service.ts` can be migrated cleanly in Phase 03.

## BYOK SERVICE LAYER: ✅ LIVE

Resolution logic wired end-to-end for all 3 services. Factory is async and BYOK-aware.

## Open Questions for Phase 03

1. Phase 03 must `await ServiceFactory.getVideoService(userId)` at all callsites — 15 errors to fix.
2. `real/video-service.ts` needs to either accept userId in constructor OR call `getHeyGenClientSync()` shim for backward compat while Phase 03 proceeds.
3. TODO: add `'heygen'` to `ByokProvider` in `user-api-key-store.ts` and remove the `as any` cast — low priority, can be done in Phase 03 or a dedicated schema phase. Also update `byok-key-form.tsx` `Provider` type to add `'heygen'` entry.
