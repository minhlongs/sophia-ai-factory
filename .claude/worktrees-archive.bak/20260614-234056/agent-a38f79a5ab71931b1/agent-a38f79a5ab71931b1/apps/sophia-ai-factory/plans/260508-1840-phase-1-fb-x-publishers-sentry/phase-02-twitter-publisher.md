# Phase 02 — X/Twitter Publisher

## Context Links

- Interface: `src/lib/publishing/publisher-interface.ts`
- Closest analog: `src/lib/publishing/tiktok-publisher.ts` (PKCE OAuth, refresh_token flow)
- TikTok OAuth client (PKCE pattern reference): `src/lib/tiktok/tiktok-oauth-client.ts`, `src/lib/tiktok/tiktok-token-manager.ts`
- Token refresher: `src/lib/publishing/oauth-token-refresher.ts`
- Inngest registration: `src/forest/inngest/functions/publish-execute.ts`
- UI: `src/app/[locale]/dashboard/integrations/channels/channels-client.tsx`
- X API docs (v2): https://docs.x.com/x-api/posts/post-create + https://docs.x.com/x-api/media/upload-init

## Overview

- **Priority:** P2
- **Status:** completed
- **Effort:** 2d
- **Description:** Implement `TwitterPublisher` posting video tweets via X API v2 with chunked media upload. OAuth 2.0 with PKCE (no consumer secret needed for public client; we use confidential client for backend with both client_id + client_secret).

## Key Insights

- **Two-step publish:** chunked media upload returns `media_id` → `POST /2/tweets` with `media.media_ids: [id]`.
- **Chunked upload v2** uses 3 phases: INIT → APPEND (per chunk) → FINALIZE. Endpoint: `POST /2/media/upload`.
- **Constraints:** video ≤ 512MB, ≤ 140s for normal video tweet (longer needs Twitter Premium / Media Studio — out of scope).
- **Tweet text limit:** 280 chars (Free/Basic tier). Caption + hashtags + product link must be truncated client-side.
- **PKCE flow:** generate `code_verifier` + `code_challenge` (SHA-256, base64url) at connect time. Store `code_verifier` in HMAC-signed state OR in a short-lived KV/DB row. Cleaner: include in state payload (already HMAC signed) — keeps stateless pattern of tiktok.
- **Refresh tokens:** X v2 issues `refresh_token` when scope includes `offline.access`. Token TTL 2h; refresh via `POST /2/oauth2/token` (Basic auth with client_id:client_secret).
- **Mock mode:** check `TWITTER_CLIENT_ID` absent.
- **Status semantics:** Tweets publish synchronously (HTTP 201 = live). `pollStatus` returns `'live'` immediately for non-mock IDs (mirror Pinterest pattern).
- **Metrics:** `GET /2/tweets/:id?tweet.fields=public_metrics` → `{retweet_count, reply_count, like_count, quote_count, impression_count}`. Free tier may not include `impression_count`.
- **Auth header:** chunked upload uses Bearer `<access_token>`.

## Requirements

### Functional

- `TwitterPublisher implements Publisher`
- Mock mode when `TWITTER_CLIENT_ID` absent (returns `mock_twitter_<ts>`)
- Caption FTC `#ad ` prefix; truncate to 280 chars total
- OAuth at `/api/oauth/twitter/connect` (PKCE; verifier embedded in HMAC-signed state)
- Callback at `/api/oauth/twitter/callback` exchanges code → access + refresh tokens; upserts channel
- Migration extends `provider` CHECK to include `'twitter'` (shared `0090` from Phase 01)
- `buildPublisher()` switch + `buildPostUrl()` add twitter
- `oauth-token-refresher.ts` adds `refreshTwitterToken()` (standard refresh_token grant)
- Settings UI adds X card
- `/api/v1/integrations/channels` `SUPPORTED_PROVIDERS` adds `'twitter'`

### Non-Functional

- Files under 200 LOC
- Zero `:any`
- Stream upload chunks (5MB each) to keep memory bounded
- Idempotent: chunked init returns `media_id`; if APPEND fails, retry only failed chunks (defer; KISS — let outer retry replay full upload for MVP)

## Architecture

### Publisher data flow

