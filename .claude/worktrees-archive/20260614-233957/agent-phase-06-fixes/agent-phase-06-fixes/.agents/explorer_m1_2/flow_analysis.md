# Architectural Execution Flow and Coupling Analysis

This report maps out the execution flows, persistence/storage architectures, authentication mechanisms, background job queues, external integrations, feature flags, and deployment topology for the **Sophia AI Factory** project.

---

## 1. System Entrypoints and Request/Data Lifecycle Flows

### Entrypoints
The application is a Next.js application compiled via OpenNext to run on Cloudflare Workers (specifically Pages).
The request lifecycle enters the system through the following primary surfaces:
1. **Public/Authenticated Web Pages**: 
   - Public routing files under `src/app/[locale]` (e.g. `/login`, `/pricing`, `/guide`).
   - Authenticated dashboard workspace under `src/app/[locale]/dashboard` (and admin views under `src/app/[locale]/dashboard/admin`).
2. **API Routes**: 
   - Rate-limited backend endpoints under `src/app/api/...` (e.g., `/api/check-access`, `/api/setup/save`).
   - Versioned public APIs under `src/app/api/v1/...` (e.g. `/api/v1/campaigns/create`).
3. **Webhooks**:
   - `/api/webhooks/heygen`: Receives terminal video rendering success/fail webhooks from HeyGen.
   - `/api/webhooks/nowpayments`: Receives payment confirmation events.
   - `/api/webhooks/telegram`: Receives bot messages and inline actions.
4. **Cron Job Endpoints**:
   - `/api/cron/*`: Authenticated triggers for daily rollups, cache cleanup, dunning checks, and system heartbeats.
5. **Background Functions Endpoint**:
   - `/api/inngest`: Endpoint exposed to receive and run Inngest asynchronous background jobs.

---

### Request/Data Lifecycle

#### Edge Middleware & Request Pipeline
Every request starts at the Cloudflare Edge, hitting Next.js Middleware:
- **Global Middleware Execution**: Managed in [middleware.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/middleware.ts).
  - **CSP Nonce Injection**: Generates a cryptographically random 16-byte nonce for HTML-bearing requests, injecting it into `x-csp-nonce` request headers so Server Components can read it.
  - **CSRF Protection**: Performs double-submit cookie validation for mutating methods (POST, PUT, DELETE, PATCH).
  - **MFA Challenge Routing**: Checks session validity; if session has MFA enabled but the challenge is incomplete, redirects the user to `/auth/mfa-challenge`.
  - **Admin Gate Routing**: Prevents layout flash by validating if the request to `/dashboard/admin` belongs to a subscription with `MASTER` or `master` tier. Reads raw D1 database directly at the edge middleware runtime.
  - **Setup Wizard Redirects**: Redirects setup/onboarding checks if the system's platform-level configuration (`IS_CONFIGURED`) is false.
- **API Handler Routing**: API requests pass to [middleware-api-handler.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/middleware-api-handler.ts).
  - **Tenant Isolation**: Calls `tenantIsolationMiddleware` to ensure data isolation.
  - **Webhook Version Pinning**: Directs webhooks (NOWPayments, PayOS, Telegram) to stable version keys during canary rollouts.
  - **Rate Limiting**: Base IP and route-bucket-specific rate limits (API, Auth, Webhook, Discovery) are checked using SQL-backed sliding windows.
  - **RaaS Licensing Gate**: Evaluates API usage, validating keys, remaining quotas, and applying headers (`x-raas-tier`, `x-raas-receipt`, `x-quota-remaining`) to downstream requests.

---

#### SQL-based Rate Limiting & D1 RPC Mimicry
The application implements rate limiting in [sql-rate-limiter.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/security/sql-rate-limiter.ts) and delegates checks through [rate-limiting-middleware.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/security/rate-limiting-middleware.ts).
Because Cloudflare D1 does not support native SQL stored procedures (RPC) standard in PostgreSQL, the custom query builder client [d1-client-rpc.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/db/d1-client-rpc.ts) intercepts calls to `db.rpc('increment_rate_limit', ...)` and runs a native SQLite UPSERT statement:
```sql
INSERT INTO rate_limits (identifier, current_count, window_start, window_seconds)
VALUES (?1, 1, datetime('now'), ?2)
ON CONFLICT(identifier) DO UPDATE SET
  current_count = CASE
    WHEN CAST(strftime('%s', window_start) AS INTEGER) < ?3 THEN 1
    ELSE current_count + 1
  END,
  window_start = CASE
    WHEN CAST(strftime('%s', window_start) AS INTEGER) < ?3 THEN datetime('now')
    ELSE window_start
  END,
  updated_at = datetime('now')
RETURNING current_count
```
Expired rate-limiting records are purged daily via [cleanupExpiredRateLimits] in the same file.

