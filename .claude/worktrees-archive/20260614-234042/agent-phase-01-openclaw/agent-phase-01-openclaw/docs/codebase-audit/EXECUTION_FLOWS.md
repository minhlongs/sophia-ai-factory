# Architectural Execution Flows & Integration Coupling

This document details the request lifecycles, database/storage adapters, queue architectures, authentication flows, integrations, and deployment topology of the **Sophia AI Factory** system.

---

## 1. System Entrypoints & Request Lifecycle

Requests enter the Next.js application (compiled via OpenNext to run on Cloudflare Workers Page isolates) through five entrypoints:

1. **User Interface Router:** Multi-lingual public and private routes under [apps/sophia-ai-factory/src/app/[locale]/](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/[locale]/).
2. **API Routes:** Internal backend logic under [apps/sophia-ai-factory/src/app/api/](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/api/) and versioned RaaS APIs under `/api/v1/`.
3. **Webhooks:** Vendor callbacks from HeyGen, NOWPayments, and Telegram.
4. **Cron Job Endpoints:** Endpoints under `/api/cron/*` executed by the worker's scheduled trigger routing handler.
5. **Background Functions Endpoint:** Served by Inngest at [apps/sophia-ai-factory/src/app/api/inngest/route.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/api/inngest/route.ts).

### Request Middleware Lifecycle Pipeline

```
  HTTP Request ──► NextJS Edge Middleware ──► API Route Handler ──► Page Component
                        (middleware.ts)        (middleware-api-handler.ts)
```

1. **Global Middleware:** [apps/sophia-ai-factory/src/middleware.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/middleware.ts) processes every request:
   - **CSP Nonce Injection:** Injecting random nonces into the `x-csp-nonce` header.
   - **CSRF Protection:** Validating double-submit cookies for mutating methods.
   - **MFA Redirects:** Checking user sessions and forcing redirect to `/auth/mfa-challenge` if TOTP validation is incomplete.
   - **Admin Gate:** Restricting `/dashboard/admin/*` to accounts with the `MASTER` / `master` tier. Reads raw D1 data directly at the Edge middleware level.
   - **Setup Redirect:** Redirecting requests to the setup page if `IS_CONFIGURED` is false.
2. **API Route Handler Middleware:** [apps/sophia-ai-factory/src/middleware-api-handler.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/middleware-api-handler.ts) intercepts API paths:
   - **Tenant Isolation:** Enforcing tenant database isolation boundaries.
   - **Webhook Version Pinning:** Mapping webhooks to stable canary slots.
   - **Rate Limiting:** Running SQL-backed sliding window evaluations.
   - **RaaS Licensing:** Validating keys, checking remaining quotas, and applying context headers (`x-raas-tier`, `x-raas-receipt`).

---

## 2. SQL-Backed Rate Limiting & D1 PostgREST Mimicry

The system utilizes custom SQL-based sliding window rate-limiting, defined in [apps/sophia-ai-factory/src/seed/security/sql-rate-limiter.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/security/sql-rate-limiter.ts) and orchestrated by [apps/sophia-ai-factory/src/seed/security/rate-limiting-middleware.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/security/rate-limiting-middleware.ts).

Because Cloudflare D1 (SQLite) lacks support for stored procedures (RPC) standard in Postgres, the proxy client [apps/sophia-ai-factory/src/seed/db/d1-client-rpc.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/db/d1-client-rpc.ts) intercepts calls to `db.rpc('increment_rate_limit', ...)` and executes a native SQLite `UPSERT` script:
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
Expired limit metrics are cleaned out daily via the `cleanupExpiredRateLimits` routine in the same file.

---

## 3. Background Jobs & Cron Execution Flows

### Inngest Event-Driven System
Inngest handles background tasks asynchronously. The client is initialized in [apps/sophia-ai-factory/src/forest/inngest/client.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/forest/inngest/client.ts) and background handlers are registered under [apps/sophia-ai-factory/src/app/api/inngest/route.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/api/inngest/route.ts).

