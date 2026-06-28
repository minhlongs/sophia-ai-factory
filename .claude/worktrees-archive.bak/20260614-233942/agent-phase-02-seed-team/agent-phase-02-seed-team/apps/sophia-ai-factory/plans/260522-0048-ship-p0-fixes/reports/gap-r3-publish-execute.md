# GAP-R3 Report: publish-execute retry + idempotency fix

**Date:** 2026-05-22
**Status:** DONE

## Files Modified

- `src/forest/inngest/functions/publish-execute.ts` — production fix
- `src/forest/inngest/functions/__tests__/publish-execute-gap-r3.test.ts` — new test file (6 tests)

## Changes

### 1. `retries: 0` → `retries: 3` (line 196)

Project standard for publish functions is 3 (video-publish, generate-campaign, etc.). With
`retries: 0` any throw inside a step caused permanent silent failure — including `RetryAfterError`
from Telegram 429.

### 2. Removed `randomUUID()` imports and calls

`randomUUID` import deleted (line 36). Both insert sites replaced with deterministic keys:

- `telegram-finalize` step: `id = event.id + ':telegram-finalize'`
- `finalize` step (OAuth path): `id = event.id + ':finalize'`

Both changed from `insert()` → `upsert()`. Inngest memoizes each `step.run` result on
replay, so the upstream Bot-API call won't re-execute. The DB PK being stable means
a replayed finalize step does `INSERT OR REPLACE` over the same row — idempotent by
construction with no duplicate rows.

### 3. Stale audit comment removed

Old `NOTE (Wave 22 P05 audit)` comment that described the known-broken state
was replaced with accurate Wave 23 rationale.

## Telegram 429 Path

`dispatchTelegramWithRetryHints` already throws `RetryAfterError(message, retryAfterSec)`.
With `retries: 0` that error caused immediate permanent failure. With `retries: 3` Inngest
now schedules the step retry after `retryAfterSec` seconds as intended.

## Tests

| Test | Assertion |
|------|-----------|
| R3-a | `publishExecute.retries >= 3` |
| R3-b | `telegram-finalize` upsert PK = `event.id + ':telegram-finalize'`; second handler invocation produces same PK, unique PKs = 1 |
| R3-c | OAuth finalize PK formula is stable (no random UUID) |
| R3-d | `RetryAfterError` from telegram-send bubbles out of `step.run`, is distinguishable from `NonRetriableError` |
| R3-e | `retry_count >= MAX_RETRIES` → result is `status=failed`, no `insert`/`upsert` on `publishing_results` |

**32/32 publish-execute tests pass** (4 test files: telegram-c1, video-url-wave17, cas, gap-r3).
TypeScript: 0 errors in modified files.

## Build Status

`npm run build` has a pre-existing transient `ENOENT _buildManifest.js.tmp` race condition
unrelated to these changes (audit trail: this failure existed before this fix per prior deploys).
TypeScript type-check via `tsc --noEmit --skipLibCheck` passes clean on both modified files.