---

## 2. Background Jobs, Queue Systems, and Cron/Schedulers

### Inngest Event-Driven System
Sophia AI Factory relies on **Inngest** for background workflows. The client is initialized in [client.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/forest/inngest/client.ts) with full type-safe event schemas (including campaign creation, URL-to-Revenue pipelines, publishing jobs, payout batching, and repurposing).

The API endpoint [route.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/api/inngest/route.ts) registers and serves the background handlers.

#### ⚠️ Critical Architecture Gaps / Missing Registrations
A major architectural discrepancy was found: **multiple critical background functions are defined but not registered in the Inngest handler.**
- The barrel file [index.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/forest/inngest/functions/index.ts) exports functions such as `videoGenerate` (handles the Wan 2.1 + Fish Speech video pipeline, detailed in [video-generate.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/forest/inngest/functions/video-generate.ts)), `batchVideoFanout`, `repurposeAnalyze`, `repurposeClipGenerate`, `analyticsSync`, `tokenRefreshCron`, and `thumbnailAbSelector`.
- However, in the serve endpoint `src/app/api/inngest/route.ts`, **none of these functions are imported or included in the `functions` registration array.**
- **Consequence**: Emitted events like `video/generate.requested` (sent during manual generation requests in Server Actions or via `batch/video.fanout` loops) will **never be processed** by Inngest. They will simply be logged as unhandled events on the Inngest Cloud console.

#### Active Inngest Functions
The active functions running under `/api/inngest` include:
1. `generateCampaign`: Multi-step campaign generation.
2. `autoDiscoverAffiliates`: Scraping/scouting affiliate offers.
3. `publishExecute` and `publishTokenRefreshCron`: Uploading composed videos to social media APIs (TikTok, LinkedIn, etc.) and refreshing tokens.
4. `conversionToLedger`, `pendingPromoterCron`, `payoutBatcher`, and `reconciliationCron`: Managing ledger accounting and commission verification.
5. `offerSyncCron` & `storageTrackerDaily`: Cleaning expired offers and reporting daily storage.
6. `accountDeleteFinalizeCron`: Deleting users after a 7-day cooldown.

---

### Cron Jobs & Scheduler Integration
The scheduler is driven by Cloudflare Workers Native Triggers configured in [wrangler.toml](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/wrangler.toml). 
1. **Cloudflare Cron Routing**: When a cron trigger fires, the Pages runtime calls the `scheduled` handler. During the build/deploy step, [inject-scheduled-handler.mjs](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/scripts/inject-scheduled-handler.mjs) injects an event handler.
2. **Local Path Dispatch**: This handler converts the cron schedule into a direct internal HTTP `GET` fetch targeting `/api/cron/<cron_name>` (e.g. `/api/cron/uptime-check`, `/api/cron/video-status-sync`).
3. **Cron Authentication**: Every cron route validates the incoming request using `verifyCronAuth()` in [cron-auth.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/security/cron-auth.ts). It enforces that the request contains the token via `Authorization: Bearer <CRON_SECRET>` or the custom header `x-cron-secret` / query param `?token=`. (Bypassing via `x-cf-cron` is blocked in production).

---

## 3. Cloudflare D1 (SQLite) and R2 Storage Layers, and Upstash Redis

### Cloudflare D1 Persistence
The application uses two separate Cloudflare D1 databases bound at runtime (configured in `wrangler.toml`):
1. `DB` (Database ID: `78bd1961-b62d-43bb-b551-0c5d7d389506`): Points to `sophia-raas-db` containing schemas for users, sessions, videos, transactions, organizations, rate limits, audits, and Telegram state.
2. `NEXT_TAG_CACHE_D1` (Database ID: `7b1d4fd4-8aa2-4006-828a-ef2b76652a46`): Points to `sophia-tag-cache`, utilized exclusively by OpenNext's `d1NextTagCache` handler to provide fast ISR tag validation.

#### Query Builder Client
The client in [client.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/db/client.ts) acts as a drop-in compatibility shim mimicking the Supabase PostgREST client:
- It lazily instantiates a `D1Client` from raw Cloudflare environment context to prevent Next.js build-time errors.
- It returns a chainable proxy `LazyQueryChain` wrapping [d1-query-chain.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/db/d1-query-chain.ts) allowing developers to call `.from('table').select().eq(...)` as if interacting with Supabase.
- Intercepts PostgreSQL RPC stored procedures (e.g., `debit_mcu_balance`, `increment_rate_limit`) and converts them to batches of SQLite queries.

---

