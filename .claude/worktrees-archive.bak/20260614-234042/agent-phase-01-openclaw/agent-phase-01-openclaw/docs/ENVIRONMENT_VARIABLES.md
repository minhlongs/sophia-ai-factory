# Environment Variables Reference

This document maps all configuration keys and environment variables used by the **Sophia AI Factory** application.

---

## 1. Mappings & Scope

The reference configurations are defined in [apps/sophia-ai-factory/.env.example](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/.env.example). 
During local development, these variables must be populated in `.env.local` inside the sub-app folder. In production (Cloudflare Workers Pages), secrets are configured using `wrangler secret put <NAME>` or via the Cloudflare dashboard.

*Note: Database bindings (D1) and bucket bindings (R2) are defined at compile time in [apps/sophia-ai-factory/wrangler.toml](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/wrangler.toml) rather than environment variables.*

---

## 2. Variables Catalog

### 2.1. OAuth & Encryption (Multi-Channel Publisher)
These keys secure user-provided tokens at rest and protect against replay/CSRF attacks:

- `OAUTH_TOKEN_ENC_KEY` (Required): An AES-256-GCM 32-byte base64-encoded key used to encrypt OAuth tokens stored in the database.
- `OAUTH_STATE_SECRET` (Required): An HMAC-SHA256 signing secret for OAuth state token parameter validation.
- `R2_PUBLIC_HOSTNAME` (Required): The base public URL of the Cloudflare R2 bucket holding asset outputs.
- `BYOK_MASTER_KEY` / `CREDENTIALS_MASTER_KEY` (Required): Master keys used to encrypt/decrypt tenant api keys at rest.

### 2.2. Social Integrations
OAuth2 credentials for publishing video assets:

- **Instagram/Facebook:** `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `INSTAGRAM_REDIRECT_URI`, `INSTAGRAM_WEBHOOK_SECRET`
- **TikTok:** `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_REDIRECT_URI`, `TIKTOK_WEBHOOK_SECRET`
- **YouTube/Google:** `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REDIRECT_URI`, `YOUTUBE_WEBHOOK_SECRET`

### 2.3. Better Auth Settings
- `BETTER_AUTH_SECRET` (Required): 32+ character random secret used for session cryptos.
- `BETTER_AUTH_URL` (Required): Origin URL of the authentication server. Defaults to `http://localhost:3000` locally.

### 2.4. Inngest Workflow Keys
- `INNGEST_EVENT_KEY`: Used to authenticate events published to the local or cloud Inngest executor.
- `INNGEST_SIGNING_KEY`: Used to verify payloads received from the Inngest runner at the serve endpoint [apps/sophia-ai-factory/src/app/api/inngest/route.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/api/inngest/route.ts).

### 2.5. Payment Gateways
- **NOWPayments (Crypto):**
  - `NOWPAYMENTS_API_KEY`: API access key.
  - `NOWPAYMENTS_IPN_SECRET`: Verification key for payload signature checks.
- **PayOS (Fiat Bank Transfer):**
  - `FEATURE_PAYOS` (Boolean): Toggle VietQR banking flow (1 = enabled, 0 = disabled).

### 2.6. Telegram Bot
- `TELEGRAM_BOT_TOKEN`: The API token for `@Sophia_Bbot`.
- `TELEGRAM_WEBHOOK_SECRET`: HMAC signature verification token.
- `TELEGRAM_ADMIN_CHAT_ID`: Telegram chat identifier for administrator notifications.

### 2.7. AI API Keys (Bring Your Own Key fallback)
- `OPENROUTER_API_KEY`: Used for LLM script scripting.
- `ELEVENLABS_API_KEY`: Used for TTS voice synthesis.
- `HEYGEN_API_KEY` / `HEYGEN_WEBHOOK_SECRET`: Used for avatar video generation and tenant isolation webhook parsing.
- `FAL_API_KEY` / `REPLICATE_API_KEY` / `RUNPOD_API_KEY`: Fallback keys for image, speech, and video models.

### 2.8. Observability & Crons
- `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_DSN`: Endpoint URLs for Sentry logging.
- `SENTRY_AUTH_TOKEN`: Build-time auth token to upload sourcemaps.
- `CRON_SECRET` (Required): The authorization header secret required to execute crons at `/api/cron/*`.

### 2.9. Supabase & Email (Licensing & Messaging)
- `NEXT_PUBLIC_SUPABASE_URL` (Required): Supabase project endpoint URL. Used for JWKS token verification in the RaaS licensing layer and gateway endpoints.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Required): Supabase anonymous client API key. Used to connect to Supabase authentication/verification endpoints.
- `RESEND_API_KEY` (Required): Resend API key for transactional email deliveries.
