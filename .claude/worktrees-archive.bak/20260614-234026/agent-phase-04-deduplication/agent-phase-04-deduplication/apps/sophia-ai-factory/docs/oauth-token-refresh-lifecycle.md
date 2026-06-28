# OAuth Token Refresh Lifecycle

## Overview

Sophia supports 12 publishing platforms with OAuth tokens. The token refresher (`src/lib/publishing/oauth-token-refresher.ts`) automatically refreshes access tokens expiring within 1 hour via a cron-based system. It uses row-level locking (C7 pattern) to prevent concurrent refresh races.

**Cron job:** `publish-token-refresh-cron` (Inngest), runs every 1 hour via `0 * * * *` schedule.

## Supported Platforms

| Platform | Refresh Method | Access Token TTL | Refresh Token Rotates? | Notes |
|----------|---|---|---|---|
| YouTube | OAuth2 `refresh_token` grant | ~1h | No | Permanent refresh_token |
| TikTok | OAuth2 `refresh_token` grant | ~24h | No | Permanent refresh_token |
| Instagram | FB long-lived token re-exchange | 60 days | N/A | No separate refresh_token; re-exchange current token for fresh one |
| Facebook | No-op (synthetic 1-year TTL) | Permanent | N/A | Page Access Tokens don't expire when derived from long-lived user token |
| Pinterest | OAuth2 `refresh_token` grant | ~1h | No | Basic auth on `/v5/oauth/token` endpoint |
| LinkedIn | OAuth2 `refresh_token` grant | ~60 days | No | Standard OAuth2 flow |
| Twitter/X | OAuth2 `refresh_token` grant | ~2h | YES | Rotating refresh token — new value stored on each refresh |
| Threads | FB long-lived token re-exchange | 60 days | N/A | Via `th_refresh_token` grant; defaults 60d if API returns no `expires_in` |
| Reddit | OAuth2 `refresh_token` grant (permanent) | ~1h | No | Permanent refresh_token (scope: `*`) |
| Bluesky | AT Protocol `refreshJwt` | ~2h `accessJwt` | YES | Stored as `refresh_token` column; rotates on each refresh |
| Mastodon | OAuth2 `refresh_token` grant (optional) | Varies (often permanent) | No | Falls back to perpetual token if no refresh_token or credentials absent |
| Zalo OA | OAuth2 `refresh_token` grant | ~24h | No | Uses `secret_key` header + app_id param |

## Cron Schedule

```
Function: publish-token-refresh-cron
Schedule: 0 * * * * (every hour on the minute)
Retries: 1
Timeout: Inngest default
```

Changed from 30-minute intervals (Round-11 F-PC-2) to hourly because the refresh window is 1 hour — most 30-minute runs found no work.

## Row-Lock Pattern (C7)

Prevents concurrent workers from double-rotating refresh tokens (critical for Twitter/X, Bluesky).

```typescript
// From acquire­RefreshLock():
const staleBefore = now - 600; // 10-minute stale window
const result = await db
  .prepare(
    'UPDATE publishing_channels SET refreshing_at = ? WHERE id = ? AND (refreshing_at IS NULL OR refreshing_at < ?)'
  )
  .bind(now, channelId, staleBefore)
  .run();
// Returns true if exactly 1 row updated (lock acquired)
```

**Lock acquisition:** `refreshing_at` column set to current Unix timestamp (seconds).
**Lock release:** Set to `NULL` on success or on error (via the `refreshExpiringTokens` loop).
**Stale threshold:** 10 minutes. If lock older than 10 minutes, another worker may acquire it (handles crashed workers).

## Refresh Algorithm

1. **Scan** all `publishing_channels` with `status = 'active'` and `expires_at <= now + 3600 seconds`
2. **For each channel:**
   - Try to acquire row-lock via `acquireRefreshLock()`
   - If lock held by another worker, skip (increment `skipped`)
   - Decrypt stored `access_token` and `refresh_token` (if present)
   - Call provider-specific refresh function (see table above)
   - Encrypt new tokens
   - Update row with new `access_token`, `expires_at`, `updated_at`, and clear `refreshing_at`
   - If provider rotates refresh token (Twitter/X, Bluesky), update `refresh_token` column too
3. **Return stats:** `{ refreshed, failed, skipped }`

## Failure Modes