- **Active Jobs Served:**
  - `generateCampaign`: Multi-step AI proposal generation.
  - `autoDiscoverAffiliates`: Scraping/scouting affiliate offers.
  - `publishExecute` / `publishTokenRefreshCron`: Posting video assets to social channels.
  - `conversionToLedger` / `payoutBatcher`: Batching promoter commission ledger entries.
  - `offerSyncCron` / `storageTrackerDaily`: Purging stale listings and reporting asset sizes.
  - `accountDeleteFinalizeCron`: Deleting user entities after a 7-day cooldown.
- **Unregistered Jobs (Execution Gap):**
  - Multiple functions exported by [apps/sophia-ai-factory/src/forest/inngest/functions/index.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/forest/inngest/functions/index.ts) (including `videoGenerate` (defined in [apps/sophia-ai-factory/src/forest/inngest/functions/video-generate.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/forest/inngest/functions/video-generate.ts)), `repurposeAnalyze`, `analyticsSync`, and `sopExecute`) are **not registered** in the serve route array. This makes them dead code that is never run by Inngest.

### Cron Routing Flow
The cron pipeline maps Cloudflare Workers native scheduler triggers to standard API routes:
1. Native cron triggers are defined in [apps/sophia-ai-factory/wrangler.toml](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/wrangler.toml).
2. Upon firing, the Pages runtime calls the `scheduled` hook handler.
3. This handler is dynamically injected into the built bundle via [apps/sophia-ai-factory/scripts/inject-scheduled-handler.mjs](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/scripts/inject-scheduled-handler.mjs), which fetches the mapped API route (e.g. `/api/cron/uptime-check`) internally.
4. The API route verifies authenticity via `verifyCronAuth()` in [apps/sophia-ai-factory/src/seed/security/cron-auth.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/security/cron-auth.ts), checking for the `CRON_SECRET` header or token query parameter.

---

## 4. Storage & Persistence Layout

- **Cloudflare D1 Databases:**
  - `DB` (`sophia-raas-db`): Contains standard application schemas (users, sessions, videos, transactions, organizations, etc.). Lazy-loaded in [apps/sophia-ai-factory/src/seed/db/client.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/db/client.ts) to prevent build-time failures. It wraps queries in a compatibility proxy `LazyQueryChain` defined in [apps/sophia-ai-factory/src/seed/db/d1-query-chain.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/db/d1-query-chain.ts) to mimic Supabase query structures.
  - `NEXT_TAG_CACHE_D1` (`sophia-tag-cache`): Managed by OpenNext for fast ISR tag invalidation.
- **Supabase (JWKS Verification Hub):**
  - While Cloudflare D1 SQLite is the primary production database, Supabase is NOT fully obsoleted and is still actively used for JWKS token verification in the RaaS licensing layer and gateway endpoints.
- **Cloudflare R2 Buckets:**
  - `VIDEO_BUCKET` (`sophia-videos`): Publicly stores video and audio composition outputs.
  - `BACKUPS_BUCKET` (`sophia-backups`): Stores D1 daily backups.
  - `NEXT_INC_CACHE_R2_BUCKET` (`sophia-ai-factory-opennext-cache`): Stores compiled SSR fetch cache files.
- **Upstash Redis Cache:**
  - Initialized lazily via a Proxy in [apps/sophia-ai-factory/src/lib/redis.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/lib/redis.ts).
  - Used in [apps/sophia-ai-factory/src/forest/raas-service-key-operations.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/forest/raas-service-key-operations.ts) to track nonces (preventing replay attacks) and read from the revoked license cache key set (`raas:revoked_keys`).

---

## 5. Authentication & Authorization Flow

System security is managed by the **Better Auth** framework, configured in [apps/sophia-ai-factory/src/seed/auth/better-auth-server.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/auth/better-auth-server.ts) with the Cloudflare D1 adapter.

1. **Magic Link Login:** Generates and emails links using Resend (lazily imported to preserve layering boundaries).
2. **Post-User Registration Hooks (`user.create.after`):**
   - Automatically initializes user profiles and organizations.
   - Binds a default subscription (`BASIC` tier).
   - Provisions 50 starting credits.
