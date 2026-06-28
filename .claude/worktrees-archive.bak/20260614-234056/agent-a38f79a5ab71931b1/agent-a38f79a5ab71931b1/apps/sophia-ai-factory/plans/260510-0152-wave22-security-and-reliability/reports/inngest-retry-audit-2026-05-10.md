# Inngest Retry Audit — Wave 22 Phase 05

**Date:** 2026-05-10
**Auditor:** /cook automation
**Source:** W20 code review finding #3

## Summary

**Finding:** Per [Inngest docs](https://www.inngest.com/docs/features/inngest-functions/error-retries/retries) and [error-handling guide](https://www.inngest.com/docs/guides/error-handling), `retries: 0` **disables ALL retries**, including those triggered by `RetryAfterError`. The function-level retries config gates whether any retry runs; `RetryAfterError` only controls *when* a retry happens (not *whether*).

**Implication:** The inline comment at `publish-execute.ts:180-181` is incorrect:
> "Inngest can retry that step independently when 429/5xx hits."

In reality, with `retries: 0` set at function level, a `RetryAfterError` thrown inside `step.run('telegram-send', ...)` causes the function to fail permanently with no retry.

## Inventory

```
src/forest/inngest/functions/
├─ video-visual.ts                  retries: 3
├─ video-scripting.ts               retries: 3
├─ video-tts.ts                     retries: 3
├─ video-compose.ts                 retries: 3
├─ video-upload.ts                  retries: 3
├─ video-publish.ts                 retries: 3
├─ video-generate.ts                retries: 2
├─ url-revenue-video-handler.ts     retries: 2
├─ generate-campaign.ts             retries: 3
├─ publish-execute.ts:193           retries: 0  ← AFFECTED
└─ publish-execute.ts:518           retries: 1  (publish-token-refresh-cron — light read+update, fine)
```

Only `publish-execute` (the publishing-job orchestrator) is affected.

## Verdict per function

| Function | Config | Verdict | Reasoning |
|---|---|---|---|
| publish-execute | retries: 0 | **WATCH** | 429 from Telegram → RetryAfterError → permanent fail. See decision below. |
| publish-token-refresh-cron | retries: 1 | SAFE | Pure read+update; retry on transient D1 timeout is desirable. |
| All video-* | retries: 2-3 | SAFE | Long pipeline; per-step idempotency exists; retry is desirable. |
| generate-campaign | retries: 3 | SAFE | Uses `NonRetriableError` for terminal failures correctly. |

## Decision: Option A (KEEP retries: 0) + correct comment + defer fix

**Why not change to retries: 2/3 in this phase:**

The `telegram-finalize` step at `publish-execute.ts:387-411` does:
```ts
db.from('publishing_results').insert({ id: randomUUID(), ... })
```

`randomUUID()` produces a NEW id on each call. If `telegram-send` succeeds (Telegram message posted) and `telegram-finalize` fails partway and retries, the retry INSERT creates a DUPLICATE `publishing_results` row.

Making this idempotent requires either:
1. Deterministic `id` derived from `jobId` (e.g., `id: jobId`) + raw SQL `INSERT OR IGNORE` (current `db.from(...).insert()` wrapper may not support OR IGNORE).
2. Schema change: `UNIQUE(publishing_job_id)` constraint on `publishing_results` + INSERT OR IGNORE.
3. Pre-INSERT existence check (extra round-trip; non-atomic on D1).

Each option requires migration + wrapper-level investigation beyond P05's 1h budget.

**Current behavior (acceptable for now):**
- 429 from Telegram during publish → permanent fail → user sees "failed" status in UI
- User can manually re-trigger publish via dashboard
- Telegram bot's organic FREE100 volume rarely hits chat-level rate limits

**Acceptable trade-off** for Wave 22 ship; documented for Wave 23.

## Action taken

1. **This audit report** — committed to plan reports directory.
2. **Inline comment update** in `publish-execute.ts` — replace inaccurate retry assertion with documented current behavior + W23 follow-up reference.
3. **Wave 23 backlog item:**
   ```
   #W23-RETRY-FIX (P2/MED): Convert publish-execute to retries: 2 with
   idempotent publishing_results insert (deterministic id = jobId, OR
   add UNIQUE constraint with INSERT OR IGNORE).
   ```

## Sources

- [Inngest Retries Docs](https://www.inngest.com/docs/features/inngest-functions/error-retries/retries) — "Setting the value to 0 will disable retries"
- [Inngest Error Handling Guide](https://www.inngest.com/docs/guides/error-handling) — `RetryAfterError` controls *when*, not *whether*, retry happens

## Unresolved Questions

1. **Does the d1-client `db.from(...).insert(...)` wrapper expose any upsert/OR-IGNORE option?** — Need to inspect wrapper API in W23 before changing publish-execute.
2. **Is there a Better-Auth or D1 schema constraint preventing addition of `UNIQUE(publishing_job_id)` to publishing_results retroactively?** — Verify with `EXPLAIN QUERY PLAN` or check existing duplicate count first.
3. **Should `publish-execute` be split into two Inngest functions** (claim+upload at retries:0, dispatch+finalize at retries:2)? Cleaner separation of idempotency boundaries.
