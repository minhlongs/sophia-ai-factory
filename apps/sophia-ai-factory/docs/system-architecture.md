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

### 5. Payment Infrastructure (NOWPayments)
- **Role**: Payment processing for tier subscriptions via USDT TRC20 cryptocurrency.
- **Provider**: NOWPayments.io (Polar rejected this product for "wellness/health" classification)
- **Backup**: PayOS (payos.vn) for Vietnam domestic payments
- **Flow**:
  1. **Tier Selection**: User selects BASIC/PREMIUM/ENTERPRISE/MASTER tier.
  2. **Checkout**: App generates NOWPayments invoice link (pre-created invoice IDs in dashboard).
  3. **Payment**: User completes crypto payment via NOWPayments hosted page.
  4. **Webhook**: NOWPayments sends IPN (Instant Payment Notification) → `/api/webhooks/nowpayments`
  5. **Fulfillment**: IPN handler verifies HMAC-SHA512 signature, updates `subscription_tier` + `period_end`
- **Security**:
  - HMAC-SHA512 signature verification on `x-nowpayments-sig` header
  - Order ID format: `sophia_{orgId}_{timestamp}` enables idempotency tracking
  - No payment data stored in application database
  - IPN secret managed via `NOWPAYMENTS_IPN_SECRET` environment variable
  - Invoice IDs (TIER → Invoice ID mapping) stored in `nowpayments-client.ts`

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
- **Turnkey Mode**: Single-user (Personal) deployment. No login required by default (assumes local/protected network or Vercel Basic Auth).
- **Admin Mode**: Optional Basic Auth middleware for public deployments.

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
   - App stores `video_id` in Supabase/Airtable.
5. **Polling**:
   - Client polls `GET /api/heygen/status/[id]`.
   - UI shows real-time progress bar (Queued -> Processing -> Completed).
6. **Completion**:
   - Status becomes `completed`.
   - Video URL is displayed for playback/download.

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
- **workflows**: id, org_id, mission_id, parent_mission_id, status, plan_prompt, current_step, step_result, error_message, created_at, updated_at, completed_at
- **Reuses** `missions.parent_mission_id` for hierarchical relationships

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
- **Changelog**: `docs/project-changelog.md` (2026-04-18 entry)

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

## Scalability Considerations
- **Frontend**: Stateless, deployable to Vercel Edge/Serverless.
- **Backend**: n8n can be self-hosted or cloud-hosted; scales independently.
- **Database**: Airtable has rate limits (5 requests/sec), suitable for SMB/Personal use. Future upgrade path: Supabase.
- **Supervisor Agent**: Cloudflare Workers cron (*/1 min) scales horizontally; D1 SQLite suitable for <100K workflows/org.