### Cloudflare R2 Storage
Three R2 Buckets are bound to the worker context in `wrangler.toml`:
1. `NEXT_INC_CACHE_R2_BUCKET` (`sophia-ai-factory-opennext-cache`): Persists rendered Next.js HTML and fetch cache objects.
2. `VIDEO_BUCKET` (`sophia-videos`): Holds raw and final composed video/audio files. Accessible publicly via the base URL hostname configured in `R2_PUBLIC_HOSTNAME`.
3. `BACKUPS_BUCKET` (`sophia-backups`): Backs up D1 daily snapshots.

---

### Upstash Redis Usage
Upstash Redis is integrated using `@upstash/redis` in [redis.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/lib/redis.ts). 
- **Initialization**: Leverages a JS Proxy to lazily initiate the client inside Cloudflare isolates, bypassing execution during build-time (which lacks environment variables).
- **Core Security Utility**: Used primarily by [raas-service-key-operations.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/forest/raas-service-key-operations.ts) for RaaS key verification:
  - **Nonce Replay Prevention**: Nonces used in license activations are recorded with a TTL (e.g., prefix `raas:nonce:<nonce>`). Reused nonces trigger replay attack warnings.
  - **License Revocation Cache**: Revoked license keys are queried and stored in Redis sets (`raas:revoked_keys`).

---

## 4. Authentication and Authorization Flows

### Better Auth Server Integration
Sophia AI Factory replaces custom authentication with the **Better Auth** framework, configured in [better-auth-server.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/auth/better-auth-server.ts).
- **Database Adapter**: Configured to run directly on the Cloudflare D1 SQL database.
- **Magic Link**: Configured to send bilingual (English/Vietnamese) login links via `sendEmail` (lazily loaded from `src/forest/email/sender.ts` to keep the DB/Auth seed layer independent of the email layer).
- **Database Hooks**:
  - `session.create.after`: Automatically inspects if MFA (TOTP) is enabled for the user via `requireMfaIfEnabled`. If true, marks the session pending MFA challenge.
  - `user.create.after`: Sets up the default organization, grants a starting credit balance of 50 credits, binds a `BASIC` subscription row, and initializes `user_profiles`. Finally, it dispatches a welcome email.

---

### Session and MFA Gates
1. **Server helpers**: Session validation helpers in [better-auth-session.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/auth/better-auth-session.ts) extract user properties (`id`, `email`, `role`) from current headers or Next.js server context.
2. **MFA Isolation**: Any user with a session flagged as "MFA pending" is restricted. Edge middleware (`src/middleware.ts`) detects this state using `isSessionMfaPending` and redirects the browser to `/auth/mfa-challenge` until the TOTP code is verified.
3. **Admin and Tier Gates**: Access to `/dashboard/admin/*` is strictly blocked by middleware unless a subscriber's active subscription tier is explicitly `MASTER` or `master`.

---

## 5. External Integrations

### HeyGen Integration
1. **Avatar Video Generation**: Client API routes (`/api/heygen/create-video`) send requests to HeyGen to render synthetic avatar clips.
2. **Signature-Verified Webhook**: Composed videos are delivered to [route.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/api/webhooks/heygen/route.ts). 
   - Signature checks (`x-heygen-signature`) are validated via HMAC-SHA256.
   - **Multi-Tenant Webhook Secrets**: Instead of relying on a single global token, [heygen-webhook-secret-resolver.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/lib/webhooks/heygen-webhook-secret-resolver.ts) parses the payload's `video_id`, queries the `videos` table to discover the user_id (tenant owner), and fetches their specific webhook secret from `user_provider_credentials`. This prevents cross-tenant webhook forgery.
   - **Terminal Actions**: If verified, the system calls `completeVideoFromWebhook` or `failVideoFromWebhook` (which updates D1 and triggers onboarding flow emails).

---

### NOWPayments Integration
1. **Crypto Payments Webhook**: Endpoint at [route.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/api/webhooks/nowpayments/route.ts) handles IPN callbacks.
2. **Signature Verification**: Validates the payload using `x-nowpayments-sig` HMAC-SHA512 with `NOWPAYMENTS_IPN_SECRET`.
3. **Completed Purchase Actions**: Validates payload schema via Zod, processes user subscription upgrades, records PostHog telemetry, and emits `payment.received` outbound webhook triggers.

---

### Telegram Bot Integration
1. **Bot Webhook Endpoint**: Incoming Telegram API updates are handled in [route.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/api/webhooks/telegram/route.ts) and verified via the `X-Telegram-Bot-Api-Secret-Token` header.
2. **Pairing Gate Control**: To secure the bot:
   - Public commands like `/version`, `/help`, and `/free100` are allowlisted.
   - Private interaction requires pairing. If an unpaired user sends a message, they receive a 15-minute verification code. The administrator approves them via `/pair_approve <CODE>`.
   - Alternatively, a user clicks "Connect Telegram" on the dashboard, generating a temporary token that is deep-linked to the bot `/start <pairing_token>`. The bot consumes the token via [pairing-token-service.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/auth/jwt-nonce-storage.ts) and registers the user.