```
publisher.upload(videoUrl, meta):
  1. fetch(videoUrl) → ReadableStream (or Blob for ≤512MB)
  2. POST /2/media/upload?command=INIT&media_type=video/mp4&total_bytes=N
     → { data: { id: media_id } }
  3. for each 5MB chunk:
       POST /2/media/upload?command=APPEND&media_id=...&segment_index=N
       multipart form: media=<chunk>
  4. POST /2/media/upload?command=FINALIZE&media_id=...
     → may return processing_info; poll GET /2/media/upload?command=STATUS&media_id=... if state=pending
  5. POST /2/tweets
     body: { text, media: { media_ids: [media_id] } }
     → { data: { id: tweet_id } }
  Return tweet_id.

publisher.pollStatus(tweetId):
  Tweets are live on creation; just verify GET /2/tweets/:id (404 → failed; 200 → live).

publisher.getMetrics(tweetId):
  GET /2/tweets/:id?tweet.fields=public_metrics
  Map: views=impression_count, likes=like_count, comments=reply_count, shares=retweet_count + quote_count.
```

### OAuth (PKCE)

```
/api/oauth/twitter/connect
  → code_verifier = base64url(crypto.getRandomValues(32))
  → code_challenge = base64url(sha256(code_verifier))
  → buildSignedState({ userId, ts, codeVerifier })  [extend tiktok pattern]
  → redirect: https://twitter.com/i/oauth2/authorize
       client_id, redirect_uri, response_type=code,
       scope=tweet.read tweet.write users.read media.write offline.access,
       state, code_challenge, code_challenge_method=S256

/api/oauth/twitter/callback
  → verifyState → extract codeVerifier
  → POST https://api.x.com/2/oauth2/token
       Basic auth client_id:client_secret
       body: grant_type=authorization_code, code, redirect_uri, code_verifier
  → { access_token, refresh_token, expires_in (~7200) }
  → GET https://api.x.com/2/users/me  → { id, username, name }
  → upsert publishing_channels (provider='twitter', external_account_id=user.id, display_name=`@${username}`)
```

### Token refresh

```
refreshTwitterToken(refreshToken):
  POST https://api.x.com/2/oauth2/token
    Basic auth client_id:client_secret
    body: grant_type=refresh_token, refresh_token=<r>
  → { access_token, refresh_token, expires_in }
  Note: X may rotate refresh_token — must update both fields when present.
```

## Related Code Files

### Create
- `src/lib/publishing/twitter-publisher.ts` (≤180 LOC; helpers extracted if oversize)
- `src/lib/publishing/twitter-oauth-client.ts` (≤120 LOC — exchangeCodeForTokens, getUserInfo, refreshAccessToken)
- `src/lib/publishing/__tests__/twitter-publisher.test.ts`
- `src/app/api/oauth/twitter/connect/route.ts`
- `src/app/api/oauth/twitter/callback/route.ts`

### Modify
- `src/lib/publishing/publisher-interface.ts` — extend `ChannelProvider` with `'twitter'`
- `src/forest/inngest/functions/publish-execute.ts` — buildPublisher + buildPostUrl
- `src/lib/publishing/oauth-token-refresher.ts` — `case 'twitter'` calling new refresh helper
- `src/app/[locale]/dashboard/integrations/channels/channels-client.tsx` — add X card
- `src/app/api/v1/integrations/channels/route.ts` — extend SUPPORTED_PROVIDERS
- `migrations/0090-publisher-add-facebook-twitter.sql` — shared with Phase 01

### Delete
- None

## Implementation Steps

1. **Type union** — extend `ChannelProvider` with `'twitter'`.
2. **OAuth client** — `twitter-oauth-client.ts`:
   - `exchangeCodeForTokens(code, codeVerifier)` → POST /2/oauth2/token (Basic auth)
   - `getUserInfo(accessToken)` → GET /2/users/me
   - `refreshAccessToken(refreshToken)` → POST /2/oauth2/token grant_type=refresh_token
   - `getAuthorizationUrl(state, codeChallenge)` → builds twitter.com/i/oauth2/authorize URL
   - `generatePkce()` helper → returns `{ codeVerifier, codeChallenge }`
3. **Publisher class** — `twitter-publisher.ts`:
   - Constants: `X_API='https://api.x.com'`, `CHUNK_SIZE=5*1024*1024`, `MAX_TEXT=280`, `MAX_DURATION_S=140`
   - `isMockMode()` checks `TWITTER_CLIENT_ID`
   - `upload()`: build text (caption with `#ad ` + truncated link, ≤280); fetch video → INIT/APPEND/FINALIZE; if `processing_info.state === 'pending'` poll STATUS up to 6 times w/ 5s sleep (or rely on outer poll — KISS: skip media polling, attach immediately and let tweet POST 4xx if not ready, then bubble up retry)
   - `pollStatus()`: GET /2/tweets/:id → 404 fail, 200 live, else processing
   - `getMetrics()`: GET /2/tweets/:id?tweet.fields=public_metrics
