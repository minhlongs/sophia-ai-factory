# Phase 03 + Phase 04 Hotfix Code Review

**Date:** 2026-05-09 11:56  
**Reviewer:** code-reviewer agent  
**Scope:** Phase 03 (Telegram channel publisher) + Phase 04 hotfix (`paired_by` column rename)  
**Work context:** `apps/sophia-ai-factory`  
**Tester report:** `plans/reports/tester-260509-1034-wave16-validation.md` (note: actual filename, not `tester-260509-phase-03-validation.md` as referenced)

## Verdict

- **Score: 7.5/10**
- **Critical: 1** (publish-execute polling-loop overwrite of Telegram `live` status)
- **Major: 2** (Zod max(12) caps at 12 vs 13 providers; 0099 migration not idempotent despite comment claim)
- **Recommendation: FIX_BEFORE_DEPLOY**

The Telegram publisher itself (`telegram-publisher.ts`) is well-crafted (token masking, error taxonomy, URL builder, sanitization). However, the integration in `publish-execute.ts` has a real flow bug that will silently corrupt every successful Telegram post: after marking `live`, the function falls into the OAuth polling loop which fails the lookup and overwrites the row to `failed` plus inserts a duplicate `publishing_results` row. Because Wave 16 ships entirely behind `NEXT_PUBLIC_DISTRIBUTE_ENABLED`, this won't burn live users today — but it must be fixed before the flag flips in Wave 17.

## Critical

### C1. publish-execute.ts:317,230 — Telegram dispatch falls through to OAuth polling loop, overwrites `live` → `failed`

**File:** `src/forest/inngest/functions/publish-execute.ts:230` and `:317`

**Issue:** The Telegram branch sets the row to `live` and inserts a `publishing_results` row inside the inner `step.run` (lines 211–227). It then returns:

```ts
return { skipped: false, jobId, status: 'processing', externalPostId: tgPostId, provider: 'telegram' };  // line 230
```

The outer early-exit guard at line 317:

```ts
if (claimResult.skipped || claimResult.status !== 'processing' || !claimResult.externalPostId) {
  return claimResult;
}
```

evaluates to `false` for Telegram (status IS `'processing'`, `externalPostId` is set), so the function does NOT exit early. It then proceeds into the polling loop (lines 326–352) which calls:

```ts
SELECT provider,access_token,external_account_id FROM publishing_channels
 WHERE tenant_id=? AND provider='telegram'
```

Telegram channels never live in `publishing_channels`, so `chData` is null → `pollResult='failed'` (line 341) → `finalStatus='failed'` (line 349). Then the `finalize` step.run (line 359) issues:

```ts
UPDATE publishing_jobs SET status='failed', finished_at=?, error='Publish polling timed out or failed' WHERE id=?
```

This **overwrites the `live` status set at line 215** and inserts a SECOND `publishing_results` row at line 391 with `post_url: null`.

Result for every Telegram post:
- `publishing_jobs.status` = `'failed'` (visible to user as failed despite Bot API success)
- `publishing_jobs.error` = `'Publish polling timed out or failed'`
- 2 rows in `publishing_results` (one with the real `post_url`, one with `null`)

**Why tests didn't catch this:** No integration tests for `publish-execute.ts`. The 15 unit tests for `telegram-publisher.ts` mock `fetch` and exercise the publisher in isolation; they never run through publishExecute's polling loop.

**Fix options (any one):**

```ts
// Option A — change return status so the early-exit guard catches Telegram
return { skipped: false, jobId, status: 'live', externalPostId: tgPostId, provider: 'telegram' };
// then update the ClaimResult union to include 'live' and the early-exit guard:
if (claimResult.skipped || claimResult.status === 'live' || claimResult.status !== 'processing' || !claimResult.externalPostId) {
  return claimResult;
}

// Option B — short-circuit at the outer guard on provider
if (claimResult.skipped || claimResult.status !== 'processing' || !claimResult.externalPostId
    || claimResult.provider === 'telegram') {
  return claimResult;
}

// Option C — return a unique sentinel:
return { skipped: false, jobId, status: 'finalized', externalPostId: tgPostId, provider: 'telegram' };
// and treat any status !== 'processing' as already-finalized.
```

