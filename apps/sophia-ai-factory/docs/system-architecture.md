# System Architecture

## Overview
Sophia AI Video Factory utilizes a **Hybrid Architecture** combining a modern Next.js frontend with a low-code backend (n8n + Airtable) to deliver a powerful yet modifiable video production platform.

```mermaid
graph TD
    User[User Browser]

    subgraph Frontend [Next.js App Router]
        Wizard[Setup Wizard]
        Dash[Dashboard UI]
        API[Internal API Routes]
        Middleware[Middleware Logic]
    end

    subgraph External_Services [AI Services]
        OpenRouter[OpenRouter (LLM)]
        Eleven[ElevenLabs (Voice)]
        DID[D-ID (Avatar)]
        HeyGen[HeyGen (Premium Avatar)]
    end

    subgraph Data_Layer [Persistence]
        Airtable[Airtable Base]
        Env[Env Config (.env.local)]
    end

    subgraph Automation [n8n Workflows]
        GenScript[Generate Script Flow]
        GenVideo[Render Video Flow]
    end

    subgraph Mobile [Telegram]
        Bot[Telegram Bot]
    end

    User --> Middleware
    Mobile --> API
    Middleware -- Unconfigured --> Wizard
    Middleware -- Configured --> Dash

    Wizard --> API
    API --> Env
    API -- Validate --> External_Services
    API -- Validate --> Airtable

    Dash --> API
    API --> Airtable
    API -- Trigger --> Automation

    Automation --> OpenRouter
    Automation --> Eleven
    Automation --> DID
    API -- Direct --> HeyGen
    Automation -- Update Status --> Airtable
```

## Core Components

### 1. The Frontend (Next.js 16)
- **Responsibility**: User Interface, Input Validation, Configuration Management.
- **Key Modules**:
  - `/login`: Authentication page with Sign In (password + magic-link) and Sign Up (password form) tabs (v1.14.19). SignupForm component with client/server validation, Zod constraints (min 8 char password), bilingual i18n (`auth.signup.*` keys).
  - `/setup-wizard`: Strictly guided onboarding flow (auth required, requires ≥1 LLM key). v1.14.18: Layout-level `getCurrentUser()` auth check, post-signup `wizard_done` cookie redirect, bilingual (VI+EN) finish step with retry button, anthropic + muapi added.
  - `/dashboard`: Main operational view.
  - `/api/*`: Serverless functions acting as proxy to external services.
  - `/api/setup/*`: Wizard endpoints (verify keys, save config, manage `wizard_done` cookie lifecycle).
- **Service Layer (New)**:
  - **Service Factory**: Centralized dependency injection pattern (`src/lib/services/factory.ts`).
  - **Abstraction**: Interfaces (`IVideoService`, `IVoiceService`, etc.) decouple logic from providers.
  - **Mock Mode**: Zero-cost development implementations (`src/lib/services/mock/`).

### 2. The Configuration Layer
- **Mechanism**: File-based `.env.local` generation.
- **Flow**:
  1. App starts without config.
  2. Middleware detects missing `SETUP_COMPLETE` flag.
  3. User is redirected to `/setup-wizard`.
  4. Wizard collects keys, validates them against real APIs.
  5. Wizard writes `.env.local` via `fs` (in dev) or instructions (in prod).

### 3. The Data Layer (Cloudflare D1 + R2)
- **Primary DB (Cloudflare D1)**: User profiles, authentication, application settings, and encrypted API keys.
- **Media Storage (Cloudflare R2)**: Video outputs, backups, and cached assets.
- **Why D1?**: Edge-native database colocated with Workers runtime, zero cold starts, native encryption support.
- **Schema**:
  - **D1 Tables**:
    - `user_profiles`: Stores user metadata, subscription tier, telegram_chat_id
    - `user_api_keys`: Encrypted BYOK credentials (openrouter, anthropic, elevenlabs, d-id, muapi)
    - `payment_events`: Payment transaction records (NOWPayments, PayOS)
    - `payout_batches`: Affiliate payout batches (Stripe Connect, crypto)
    - `commission_ledger`: Per-conversion commission tracking and accrual
    - `oauth_credentials`: Encrypted OAuth tokens (TikTok, YouTube, Reddit, etc.)
    - `engine_missions`: Video generation jobs with status and output URLs
    - `campaigns`: User-created content campaigns
    - `audit_logs`: System audit trail with tamper-proof signatures
  - **R2 Buckets**:
    - `sophia-videos`: Final HeyGen/Wan 2.1 video outputs
    - `sophia-ai-factory-opennext-cache`: NextJS incremental static regeneration cache
    - `sophia-ai-factory-backups`: D1 database backups (30-day lifecycle)

### 4. The Automation Engine (n8n)
- **Role**: Heavy lifting and orchestration.
- **Why n8n?**: Visual workflow builder allows users to customize logic (e.g., change prompts) without coding.
- **Workflows**:
  - `script-generator.json`: Webhook -> OpenRouter -> JSON Parse -> Airtable Update.
  - `video-generator.json`: Webhook -> ElevenLabs -> D-ID -> Airtable Update.
  - `voice-generator.json`: Text-to-Speech generation.
  - `publish-workflow.json`: Final publishing steps.

### 5. Payment & Media Infrastructure
- **Payments**: NOWPayments.io (crypto USDT TRC20) for tier subscriptions.
  - **Flow**: Tier selection → Invoice link → Payment → HMAC webhook → tier activation.
  - **Webhook Signature**: Inbound webhooks (NOWPayments, PayOS) unified via `verifyInboundWebhook()` helper (`src/lib/webhooks/signature.ts`).
  - **Secrets**: `NOWPAYMENTS_IPN_SECRET`, `PAYOS_CHECKSUM_KEY` (Cloudflare env).
- **Media Storage**: Cloudflare R2 bucket `sophia-videos` for HeyGen + muxed video outputs.
  - **Webhook**: `POST /api/webhooks/heygen` (unified signature format: `t=<timestamp>,v1=<hmac>`).
  - **Secrets**: `HEYGEN_WEBHOOK_SECRET`, `HEYGEN_API_KEY`, `CLOUDCONVERT_API_KEY` (Cloudflare env).
  - **Sync Cron**: `GET /api/cron/video-status-sync` (5-min polling fallback).
  - **Metadata**: D1 columns `r2_key`, `r2_size_bytes` track stored videos.
  - **Public URL**: Optional `R2_PUBLIC_BASE_URL` env var for direct CDN access.
  - **FFmpeg Muxing** (Wave 15): Audio + video muxed via Cloudconvert REST API (`src/lib/video/ffmpeg-muxer.ts`). Fallback to dev stub MP4 if `CLOUDCONVERT_API_KEY` absent.
- **Backup Payment**: PayOS (payos.vn) for Vietnam domestic.
- **Webhook Security Note**: Outbound signature default flipped to `acceptLegacy=false` (Wave 15). Callers needing legacy bare-hex format must explicitly opt-in.

