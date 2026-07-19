# Phase 01 — Facebook Publisher

## Context Links

- Interface: `src/lib/publishing/publisher-interface.ts`
- Closest analog: `src/lib/publishing/instagram-publisher.ts` (Meta Graph API)
- Token refresher: `src/lib/publishing/oauth-token-refresher.ts` (Instagram fb_exchange_token pattern reusable)
- OAuth callback analog: `src/app/api/oauth/instagram/callback/route.ts`
- Inngest registration: `src/forest/inngest/functions/publish-execute.ts` (buildPublisher switch)
- UI: `src/app/[locale]/dashboard/integrations/channels/channels-client.tsx`
- Channels API: `src/app/api/v1/integrations/channels/route.ts`
- Migration template: `migrations/0083-publisher-tokens-pinterest-linkedin-zalo.sql`
- Meta docs: https://developers.facebook.com/docs/video-api/guides/reels-publishing

## Overview

- **Priority:** P2
- **Status:** completed
- **Effort:** 1.5d
- **Description:** Implement `FacebookPublisher` posting Reels to a Facebook Page via Graph API v21.0. Uses Page Access Token (encrypted). OAuth flow gets User Access Token → exchanges for long-lived Page Access Token via `/me/accounts`.

## Key Insights

- Facebook Reels uploads use a **3-step flow** (different from Instagram Reels):
  1. `POST /{page-id}/video_reels?upload_phase=start` → returns `video_id` + `upload_url`
  2. `POST <upload_url>` with binary or file_url → Facebook ingests
  3. `POST /{page-id}/video_reels?upload_phase=finish&video_id=<id>` → publishes
- Alternative simpler path (sufficient for MVP): single `POST /{page-id}/video_reels` with `file_url` + `video_state=PUBLISHED`. Use this — KISS.
- Page Access Tokens never expire (NEVER_EXPIRES) when derived from a long-lived User token, IF the user keeps password unchanged. So token refresh is a no-op for FB — but token may still be invalidated; treat 401 as `expired` status.
- `ChannelStatus` already has `'expired'` — no new status needed.
- `external_account_id` = Facebook Page ID (not user ID — a user may admin multiple pages; UI must let user pick which page to connect).
- Page selection at OAuth callback time: list pages from `/me/accounts`, store ALL connected pages or let user pick one (KISS: store first page, document this in UI tooltip — multi-page support deferred).
- v21.0 (current GA as of 2025/2026). Instagram publisher uses v19.0 — that's fine for IG; FB uses v21.0.

## Requirements

### Functional

- `FacebookPublisher implements Publisher` (upload/pollStatus/getMetrics)
- Mock mode when `FACEBOOK_APP_ID` is absent (returns `mock_facebook_<ts>`)
- Caption gets `#ad ` prefix if missing (FTC compliance — match instagram/tiktok pattern)
- OAuth connect at `/api/oauth/facebook/connect` (HMAC signed state — copy tiktok pattern)
- OAuth callback at `/api/oauth/facebook/callback` exchanges code → long-lived user token → fetches first page → upserts `publishing_channels`
- Migration extends `provider` CHECK constraint to include `'facebook'`
- `buildPublisher()` switch adds `case 'facebook'`
- Settings UI adds Facebook card
- `/api/v1/integrations/channels` `SUPPORTED_PROVIDERS` adds `'facebook'`

### Non-Functional

- Files under 200 LOC each
- Zero `:any`
- All inputs Zod-validated where they cross trust boundaries
- Errors sanitized (no Bearer leaks) — already handled centrally in publish-execute

## Architecture

### Data flow (publish)

```
publish-execute.ts (forest)
  → buildPublisher('facebook') → new FacebookPublisher(pageAccessToken, pageId)
  → publisher.upload(videoUrl, meta) → POST /{page-id}/video_reels (file_url) → fb_video_id
  → step.sleep + pollStatus → GET /{video-id}?fields=status → live | processing | failed
  → finalize: getMetrics → GET /{video-id}/video_insights
```

### Auth flow (OAuth)

