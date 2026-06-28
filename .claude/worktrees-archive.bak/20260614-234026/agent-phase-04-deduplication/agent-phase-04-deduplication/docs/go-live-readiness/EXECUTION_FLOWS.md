# System Execution Flows

This document details the request lifecycles, processing pipelines, and deployment topologies of the Sophia AI Factory platform.

---

## 1. Request Flow & Entry Points

### Client HTTP Requests
All user-facing requests enter via Cloudflare's Edge network, routing through Cloudflare Workers.
- **Entry Point**: Cloudflare Workers routing configuration (`wrangler.toml`).
- **Middleware Layer**: Next.js custom middleware (`file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/middleware.ts`) intercepting requests:
  - Validates active sessions via the `better-auth` session token cookie.
  - Enforces MFA redirection if the session is flagged as MFA-pending via `login-challenge.ts`.
  - Performs locale translation routing (Next-Intl setup).

### Authentication Verification
- **Framework**: Better Auth D1 Adapter.
- **Implementation**: [apps/sophia-ai-factory/src/seed/auth/better-auth-server.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/auth/better-auth-server.ts)
- **Execution Hook**:
  - `databaseHooks.user.create.after`: Sets up organization tables, members, zeroed credit balance rows in `org_balances`, user profile metadata, and inserts a signup bonus.

---

## 2. Inngest Event Queue Lifecycles

Sophia uses an asynchronous event-driven model driven by **Inngest**. The serve endpoint registers queues and cron hooks:
- **Serve Route**: [apps/sophia-ai-factory/src/app/api/inngest/route.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/api/inngest/route.ts)

### Core Background Pipelines

1. **Video Generation Flow** (`videoGenerate`)
   - **Event Trigger**: `video.generate`
   - **Step 1**: Validates user compute balances via `deductCredits`.
   - **Step 2**: Calls OpenClaw LLM models to formulate a script.
   - **Step 3**: Generates voice synthesis payloads using ElevenLabs APIs.
   - **Step 4**: dispatches rendering jobs to CloudConvert or HeyGen.
   - **Step 5**: Receives rendering webhooks, updates `videos` table, and refunds compute units if the execution failed.

2. **Auto-Repurposing Engine** (`repurposeAnalyze`, `repurposeClipGenerate`)
   - **Event Trigger**: `repurpose.analyze` -> `repurpose.clip.generate`
   - **Step 1**: Downloads parent video streams.
   - **Step 2**: Evaluates audio transcriptions for highlight scoring.
   - **Step 3**: Crops and chops segments into optimized portrait ratios.

3. **Payout & Ledger Reconciliation** (`conversionToLedger`, `payoutBatcher`)
   - **Event Trigger**: `conversion.detected` -> `payout.batch.process`
   - **Step 1**: Maps affiliate checkout clicks to affiliate ledger credits.
   - **Step 2**: Batches payouts through Stripe Connect.
   - **Step 3**: Reconciles balances using transaction double-entry records.

---

## 3. Database Lifecycle & Transaction Boundaries

Sophia AI Factory utilizes a Cloudflare D1 SQL database.
- **Client Factory**: [apps/sophia-ai-factory/src/seed/db/client.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/db/client.ts)
- **Isolation Level**: SQLite default serialized isolation.
- **Transaction Safety**:
  - Credit adjustments utilize D1 atomic commands, ensuring concurrent requests cannot double-spend balances:
    ```sql
    UPDATE user_mcu_balance
    SET credits_remaining = credits_remaining - ?, credits_total_used = credits_total_used + ?
    WHERE user_id = ? AND credits_remaining >= ?
    ```

---

## 4. Background Cron Job Flows

Cloudflare Workers trigger scheduled events according to cron configurations in `wrangler.toml`.
- **Glue Script**: [apps/sophia-ai-factory/scripts/inject-scheduled-handler.mjs](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/scripts/inject-scheduled-handler.mjs) matches Cron Triggers to Next.js API endpoints.

```
[Cloudflare Cron Trigger]
         │
         ▼
[inject-scheduled-handler.mjs :: scheduled()]
         │
         ▼
[Internal Route Check & Authorization Header Verification]
         │
         ▼
[Target Next.js API Route Endpoint]
```

- **Cron Mappings**:
  - `*/5 * * * *` (Every 5 mins): `/api/cron/uptime-check`, `/api/cron/video-status-sync`, `/api/cron/sop-scheduler`
  - `0 5 * * *` (Daily 05:00): `/api/cron/d1-backup`, `/api/cron/error-digest`
  - `0 7 * * *` (Daily 07:00): `/api/cron/llm-cache-purge`
  - `0 */4 * * *` (Every 4 hours): `/api/cron/affiliate-scout`
  - `10 * * * *` (Hourly at min 10): `/api/cron/wallet-rebuild`
  - `*/10 * * * *` (Every 10 mins): `/api/cron/heartbeat`

---

## 5. External API Integrations

Sophia relies on critical upstream SaaS APIs:
1. **ElevenLabs**: TTS audio stream generation.
2. **CloudConvert**: FFMPEG composition, stitching visual layers.
3. **HeyGen**: Interactive video avatar rendering.
4. **Stripe Connect**: Multi-tenant payout distribution and billing subscription webhooks.
5. **TikTok / Meta APIs**: Social network posting and token exchange loops.

---

## 6. Production Deployment Topology

```
             [ User Browser / Client Applications ]
                               │
                               ▼ (HTTP/HTTPS)
                 [ Cloudflare Edge Platform ]
                               │
                 ┌─────────────┴─────────────┐
                 ▼                           ▼
      [ Cloudflare Worker ]         [ Cloudflare D1 SQL ]
      (Next.js App Build)           (Primary Transactional DB)
                 │                           │
                 ▼ (Async Events)            ▼ (Data Storage)
        [ Inngest Engine ]          [ Cloudflare R2 Bucket ]
      (Event-Driven Pipelines)      (Videos, Assets, Backups)
```
- **Static Assets**: Cached on Cloudflare's Global CDN network.
- **Compute Instance**: Cloudflare Worker isolate. Max memory 128MB per execution. Large media assets are piped directly from R2 to avoid edge compute exhaustion.