### 6. Distribution Publishers (Wave 11)
- **Role**: Multi-platform video distribution (Threads, Reddit, Bluesky, Mastodon, Twitter, TikTok, YouTube, Facebook).
- **Architecture**: 
  - **Publishers**: `src/lib/publishing/{threads,reddit,bluesky,mastodon,twitter-publisher,tiktok-publisher,youtube-publisher,facebook-publisher}.ts`
  - **OAuth Flow**: Dynamic scopes per provider; state encrypted server-side (migration 0095 `oauth_state_store` table)
  - **Webhook Security**: Unified format `t=<timestamp>,v1=<hmac>` (per-provider override support)
  - **Token Crypto**: `src/lib/publishing/token-crypto.ts` handles encryption/decryption of OAuth payloads (Wave 12: 4x refresh handlers for stale token auto-reflow)
  - **Quota Manager**: `src/lib/publishing/per-channel-quota.ts` enforces tier limits (BASIC: 1 channel, PREMIUM: 5, ENTERPRISE: unlimited)
- **Key Providers** (Wave 11 additions):
  - **Threads**: AT Protocol compliance, ephemeral tokens
  - **Reddit**: OAuth2 with dynamic scope (read/write/manage subreddits)
  - **Bluesky**: PDS direct endpoint support
  - **Mastodon**: Instance-specific OAuth (user selects instance during setup)

### 7. Video Generation Pipeline (Wave 12+13)
- **Role**: Multi-model video synthesis (Replicate Wan 2.1 + fal.ai Fish Speech audio).
- **Architecture**:
  - **Models**: Wan 2.1 (text→video), Fish Speech (text→audio via fal.ai)
  - **Storage**: Cloudflare R2 `sophia-ai-factory-opennext-cache` (video outputs) + D1 metadata tracking
  - **Workflow**: Mission script complete → Inngest trigger `video-gen-handler` → API calls (Wan 2.1 + Fish Speech) → poll for job completion → R2 upload → D1 update
  - **Schema**: Migration 0096 adds `output_video_url, output_audio_url, video_job_id` to `engine_missions` table
  - **Inngest Registration** (Wave 13): `src/forest/inngest/client.ts` registers `video-gen` event schema (`{missionId, scriptId, avatarId, voiceId, duration}`). Trigger endpoint: `POST /api/v1/missions/[id]/generate-video` (accepts same body, replaces ad-hoc queue pattern).
  - **Rate Limiting**: All 37 v1 routes wrapped with `withRateLimit()` (tier-aware burst buckets)

### 8. Mobile Command Center (Telegram)
- **Role**: Remote interface for campaign management.
- **Components**:
  - **Bot**: Registers webhooks with Telegram API.
  - **Webhook Handler**: Validates secrets and routes commands (`/campaign`, `/status`).
  - **User Mapping**: Links `chat_id` to D1 `user_id` via `/email` verification (stored in `user_profiles.telegram_chat_id`).
- **Flow**:
  1. **Command**: User sends `/campaign New Topic`.
  2. **Validation**: Bot checks if `chat_id` exists in D1 `user_profiles.telegram_chat_id`.
  3. **Trigger**: Bot inserts record into D1 `campaigns` and sends `campaign.created` event to Inngest.
  4. **Feedback**: Bot replies with "Campaign Started".
  5. **Notification**: (Future) System sends push notification back to Telegram on completion.

## Security Architecture

### API Key Management
- **Client-Side**: No sensitive keys are exposed to the browser. Keys are masked (e.g., `sk-****`).
- **Server-Side**: All API requests are proxied through Next.js API Routes / Server Actions.
- **Storage**:
  - **System Keys**: stored in `.env.local` (local) or Cloudflare Worker secrets (wrangler).
  - **User Keys (BYOK)**: D1 table `user_api_keys` (encrypted at rest, decrypted on read).
- **BYOK Provider Enum** (v1.14.18+):
  - **User-Settable**: `openrouter`, `anthropic`, `elevenlabs`, `d-id`, `muapi` (+ admin-only `heygen` for backward compat, removed from UI).
  - **Validation**: Zod superRefine per-provider regex (openrouter: `sk-or-v1-...`, anthropic: `sk-ant-api\d{2}-...`, muapi: `≥20 chars`, elevenlabs: `11_...`, d-id: format-check).
  - **Rate-Limit**: `/api/user/byok/*` enforces admin tier (20 req/min) via middleware rule inserted before catch-all.
  - **Admin Page** (`/dashboard/byok`): Bilingual provider feature matrix, edit/delete with error handling, field-level validation messages.

### Access Control
- **User Authentication**: Better Auth session (email/password + magic link) with D1 user profiles.
- **Password Reset** (Wave 11): One-time reset tokens (`password_reset_tokens` table, migration 0095). Flow: `signResetToken(userId)` → JTI in email → `consumeResetToken(token)` atomically marks used, prevents replay. Expires in 15min. Endpoint: `POST /api/auth/reset-password`.
- **OAuth State Security** (Wave 11): Server-side encrypted state storage (`oauth_state_store` table, migration 0095) — clientSecret never exposed in URL. Helpers: `storeOauthState(provider, payload)` / `consumeOauthState(nonce)` in `src/lib/publishing/token-crypto.ts`. State expires in 10min.
- **Admin Authorization**: Unified via `requireAdmin()` helper (`@/lib/auth/require-admin`) backed by Better Auth session + D1 role check. All 33+ admin API routes converged to single auth source (Phase TIER-2B, 2026-04-28).
- **Turnkey Mode**: Single-user (Personal) deployment. No login required by default (assumes local/protected network).
- **Deprecated**: Basic Auth env vars (`ADMIN_USER`, `ADMIN_PASS`, `ADMIN_API_KEY`) removed from active API routes; Cloudflare secrets cleanup pending post-deploy.

### 7. Feature Gating & Tier Enforcement
- **Philosophy**: "Secure by Design" - Enforcement happens at the API level, UI is just a reflection.
- **Tiers**:
  - **BASIC (Starter)**: Entry level, 1 channel, manual workflow.
  - **PREMIUM (Growth)**: Automation enabled, 3 channels, affiliate engine.
  - **ENTERPRISE (Premium)**: Unlimited scale, API access, white-glove features.
- **Enforcement Layers**:
  1.  **Middleware / API Routes**: `TierGuard` function checks `user_profiles.subscription_tier` before processing requests.
      - *Example*: POST `/api/campaigns` checks if `campaign_count < tier_limit`.
  2.  **UI Layer**: Components check `useTier()` hook to show/hide features or display "Upgrade" banners.
  3.  **Database**: Row Level Security (RLS) can be used for hard limits (future optimization).
- **Limits Config**: Defined in `src/config/tiers.ts` as the single source of truth.

### 9. CI/CD & Deployment (Cloudflare Workers)
- **Build**: `npm run build` — Next.js compilation to OpenNext format (Cloudflare Workers compatible).
- **Testing**:
  - **Unit Tests**: Vitest with coverage tracking
  - **Type Check**: TypeScript strict mode (zero `:any` types in prod)
  - **Linting**: Biome code quality checks
  - **E2E Tests** (optional): Playwright against mock mode for deterministic testing
- **Deployment** (CF-direct doctrine):
  - **Deploy Command**: `npm run deploy:full` (local wrangler CLI, NOT CI/CD)
  - **Artifact**: `.open-next/worker.js` deployed to Cloudflare Workers
  - **Database**: D1 migrations applied via `bash scripts/apply-migrations.sh`
  - **Verification**: SHA match required (`/api/version` endpoint), HTTP 200 confirmation, production health check
  - **Rollback**: `npx wrangler rollback --name sophia-ai-factory` reverts to previous version
  - **Note**: GitHub Actions intentionally disabled (`.github/workflows/test.yml.disabled`); see `CLAUDE.md` for CF-direct doctrine details