```
/api/oauth/facebook/connect
  → buildSignedState(userId)  [HMAC-SHA256, copy tiktok pattern]
  → redirect to https://www.facebook.com/v21.0/dialog/oauth
     scope: pages_show_list, pages_read_engagement, pages_manage_posts, publish_video

/api/oauth/facebook/callback
  → verifyState
  → exchange code → short-lived user token
  → exchange short → long-lived user token (60d)
  → GET /me/accounts?fields=id,name,access_token → page list
  → take first page (or page_id query param if user re-opens connect with selection)
  → encryptToken(page_access_token)
  → upsert publishing_channels (provider='facebook', external_account_id=page.id, refresh_token=null)
```

### Token "refresh"

Page tokens don't expire. Add `case 'facebook':` to `oauth-token-refresher.ts` that returns the existing token unchanged (no-op refresh — keeps invariant simple). Document in code comment.

## Related Code Files

### Create
- `src/lib/publishing/facebook-publisher.ts` (≤180 LOC)
- `src/lib/publishing/__tests__/facebook-publisher.test.ts` (mirror instagram-publisher.test.ts)
- `src/app/api/oauth/facebook/connect/route.ts` (≤45 LOC, copy of tiktok connect)
- `src/app/api/oauth/facebook/callback/route.ts` (≤180 LOC, fork of instagram callback)
- `migrations/0090-publisher-add-facebook-twitter.sql` (single migration shared with phase 02)

### Modify
- `src/lib/publishing/publisher-interface.ts` — extend `ChannelProvider` to include `'facebook'`
- `src/forest/inngest/functions/publish-execute.ts` — add `case 'facebook'` in `buildPublisher` + `buildPostUrl`
- `src/lib/publishing/oauth-token-refresher.ts` — add no-op `case 'facebook'` branch
- `src/app/[locale]/dashboard/integrations/channels/channels-client.tsx` — add `facebook` to CHANNEL_META
- `src/app/api/v1/integrations/channels/route.ts` — add `'facebook'` to `SUPPORTED_PROVIDERS`
- `docs/code-standards.md` (channel list update if any)

### Delete
- None

## Implementation Steps

1. **Migration first** — write `migrations/0090-publisher-add-facebook-twitter.sql` to recreate the CHECK constraint with `facebook` and `twitter` (D1/SQLite cannot ALTER CHECK; recreate table with data copy or use `IF NOT EXISTS` + create new with broader constraint, then drop old). Use the pattern from 0083 if table already permits — verify by reading current schema; if CHECK is enforced, do a CREATE TABLE_new + INSERT SELECT + DROP + RENAME.
2. **Type union** — add `'facebook'` to `ChannelProvider` in `publisher-interface.ts`.
3. **Publisher class** — implement `facebook-publisher.ts`:
   - Constants: `GRAPH_API_VERSION='v21.0'`, `GRAPH_BASE`
   - `isMockMode()` checks `FACEBOOK_APP_ID`
   - `upload()`: build caption with `#ad ` prefix + hashtags + productLink. POST `/{pageId}/video_reels` body `{video_url, description, video_state:'PUBLISHED', access_token}`. Return `id`.
   - `pollStatus()`: GET `/{videoId}?fields=status&access_token=...` → map `ready` → live, `error` → failed, else processing.
   - `getMetrics()`: GET `/{videoId}/video_insights?metric=total_video_impressions,total_video_views,post_video_likes_by_reaction_type` → map to `MetricsJson`.
4. **OAuth connect route** — copy `oauth/tiktok/connect/route.ts`, swap auth URL:
   ```
   https://www.facebook.com/v21.0/dialog/oauth?client_id=...&redirect_uri=...&state=...&scope=pages_show_list,pages_read_engagement,pages_manage_posts,publish_video
   ```