4. **OAuth connect route** — generate PKCE, embed `codeVerifier` in HMAC-signed state, redirect.
5. **OAuth callback route** — verify state, extract verifier, exchange tokens, fetch user, upsert.
6. **Inngest registration** — add to `buildPublisher`:
   ```ts
   case 'twitter':
     return new TwitterPublisher(accessToken);
   ```
   `buildPostUrl`: `https://twitter.com/i/status/${tweetId}`
7. **Token refresher** — add `case 'twitter'` calling `refreshTwitterToken` and persist rotated refresh_token if present (rotation-aware: extend refreshChannelToken signature to optionally update refresh_token — currently only updates access_token; if behavior change is too invasive, store rotated refresh_token in same flow by extending the switch to set both).
8. **UI** — add to CHANNEL_META:
   ```ts
   twitter: { label: 'X (Twitter)', icon: 'tag', connectPath: '/api/oauth/twitter/connect' }
   ```
9. **API route** — add `'twitter'` to SUPPORTED_PROVIDERS.
10. **Tests** — `twitter-publisher.test.ts`: mock mode (3), real mode upload happy path (mock fetch INIT/APPEND/FINALIZE/tweet — 1), pollStatus 404 → failed (1), getMetrics shape (1).
11. **Migration** — coordinate `0090` with Phase 01 (single migration adds both `'facebook'` and `'twitter'`).
12. **Build + test** — `npm run build && npm test`.
13. **Commit** — `feat(publishing): add X/Twitter publisher with PKCE OAuth and chunked media upload`

## Todo List

- [x] Migration `0090` — extend CHECK to include `twitter` (shared with phase 01)
- [x] Extend ChannelProvider with `'twitter'`
- [x] Implement `twitter-oauth-client.ts` (PKCE helpers + token exchange)
- [x] Implement `twitter-publisher.ts` (chunked upload + tweet POST)
- [x] Implement `/api/oauth/twitter/connect/route.ts` (PKCE)
- [x] Implement `/api/oauth/twitter/callback/route.ts`
- [x] Register in `publish-execute.ts` buildPublisher + buildPostUrl
- [x] Register in `oauth-token-refresher.ts` (refresh_token rotation)
- [x] Add to `channels-client.tsx` CHANNEL_META
- [x] Add to `/api/v1/integrations/channels/route.ts` SUPPORTED_PROVIDERS
- [x] Write `twitter-publisher.test.ts`
- [x] `npm run build` — 0 TS errors
- [x] `npm test` — all pass
- [ ] Set wrangler secrets: `TWITTER_CLIENT_ID`, `TWITTER_CLIENT_SECRET` (operator action)
- [ ] Manual smoke: OAuth round-trip + post a test tweet via Inngest dev (operator action)

## Success Criteria

- 6+ unit tests pass (mock + real)
- Build clean, no `:any`
- Settings UI shows X card
- D1 migration applied; CHECK accepts `'twitter'`
- Live OAuth + tweet smoke test on production with a test account

## Risk Assessment

- **PKCE state size** — code_verifier in state payload makes state cookie ~150 chars longer. Acceptable; Cloudflare URL limits are generous.
- **X rate limits** — Free tier extremely tight (1500 posts/month). Mitigation: document tier requirement in UI tooltip ("requires X Basic plan or higher for production volume").
- **Refresh token rotation** — must persist new refresh_token when X rotates. Mitigation: extend `oauth-token-refresher.ts` `refreshChannelToken` to update refresh_token field when returned (currently only updates access_token); contained change.
- **Chunked upload partial failure** — APPEND of chunk N fails → outer retry replays whole upload. Wasteful but simple. Mitigation: defer resumable upload to Phase 2.
- **Video constraints** — > 512MB or > 140s will hard-fail. Mitigation: validate up-front; clear error message; let outer FSM mark `failed` (no retry).

## Security Considerations

- Access + refresh tokens encrypted (AES-256-GCM)
- HMAC-signed state with embedded PKCE verifier (10-min TTL)
- Bearer never logged (centralized sanitizeError)
- `getCurrentUserFromHeaders()` enforces session
- Banned imports respected
- Zod-validate query params on callback (code, state)

## Next Steps

- Phase 03 (Sentry) is independent
- Post-merge announce in Telegram help that X is supported
- Future: refresh-token rotation persisting also benefits any future provider that rotates refresh tokens (already true for tiktok)

## Unresolved Questions

- Should we let the user pick which X account if they have multiple? Defer (KISS — first account wins, document in UI).
- Should media upload poll STATUS phase or rely on outer FSM retry? KISS: skip inner polling for MVP; if X returns "media still processing" on tweet POST, surface as transient error → retry path.