## Data Flow: "New Project" Lifecycle

### Standard Flow (n8n Orchestration)
1. **Initiation**: User clicks "New Project" in Dashboard.
2. **Input**: User provides Topic or Product URL.
3. **Storage**: App creates a "Draft" record in Airtable `Scripts` table.
4. **Trigger**: App calls n8n `generate-script` webhook with Record ID.
5. **Processing (Async)**:
   - n8n fetches record.
   - n8n calls LLM to generate script.
   - n8n updates Airtable record with content and changes status to `generated`.
6. **Review**: User sees updated script in Dashboard (via SWR/Polling).
7. **Approval**: User clicks "Generate Video".
8. **Rendering (Async)**:
   - App calls n8n `render-video` webhook.
   - Audio generated, then Video.
   - Final URL updated in Airtable.

### Enterprise Flow (Direct HeyGen Integration + Tier Gate)
1. **Tier Enforcement**: `POST /api/heygen/create-video` checks `getUserTier(userId)`. BASIC users get 402 + `/pricing` redirect hint. PREMIUM+ allowed.
2. **Initiation**: User selects "Premium Avatar" in Campaign Wizard.
3. **Input**: Script Text, Avatar ID, Voice ID.
4. **Submission**: App calls `POST /api/heygen/create-video` directly (auth required, tier validated).
5. **Processing (Async)**:
   - HeyGen API accepts job, returns `video_id`.
   - App stores `video_id` + migration 0030 R2 metadata (`r2_key`, `r2_size_bytes`) in D1.
6. **Webhook Ingest**:
   - HeyGen POSTs completion event to `POST /api/webhooks/heygen` (HMAC-SHA256 verified).
   - If `HEYGEN_WEBHOOK_SECRET` missing in prod, returns 200 + log warn (fallback mode, avoids retry-storm).
   - Handler fetches video from R2 bucket `sophia-videos`, updates status + URLs.
7. **Caching** (Performance Optimization):
   - `GET /api/heygen/avatars` and `GET /api/heygen/voices` use module-level 5-min cache (CF Workers isolate-bound).
   - Global data (not per-user) allows safe caching. Reset helper `_resetCacheForTest` for test isolation.
8. **Status Polling** (fallback):
   - Cron `GET /api/cron/video-status-sync` runs every 5 min, polls pending HeyGen jobs.
   - Updates D1 + fetches video if ready.
9. **Response Structure**:
   - Status route returns: `{status, video_url, thumbnail_url, duration_sec, error}`.
   - Error codes: `MISSING_KEY`, `DB_FAILED`.
10. **Storage**:
   - Video stored in Cloudflare R2 `sophia-videos` bucket.
   - Public URL via `R2_PUBLIC_BASE_URL` env var (optional, defaults to R2 auth URL).

### Quota & Rate Limiting (v1.14.19+)

**Video Quota Architecture**:
- **Table**: `video_usage_monthly` (D1) — per-user monthly counter, keyed on `(user_id, year_month)`.
- **Tier Limits**:
  - BASIC: 0 (blocked at 402 before quota check)
  - PREMIUM: 30 per month
  - ENTERPRISE: 200 per month
  - MASTER: 1000 per month
- **Enforcement**: `POST /api/heygen/create-video` calls `checkVideoQuota(userId)` before submitting to HeyGen. Returns 429 (Too Many Requests) + metadata `{error, limit, used, resetAt}` if over limit.
- **Increment**: Fire-and-forget counter increment post-HeyGen success (via `incrementVideoUsage(userId)`). Non-fatal if D1 write fails (logs but user still gets video).
- **Known Issue (TOCTOU race)**: Concurrent requests from same user can all read count=29 simultaneously, all pass quota gate, then all increment to 30+ before D1 UPSERT completes. Recommend atomic `UPDATE … SET count = count + 1 WHERE count < limit RETURNING count` for MASTER tier scale (pre-GA fix).

**Rate Limiting**:
- **Global Default**: Middleware enforces 30 req/min per IP (via Cloudflare Workers rate-limit header).
- **Admin Tier Rules**: `/api/user/byok/*` elevated to 20 req/min (admin operations).
- **Public Endpoints**: `/api/affiliate-discovery` (200 req/min), `/api/webhooks/*` (10 req/min per signature).

## Supervisor Agent (2026-04-17 MVP)

**Overview**: Autonomous workflow orchestrator managing a 3-step linear pipeline (plan → execute → test) on Cloudflare Workers edge.

### Architecture

```
User Mission Request
  ↓
POST /api/raas/workflows
  ↓
D1: Create workflows row (status=PLANNING, step=PLAN)
  ↓
Cron Trigger (*/1 * * * *): GET /api/cron/workflow-stepper
  ↓
  ├─ Fetch active workflows from D1
  ├─ Execute appropriate step (PLAN/EXECUTE/TEST)
  ├─ Update D1 with results
  └─ Emit signal events (STEP_COMPLETED, WORKFLOW_COMPLETED, etc.)
  ↓
Dashboard Polling (3s): GET /api/raas/workflows/[id]
  ↓
Timeline UI Shows Progress: PLAN → EXECUTE → TEST → COMPLETED
```

### D1 Tables

#### Core Tables
- **workflows**: id, org_id, mission_id, parent_mission_id, status, plan_prompt, current_step, step_result, error_message, created_at, updated_at, completed_at
- **Reuses** `missions.parent_mission_id` for hierarchical relationships

#### Revenue Path Tables (Phase M1)
- **campaigns**: id, user_id, name, status, created_at, updated_at
- **campaign_checkpoints**: id, campaign_id, checkpoint_name, status, result, created_at
- **raas_licenses**: id, tenant_id, subscription_tier, license_key, issued_at, expires_at, status
- **raas_audit_logs**: id, tenant_id, action, resource_id, actor, timestamp
- **user_profiles (extended)**: Added `subscription_tier` (TEXT), `telegram_chat_id` (TEXT) for billing & bot linkage

### API Endpoints (Protected Routes - Auth Required)

| Route | Method | Purpose | Rate Limit |
|-------|--------|---------|-----------|
| `/api/raas/workflows` | POST | Create workflow | default |
| `/api/raas/workflows` | GET | List all workflows | default |
| `/api/raas/workflows/[id]` | GET | Workflow detail + timeline | default |
| `/api/cron/workflow-stepper` | GET | Internal cron (automatic, */1 * * * *) | — |
| `/api/discovery/score` | POST | Score program niche via BYOK | discovery (strict) |
| `/api/discovery/*` | — | Full discovery scope | discovery (strict) |
| `/api/user/byok` | GET/POST/DELETE | BYOK credential management | auth (strict) |

**Rate Limit Notes:**
- `RATE_LIMITS.default` — standard API bucket (apply to most endpoints)
- `RATE_LIMITS.auth` — stricter bucket for sensitive operations (user credential management)
- `RATE_LIMITS.discovery` — stricter bucket (30/60s) for `/api/discovery/*` due to OpenRouter cost exposure