Option A is cleanest and most aligned with the existing FSM. Add a publish-execute integration test before fixing.

## Major

### M1. distribute/route.ts:38 — Zod `max(12)` blocks selecting all 13 providers

**File:** `src/app/api/v1/videos/[id]/distribute/route.ts:38`

```ts
channelProviders: z.array(z.enum(CHANNEL_PROVIDERS)).min(1).max(12),
```

`CHANNEL_PROVIDERS` array (line 32–35) has 13 entries (12 OAuth + telegram). A user who selects every channel hits a 422 with no actionable error. Bump to `max(13)` (or omit the upper bound entirely — there's no strong reason to cap it at the count of supported providers).

```ts
channelProviders: z.array(z.enum(CHANNEL_PROVIDERS)).min(1).max(13),
```

### M2. migrations/0099 — comment claims idempotency, SQL is not idempotent

**File:** `migrations/0099-publishing-jobs-add-provider.sql:9`

The header comment says:

```
-- Safe to re-run (IF NOT EXISTS + idempotent ALTER).
```

But SQLite's `ALTER TABLE ... ADD COLUMN` does NOT accept `IF NOT EXISTS`, and the SQL itself is:

```sql
ALTER TABLE publishing_jobs ADD COLUMN provider TEXT NOT NULL DEFAULT '';
```

Re-running this fails with `SQLite error: duplicate column name: provider`. The tester report flagged this correctly. The fix is one of:

1. Remove the misleading comment (cheapest — single-shot apply per `apply-migrations.sh`).
2. Wrap in `apply-migrations.sh` with a `PRAGMA table_info(publishing_jobs)` pre-check.
3. Switch to `CREATE TABLE IF NOT EXISTS publishing_jobs_v2` + INSERT-from-SELECT migration pattern (overkill here).

Recommend **option 1** (delete the misleading comment, replace with `Single-shot. Reapply will fail with "duplicate column" — that is expected.`). Document in deploy runbook to apply via `bash scripts/apply-migrations.sh` exactly once, never `wrangler d1 execute --file` manually after that.

## Minor

### m1. publish-execute.ts:211–217 — redundant double UPDATE in Telegram branch

```ts
await db.from('publishing_jobs').update({ status: 'processing' }).eq('id', jobId);
await db.from('publishing_jobs').update({
  status: 'live',
  finished_at: Math.floor(Date.now() / 1000),
}).eq('id', jobId);
```

Two writes where one suffices. Either drop the `processing` write (we already left `uploading` from the CAS claim and post directly to `live`), or merge into a single update. Cosmetic; no correctness impact beyond doubled D1 round-trips.

### m2. telegram-publisher.ts:122 — bot token in fetch URL is fine, but consider env-overridable API base

```ts
const TELEGRAM_API = 'https://api.telegram.org';
```

Hardcoded. Acceptable per KISS, but a future test/staging Bot API mock would need a code change. Optional: `process.env.TELEGRAM_API_BASE ?? 'https://api.telegram.org'`. Not blocking.

### m3. telegram-publisher.ts:50–55 — comment says "no parse_mode set" but caption is still stripped

```ts
function sanitizeCaption(text: string): string {
  // Remove Telegram MarkdownV2 special chars to avoid parse errors
  // (we send without parse_mode so escaping is not required, but strip anyway)
  ...
}
```

Two contradictory thoughts in one comment. Since payload truly omits `parse_mode` (verified at line 106–111), the strip is defensive belt-and-suspenders. Either strengthen the comment ("future-proofing in case parse_mode is added") or drop the strip and rely on Telegram's plain-text mode. Current behaviour is correct — only the comment is muddy.

### m4. publish-execute.ts:172 — type cast for `provider` field is loose

```ts
const jobProvider = (job as PublishingJob & { provider?: string }).provider ?? '';
```

`PublishingJob` interface in `publisher-interface.ts:55` already declares `provider: ChannelProvider` (non-optional, post-migration 0099). The intersection cast widens it to allow `undefined`. After 0099 backfill, every row has `provider TEXT NOT NULL DEFAULT ''`, so the field exists and `??''` is dead. Cleaner:

```ts
const jobProvider = job.provider ?? '';
```

(Or remove the `?? ''` entirely once you trust the schema — but the `??` is harmless safety.)

### m5. get-user-channels.ts:75 — `display_name` fallback should preserve null contract

```ts
display_name: row.first_name ?? 'Telegram',
```

Existing OAuth rows return `display_name: r.display_name` (which is `string | null`). The Telegram synthetic always returns a non-null string. UI consumers of `UserChannel.display_name` may have null-handling that becomes dead code for Telegram. Either:
- Match the contract: `display_name: row.first_name` (allow null)
- Or, document that `display_name` is non-null specifically for Telegram (current behaviour, fine if intentional)

Cosmetic; aligns the type contract with the data.

### m6. distribute/route.ts:138 — Telegram lookup uses `LIMIT 1` but pairings should be 1:1 per user

```ts
SELECT chat_id FROM telegram_paired_chats WHERE paired_by = ? LIMIT 1
```

`telegram_paired_chats.chat_id` is the PRIMARY KEY (per migration 0077), but `paired_by` is not unique-indexed — a single user could (in theory) have multiple paired chats. The `LIMIT 1` picks an arbitrary one. Two questions:
1. Is multi-pairing per user intentional? If yes, the route silently picks one with no UI selector — surprise.
2. If no, add `UNIQUE(paired_by)` constraint OR explicit `ORDER BY paired_at DESC LIMIT 1` (newest pairing wins) for determinism.

Not blocking — but document the intent.

### m7. publish-execute.ts:189–201 — pairing re-check is good but performs an extra D1 round-trip

The pairing verification `WHERE chat_id=? AND paired_by=tenantId` (line 191–194) duplicates a check the distribute route already did. Defense-in-depth is good for an Inngest worker (separate trust boundary), but worth noting it doubles D1 latency on the happy path. Keep as-is — the security value (preventing cross-user posting if pairing is revoked between dispatch and execute) outweighs the latency cost.

## Strengths

- **Token masking** in `maskToken()` is correct — only first 6 chars exposed in logs/errors, never the full token. Test `bot token is NEVER logged in plain form` proves it.
- **Error taxonomy** in publishToTelegram is thoughtful: 429 → throw with Retry-After (Inngest retries with backoff), 401/403 → throw with hint, network error → throw, parse error → throw with HTTP status. All paths surface to Inngest for retry, none silently swallowed.
- **URL builder** correctly distinguishes public (`t.me/<username>/<id>`), private channel (`t.me/c/<id_no_-100>/<id>`), and DM placeholder. Three test cases prove it.
- **Caption sanitization** strips MarkdownV2 special chars — defensive even though `parse_mode` is omitted. 18-char regex covers the full Telegram MarkdownV2 spec.
- **Pairing ownership re-verification** in publish-execute.ts:189 (paired_by == tenantId) is the right cross-user-posting defense at the worker boundary.
- **Layer architecture clean** — telegram-publisher.ts only imports from `@/seed/utils/*` (forest → seed allowed). No banned cross-layer.
- **Quota config** for Telegram (300/day) is conservative and below Bot API's 30 msg/sec hard limit per chat.
- **15 unit tests** with strong coverage of failure modes (auth errors, rate limit, network failure, malformed response, masking, truncation, special-char strip).
- **Phase 04 hotfix** is the obvious correct change — `paired_by` matches the schema (migration 0077 line 7) and other queries (`get-user-channels.ts:65`, `distribute/route.ts:141`, `redeem-free/route.ts:191`, `telegram-publisher.ts` ownership check).

## Cross-pipeline gap stance

**Agree** with the gated-ship rationale, with one caveat.

The reasoning is sound: `assertSafeVideoUrl()` rejects non-R2 hostnames, and Phase 03's Telegram path inherits this guard. Wave 16 ships the entire distribute UI behind `NEXT_PUBLIC_DISTRIBUTE_ENABLED` (default off → button hidden), so the only way to trigger publishExecute is via direct API hit + flag flip. Wave 17 will resolve the cross-pipeline (HeyGen videos.id stored in publishing_jobs.video_job_id where video_jobs lookup expects video_jobs.id) and bridge the R2 URL pipeline.

**Caveat:** the C1 critical bug above (Telegram dispatch overwritten by polling loop) means even if the SSRF guard passes and the Bot API call succeeds, the user-visible state will still show `failed`. So the gated-ship rationale protects against external SSRF, but does NOT protect against this internal logic bug — a user with the flag enabled (admin, beta tester) will see broken Telegram posts. C1 must ship green before the flag flips.

## Phase 04 hotfix verification

- One-line fix at `src/app/[locale]/dashboard/onboarding/page.tsx:42` from `user_id = ?1` to `paired_by = ?1`. **Correct.**
- Schema confirms: `migrations/0077-telegram-pairing.sql:3-8` defines `telegram_paired_chats(chat_id PK, first_name, paired_at, paired_by)` — there is NO `user_id` column on this table. Pre-fix query would return zero rows on every onboarding load, leaving step 2 perpetually incomplete for users who only paired Telegram.
- **Cross-grep for other broken queries:** ran `grep -rn telegram_paired_chats src/`. Found 8 query sites:
  - `src/seed/db/get-user-channels.ts:65` — `WHERE paired_by = ?` ✅
  - `src/app/api/v1/videos/[id]/distribute/route.ts:141` — `WHERE paired_by = ? LIMIT 1` ✅
  - `src/app/api/promo/redeem-free/route.ts:191` — `.eq('paired_by', userId)` ✅
  - `src/forest/inngest/functions/publish-execute.ts:194` — `.eq('paired_by', tenantId)` ✅
  - `src/lib/telegram/pairing.ts:59,148,162,169` — query by `chat_id` directly (no user filter, intentional — admin listing / pairing approve) ✅
  - `src/app/[locale]/dashboard/onboarding/page.tsx:42` — `WHERE paired_by = ?1` ✅ (post-fix)
- **No other broken queries.** The Phase 04 site was the only `user_id` instance — every other query correctly uses `paired_by` or the PK `chat_id`. Hotfix is complete.
- Note: line 39–43 of `onboarding/page.tsx` uses `UNION ALL ... LIMIT 1` which has SQLite parser ambiguity (LIMIT may bind to the second SELECT only). This was flagged in the prior wave-16 code review and is unchanged here — not a regression introduced by Phase 03/04, but should be revisited when adjacent code is touched again.

## Unresolved

- Why does the Telegram branch return `status: 'processing'` when it could safely return `'live'` and short-circuit? The intent comment at line 213 says "no polling needed" — the code's outer guard contradicts that. Likely an oversight during refactor; one of the C1 fix options will resolve it.
- Should `telegram_paired_chats` have a `UNIQUE(paired_by)` constraint to prevent multi-pairing per user? Current schema allows it but every consumer assumes 1:1. Worth a follow-up migration if the assumption is intentional.
- `oauth-token-refresher.ts:173` switches on `channel.provider` and throws default for unknown providers. Telegram channels never enter `publishing_channels`, so this is safe — but if someone manually inserts a `publishing_channels` row with `provider='telegram'` (e.g. via SQL fix script), the cron job will throw `Unknown provider: telegram` and mark the row `expired`. Defensive — not a bug, just a sharp edge.
- No integration test coverage for `publish-execute.ts` end-to-end. The C1 bug would have been caught by a single integration test exercising the Telegram dispatch path. Recommend adding before Wave 17.

---

**Auto-approve:** No (score 7.5 < 9.5; 1 critical). Fix C1 + M1 + M2 before deploy. m1–m7 are nice-to-have polish — defer to a cleanup PR.
