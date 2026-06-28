# System Design: Sophia AI Factory — Harness Engineering & CEO Media Handover

**Date:** 2026-05-30  
**Status:** Approved  
**Author:** Principal Architect  
**Audience:** Developer Team, CEO Media Operations  

---

## 1. Executive Summary

This document details the architectural specifications for the **Sophia AI Factory Harness Engineering** system. The objective is to build a reliable, multi-channel verification harness that checks system health, external API keys, database connectivity, and local video rendering. 

To prevent execution timeout constraints on Cloudflare Edge Workers, the system uses a **Hybrid Pull Model**. A local daemon running on the operator's Mac Studio checks for pending audit jobs, executes local rendering tests, and reports outcomes back to the Next.js API Gateway. The verification loop is triggered and monitored via three entrypoints: **Web Dashboard UI**, **Telegram Bot**, and a **Local CLI Shortcut**.

---

## 2. System Architecture & Component Mapping

```
  ┌────────────────────────────────────────────────────────┐
  │                   Cloudflare Edge Pages                │
  │  - Web Dashboard UI       - Telegram Webhook Handler   │
  │  - API Gateway Trigger    - D1 Database storage        │
  └───────────────────────────┬────────────────────────────┘
                              │
             GET /jobs/poll   │   PATCH /jobs/:id
             (API Key Auth)   │   (Update Status)
                              ▼
  ┌────────────────────────────────────────────────────────┐
  │                 Mac Studio / Local Node                │
  │  - Local Daemon (TS)      - Remotion CLI compiler      │
  │  - FFmpeg muxer           - API key validation runs    │
  └────────────────────────────────────────────────────────┘
```

The system components reside across two boundaries:

1. **Edge Side (Cloudflare Pages Worker):**
   - Implements API endpoints under the Next.js app route `/api/v1/harness/`.
   - Stores job definitions in SQLite D1 using the database connection manager [client.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/db/client.ts).
   - Manages interactive states on the dashboard at [customize-page-client.tsx](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/[locale]/dashboard/settings/customize/customize-page-client.tsx).
   - Resolves commands in the Telegram bot webhook route [route.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/api/webhooks/telegram/route.ts).
2. **Local Side (Mac Studio Client):**
   - Node.js Daemon polling the Edge endpoints.
   - Remotion CLI engine executing local video composites.

---

## 3. Database Schema Design (SQLite D1)

A new SQL migration adds the queue control tables:

### `harness_jobs`
Defines the transaction boundaries for health audits:
- `id`: TEXT (UUID, PRIMARY KEY)
- `status`: TEXT (Check constraint: `'pending'`, `'processing'`, `'completed'`, `'failed'`)
- `triggered_by`: TEXT (Check constraint: `'web'`, `'telegram'`, `'scheduler'`)
- `created_at`: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- `updated_at`: TIMESTAMP

### `harness_results`
Stores step-by-step metrics for the audit checklist:
- `id`: TEXT (UUID, PRIMARY KEY)
- `job_id`: TEXT (FOREIGN KEY referencing `harness_jobs(id)` ON DELETE CASCADE)
- `test_name`: TEXT (Check constraint: `'d1_ping'`, `'r2_storage'`, `'api_openrouter'`, `'api_elevenlabs'`, `'api_heygen'`, `'remotion_render'`)
- `status`: TEXT (Check constraint: `'success'`, `'failed'`)
- `duration_ms`: INTEGER
- `error_message`: TEXT NULL
- `metadata`: TEXT NULL (JSON format details)

---

## 4. API Gateway Endpoints (Next.js Edge)

All endpoints reside in the sub-app folder:

### `POST /api/v1/harness/trigger`
- **Access**: Admin session or validated Telegram bot webhook secret.
- **Action**: Inserts a new `pending` record into `harness_jobs`. Returns the job ID.

### `GET /api/v1/harness/jobs/poll`
- **Access**: Custom header `X-Harness-Secret` matching user API token.
- **Action**: Fetches the oldest `pending` job. If found, changes status to `processing` and returns the schema.

### `PATCH /api/v1/harness/jobs/[id]`
- **Access**: Custom header `X-Harness-Secret` matching user API token.
- **Action**: Updates job status and inserts the test step results array into `harness_results`. Triggers real-time notifications to the client.

---

## 5. Local Daemon Core Execution Lifecycle

The Local Daemon script runs continuously on the Mac Studio:

1. **Interval Loop**: Every 10 seconds, it fetches `/api/v1/harness/jobs/poll`.
2. **Execution Gate**: On receiving a job, it spins up the validation runner:
   - **D1 Ping**: Measures latency by executing a light query against `/api/health`.
   - **R2 Storage Write**: Attempts to upload and delete a 100KB binary blob using client credentials.
   - **API Verify**: Directly calls validation hooks of OpenRouter, ElevenLabs, and HeyGen, diagnosing IP blocks or quota exhaustion.
   - **Remotion Video Render Check**: Spawns a shell child process executing:
     ```bash
     npx remotion render template/test-composite.ts out/test-out.mp4 --overwrite
     ```
     Verifies if the canvas output is generated, the compilation finishes without memory errors, and the ffmpeg muxing succeeds.
3. **Payload Dispatch**: Updates the gateway API with the results, errors, and output logs.

---

## 6. Multi-Channel Interface & Handover

### 6.1. Web Dashboard Widget
A widget in [customize-page-client.tsx](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/[locale]/dashboard/settings/customize/customize-page-client.tsx) provides:
- Live indicator of Daemon status (`ONLINE` if updated within 30s).
- Stepper component updating on status changes using interval polling queries.
- Troubleshooting cards in plain Vietnamese explaining specific failures (e.g., node path errors, license limits) and how the operator can resolve them locally.

### 6.2. Telegram Bot
The webhook handler [route.ts](file:///Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/api/webhooks/telegram/route.ts) maps:
- `/status`: Returns system status and last run logs.
- `/audit`: Triggers a new job. Bot updates status via progress indicators (`20%`, `50%`, `80%`) and sends a final green/red checklist summary.

### 6.3. CLI Shortcut
A pre-configured file `Sophia-Harness.command` is saved to the operator's desktop. It opens a terminal displaying logging loops, memory indicators, and current queue state to ensure transparency.

---

## 7. Implementation & Testing Plan

- **Step 1**: Write migration files for `harness_jobs` and apply them to local and production D1 databases.
- **Step 2**: Implement Edge endpoints and secure validation headers.
- **Step 3**: Write the local daemon scripts, compile the CLI binary, and test local Remotion render loops on Mac Studio.
- **Step 4**: Integrate dashboard UI components and hook up Telegram webhook listeners.
- **Step 5**: Test integration under failure modes (network timeouts, wrong API keys, canvas engine failure) to verify error reporting accuracy.
