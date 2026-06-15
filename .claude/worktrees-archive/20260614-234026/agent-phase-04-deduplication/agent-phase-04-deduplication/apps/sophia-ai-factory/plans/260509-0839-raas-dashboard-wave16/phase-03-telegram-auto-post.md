---
status: done (gated)
---

# Phase 03 — Telegram Auto-Post Channel

## Context Links
- Audit: `plans/reports/scout-260509-0839-raas-dashboard-gap.md` §P1.1
- Existing bot: `src/tree/telegram/telegram-bot-campaign-handlers.ts`
- Telegram pairing table: `telegram_paired_chats` (per audit §3)
- Phase 02 dependency: `DistributePanel` + `/api/v1/videos/[id]/distribute` exist.

## Overview
- **Priority:** P1.1
- **Status:** pending (depends on Phase 02)
- **Description:** Add Telegram as a selectable "channel" in the distribution panel from Phase 02. When checked, post the finished video to user's paired Telegram chat/channel via existing bot infrastructure. Reuse `@Sophia_Bbot` connection — no new bot, no new OAuth.

## Key Insights
- Telegram pairing already happens via bot deep-link (existing flow); we only READ pairing here.
- Audit suggests new event `telegram/post.requested` + new Inngest handler. KISS: piggyback on `publish.scheduled` with `provider: 'telegram'` so existing `publishExecute` dispatches it. ONE new step inside `publishExecute` switch (or registered telegram publisher module). Keeps the system uniform.
- Telegram post = call Bot API `sendVideo` with chat_id from `telegram_paired_chats` + caption.
- For `is_channel=true` vs DM chat: same `sendVideo` API call; user's pairing record stores correct `chat_id`.

## Requirements

### Functional
- DistributePanel from Phase 02 lists Telegram alongside YouTube/TikTok/etc IF user has row in `telegram_paired_chats`.
- Display label: `Telegram (@<username>)` or `Telegram (channel: <title>)` based on `is_channel`.
- Selecting Telegram + submit → publishing_jobs row with `provider='telegram'` → `publishExecute` dispatches.
- `publishExecute` calls new module `forest/publishing/providers/telegram-publisher.ts` which calls Bot API.
- On success: `publishing_jobs.status = 'live'`; `external_post_id = telegram_message_id`; `external_url = t.me/<username>/<message_id>`.
- On failure: status `failed`; error stored.

### Non-Functional
- Reuse `TELEGRAM_BOT_TOKEN` env (already set).
- File <200 LOC.

## Architecture
```
DistributePanel (Phase 02)
   └─ checkbox: Telegram (@user) ──┐
                                   ▼
   POST /api/v1/videos/[id]/distribute  (channelProviders includes 'telegram')
                                   │
                                   ▼
   schedule-publish.ts inserts publishing_jobs (provider='telegram')
                                   │
                                   ▼
   publishExecute  (existing — adds dispatch case for 'telegram')
                                   │
                                   ▼
   forest/publishing/providers/telegram-publisher.ts  (NEW)
       └─ read telegram_paired_chats by user_id
       └─ fetch video_url
       └─ Bot API POST /sendVideo  { chat_id, video, caption }
       └─ return { externalPostId, externalUrl }
```

Layer placement:
- `telegram-publisher.ts` is in forest (orchestration) — calls Telegram Bot API directly. May import existing `tree/telegram/*` clients if pattern matches.

## Related Code Files

### Modify
- `src/forest/inngest/functions/publish-execute.ts` — add `'telegram'` case to provider switch (single step add).
- `src/seed/db/get-user-channels.ts` (from Phase 02) — also include Telegram pairings in returned list.
- `src/app/[locale]/dashboard/videos/[id]/distribute/distribute-panel.tsx` — accept `'telegram'` as valid provider.
- `src/app/api/v1/videos/[id]/distribute/route.ts` — extend Zod enum to include `'telegram'`.

### Create
- `src/forest/publishing/providers/telegram-publisher.ts` (~120 LOC) — Bot API call wrapper.
- `src/forest/publishing/providers/__tests__/telegram-publisher.test.ts` — unit tests.

## Implementation Steps
1. Inspect existing `publishExecute` switch (around line 200+ where providers are dispatched). Confirm shape `{ externalPostId, externalUrl }` return contract.
2. Build `telegram-publisher.ts`:
   - Input: `{ jobId, userId, videoUrl, caption }`.
   - Query `telegram_paired_chats` where `paired_by = userId` (single active row).
   - Throw if no pairing — `publishExecute` will mark job failed.
   - Call `https://api.telegram.org/bot<TOKEN>/sendVideo` with `{ chat_id, video: videoUrl, caption }` (multipart not needed; Telegram fetches URL).
   - Parse response: `{ ok, result: { message_id, chat: { username } } }`.
   - Return `{ externalPostId: String(message_id), externalUrl: 'https://t.me/<username>/<message_id>' }`.
   - Handle 429 (rate limit) by throwing — Inngest retries.
3. Add `case 'telegram': return telegramPublisher(...)` in `publishExecute` provider dispatch.
4. Extend `get-user-channels.ts` to query `telegram_paired_chats` and append `{ provider: 'telegram', display_name: '@'+username, status: 'connected' }`.
5. Update Zod enum and panel checkbox metadata.
6. i18n: `dashboard.videos.distribute.telegram.label` etc.
7. Unit test `telegram-publisher`: mock Bot API, assert payload + return shape.
8. e2e flow test: video → distribute → telegram checked → message appears in test bot's chat (mock in CI).
9. `npm run build`, `npm test`, deploy + SHA verify.