### Signal Events (D1 signals_events table)
- `WORKFLOW_STARTED` — Workflow created
- `STEP_COMPLETED` — Plan/Execute/Test step finishes
- `WORKFLOW_COMPLETED` — All 3 steps done
- `WORKFLOW_FAILED` — Any step fails
- `DISCOVERY_SCORE_REQUESTED` — Niche scoring operation requested via `/api/discovery/score`

### MVP Implementation
Step functions currently stubbed:
- **PLAN**: `"Step PLAN completed: {prompt[:100]}"`
- **EXECUTE**: `"Step EXECUTE completed: {prompt[:100]}"`
- **TEST**: `"Step TEST completed: {prompt[:100]}"`

Real PEV (Prompt Execution Validator) engine deferred to Phase 2.

### Dashboard UI
- **`/dashboard/workflows`**: List view with status badges, 3s polling
- **`/dashboard/workflows/[id]`**: Detail view with timeline, step results (JSON)

### Admin Monitoring Helpers

**`src/lib/admin/monitoring-queries.ts`** — Utility functions for dashboard aggregation:
- `aggregateByokEvents(hoursBack = 24)` — Returns `{ setCount, clearCount, netChange }` for BYOK statistics
- Other existing helpers for system health and performance metrics

### See Also
- **Runbook**: `docs/sophia-supervisor-agent-runbook.md` (bilingual VN+EN, troubleshooting, manual ops, rollback)
- **Changelog**: `docs/project-changelog.md` (2026-04-27 Sprint M entry)

---

## Revenue Pipeline (Sprint M — 2026-04-27)

**Overview:** End-to-end first-dollar monetization system. Users discover affiliate products → generate videos with CTA links → track conversions → receive payouts. Powered by ClickBank affiliate webhooks + D1 settlement engine.

**Wave 27 RaaS Global Multi-Channel Expansion (2026-05-15):** Feature batch adds:
- **10 affiliate networks** (4 crypto exchanges + 6 SaaS scouts): Binance, Bybit, Bitget, Coinbase (crypto); ShareASale, Awin, Rakuten, CJ Affiliate, Impact, FlexOffers (SaaS)
- **Anti-scam + EPC scoring** (`src/lib/affiliates/scout/scoring-engine.ts`) — 6-factor model (domain age, SSL validity, EPC trend, network approval, crypto volume, blacklist match) → risk score + EPC data
- **One-click bundle publishing** (`src/forest/publishing/bundle-publisher.ts`) — 4 presets (Vietnam/Global/Professional/Maximum), orchestrates caption translation → thumbnails → channel scheduling → tracking pixel injection
- **Geo-aware caption/hashtag translation** (`src/forest/publishing/caption-translator.ts`) — BYOK OpenRouter + per-channel locale mapping (TikTok.vn→VI, YouTube.kr→KO, etc.) + KV cache
- **Unified revenue dashboard** (`src/land/billing/revenue-dashboard.tsx`) — stacked Recharts: SaaS MRR + crypto USDT payouts + affiliate commissions; bilingual; drill-down per stream
- **Per-jurisdiction crypto disclaimer** (`src/seed/compliance/crypto-disclaimer-*.ts`) — 5 regions (US/EU/VN/SG/JP); KYC banner + video overlay + checkout disclaimer; migration 0110
- **Per-channel cooldown + burst protection** (`src/forest/publishing/channel-cooldown.ts`) — 13 channels (TikTok 4h, Instagram 24h, YouTube 12h, LinkedIn, Twitter, Telegram, Snapchat, Pinterest, Reddit, Discord, Bluesky, Threads, BeReal); defer-not-reject strategy

### Architecture

```
User (Telegram Bot)
  ├─ /campaign "Topic" → Create campaigns row
  ├─ Select offer → Store in affiliate_offers_selected + FSM state
  │
Campaign Generator (Inngest)
  ├─ Generate script + voice
  ├─ Inject CTA: "Get [offer_name] at bit.ly/[shortcode]"
  └─ Render video with short-link
  │
Short-Link Handler (/api/r/[code])
  ├─ Rate-limit 100/min
  ├─ Log click in affiliate_clicks D1 table
  └─ Redirect to ClickBank offer
  │
ClickBank Vendor (External)
  ├─ User purchases product
  └─ Send IPN postback
  │
Webhook Handler (/api/webhooks/clickbank)
  ├─ HMAC-SHA1 verify signature
  ├─ Log conversion in affiliate_conversions (70/30 split)
  └─ Mark TEST events as unavailable_at=null (skip in payouts)
  │
Payout Engine (Cron)
  ├─ Hourly: rebuild user_wallets from conversions
  │   - Apply 60-day clearance window
  │   - Sync balance_pending vs balance_available
  │
  └─ Daily: promote cleared conversions
      - Transfer pending → available
      - Update wallet timestamp
  │
Admin Dashboard (/admin/payouts)
  ├─ Review pending payouts
  ├─ Mark Paid → update payouts table
  └─ Trigger Telegram notification
  │
User Wallet (/dashboard/wallet)
  └─ View balance_available, balance_pending, lifetime_paid_out
```

### D1 Tables

**Core Tables (Revenue)**
- **affiliate_offers_catalog** (PUBLIC): System-wide catalog of affiliate offers (seedable, read-only for users)
  - Columns: id, name, url, category, description, provider, created_at
  - Purpose: Public discovery API source; separates catalog metadata from user-private tracking
  - Seed: 10 real offers (Bluehost, SEMrush, ConvertKit, Teachable, Canva, NordVPN, Shopify, ClickFunnels, Amazon Associates, Wealthy Affiliate) — migration 0032

- **affiliate_offers_selected** (PRIVATE): Records user's chosen affiliate product for a campaign
  - Columns: id, user_id, campaign_id, offer_id, offer_title, offer_url, created_at
  - Purpose: Binding affiliate product choice to specific campaign (enables per-campaign attribution); never exposed via public API

- **affiliate_clicks**: Click event log (fire-and-forget, no rate limit on logging)
  - Columns: id, shortcode, user_id, offer_id, referrer, created_at
  - Indexes: user_id, offer_id, created_at
  - Purpose: Attribution trail; helps debug conversion gaps

- **affiliate_conversions**: ClickBank postback records (webhook-driven)
  - Columns: id, receipt, click_id, campaign_id, user_id, offer_id, event_type, gross_amount, commission_user (70%), commission_sophia (30%), payout_status, available_at, paid_at, raw_payload, created_at
  - Unique: (receipt, event_type) — prevents double-counting webhook retries
  - available_at: NULL for TEST events; Unix timestamp (now + 60 days) for SALE; prevents chargebacks within clearance window
  - payout_status: pending_clearance → available → paid | reversed | unattributed
  - Purpose: Single source of truth for owed commissions; audit trail of all conversions

- **user_wallets**: Materialized balance view (rebuilt hourly via cron)
  - Columns: user_id (PK), balance_pending, balance_available, balance_paid_out, last_rebuilt_at
  - Purpose: Fast read for UI; durable aggregate of conversions subject to clearance window

- **payouts**: Admin-approved payout records
  - Columns: id, user_id, amount, currency, method (usdt_trc20|usdt_erc20|bank_transfer|other), reference, notes, paid_by_admin, created_at
  - Indexes: user_id, created_at
  - Purpose: Audit trail of all money moved out; enables reconciliation