| Scenario | Behavior |
|---|---|
| Lock held by another worker | Increment `skipped`, continue to next channel |
| Refresh endpoint returns HTTP error | Log error, mark channel `status = 'expired'`, set `refreshing_at = NULL` |
| Missing `refresh_token` (required by provider) | Log error, mark channel `status = 'expired'`, set `refreshing_at = NULL` |
| Decryption/encryption failure | Log error, mark channel `status = 'expired'` |
| Provider endpoint timeout | Depends on fetch timeout; typically treated as HTTP error |

**Key:** Failed refreshes are marked `expired` permanently until operator manually intervenes or customer re-registers channel. The cron will skip them on subsequent runs (they no longer match `status = 'active'`).

## Monitoring & Manual Intervention

### Detect Expired Tokens

```sql
-- Find channels in 'expired' state (failed refresh)
SELECT id, provider, external_account_id, expires_at, updated_at
FROM publishing_channels
WHERE status = 'expired'
ORDER BY updated_at DESC;

-- Find channels expiring soon (within 1 hour)
SELECT id, provider, external_account_id, expires_at
FROM publishing_channels
WHERE status = 'active' AND expires_at < datetime('now', '+1 hour')
ORDER BY expires_at ASC;
```

### Force Refresh a Token (Manual)

```bash
# Inngest trigger via curl (if Inngest dashboard access):
curl -X POST https://api.inngest.com/events \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $INNGEST_EVENT_KEY" \
  -d '{
    "events": [{
      "name": "publish.manual-token-refresh",
      "data": { "channelId": "abc123def456" }
    }]
  }'
```

Or re-register the channel via `src/land/publish/register-publishing-channel.ts` with fresh tokens from the customer.

## Environment Variables Required

| Platform | ENV Variables | Used By |
|---|---|---|
| YouTube | (none — uses customer-provided refresh_token) | `refreshYouTube()` |
| TikTok | (none — uses customer-provided refresh_token) | `refreshTikTok()` |
| Instagram | `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET` | `refreshInstagramLongLivedToken()` |
| Facebook | (none) | No-op |
| Pinterest | `PINTEREST_CLIENT_ID`, `PINTEREST_CLIENT_SECRET` | `refreshPinterestToken()` |
| LinkedIn | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` | `refreshLinkedInToken()` |
| Twitter/X | (none — uses customer-provided refresh_token) | `refreshTwitter()` |
| Threads | (none — uses customer-provided access_token) | `refreshThreadsToken()` |
| Reddit | (none — uses customer-provided refresh_token) | `refreshReddit()` |
| Bluesky | (none — uses customer-provided refreshJwt) | `refreshAtprotoSession()` |
| Mastodon | `MASTODON_CLIENT_ID`, `MASTODON_CLIENT_SECRET` (optional) | Falls back to perpetual token if absent |
| Zalo OA | `ZALO_APP_ID`, `ZALO_APP_SECRET` | `refreshZaloToken()` |

**Setup:** Configure platform credentials in `wrangler.toml` under `[env.production].vars` or as secrets in Cloudflare Workers dashboard.

## Schema

```sql
-- publishing_channels relevant columns
CREATE TABLE publishing_channels (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL, -- CHECK (provider IN ('youtube', 'tiktok', 'instagram', ...))
  external_account_id TEXT NOT NULL, -- Platform account ID
  display_name TEXT,
  access_token TEXT NOT NULL, -- Encrypted
  refresh_token TEXT, -- Encrypted (NULL if provider doesn't use refresh_token)
  expires_at INTEGER, -- Unix timestamp (seconds)
  refreshing_at INTEGER, -- Row-lock: current timestamp if locked, NULL if unlocked
  status TEXT DEFAULT 'active', -- 'active' | 'expired'
  created_at INTEGER,
  updated_at INTEGER,
  
  UNIQUE (tenant_id, provider, external_account_id)
);
```

## Code Location

- **Refresher logic:** `src/lib/publishing/oauth-token-refresher.ts`
- **Cron registration:** `src/forest/inngest/functions/publish-execute.ts` (lines 527–536)
- **Channel registration:** `src/land/publish/register-publishing-channel.ts`
- **Token crypto:** `src/lib/publishing/token-crypto.ts` (encrypt/decrypt)

## Testing

The refresher is tested in isolation with platform-specific mocks:
- `__tests__/oauth-token-refresher.test.ts` — lock behavior, error handling, stats

In production, verify via:
1. Monitor D1 for `status = 'expired'` rows (indicates refresh failure)
2. Check Cloudflare Workers logs: `wrangler tail` for token refresh errors
3. Query `expires_at` distribution: should see minimal rows expiring within next 1 hour for active channels