5. **OAuth callback route** — fork `oauth/instagram/callback/route.ts`:
   - Exchange code → short-lived user token
   - Exchange short → long-lived (60d) user token (existing `fb_exchange_token` flow)
   - GET `/me/accounts` → pages array → pick first
   - Use page's `access_token` (Page Access Token) — encrypt and store
   - Upsert with `external_account_id = page.id`, `display_name = page.name`, `refresh_token = null`, `expires_at = null` (page tokens don't expire)
6. **Inngest registration** — add to `buildPublisher`:
   ```ts
   case 'facebook':
     return new FacebookPublisher(accessToken, channel.external_account_id);
   ```
   Add to `buildPostUrl`: `https://www.facebook.com/{pageId}/videos/{videoId}`.
7. **Token refresher** — add to `refreshChannelToken` switch:
   ```ts
   case 'facebook':
     // Page Access Tokens don't expire when derived from long-lived user token.
     // No-op: return existing expiry unchanged.
     return channel.expires_at ?? Math.floor(Date.now()/1000) + 86400 * 365;
   ```
8. **UI registration** — `channels-client.tsx` add to `CHANNEL_META`:
   ```ts
   facebook: { label: 'Facebook', icon: 'thumb_up', connectPath: '/api/oauth/facebook/connect' }
   ```
9. **API route** — add `'facebook'` to `SUPPORTED_PROVIDERS` in `/api/v1/integrations/channels/route.ts`.
10. **Tests** — write `facebook-publisher.test.ts` covering mock mode (3 cases) + real mode upload (1 case). Mirror `instagram-publisher.test.ts`.
11. **Build + test** — `npm run build && npm test`. Fix any TS errors immediately.
12. **Commit** — `feat(publishing): add Facebook Reels publisher with OAuth flow`

## Todo List

- [x] Write migration `0090-publisher-add-facebook-twitter.sql` (CHECK constraint extend)
- [x] Extend `ChannelProvider` type union in publisher-interface.ts
- [x] Implement `facebook-publisher.ts` (upload/pollStatus/getMetrics + mock mode)
- [x] Implement `/api/oauth/facebook/connect/route.ts`
- [x] Implement `/api/oauth/facebook/callback/route.ts` (Page Access Token fetch)
- [x] Register in `publish-execute.ts` buildPublisher + buildPostUrl
- [x] Register in `oauth-token-refresher.ts` (no-op refresh)
- [x] Add to `channels-client.tsx` CHANNEL_META
- [x] Add to `/api/v1/integrations/channels/route.ts` SUPPORTED_PROVIDERS
- [x] Write `facebook-publisher.test.ts` (mock + real mode)
- [x] Run `npm run build` — 0 TS errors
- [x] Run `npm test` — all pass
- [ ] Set wrangler secrets: `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET` (operator action)
- [ ] Manual smoke: connect flow → publish a test reel via Inngest dev (operator action)
- [ ] Update `docs/code-standards.md` channel list if maintained

## Success Criteria

- New publisher passes 4+ unit tests (mock + real upload)
- Build passes; no `:any`
- Settings UI shows Facebook card
- D1 migration applied; `provider` CHECK accepts `'facebook'`
- Live deploy + manual OAuth round-trip with a test FB Page returns `connected=facebook` redirect

## Risk Assessment

- **CHECK constraint migration** — D1/SQLite ALTER limited. Mitigation: CREATE TABLE_new + INSERT SELECT + DROP old + RENAME. Tested in dev D1 first.
- **Page Access Token revocation undetected** — user changes FB password → token invalidated, but no expiry timestamp signals it. Mitigation: 401 in `pollStatus`/`getMetrics` triggers status='expired' (handled centrally in publish-execute via existing failure flow).
- **Multi-page admin** — picking first page may not be user's choice. Mitigation: document in UI; defer multi-page to Phase 2.
- **Rate limits** — Graph API has per-app and per-user limits. Mitigation: existing retry/backoff in publish-execute is sufficient for MVP volume.

## Security Considerations

- Page Access Token encrypted at rest via `token-crypto.ts` (AES-256-GCM)
- HMAC-signed OAuth state (10-min TTL) — same pattern as tiktok/instagram
- No tokens in error messages (centralized `sanitizeError` in publish-execute)
- `getCurrentUserFromHeaders()` enforces session before connect/callback
- SSRF guard for video URL already centralized
- Banned imports respected: no `@/lib/auth`, no `@/lib/subscription`

## Next Steps

- Phase 02 (twitter) shares the migration `0090` — coordinate so both run as one DB change
- Phase 03 (sentry) is independent
- Post-merge: announce in Telegram bot help text that FB is supported