- **user_payout_settings**: User KYC preferences (lightweight, no full KYC)
  - Columns: user_id (PK), preferred_method, payout_address (encrypted PII, TODO), verified_at
  - Purpose: Store user's payment destination; prevents typos on payout day

**Wave 27 New Tables (RaaS Global Multi-Channel)**
- **affiliate_networks** (PUBLIC): Master list of 10+ supported networks
  - Columns: id (TEXT, primary), name, category (crypto|saas), network_config_json (TEXT), requires_byok (BOOLEAN), created_at, updated_at
  - Seed data (Wave 27): Crypto (Binance, Bybit, Bitget, Coinbase) + SaaS (ShareASale, Awin, Rakuten, CJ Affiliate, Impact, FlexOffers)
  - Purpose: Define available affiliate networks; BYOK flag controls credential requirement
  - Example: `{id: 'binance', name: 'Binance', category: 'crypto', requires_byok: true, network_config_json: '{"apiKeyPattern": "sk-orapi-..."}', created_at: 1715784000}`

- **user_affiliate_networks_byok** (PRIVATE): BYOK credentials per network per user
  - Columns: id, user_id, network_id, encrypted_credentials (TEXT, encrypted via chacha20-poly1305), created_at, updated_at, verified_at
  - Purpose: Store user's own API keys/affiliate account tokens for BYOK networks (one per user+network combo)
  - Example: BYOK for Binance = user's own Binance affiliate account API key

- **affiliate_scout_scores** (SEMI-PUBLIC): Computed scores from Phase 03 anti-scam engine
  - Columns: id, network_id, domain, score (0-100), risk_factors (TEXT array), epc_current, epc_90d_avg, epc_trend, domain_age_days, ssl_valid, blacklist_match (BOOLEAN), created_at, cached_until
  - Indexes: (network_id, domain), created_at
  - Purpose: Cache scoring results to avoid re-computation; populated on-demand by `POST /api/scout/networks/{networkId}/score/{domainId}`
  - TTL: cached_until = created_at + 7 days (refresh weekly)

- **channel_publishing_queue** (PRIVATE): Per-channel deferred publishing with cooldown
  - Columns: id, user_id, channel (VARCHAR), campaign_id, media_url, caption, hashtags, scheduled_for, cooldown_expiry, status (queued|published|failed), error_msg, created_at, published_at
  - Indexes: (user_id, channel, status), scheduled_for
  - Purpose: Respect per-channel cooldown (TikTok 4h, Instagram 24h, etc.); defer-not-reject strategy
  - Example: Bundle publish to 13 channels enqueues 13 rows; cron respects cooldown_expiry before posting

- **tenant_settings** (EXTENDED, per user): Row added in migration 0110
  - New column: crypto_jurisdiction (TEXT, default 'US') — one of {US, EU, VN, SG, JP}
  - Purpose: Control which crypto disclaimer + KYC requirement applies

**Related Extended Tables**
- **user_profiles**: Added `subscription_tier` (TEXT) and `telegram_chat_id` (TEXT) in migration 0020
  - Enables affiliate tier-gating (future: ENTERPRISE+ only) + Telegram notifications

### API Endpoints

| Route | Method | Auth | Rate Limit | Purpose |
|-------|--------|------|-----------|---------|
| `/api/r/[code]` | GET | none | 100/min | Short-link redirect with click logging |
| `/api/scripts/generate` | POST | session (Better Auth) | default | Generate video script via OpenRouter — tier-gated (BASIC min), model selected by `selectModelForTier()` (ENTERPRISE → claude-3.5-sonnet, else → gpt-4o-mini). Returns ephemeral `requestId`, no D1 persistence yet. |
| `/api/webhooks/clickbank` | POST | HMAC-SHA1 | 1000/min per IP | ClickBank conversion postback |
| `/api/user/wallet` | GET | session | default | View user's wallet balances |
| `/api/admin/payouts/queue` | GET | admin | default | List pending payouts (next 30 days) |
| `/api/admin/payouts/mark-paid` | POST | admin | default | Mark payout as paid + notify user |
| `/api/campaigns` | POST | session | default | Create new campaign (via Telegram FSM) |
| `/api/scout/networks` | GET | session | RAAS tier-gated | List all 10 affiliate networks (Wave 27) with category, BYOK flag, config hints |
| `/api/scout/networks/{networkId}/score/{domain}` | POST | session | RAAS tier-gated | Phase 03 anti-scam scoring — returns `{score, riskFactors, epc, domainAge, sslValid, blacklistMatch, cachedUntil}` |
| `/api/user/affiliate-networks` | GET | session | default | List networks the user has BYOK credentials for |
| `/api/user/affiliate-networks/{networkId}` | POST/DELETE | session | auth (strict) | Create/delete BYOK credential for network (encrypted storage, migration 0110) |
| `/api/publish/bundle` | POST | session | RAAS tier-gated | Phase 04 one-click bundle publish — accepts `{preset, campaignId, caption, hashtags, channels}`, orchestrates translation + scheduling |
| `/api/publish/channels/{channel}/cooldown` | GET | session | default | Query next available publish window for channel (TikTok 4h, Instagram 24h, etc.) |
| `/api/compliance/crypto-disclaimer/{jurisdiction}` | GET | none | 200/min | Phase 08 jurisdiction-specific disclaimer text (US/EU/VN/SG/JP); public, cacheable |
| `/api/revenue/dashboard` | GET | session | default | Unified dashboard: SaaS MRR + Crypto USDT + Affiliate commissions (stacked Recharts data) |

### Cron Jobs (Cloudflare Workers)

| Schedule | Handler | Purpose |
|----------|---------|---------|
| `0 * * * *` (hourly) | `cron/payout-wallet-rebuilder` | Aggregate conversions, apply clearance window, update user_wallets |
| `0 0 * * *` (daily) | `cron/payout-clearance-promoter` | Move pending conversions to available after 60-day hold |

### Webhook Security

**ClickBank INS (Instant Notification Service)**
- Signature header: `x-clickbank-signature` (HMAC-SHA1)
- Verification: Compare computed vs provided signature (timing-safe)
- Failure response: 401 Unauthorized (no retry from ClickBank)
- Success response: 200 OK (even if DB insert fails; prevent webhook storm)
- Idempotency: (user_id, receipt, event_type) unique constraint prevents double-processing on retry

### Settlement Logic

**Clearance Window (60 days)**
- Conversion logged → available_at = now + 60 days
- Hourly cron: if conversion.available_at <= now, move to balance_available
- Prevents chargebacks within window (conservative merchant practice)
- Adjustments: Admin can manually move back to pending if dispute filed

**Commission Split**
- gross_amount = ClickBank merchant-net commission (what Sophia receives from ClickBank)
- commission_user = gross_amount × 0.70 (user receives 70%)
- commission_sophia = gross_amount × 0.30 (Sophia retains 30%)
- Both stored in affiliate_conversions row; wallet accumulates commission_user over all conversions

**Payout Methods**
- USDT TRC20 (default, fastest, lowest fee)
- USDT ERC20 (fallback if TRC20 address invalid)
- Bank transfer (slow, high min ~$100)
- Other (manual, e.g., crypto exchange credit)

### Telegram Notifications

**On payout approval:**
```
Subject: [Notification] 💰 Payout Approved
Body: Your payout of $XXX USD has been approved and will be sent to [method] within 24-48 hours.
```

