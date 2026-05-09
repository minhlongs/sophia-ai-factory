# Wave 11 G4 — Distribution Publishers Report
Date: 2026-05-09

## Status: COMPLETE

## Files Created

**Publishers (4)**
- `src/lib/publishing/threads.ts` — ThreadsPublisher
- `src/lib/publishing/reddit.ts` — RedditPublisher
- `src/lib/publishing/bluesky.ts` — BlueskyPublisher + createAtprotoSession + refreshAtprotoSession
- `src/lib/publishing/mastodon.ts` — MastodonPublisher + parseExternalAccountId

**OAuth Clients (3, no Bluesky — uses app-password)**
- `src/lib/publishing/threads-oauth-client.ts`
- `src/lib/publishing/reddit-oauth-client.ts`
- `src/lib/publishing/mastodon-oauth-client.ts`

**API Routes (7)**
- `src/app/api/oauth/threads/connect/route.ts` (GET — OAuth2 redirect)
- `src/app/api/oauth/threads/callback/route.ts` (GET — code exchange)
- `src/app/api/oauth/reddit/connect/route.ts` (GET — OAuth2 redirect)
- `src/app/api/oauth/reddit/callback/route.ts` (GET — code exchange)
- `src/app/api/oauth/bluesky/connect/route.ts` (POST — app-password session)
- `src/app/api/oauth/mastodon/connect/route.ts` (POST — register app + return authUrl)
- `src/app/api/oauth/mastodon/callback/route.ts` (GET — code exchange)

**Tests (4)**
- `src/lib/publishing/__tests__/threads-publisher.test.ts` (8 tests)
- `src/lib/publishing/__tests__/reddit-publisher.test.ts` (4 tests)
- `src/lib/publishing/__tests__/bluesky-publisher.test.ts` (6 tests)
- `src/lib/publishing/__tests__/mastodon-publisher.test.ts` (7 tests)

**Migration**
- `migrations/0094-publisher-add-distribution-platforms.sql`

## Files Modified (cascading type fixes only)

- `src/lib/publishing/publisher-interface.ts` — ChannelProvider union extended (+4 providers)
- `src/lib/publishing/per-channel-quota.ts` — DAILY_QUOTAS map extended (+4 quotas, required by Record<ChannelProvider,number>)
- `src/forest/inngest/functions/publish-execute.ts` — imports +4, buildPublisher switch +4 cases (APPEND-ONLY, facebook/twitter untouched)

## Platform Auth Method + Token Storage

| Platform | Auth | Token Storage |
|---|---|---|
| Threads | OAuth2 (graph.threads.net, THREADS_APP_ID separate from FB) | accessToken AES-256-GCM, expires_at 60d |
| Reddit | OAuth2 permanent (reddit.com/api/v1/authorize, duration=permanent) | accessToken + refreshToken encrypted |
| Bluesky | App-password → createSession (no OAuth) | accessJwt + refreshJwt AES-256-GCM, expires_at 2h |
| Mastodon | OAuth2, instance-variable (dynamic /api/v1/apps registration) | accessToken AES-256-GCM, compound external_account_id |

## buildPublisher Switch Cases Added: 4
`threads`, `reddit`, `bluesky`, `mastodon` — inserted after `zalo` case, before `default`

## Migration 0094 Summary
Extends CHECK constraint on `publishing_channels.provider` from 8 → 12 values. D1/SQLite TABLE recreate pattern (same as 0090). Adds: `threads`, `reddit`, `bluesky`, `mastodon`. All existing data preserved via INSERT OR IGNORE copy.

## Type Check: PASS (0 errors)
## Tests: PASS — 2852/2852 tests, 288 files (22 new tests added)

## Notable Design Decisions
- Mastodon connect flow is POST (returns authUrl JSON for frontend redirect) because instance URL must be supplied first to register the app dynamically.
- Bluesky connect is POST (app-password, no OAuth redirect needed).
- Mastodon `external_account_id` uses `<instanceUrl>|<accountId>` compound key to support multi-instance uniqueness.
- Reddit `external_account_id` stores username (not t2_ id) since `/api/submit` requires username for profile subreddit.
- Token refresh for new providers (threads, bluesky, mastodon) deferred to oauth-token-refresher.ts — out of this phase's ownership boundary.
