# Phase 3 — Persistence (Success + Failure, BOTH Callers)

## Overview
- Priority: HIGH
- Status: PENDING
- Description: Update BOTH callers of `FalImageProvider.generate()` to
  persist the enriched economic fields on BOTH success and failure paths.
  Callers: `image-generate-action.ts` (UI server action) and `route.ts`
  (API route — Telegram bot / external clients, live in production).

## Key Insights
- Today the success path writes `provider_cost: result.costCents ?? null`
  (always NULL today) and `cost_classification: classifyCost(...)` (always
  UNKNOWN). After Phase 2, `result.costCents` is real.
- Today the failure path in the ACTION (catch block, line 208) does NOT
  write a `media_jobs` row at all — it just returns `{ success: false }`.
  The ROUTE's catch block (line 145) also does NOT write a `media_jobs`
  row — it just returns a 502. Both mean failed jobs are invisible to the
  economic loop.
- User confirmed: record failed jobs with `status='failed'` +
  `error_category`.

## Architecture

### Success path (existing, minimal change)
- `provider_cost` ← `result.costCents ?? null` (now real)
- `cost_classification` ← `result.costClassification ?? classifyCost(...)`
- `cost_currency` ← `result.costCents != null ? 'USD' : null`
- `error_category` ← null (success)
- `retry_count` ← `result.retryCount ?? null`
- `requested_at` ← `result.requestedAt ?? requestedAt`
- `started_at` ← `result.startedAt ?? requestedAt`

### Failure path (NEW)
- Insert a `media_jobs` row with:
  - `status: 'failed'`
  - `error_category` ← `mapFailureKindToErrorCategory(err.code)`
    (import from `tree/media-jobs/error-category-mapper`)
  - `retry_count` ← `err.retryCount ?? null`
  - `requested_at` ← `result?.requestedAt ?? requestedAt` (if available)
  - `started_at` ← `result?.startedAt ?? requestedAt`
  - `latency_ms` ← `Date.now() - startTime`
  - `provider_cost: NULL` (failure = no billable cost... actually
    fal.ai may still charge. Decision: NULL = UNKNOWN on failure,
    since we can't confirm. Document this.)
- Failure insert is BEST-EFFORT: wrapped in try/catch, logged on error,
  but NEVER masks the original error returned to the user.
- After the failure insert, return `{ success: false, error, code }`
  exactly as today.

## Requirements
- **FR-1**: Success path persists all economic columns from
  `ImageGenerationResult`.
- **FR-2**: Failure path inserts a `media_jobs` row with
  `status='failed'` + `error_category`.
- **FR-3**: Failure insert failure does NOT change the user-facing error.
- **FR-4**: `error_category` is mapped from `FailureKind` via the existing
  `mapFailureKindToErrorCategory`.
- **FR-5**: `retry_count` persisted on both paths.

## Related Code Files
- **Modify**: `src/app/actions/image-generate-action.ts` (caller 1 — UI)
- **Modify**: `src/app/api/v1/creative-studio/images/generate/route.ts` (caller 2 — API/Telegram)
- **Read**: `src/tree/media-jobs/error-category-mapper.ts`
- **Read**: `src/seed/types/creative-job-economics.ts`

## Implementation Steps

### Caller 1: `image-generate-action.ts` (UI server action)
1. Import `mapFailureKindToErrorCategory` from
   `@/tree/media-jobs/error-category-mapper`.
2. Update success-path insert to use the new fields from
   `result` (costClassification, retryCount, requestedAt, startedAt).
3. Add failure-path insert BEFORE the final return in the catch block:
   ```ts
   } catch (err) {
     const message = err instanceof Error ? err.message : String(err);
     const code = err instanceof ImageGenerationError ? err.code : 'FAL_ERROR';
     const retryCount = err instanceof ImageGenerationError ? err.retryCount : undefined;
     const errorCategory = code ? mapFailureKindToErrorCategory(code) : 'UNKNOWN';

     // Best-effort: record the failed job for the economic loop.
     // Never let insert failure mask the original error to the user.
     try {
       const db = createServerClient();
       await db.from('media_jobs').insert({
         id: jobId,
         user_id: user.id,
         type: 'image',
         model,
         prompt,
         status: 'failed',
         provider: 'fal-ai',
         error_category: errorCategory,
         retry_count: retryCount ?? null,
         cost_classification: 'UNKNOWN',
         requested_at: requestedAt,
         started_at: requestedAt,
         latency_ms: Date.now() - startTime,
       });
     } catch (dbErr) {
       logger.error('[image-generate-action] failed to record failed job', dbErr instanceof Error ? dbErr : new Error(String(dbErr)));
     }

     logger.warn('[image-generate-action] fal-ai generation failed', { error: message, code });
     return { success: false, error: message, code };
   }
   ```
4. Verify `jobId` is available in the catch block (it is — declared at
   line 115, before the try).

### Caller 2: `route.ts` (API route — Telegram bot / external)
5. Import `mapFailureKindToErrorCategory` from
   `@/tree/media-jobs/error-category-mapper` (route already imports
   `classifyCost` from seed, so tree import is consistent).
6. Update success-path insert (line 121) to use the new fields:
   `cost_classification: result.costClassification ?? classifyCost(result.costCents, false)`,
   `retry_count: result.retryCount ?? null`,
   `requested_at: result.requestedAt ?? requestedAt`,
   `started_at: result.startedAt ?? requestedAt`.
7. Add failure-path insert in the catch block (before the 502 return):
   read `code` (already done) and `retryCount` from the caught error,
   map `errorCategory = mapFailureKindToErrorCategory(code)`,
   insert a `media_jobs` row with `status='failed'`,
   `error_category`, `retry_count`, `cost_classification='UNKNOWN'`,
   `requested_at`, `started_at`. Best-effort (inner try/catch, logged,
   never masks the 502).
8. Verify layer direction (land → tree import is allowed — route is
   `src/app/api/...` which is land layer).

## Todo
- [ ] **Caller 1 (action)**: Import `mapFailureKindToErrorCategory`
- [ ] **Caller 1 (action)**: Update success-path insert with new economic fields
- [ ] **Caller 1 (action)**: Add failure-path insert (best-effort, logged)
- [ ] **Caller 1 (action)**: Verify `jobId` scope covers catch block
- [ ] **Caller 2 (route)**: Import `mapFailureKindToErrorCategory`
- [ ] **Caller 2 (route)**: Update success-path insert with new economic fields
- [ ] **Caller 2 (route)**: Add failure-path insert (best-effort, logged)
- [ ] Verify layer direction (land → tree import is allowed)

## Success Criteria
- Success: `media_jobs` row has `provider_cost=1`,
  `cost_classification='METERED'`, `retry_count` = attempts.
- Failure: `media_jobs` row exists with `status='failed'`,
  `error_category` = mapped value (e.g. 429 → 'RATE_LIMIT').
- Failure insert error → logged, but user still sees original error.
- `npm run build` 0 errors.

## Risk Assessment
| Risk | Mitigation |
|---|---|
| Failure insert masks original error | Insert is inner try/catch; outer catch always returns original error. |
| `jobId` not in scope | Verified: declared at line 115, before try block. |
| Layer violation | land→tree import is ALLOWED per architecture. |