**On conversion:**
```
(Future: async notification when conversion posts, enabling real-time motivation)
```

### Deployment Requirements

**Secrets (Cloudflare)**
- `CLICKBANK_INS_SECRET` — Webhook signature key from ClickBank vendor dashboard
- `CRON_SECRET` — Shared secret for cron trigger validation (prevent unauthorized execution)

**Configuration**
- ClickBank vendor INS URL → https://sophia.agencyos.network/api/webhooks/clickbank
- D1 migrations 0018-0023 applied to remote DB
- Cron triggers enabled in wrangler.toml (already configured; requires deploy)

**Testing Checklist**
- [ ] Telegram: /campaign flow creates row in campaigns + checkpoint tables
- [ ] Web: /dashboard/campaigns/new loads affiliate offers + dropdown works
- [ ] Click: /api/r/[code] logs to affiliate_clicks + redirects
- [ ] Conversion: ClickBank "Send Test INS" → verified + logs to affiliate_conversions
- [ ] Wallet: Cron runs → user_wallets updated, balance_available changes visible
- [ ] Payout: Admin marks paid → user receives Telegram notification + payouts row created

---

## Telegram FSM State Validation (Phase 12 design)

The Telegram bot FSM persists conversation state (`BotState` enum) in D1 table `telegram_fsm_state`. On read, `telegram-fsm-state-manager.ts` validates the persisted `row.state` against the current enum via `isBotState()` runtime guard.

**Invalid-state policy: LOG-ONLY, NO WRITE-BACK.**

When `row.state` fails the runtime guard:
1. Emit `logger.warn('telegram_fsm_invalid_state', { metric: 'telegram_fsm_invalid_state', chatId, rawState })`.
2. Return `BotState.IDLE` as a safe default to the caller.
3. **Do NOT write `IDLE` back to D1.**

### Rationale

Three causes of invalid state exist. Only one is safely auto-healable:

| Cause | Self-heal safe? |
|---|---|
| DB corruption (bit flip, partial write) | ❌ Write-back hides evidence of corruption |
| Enum value removed in a migration | ✅ Write-back is harmless (old value is dead) |
| Manual DB edit by admin | ❌ Write-back erases intentional change |

Silent write-back would mask causes 1 and 3. We chose to preserve the invalid row and let ops investigate. The `metric: 'telegram_fsm_invalid_state'` log key enables alerting dashboards to thresh on frequency.

### Ops alert recommendation

- **Warning threshold:** >10 occurrences/hour — possible migration drift or bad deploy.
- **Critical threshold:** >100/hour sustained — DB corruption suspected; page oncall.

### Future env-flag opt-in (deferred)

If a concrete migration scenario emerges (e.g., deliberate mass cleanup of a removed enum value), add `FSM_SELF_HEAL=true` env flag to enable opt-in write-back. Not implemented now — YAGNI until demanded.

---

## Agent Factory (Phase 01 — 2026-04-25)

Each org auto-provisions an **AI Company** with CEO + Developer agents.

### Tables
- `agent_teams` — one per org, stores team config
- `agents` — individual agents (role: CEO|Developer, system_prompt, model)
- `agent_tasks` — task queue (input, output, status, tokens, cost)
- `agent_logs` — append-only audit trail per task

### Request Flow
```
User → POST /api/agents/task or Server Action createAgentTask
         ↓
   getCurrentUser() → orgId (= user.id)
         ↓
   seedDefaultTeam(orgId) — idempotent CEO+Developer seed
         ↓
   createTask(orgId, agentId, input)
         ↓
   runAgent(taskId, orgId) — inline OpenRouter call (gpt-4o-mini)
         ↓
   updateTaskResult + appendLog (action: invoke)
         ↓
   Return task / GET /api/agents/status/[id]
```

### Key Design Decisions
- Tasks executed **inline** (no Durable Objects) — Cloudflare Workers free tier constraint
- `org_id = user.id` — consistent with existing missions/referral pattern
- Agent system_prompts stored server-side only, never echoed to client
- Default model: `openai/gpt-4o-mini` (cost-efficient, low latency)
- Phase 02 will add Durable Objects for stateful multi-turn sessions

---

## Agent Observability (Phase 04 — Land)

### Overview
Agent runtime metrics are surfaced via two D1 tables: `signals_events` (Phase 03) and `error_log`. No external APM (Sentry not used).

### Components

```
agent runner (runner.ts)
  │
  ├── ENFORCEMENT GATE: assertTierAllowsAgent(userTier, role)
  │       └── AgentTierBlockedError → HTTP 403
  │           ├── updateTaskResult(status: 'failed')
  │           └── track(AGENT_TASK_FAIL, { error_class: 'tier_blocked' })
  │
  ├── try { fetch(openrouter) } catch (err) {
  │       void reportError(err, { route:'agent.runner', agent_role, task_id, variant })
  │       track(AGENT_TASK_FAIL, ...)
  │       throw
  │   }
  │
  └── success path: track(AGENT_TASK_COMPLETE, ...)

system-health page (/dashboard/system-health)
  │
  ├── /api/health           → existing services grid
  └── /api/health/agents    → AgentHealthCard (React Query 30s)
                               └── agent-health-resolver.ts
                                   ├── signals_events GROUP BY agent_role (24h)
                                   └── error_log WHERE ctx_json.agent_role != null
```

### Tier Gate Map
| Agent Role | Minimum Tier Required |
|------------|----------------------|
| CEO        | PREMIUM              |
| Developer  | PREMIUM              |
| (unknown)  | ENTERPRISE (deny)    |
| (MASTER)   | bypass all gates     |

### Error Context Extension
`ErrorContext` in `error-tracker.ts` gained three optional fields:
- `agent_role?: string` — correlates error to agent role
- `task_id?: string` — correlates to `agent_tasks` row
- `variant?: string` — A/B prompt variant label

---

## Observability & Error Tracking (TIER-2D — 2026-04-28)

### Sentry Integration
- **SDK**: `@sentry/nextjs` v8 with `instrumentation.ts` (Next.js 15+ pattern)
- **Auto-instrumentation**: Client, Server, Edge runtime handlers configured via `withSentryConfig()` wrapper in `next.config.ts`
- **PII Filtering**: `beforeSend` hook strips sensitive fields (token, secret, password, key, auth keys, credit card)
- **4xx Filtering**: HTTP 4xx errors dropped (not actionable)
- **Sampling**: 10% traces in prod / 100% in dev; replays on errors at 10% prod to minimize data ingest
- **Release Tracking**: Release tag = git short SHA (matches `/api/version` shortSha) for precise deploy correlation
- **Source Maps**: Client maps auto-uploaded by Sentry plugin; server+edge maps from `.open-next/` via CLI script `scripts/ci/sentry-upload-sourcemaps.sh`

### Health Monitoring
- **Endpoint**: `GET /api/health` — service liveness with structured response
- **Probes**: D1 (test query), R2 (object exists), KV (key-value read) — 1500ms timeout per probe
- **Caching**: 30s response cache to prevent thundering herd
- **Response Schema**: `{ ok: boolean, db: {ok, latency}, r2: {ok, latency}, kv: {ok, latency}, sha: string, deployedAt: ISO8601, latencyMs: number }`