3. **MFA Enforcement:**
   - The `session.create.after` hook checks if the user has MFA enabled. If so, it flags the session as `MFA pending`.
   - The middleware [apps/sophia-ai-factory/src/middleware.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/middleware.ts) detects the pending state via `isSessionMfaPending` and redirects the user to `/auth/mfa-challenge` until the TOTP code is verified.
4. **Session Extraction:** Managed via server helpers in [apps/sophia-ai-factory/src/seed/auth/better-auth-session.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/auth/better-auth-session.ts).

---

## 6. External Integrations Coupling

### HeyGen Avatar Synthesis
1. The app triggers video creation requests via `/api/heygen/create-video`.
2. Composed videos are delivered to the webhook endpoint [apps/sophia-ai-factory/src/app/api/webhooks/heygen/route.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/api/webhooks/heygen/route.ts).
3. The signature resolver [apps/sophia-ai-factory/src/lib/webhooks/heygen-webhook-secret-resolver.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/lib/webhooks/heygen-webhook-secret-resolver.ts) extracts the `video_id` from the payload, queries D1 to discover the owner (tenant), and loads their specific webhook secret to verify signature hash. This ensures strict tenant isolation.
4. Upon signature validation, it updates the database and sends user notifications.

### NOWPayments Gateway
1. Handles crypto payments callback at [apps/sophia-ai-factory/src/app/api/webhooks/nowpayments/route.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/api/webhooks/nowpayments/route.ts).
2. Validates signatures using the custom `NOWPAYMENTS_IPN_SECRET` with SHA-512.
3. Processes subscriptions and triggers ledger credits on signature match.

### Telegram Bot
1. The bot webhook endpoint resides at [apps/sophia-ai-factory/src/app/api/webhooks/telegram/route.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/api/webhooks/telegram/route.ts) (using `X-Telegram-Bot-Api-Secret-Token`).
2. Private commands require pairing. Users get a 15-minute verification code that must be approved via the admin command `/pair_approve <CODE>`.
3. Alternatively, clicking "Connect Telegram" in the dashboard generates a JWT pairing token that is resolved when starting the bot via deep-link `/start <pairing_token>` through [apps/sophia-ai-factory/src/seed/auth/jwt-nonce-storage.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/auth/jwt-nonce-storage.ts).

### MoviePy Render Microservice
1. A python FastAPI sidecar at [services/moviepy-render/server.py](file:///Users/macbook/projects/sophia-ai-factory/services/moviepy-render/server.py) executes ffmpeg subtitles, crops, and audio composition.
2. The edge worker calls this service via `/compose` inside [apps/sophia-ai-factory/src/lib/video/composer-ffmpeg.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/lib/video/composer-ffmpeg.ts).
3. The call is wrapped in a circuit breaker (`withBreaker`). If the FastAPI server times out or fails, the breaker opens, and a base64-encoded stub mp4 is returned as a fallback to prevent blocking the worker isolate.

---

## 7. Feature Flags & Rollout Mechanisms

- **Static Environment Flags:** Map features to user subscription tiers in [apps/sophia-ai-factory/src/seed/config/flags.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/config/flags.ts).
- **Dynamic Percentage Rollout Flags:** Handled in [apps/sophia-ai-factory/src/lib/feature-flags/index.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/lib/feature-flags/index.ts):
  - Resolves configuration bounds using `EXPERIMENT_KV` bindings.
  - Computes FNV-1a 32-bit hashes of user IDs to place users into buckets (0–99).
  - Enables features if `hash(userId) % 100 < percent`.
  - Memoizes flag lookups in memory for 60 seconds.

---

## 8. Deployment Topology

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

1. **Turbopack Build Requirement:** Due to webpack OOM issues during trace compilation on M1 16GB environments, [apps/sophia-ai-factory/scripts/deploy-with-sha.sh](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/scripts/deploy-with-sha.sh) forces the Next.js compiler to build via Turbopack.
2. **Worker Chunk Trimming:** `strip-ssr-bloat.sh` removes client assets leaked into standalone server component chunks, keeping bundle output under 10MB to fit within Cloudflare's limit.
3. **Trigger Injection:** The script `inject-scheduled-handler.mjs` binds the Pages worker triggers to endpoint routes.
4. **Git Mirroring:** Successful deploys trigger GitLab repository synchronization.
