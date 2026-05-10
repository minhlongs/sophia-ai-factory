# Phase 05 — Telegram Dispatch Retry Mechanism (M2)

## Context Links

- Plan overview: `./plan.md`
- Source: `src/forest/inngest/functions/publish-execute.ts` (telegram branch)
- Related: `src/tree/telegram/*` (sender helpers)
- Telegram Bot API rate limit doc: 429 with `retry_after` seconds in body

## Overview

- **Priority:** P1
- **Effort:** 0.5d
- **Status:** pending
- **Description:** Current Telegram dispatch in `publish-execute` does not retry on transient errors (HTTP 429 rate-limit, network error, 5xx). Single failure → publishing_job.status='failed' permanently. Add bounded retry with exponential backoff and Telegram-aware `retry_after` parsing.

## Key Insights

- Telegram returns `429` with body `{ ok: false, error_code: 429, parameters: { retry_after: <seconds> } }`. Honoring `retry_after` is mandatory or you'll be IP-banned.
- Network errors (`fetch` throws) and 5xx are also transient.
- 4xx (other than 429) like 400 invalid chat — DO NOT retry.
- Inngest already retries failed steps by default; we should USE Inngest's retry instead of re-implementing inside the step. But we still need to parse `retry_after` and rethrow with the right hint.

## Requirements

### Functional
- F1. New helper `dispatchTelegramWithRetryHints(bot, chatId, payload)` in `src/tree/telegram/dispatch-with-retry-hints.ts`:
   - On 429: read `parameters.retry_after`, throw error with `cause: { retryAfterSec }`.
   - On network/5xx: throw plain error (Inngest will retry with default backoff).
   - On 400 / other 4xx: throw `NonRetryableError` (Inngest stops).
- F2. `publish-execute.ts` Telegram branch wraps the existing `step.run('telegram-send', ...)` to use the helper. Inngest step is configured with `retries: 4`.
- F3. When error has `cause.retryAfterSec`, log it to Sentry breadcrumb with `category:'telegram-rate-limit'`.

### Non-Functional
- NF1. Helper file <100 LOC.
- NF2. No `:any`.
- NF3. Unit tests cover: 200 success, 429 with retry_after, 5xx, 400 NonRetryable, network throw.
- NF4. No new external dependency — use existing `fetch` and Inngest types.

## Architecture

```
forest/inngest/functions/publish-execute.ts
   └── step.run('telegram-send', async () => {
         await dispatchTelegramWithRetryHints(...)
       })
            │
            ▼
tree/telegram/dispatch-with-retry-hints.ts (NEW)
   ├── classify HTTP response
   ├── if 429 → throw new Error('rate_limited', { cause: { retryAfterSec }})
   ├── if 4xx (not 429) → throw NonRetryableError (from inngest)
   └── if 5xx / network → throw plain Error
```

## Related Code Files

### Modify
- `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/forest/inngest/functions/publish-execute.ts`

### Create
- `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/tree/telegram/dispatch-with-retry-hints.ts`
- `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/tree/telegram/__tests__/dispatch-with-retry-hints.test.ts`

### Delete
None.

## Implementation Steps

1. Read `publish-execute.ts` Telegram branch to identify exact call signature being replaced.
2. Read existing `tree/telegram/` helpers; check if a base sendMessage helper exists. Reuse it inside the new wrapper rather than duplicating fetch logic.
3. Implement `dispatchTelegramWithRetryHints`:
   - Call existing send helper (or inline `fetch(`https://api.telegram.org/bot${token}/sendMessage`, ...)`)
   - On non-2xx response, parse JSON body
   - Classify per Key Insights → throw appropriately
   - Use `import { NonRetriableError } from 'inngest'` if available (check current Inngest version export).
4. Update `publish-execute.ts`:
   - Wrap call in `step.run('telegram-dispatch', { retries: 4 }, async () => { ... })`.
   - Add Sentry breadcrumb `Sentry.addBreadcrumb({ category: 'telegram-rate-limit', data: { retryAfterSec } })` on rate-limit catch (if Sentry imported in this file already).
5. Tests:
   - Mock fetch to return 200 → asserts no throw.
   - Mock 429 with `retry_after: 5` body → asserts thrown error has `cause.retryAfterSec === 5`.
   - Mock 400 invalid chat → asserts `NonRetriableError` instance.
   - Mock 503 → asserts plain Error.
   - Mock fetch reject → asserts plain Error.
6. `npm run build` + `npm test`.
7. Manual: send a message to a known-good chat → succeeds.

## Todo List

- [ ] Read `publish-execute.ts` Telegram branch
- [ ] Read `tree/telegram/` for existing sender
- [ ] Implement `dispatch-with-retry-hints.ts`
- [ ] Wire into `publish-execute.ts` with `retries: 4`
- [ ] Sentry breadcrumb on rate-limit
- [ ] Unit tests covering 5 cases
- [ ] `npm run build` + `npm test`
- [ ] Code review pass
- [ ] `npm run deploy:full` + SHA verify

## Success Criteria

- [ ] On simulated 429, Inngest retries the step (visible in Inngest dashboard run timeline).
- [ ] On invalid chat ID (400), Inngest does NOT retry (single attempt).
- [ ] All tests green.

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| `NonRetriableError` not exported from current Inngest version | M | M | Verify import path; fall back to throwing with `cause: { retryable: false }` and check in caller. |
| Inngest `retries: option` overrides global retry count | L | L | Test on dev Inngest first; document chosen value. |
| `retry_after` not honored — Inngest backoff uses its own schedule | M | L | Acknowledge limitation in code comment; future work could add `step.sleep(retryAfterSec)` before rethrow. (Defer this.) |
| Existing tree/telegram sender already has retry logic | L | M | Read first; if so, augment instead of duplicate. |

## Security Considerations

- Do not log bot token in any error message (use placeholder `<redacted>`).
- Do not log full chat IDs in Sentry (PII); log just `chat_id_hash` (sha256 first 8 hex).

## Next Steps

- Phase 06 (Sentry wiring) ensures the new breadcrumbs route to a real DSN.
- Future: parse `retry_after` and use `step.sleep(retryAfterSec)` so retry waits the exact time Telegram requested. Out of scope for Phase 05.