3. **Wizard Flows**: Provides FSM-based wizard panels for creating video campaigns.

---

### MoviePy Render Microservice
A separate Python microservice based on FastAPI and MoviePy, defined in [server.py](file:///Users/macbook/projects/sophia-ai-factory/services/moviepy-render/server.py), handles audio-video muxing, subtitle burn-in, loudnorm audio balancing, crop actions, and thumbnail extraction.
- **Circuit Breaker**: The worker calls this service inside [composer-ffmpeg.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/lib/video/composer-ffmpeg.ts) wrapped in a circuit breaker (`withBreaker`). If the render service goes down or times out, the breaker opens, and the system falls back to returning a base64-encoded stub mp4, preventing pipeline blocking.

---

## 6. Feature Flags, Env Vars, and Deployment Topology

### Feature Flags
Sophia AI Factory divides flags into two separate systems:
1. **Static Environment-based Flags**: Configured in [flags.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/config/flags.ts). Uses `process.env` (e.g., `FEATURE_PAYOS`) and static maps (`FEATURE_FLAGS`) mapping features (like `enable_admin_dashboard`) to their default status and required user tier.
2. **Dynamic KV Percentage Rollouts**: Handled in [index.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/lib/feature-flags/index.ts) using the `EXPERIMENT_KV` namespace binding:
   - Uses an FNV-1a 32-bit hash function to map `userId` to a stable bucket value (0–99).
   - If `bucket(userId) < percent`, the feature is enabled.
   - Employs a 60-second in-memory cache to reduce Cloudflare KV read operations.

---

### Environment Variables
Key configuration categories defined in [env.example](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/.env.example):
- **Oauth & Webhook Encryption**: `OAUTH_TOKEN_ENC_KEY`, `OAUTH_STATE_SECRET`, `BYOK_MASTER_KEY` (all 32-byte keys).
- **External API secrets**: `FAL_API_KEY`, `WAN_API_KEY`, `FISH_SPEECH_API_KEY`, `NOWPAYMENTS_API_KEY`, `TELEGRAM_BOT_TOKEN`, `RESEND_API_KEY`.
- **Infrastructure Keys**: `CRON_SECRET` for routing crons, `INTERNAL_API_SECRET` for inter-service authentication.

---

### Deployment Topology

```
                  [ Git Repository (HEAD == origin/main) ]
                                     │
                                     ▼ (deploy-with-sha.sh)
                       [ external tsc type-check ]
                                     │
                                     ▼
                        [ npm run build (Turbopack) ]
                                     │
                                     ▼
                      [ strip-ssr-bloat.sh / OpenNext ]
                                     │
                                     ▼
                [ inject-scheduled-handler.mjs scheduled triggers ]
                                     │
                                     ▼
                      [ wrangler deploy / Cloudflare Pages ]
                                     │
                        ┌────────────┴────────────┐
                        ▼                         ▼
            (Cloudflare Worker Isolates)      (Cloudflare R2 Buckets)
            - NextJS Server Components        - sophia-videos
            - Edge middleware/API routing     - sophia-backups
            - Inngest serve endpoint          - opennext-cache
                        │
                  ┌─────┴─────────────────────────┐
                  ▼                               ▼
        (Cloudflare D1 Databases)          (Upstash Redis REST)
        - DB (sophia-raas-db)              - Nonce tracking
        - Tag Cache (sophia-tag-cache)     - Revocations list
                  │
                  ▼
         (External Services)
         - MoviePy Render (Fly.io)
         - Coqui TTS (Fly.io)
```

1. **Build Constraints (Turbopack & Webpack OOM)**: Due to OOM issues on M1 16GB systems during webpack trace collection, `npm run build` is forced to build via **Next.js Turbopack** in [deploy-with-sha.sh](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/scripts/deploy-with-sha.sh).
2. **Post-Build Optimizations**:
   - `strip-ssr-bloat.sh` removes client-side libraries leaked into Server Component JS chunks to keep worker sizes below 10MB.
   - `fix-instrumentation-standalone.mjs` corrects runtime symbols.
   - `inject-scheduled-handler.mjs` maps CF Pages scheduler triggers to target Next.js API endpoints.
3. **Release Integrity**: Version metadata (`COMMIT_SHA`, `DEPLOYED_AT`) are pushed directly to Worker environment secrets after deploy. The repository code is mirrored automatically to the GitLab registry.