## Todo List
- [x] Audit `publishExecute` provider switch shape
- [x] Implement `telegram-publisher.ts` (175 LOC)
- [x] Wire 'telegram' case in `publishExecute`
- [x] Extend `get-user-channels.ts` to include Telegram pairings
- [x] Extend Zod enum + panel metadata for 'telegram'
- [x] i18n keys (en + vi)
- [x] Unit test `telegram-publisher` (15 tests)
- [x] Integration test: schedule + dispatch (7 C1 regression tests)
- [x] `npm run build` clean
- [x] `npm test` all pass (3018/3018)
- [x] Deploy + SHA-match verify

## Success Criteria
- User with paired Telegram sees "Telegram (@username)" checkbox in distribute panel.
- Checking + submit → video appears in Telegram chat with caption.
- `publishing_jobs.external_url` is a clickable t.me link.
- Users without pairing see no Telegram option (auto-hidden).

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Telegram URL fetch fails (R2 access) | M | M | Ensure video_url is publicly accessible OR pre-sign; fallback to multipart upload. |
| Bot API rate limit (30 msg/sec/chat) | L | M | Inngest retries; only 1 video per submission. |
| Pairing expired/revoked | M | M | Catch 401/403; mark job failed with "Pairing invalid — re-pair via /start in bot". |
| `is_channel` requires bot admin role | M | M | Pre-check: if pairing.is_channel and bot lacks admin → fail with explicit hint. |
| TELEGRAM_BOT_TOKEN missing in worker env | L | H | Fail-fast on init; add to deploy runbook. |

## Security Considerations
- Verify `paired_by = current_user.id` server-side before posting (no cross-user posting).
- Never log full bot token; mask in error output.
- Caption stripped of telegram-control chars (markdown escapes).
- Rate-limit telegram-specific publishes to 5/min per user (in API route).

## Completion Notes

**Files Created:**
- `src/forest/publishing/providers/telegram-publisher.ts` (175 LOC) — Bot API call wrapper with error handling
- `src/forest/publishing/providers/__tests__/telegram-publisher.test.ts` (15 tests) — unit tests for telegram-publisher
- `src/forest/inngest/functions/__tests__/publish-execute-telegram-c1.test.ts` (7 C1 regression tests) — C1 fix verification
- `migrations/0099-publishing-jobs-add-provider.sql` (10 LOC) — one-shot migration: ALTER TABLE ADD COLUMN

**Files Modified:**
- `src/forest/inngest/functions/publish-execute.ts` — added telegram dispatch + C1 fix (status='live' return, early-exit guard, ClaimResult union extension)
- `src/forest/publishing/schedule-publish.ts` — telegram provider support
- `src/seed/db/get-user-channels.ts` — include telegram pairings in channel list
- `src/app/[locale]/dashboard/videos/[id]/distribute/route.ts` — extended Zod enum with 'telegram'
- `src/forest/publishing/publisher-interface.ts` — telegram provider type
- `src/forest/publishing/per-channel-quota.ts` — telegram quota rules
- `src/app/[locale]/dashboard/videos/[id]/distribute/channel-meta.ts` — telegram metadata + icon
- `src/app/[locale]/dashboard/onboarding/page.tsx:42` — BUNDLED Phase 04 hotfix: `user_id` → `paired_by` column rename (was throwing "no such column" in production)
- `src/app/[locale]/messages/en.json` + `vi.json` — telegram labels and descriptions

**Schema Findings:**
`telegram_paired_chats` columns are: `chat_id, first_name, paired_at, paired_by` (not `is_channel/username/chat_title` as initially planned). URL construction uses Bot API response at post-time.

**Architecture Decision:**
Option A: special-case telegram in route + schedule-publish; bypass `publishing_channels` lookup; new migration 0099 adds `provider TEXT NOT NULL DEFAULT ''` to `publishing_jobs` table.

**Code-Review Findings Fixed:**
- **C1 (critical):** telegram status='processing' caused polling-loop overwrite to 'failed'. FIX: status='live' return + early-exit guard + ClaimResult union extension + redundant write removal
- **M1 (major):** Zod max(12) blocked 13th provider. FIX: Zod max(CHANNEL_PROVIDERS.length) == 13
- **M2 (major):** migration comment falsely claimed idempotency. FIX: updated comment to document one-shot nature

**Phase 04 Hotfix Bundled:**
`src/app/[locale]/dashboard/onboarding/page.tsx:42` column rename: `user_id` → `paired_by` on `telegram_paired_chats` query. Was throwing "column does not exist" error in production at commit 5bcf1e09.

**Verification:**
- Build: ✅ `npm run build` exit code 0
- Tests: ✅ 3018/3018 pass (was 2996, +15 telegram-publisher + 7 C1 regression)
- TypeScript: ✅ 0 errors
- i18n: ✅ 0 missing keys
- Migration: ✅ 0099 one-shot ALTER TABLE ADD COLUMN — apply via `apply-migrations.sh` exactly once. Re-runs error with "duplicate column" (expected behavior)

**Gating:**
Behind NEXT_PUBLIC_DISTRIBUTE_ENABLED flag. Wave 17 unlocks when HeyGen→R2 bridge pipeline ready.

## Next Steps
- Wave 17: scheduled Telegram posts; multi-chat pairing (post to multiple groups); flip feature flag.
