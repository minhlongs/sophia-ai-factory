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
  - `/setup-wizard`: A strictly guided flow to initialize the app.
  - `/dashboard`: Main operational view.
  - `/api/*`: Serverless functions acting as proxy to external services.
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

### 3. The Data Layer (Hybrid)
- **Primary DB (Supabase)**: User profiles, authentication, application settings, and encrypted API keys.
- **Content DB (Airtable)**: Lightweight CMS for Scripts, Videos, and Affiliate data.
- **Why Hybrid?**: Supabase handles secure user data and auth; Airtable remains for visual content management and n8n integration.
- **Schema**:
  - **Supabase**:
    - `user_profiles`: Stores `settings` (JSONB) and `api_keys` (Encrypted JSONB).
  - **Airtable**:
    - `Scripts`: Stores generated text, status, and metadata.
    - `Videos`: Stores final video URLs and performance metrics.
    - `Affiliates`: Stores product research data.

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
  - **Flow**: Tier selection → Invoice link → Payment → HMAC-SHA512 IPN webhook → tier activation.
  - **Security**: HMAC-SHA512 on `x-nowpayments-sig`, Order ID format `sophia_{orgId}_{timestamp}`.
  - **Secrets**: `NOWPAYMENTS_IPN_SECRET` (Cloudflare env).
- **Media Storage**: Cloudflare R2 bucket `sophia-videos` for HeyGen video outputs.
  - **Webhook**: `POST /api/webhooks/heygen` (HMAC-SHA256 verified).
  - **Secrets**: `HEYGEN_WEBHOOK_SECRET`, `HEYGEN_API_KEY` (Cloudflare env).
  - **Sync Cron**: `GET /api/cron/video-status-sync` (5-min polling fallback).
  - **Metadata**: D1 columns `r2_key`, `r2_size_bytes` track stored videos.
  - **Public URL**: Optional `R2_PUBLIC_BASE_URL` env var for direct CDN access.
- **Backup Payment**: PayOS (payos.vn) for Vietnam domestic.

### 6. Mobile Command Center (Telegram)
- **Role**: Remote interface for campaign management.
- **Components**:
  - **Bot**: Registers webhooks with Telegram API.
  - **Webhook Handler**: Validates secrets and routes commands (`/campaign`, `/status`).
  - **User Mapping**: Links `chat_id` to Supabase `user_id` via `/email` verification.
- **Flow**:
  1. **Command**: User sends `/campaign New Topic`.
  2. **Validation**: Bot checks if `chat_id` exists in `user_profiles`.
  3. **Trigger**: Bot inserts record into `campaigns` and sends `campaign.created` event to Inngest.
  4. **Feedback**: Bot replies with "Campaign Started".
  5. **Notification**: (Future) System sends push notification back to Telegram on completion.

## Security Architecture

### API Key Management
- **Client-Side**: No sensitive keys are exposed to the browser. Keys are masked (e.g., `sk-****`).
- **Server-Side**: All API requests are proxied through Next.js API Routes / Server Actions.
- **Storage**:
  - **System Keys**: stored in `.env.local` (local) or Vercel Environment Variables.
  - **User Keys**: stored in Supabase `user_profiles` table, encrypted at rest using AES-256-GCM.

### Access Control
- **User Authentication**: Better Auth session (email/password + magic link) with D1 user profiles.
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

### 8. CI/CD & Automation (Binh Pháp Strategy)
- **Pipeline**: GitHub Actions (`.github/workflows/ci-cd.yml`) implementing Binh Pháp methodology.
  - **Lint & Type Check**: Static analysis to ensure code quality (Front 2).
  - **Unit Tests**: Vitest for logic verification.
  - **E2E Tests**: Playwright running against **Mock Mode** (`NEXT_PUBLIC_MOCK_AI_SERVICES=true`) for deterministic UI testing without API costs.
  - **Build Verification**: Ensures the application builds successfully (Front 3).
- **Deployment**:
  - **Vercel**: Automated preview deployments for PRs and production deployment for main.
  - **Infrastructure**: Idempotent scripts (`scripts/infra-sync.sh`) for setup and verification.
  - **Verification**: Post-deploy smoke tests (`scripts/smoke-test.ts`) using deep health checks (`/api/health/`).

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

### Enterprise Flow (Direct HeyGen Integration)
1. **Initiation**: User selects "Premium Avatar" in Campaign Wizard.
2. **Input**: Script Text, Avatar ID, Voice ID.
3. **Submission**: App calls `POST /api/heygen/create-video` directly.
4. **Processing (Async)**:
   - HeyGen API accepts job, returns `video_id`.
   - App stores `video_id` + migration 0030 R2 metadata (`r2_key`, `r2_size_bytes`) in D1.
5. **Webhook Ingest**:
   - HeyGen POSTs completion event to `POST /api/webhooks/heygen` (HMAC-SHA256 verified).
   - Handler fetches video from R2 bucket `sophia-videos`, updates status + URLs.
6. **Status Polling** (fallback):
   - Cron `GET /api/cron/video-status-sync` runs every 5 min, polls pending HeyGen jobs.
   - Updates D1 + fetches video if ready.
7. **Response Structure**:
   - Status route returns: `{status, video_url, thumbnail_url, duration_sec, error}`.
   - Error codes: `MISSING_KEY`, `DB_FAILED`.
8. **Storage**:
   - Video stored in Cloudflare R2 `sophia-videos` bucket.
   - Public URL via `R2_PUBLIC_BASE_URL` env var (optional, defaults to R2 auth URL).

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
