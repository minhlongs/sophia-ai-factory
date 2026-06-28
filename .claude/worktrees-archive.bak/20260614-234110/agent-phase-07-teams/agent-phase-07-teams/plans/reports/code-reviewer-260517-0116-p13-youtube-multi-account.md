# Code Review — P13 YouTube Multi-Account Refactor

## Scope
- `forest/missions/handlers/youtube-list-channels.ts` (refactored)
- `forest/missions/handlers/youtube-publish.ts` (refactored)
- `forest/missions/handlers/youtube-list-channels.test.ts` (NEW)
- `forest/missions/handlers/youtube-publish.test.ts` (NEW)
- `forest/missions/command-registry.ts` (status flipped beta → live)

## Score: 8.5/10
Solid, idiomatic refactor. Schema-correct, multi-tenant-safe, tests cover the matrix. Two follow-ups separate gate this from 10/10: auto-refresh parity with `publish-execute.ts` and a couple of test gaps.

## Answers

1. **Token security ✅** — `decryptToken` usage mirrors `publish-execute.ts` line 329. Decrypted token only passed to `YouTubePublisher` constructor; never logged. Error logs only carry `channelId` (publishing_channels.id) — safe. No `console.log`. `:any` count = 0.

2. **Authorization ✅** — `publish.ts:65-67` filters by `.eq('id', channelId).eq('tenant_id', userId).eq('provider', 'youtube').single()`. Foreign `channel_id` returns `channel_not_found`. Defence-in-depth via UNIQUE(tenant_id, provider, external_account_id) at schema level.

3. **Error codes ✅** — Codes (`missing_*`, `channel_not_found`, `channel_disconnected`, `token_expired`, `token_decrypt_failed`, `youtube_upload_failed`) align in spirit with `avatar-create-did` (`missing_params:*`, `no_byok_did_key`, `avatar_create_failed`). The `hint` payload on `missing_channel_id` and `token_expired` is **better than siblings** — operator-friendly.

4. **Tier gating ✅** — Quota enforced upstream at `app/api/v1/missions/route.ts:71` via `checkAiCommandQuota`. Handlers stay pure. Correct separation of concerns.

5. **Token refresh — gap** — `publish-execute.ts:300` auto-refreshes when `expires_at < now + 3600`. Mission handler returns `token_expired` instead. For zero-bug handover, the `reconnect` UX is acceptable IF Settings page surfaces token-expired state proactively. Recommend wiring `refreshChannelToken(channel)` from `@/lib/publishing/oauth-token-refresher` before failing — single-line fix, eliminates a class of operator-confusion tickets.

6. **Test gaps** — Missing: (a) tenant isolation test (foreign tenant's channel_id returns `channel_not_found`); (b) `provider='tiktok'` row with same id returns `channel_not_found` (provider filter coverage); (c) DB `.error` non-null path; (d) hashtags non-array (string) coerces to `[]`.

## Nice-to-haves (non-blocking)
- Wire auto-refresh (Q5) — parity with `publish-execute.ts`.
- Add 4 test cases above (Q6).
- Sanitize `youtube_upload_failed` `data.message` via `sanitizeError()` pattern from `publish-execute.ts:45` — currently raw `err.message` propagates to caller. Low risk (YouTubePublisher wraps SDK) but cheap to add.
- Consider sorting `channels[]` by `display_name` for stable UX.

## Blockers (critical)
**None.** Ship.

## Verification Status
- Build: not run by reviewer (handler code compiles per type annotations)
- Tests: structure looks correct; one note — `buildDbMock` doesn't assert filter args, so authz claim relies on code-reading not test-proving. Adding the tenant-isolation test in Q6 closes this.

## Unresolved
- Should `youtube:list-channels` filter out `status != 'active'` rows, or return them with status for UI to render warning? Current passthrough is fine but worth confirming with UI design.
- `mock_` prefix check on `external_post_id` (publish.ts:117) — is the YouTubePublisher mock-mode contract documented anywhere? Magic string risks drift.