### Structured Logging
- **Module**: `@/lib/utils/logger-utility` — Sentry-aware logger
- **Dynamic Hook**: Auto-detects Sentry SDK presence; forwards `error` level to Sentry (graceful no-op if SDK absent)
- **Signature**: `logger.error(message, {error?, ...metadata}?, requestId?)` — object form preferred
- **Fallback**: Legacy form `logger.error(message, error, metadata, requestId)` still supported
- **Production Safety**: One intentional `console.error` fallback at `logger-internals.ts:92` to prevent recursive logging

---

## Operations & Disaster Recovery

See [`docs/disaster-recovery.md`](./disaster-recovery.md) for RTO/RPO definitions, backup procedures, and recovery runbooks:

- **RTO (Recovery Time Objective):** 4 hours
- **RPO (Recovery Point Objective):** 24 hours
- **Automated backups:** D1 exports via `scripts/dr/d1-snapshot.sh` (daily 02:00 UTC)
- **Recovery scripts:** `scripts/dr/restore-from-snapshot.sh` (dry-run safe by default)
- **Components covered:** D1 database, R2 cache, KV namespace, Worker code
- **Quarterly DR drills:** First Tuesday of each quarter

---

## Infrastructure Hardening

**Full documentation:** [`docs/infra-hardening.md`](./infra-hardening.md)

### DNS Security (Cloudflare)
- **Domain**: `sophia.agencyos.network` (proxied via orange cloud)
- **CAA Records**: Restrict SSL issuance to LetsEncrypt only
- **DNSSEC**: Enabled with chain validation
- **Email Auth**: SPF/DKIM/DMARC configured for outgoing mail

### R2 Bucket Lifecycle
- **Bucket**: `sophia-ai-factory-opennext-cache` (Next.js incremental static regeneration cache)
- **Retention**: Auto-delete cache objects after 30 days (regeneratable, no data loss)
- **Health Checks**: Rotate test files every 7 days

### GitHub Secrets Management
- **Repository**: `longtho638-jpg/sophia-ai-factory`
- **Secrets**: 8 critical secrets (API tokens, encryption keys, webhook secrets)
- **Rotation**: 90-day tokens (API keys), 180-day keys (encryption), static identifiers (org slugs)
- **Audit Scripts**: Bilingual scripts in `scripts/infra/` for DNS, R2, and secrets auditing

### Audit & Verification Scripts
```bash
# DNS audit — validates A, AAAA, CAA, MX, TXT, NS, DNSSEC
scripts/infra/audit-dns.sh

# R2 lifecycle — verifies cache expiration rules
scripts/infra/audit-r2-lifecycle.sh

# GitHub secrets — compares actual vs required secrets
scripts/infra/audit-github-secrets.sh
```

---

## Scalability Considerations
- **Frontend**: Stateless, deployable to Vercel Edge/Serverless.
- **Backend**: n8n can be self-hosted or cloud-hosted; scales independently.
- **Database**: Airtable has rate limits (5 requests/sec), suitable for SMB/Personal use. Future upgrade path: Supabase.
- **Supervisor Agent**: Cloudflare Workers cron (*/1 min) scales horizontally; D1 SQLite suitable for <100K workflows/org.

---

## Bring-Your-Own-Key (BYOK) Architecture (Wave 14, 2026-05-09)

**BYOK Columns Location:** Mission `byok_provider_id` + `byok_model_id` stored in `missions` table (NOT `engine_missions`). Wired via:
- `user_byok_active_provider` (D1) → mission create flow resolves provider registry (OpenRouter, Anthropic, etc.)
- `user_byok_active_model` (D1) → mission launcher selects model endpoint
- Fallback: tier-default model if BYOK unconfigured
- Validation: `@/lib/byok/provider-registry.ts` enforces provider/model pairing rules
- Security: API key rotation via `/api/user/byok/rotate-secrets` (admin-gated, logs audit event)

**Webhook Diagnostics:** `/api/canary/webhook` endpoint (POST, admin-only) for testing webhook infrastructure. Accepts `provider + signature + payload`; returns verification result + timing. Useful for ops validation during incidents.

---

## Kiến Trúc 4 Tầng Mekong / Mekong 4-Layer Architecture (2026-05-03)

<!-- Tiếng Việt -->
**Tổng quan (VN):** Kể từ ngày 2026-05-03, mã nguồn `src/` được tổ chức thành 4 tầng độc lập theo mô hình Mekong. Chiều phụ thuộc chỉ đi xuống (một chiều): `land → forest → tree → seed`. Không có tầng nào được import từ tầng trên nó. Quy tắc này được thực thi tự động bởi ESLint (`eslint.config.mjs`). Một số file được miễn trừ (xem mục Exemptions bên dưới) vì lý do kiến trúc đã được ghi chép trong kế hoạch.

**Overview (EN):** As of 2026-05-03, `src/` is organized into 4 independent layers following the Mekong model. Dependency direction is strictly one-way downward: `land → forest → tree → seed`. No layer may import from a layer above it. This rule is automatically enforced by ESLint (`eslint.config.mjs`). A documented set of files are exempted due to architectural constraints captured in the plan.

```mermaid
graph TB
  Land["land/<br/>Revenue + Governance<br/>billing • payments • status • pricing"]
  Forest["forest/<br/>Multi-Tenant SaaS Plumbing<br/>outbox • api-keys • email • quota • tenant-iso"]
  Tree["tree/<br/>Single-Tenant CEO Ops<br/>setup-wizard • handover • telegram • admin"]
  Seed["seed/<br/>Infra Primitives<br/>db • utils • types • config • base-agent • better-auth"]

  Land --> Forest
  Forest --> Tree
  Tree --> Seed
  Land -.-> Tree
  Land -.-> Seed
  Forest -.-> Seed

  classDef land fill:#fee,stroke:#c00
  classDef forest fill:#efe,stroke:#0a0
  classDef tree fill:#eef,stroke:#00c
  classDef seed fill:#fef,stroke:#a0a
  class Land land
  class Forest forest
  class Tree tree
  class Seed seed
```

_Solid arrows = primary dependency chain. Dashed arrows = allowed skip-layer imports (e.g., land → seed for infra types)._

### Layer Responsibilities / Trách nhiệm mỗi tầng

