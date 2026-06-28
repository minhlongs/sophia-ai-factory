# Phase 02 — Telegram Step Split + retry_after honor (7F + Phase 05 follow-up)

## Context Links

- Wave 19 Phase 05 carry-over: `dispatchTelegramWithRetryHints` already classifies 4xx → NonRetriable / 429 → plain retry, but the parent step (`claim-and-upload`) bundles CAS + dispatch. On 2nd Inngest retry, CAS finds status='uploading' (not 'scheduled') and returns `skipped: true` — the dispatch never re-fires.
- Source: `src/forest/inngest/functions/publish-execute.ts:185-285`
- Inngest docs (memoization + RetryAfterError): https://www.inngest.com/docs/guides/error-retries

## Overview

- **Priority:** P1
- **Effort:** 4h
- **Status:** ⏳ IN PROGRESS
- **Description:** Re-architect the Telegram dispatch inside `publishExecute` into 3 separate `step.run` calls so retries on 429/5xx actually re-fire the network call. Inngest memoizes step output, so the CAS-claim step runs once and subsequent retries only re-execute the failing step. Also use `RetryAfterError` to honor the Telegram-supplied retry_after seconds.

## Key Insights

- Inngest steps are MEMOIZED on success. Step 1 (CAS claim) returns its output, Inngest caches it; on step 2 retry, step 1 is NOT replayed.
- `RetryAfterError(message, retryAfter)` (Inngest ≥3.x) tells the runtime exactly how long to wait — replaces default exponential backoff with the Telegram-suggested value.
- Splitting send and finalize prevents the rare "send succeeded → DB write failed → retry double-sends" failure mode (DB write retry uses memoized send result).
- OAuth providers' state machine is OUT OF SCOPE; only Telegram path is rewired here.

## Requirements

### Functional
- F1. Step `claim-telegram-job`: read job + CAS to 'uploading' + verify pairing + resolve videoUrl. Returns claimed-state struct or `{skipped:true}`.
- F2. Step `send-telegram`: invoke `dispatchTelegramWithRetryHints`. Errors thrown here → Inngest retries this step only.
- F3. Step `finalize-telegram`: UPDATE status='live' + INSERT publishing_results.
- F4. `dispatchTelegramWithRetryHints` throws `RetryAfterError` on 429 (delay = retryAfterSec).

### Non-Functional
- NF1. OAuth path unchanged.
- NF2. Existing tests still pass (helper test must update to expect `RetryAfterError` on 429 path).
- NF3. Idempotency: step 2 on retry re-fires Telegram API; step 3 retry uses memoized step 2 output.

## Architecture

```
Before (single step):
  step.run('claim-and-upload') → CAS + send + finalize  ← retry stuck on CAS

After (Telegram path):
  step.run('claim-telegram-job')     → returns {videoUrl, chatId, caption} | {skipped}
  step.run('send-telegram')          → returns {externalPostId, externalUrl}  ← retries here on 429/5xx
  step.run('finalize-telegram')      → DB writes; returns ClaimResult         ← memoizes step 2 output
```

## Related Code Files

### Modify
- `src/tree/telegram/dispatch-with-retry-hints.ts` — switch 429 from plain Error → `RetryAfterError`
- `src/tree/telegram/__tests__/dispatch-with-retry-hints.test.ts` — assert RetryAfterError on 429
- `src/forest/inngest/functions/publish-execute.ts` — split telegram path into 3 `step.run` calls

## Implementation Steps

1. Update helper to use `RetryAfterError`. Keep NonRetriable for 4xx, plain Error for 5xx/network.
2. Refactor `publishExecute` Telegram branch:
   - Move `if (jobProvider === 'telegram')` block out of `claim-and-upload`.
   - New steps: claim-telegram-job → send-telegram → finalize-telegram.
3. Update test: 429 case asserts the thrown error is RetryAfterError with retryAfter ms ≈ retryAfterSec * 1000.
4. Run unit tests + build.
5. Commit + deploy + verify.

## Todo List

- [x] Helper: 429 → RetryAfterError
- [x] Helper test: assert RetryAfterError type
- [x] publishExecute: 3-step split for Telegram
- [x] `npm test` 100% pass
- [x] `npm run build` 0 errors
- [x] Commit + CF deploy + SHA verify

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Step boundary change breaks Inngest event replay | M | H | Inngest memoization is the documented contract. Separate steps is the canonical pattern. |
| RetryAfterError API differs across Inngest versions | L | M | Pinned to `^3.50` — RetryAfterError is GA. Falls back to default retry if Inngest doesn't recognize the type. |
| Double-send if step 3 fails after step 2 succeeds | L | M | Step 2 memoization guarantees no re-fire. Risk only on full job replay (separate concern). |

## Security Considerations

- No auth changes. SSRF guard `assertSafeVideoUrl` stays in step 1.

## Next Steps

- Wave 20 wrap-up after Phase 02. Wave 21 to consider full DELETE flow + true 429 backoff with delayed step.sleep.
