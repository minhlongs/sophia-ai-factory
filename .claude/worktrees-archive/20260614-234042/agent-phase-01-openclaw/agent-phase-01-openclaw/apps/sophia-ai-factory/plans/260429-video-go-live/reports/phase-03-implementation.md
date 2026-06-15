# Phase 03 — Persistence Errors: Implementation Report

## Status: COMPLETED

## Files Modified

| File | Change |
|------|--------|
| `src/app/api/heygen/create-video/route.ts` | +23 lines: MissingCredentialsError catch → 503, D1 fail → 500 with videoId, logger.error |
| `src/app/api/heygen/status/[id]/route.ts` | +17 lines: StatusResponse interface, error→failed coercion, logger.info on persist, logger.error on D1 fail |
| `src/app/api/heygen/api-routes.test.ts` | 2 assertions updated to match new response shapes |

## Diff Summary

### create-video/route.ts

- Added `MissingCredentialsError` import from `@/lib/services/errors`
- Added `logger` import from `@/lib/utils/logger-utility`
- Wrapped `ServiceFactory.getVideoService()` + `createVideo()` in explicit try-catch:
  - `MissingCredentialsError` → 503 `{ error: "video_service_unavailable", code: "MISSING_KEY" }`
  - Other errors → re-throw to outer catch → 500
- D1 INSERT failure: `logger.error(...)` then 500 `{ error: "...", code: "DB_FAILED", videoId: heygenJobId }` — caller still gets the videoId
- Success response: `{ videoId, status: "processing" }` (added `status` field)
- Outer catch: uses `logger.error` (no console.*)

### status/[id]/route.ts

- Added `StatusResponse` interface — normalized shape `{ status, video_url, thumbnail_url, duration_sec, error }`
- Added `logger` import
- Coercion: if HeyGen `raw.error` truthy AND status non-terminal → force `effectiveStatus = "failed"`
- On terminal + owner: D1 UPDATE + `logger.info` on success, `logger.error` on fail (request still returns status to client)
- Outer catch: uses `logger.error`
- Response always returns `StatusResponse` shape (consistent, no null leakage)

## Error Codes Added

| Route | Condition | HTTP | Code |
|-------|-----------|------|------|
| create-video | MissingCredentialsError from ServiceFactory | 503 | `MISSING_KEY` |
| create-video | D1 INSERT fail (after HeyGen success) | 500 | `DB_FAILED` |

## Type Check

```
npx tsc --noEmit → 0 errors
```

## Tests

```
npx vitest run src/app/api/heygen
Test Files: 1 passed (1)
Tests: 10 passed (10)
```

## Notes

- `api-routes.test.ts` is within phase ownership boundary (it tests the owned routes)
- Logger signature is `(message: string, err?: Error, meta?: Record<string,unknown>)` — object-first pino pattern would NOT compile; string-first used
- D1 errors surfaced to user via structured `code` field — no silent swallowing