| Layer | Tầng | Purpose | Sample Modules | NOT Allowed |
|-------|------|---------|---------------|-------------|
| **seed/** | Hạ tầng nguyên thủy | Infra primitives — no business domain. Used by all layers. | `db/`, `utils/`, `types/`, `config/`, `auth/`, `security/`, `health/`, `components/ui/` | Import `tree/`, `forest/`, or `land/` |
| **tree/** | Vận hành CEO đơn tenant | Single-tenant CEO-facing ops. Admin panel, Telegram bot, handover reports. | `admin/`, `audit/`, `byok/`, `crypto/`, `gateway/`, `handover/`, `telegram/` | Import `forest/` or `land/` |
| **forest/** | Hạ tầng SaaS đa tenant | Multi-tenant SaaS plumbing. Agents, email delivery, API key management, quotas. | `agents/`, `api-keys/`, `email/`, `outbox/`, `onboarding/`, `quota/`, `usage-metering/`, `middleware/`, `worker/`, `inngest/`, `missions/` | Import `land/` |
| **land/** | Doanh thu + quản trị | Revenue & governance. Billing, payments, status pages, affiliate programs. | `billing/`, `payments/`, `status/`, `affiliates/`, `orders/`, `payouts/`, `promo/`, `refunds/`, `wallet/` | (top layer — no restriction) |

### Import Direction Rule / Quy Tắc Hướng Import

```
land/   ──▶  forest/  ──▶  tree/  ──▶  seed/
                │                        ▲
                └────────────────────────┘  (direct skip allowed)
```

- **Forbidden (sẽ bị ESLint báo lỗi):**
  - `seed/` importing `@/tree`, `@/forest`, or `@/land`
  - `tree/` importing `@/forest` or `@/land`
  - `forest/` importing `@/land`
- **Allowed exceptions (được miễn trừ trong eslint.config.mjs):**
  - `src/app/**` — App Router route files orchestrate all layers (top-level orchestration)
  - Auth cluster: `seed/auth/enriched-jwt*.ts`, `seed/auth/enforce-tier-quota.ts`, `seed/auth/better-auth-server.ts`
  - Security cluster: `seed/security/api-key-validator-*.ts`
  - Handover: `tree/handover/auto-handover.ts`, `tree/handover/handover-email-service.ts`
  - Telegram: `tree/telegram/telegram-bot-campaign-*.ts`, `tree/telegram/handlers/campaign-handler.ts`
  - Inngest: `forest/inngest/functions/auto-discover-affiliates.ts`, `forest/inngest/functions/conversion-to-ledger.ts`
  - Quota: `forest/quota/quota-enforcer.ts`
  - Pricing UI: `forest/components/pricing/coupon-input.tsx`

### ESLint Enforcement / Thực thi ESLint

Layer boundaries are enforced via `no-restricted-imports` in `apps/sophia-ai-factory/eslint.config.mjs` (Phase 07 — 2026-05-03). Run `npm run lint` to verify. Zero new violations expected in non-exempt files.

**Related:** Scout report (`plans/260503-1030-sophia-mekong-restructure/`), PRs #23–#28 (layer moves), PR #29 (this phase — ESLint + docs).

---

## 12. Sophia 2027 — Creative Economy OS (Transformation Layer)

> **Codename:** CREATIVE ECONOMY OS. **Target:** 2026-08-17 → 2027-12-31.
> **Status:** In progress. **Full spec:** `docs/strategy/SOPHIA_2027_CONSTITUTION.md`.

Sophia is evolving from an "AI Video Factory" into an **Autonomous Creative
Economy OS**. This is an integration/wiring effort — **not a rewrite**. The
transformation extends the existing 4-layer architecture rather than replacing
it. The core metric shifts from *videos generated* to **economic output per
creative unit**.

### 12.1 The Flywheel

```
VISION → CREATE → DISTRIBUTE → MEASURE → LEARN → COMPOUND
```

Each arrow is a domain primitive wired into the existing layer structure.

### 12.2 Domain Primitives (seed)

`src/seed/types/creative-domain.ts` (661 lines) is the canonical source of truth
for all 30 transformation entity types. It is **extended, never rewritten**:

| Entity | Purpose |
|--------|---------|
| `CreativeIdentity` | Voice, tone, positioning, beliefs, constraints, formats |
| `CreativeMemory` | Typed/versioned/scoped/auditable memory |
| `CreativeMissionStatus` | 9-state lifecycle: draft → planned → approval_required → running → paused → review → completed → learning → iterating |
| `AgentDefinition` / `AgentContext` / `AgentDecision` / `AgentAction` / `AgentResult` / `AgentApproval` / `AgentRun` | Agent protocol contract |
| `AgentPermission` | tool, scopes, requiresApproval, maxCostCents |
| `AutonomyLevel` | 0–4 autonomy scale |
| `ProvenanceRecord` | Append-only audit trail |
| `IP` | Universe → world → series → character → theme → brand |
| `ContentProject` / `ContentAsset` / `DerivativeAsset` | Content graph |
| `DistributionPlan` / `ChannelConfig` / `DistributionAsset` | Multi-platform distribution |
| `PerformanceEvent` / `PerformanceSnapshot` | Performance model |
| `RevenueEvent` | Economy tracking |
| `Experiment` / `ExperimentVariant` | A/B testing primitives |
| `AIProvider` / `ModelPolicy` / `ModelInfo` | Model-agnostic provider abstraction |

### 12.3 Domain Repositories (tree)

| Module | Responsibility |
|--------|----------------|
| `tree/creative-memory/` | CRUD + query + confidence decay for `CreativeMemory` |
| `tree/creative-identity/` | CRUD + query for `CreativeIdentity` |
| `tree/content-graph/` | Content lifecycle (Idea → Concept → Brief → Script → Storyboard → Production → Asset → Derivative → Distribution → Performance) |
| `tree/ip-graph/` | IP entity relationships + derivative traversal |
| `tree/agent-protocol/` | `executeAgent()` — runs an `AgentDefinition` against an `AgentContext`, wired through `seed/ai/` provider abstraction, respecting `AutonomyLevel` approval gates |
| `tree/autonomy/` | `checkActionAllowed(level, action)` — maps autonomy levels to allowed actions |
| `tree/performance/` | Performance events + experiments |
| `tree/distribution/` | Distribution plans + assets |
| `tree/learning/` | `analyzePerformance()` → `extractInsights()` → `updateCreativeMemory()` → `generateRecommendations()` |
| `tree/mission/` | Mission lifecycle (`canTransition`, `createApproval`, `resolveApproval`) |

### 12.4 Wire-Up Rules

1. **Extend, never replace.** `seed/ai/provider-interface.ts` is already
   model-agnostic. New creative providers extend it (`CreativeProvider`), never
   rewrite the `Provider` contract.
2. **No fourth workflow engine.** Inngest owns long-running workflows. The
   `tree/mission/` lifecycle is domain logic, not a workflow engine.
3. **No new agent framework.** Wire existing types into existing agent
   infrastructure (`tree/agent-protocol/agent-executor.ts`).
4. **Forest → Land orchestration only.** Inngest/cron/quota jobs (forest) dispatch
   business workflow (land). See `cross-layer-orchestration.md`.
5. **Deprecate, never delete.** All deprecated artifacts are tracked in
   `src/seed/types/deprecation-markers.ts` (`DEPRECATION_REGISTRY`). Removal is
   permitted only after a 2-sprint buffer.

### 12.5 Verification

- `npx tsc --noEmit` → 0 errors ✅
- Domain tests: 160/160 passing across 14 files ✅
- E2E creative mission test: 10/10 passing (`src/__tests__/integration/creative-mission-e2e.test.ts`) ✅
- No protected flows (Setup Wizard / Telegram / NOWPayments) touched ✅
- No `:any` types in new files ✅
- No `console.log`/`console.warn`/`console.error` in new files ✅
- No `TODO`/`FIXME`/`HACK`/`XXX` in new files ✅

**See also:** `docs/architecture/CREATIVE_MEMORY.md`, `CONTENT_GRAPH.md`,
`IP_GRAPH.md`, `AGENT_PROTOCOL.md`, `AUTONOMY.md`, `PROVENANCE.md`,
`DISTRIBUTION_OS.md`, `PERFORMANCE_INTELLIGENCE.md`, `DATA_FLYWHEEL.md`,
`DEPRECATION_CANDIDATES.md`.
