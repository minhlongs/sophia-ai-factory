# Implementation Plan: Sophia AI Factory — Harness Engineering Core

This document outlines the detailed plan to implement database migrations, Next.js Edge APIs, and the new local daemon for system health and rendering check automation.

---

## 1. Phase 1: Database Migrations (SQLite D1)
We will add two tables: `harness_jobs` (audit queue transactions) and `harness_results` (check results and logs).

**Target File:** `migrations/0148_harness_tables.sql`

```sql
-- Migration: Add Harness Engineering tables

CREATE TABLE IF NOT EXISTS harness_jobs (
  id TEXT PRIMARY KEY,
  status TEXT CHECK (status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
  triggered_by TEXT CHECK (triggered_by IN ('web', 'telegram', 'scheduler')) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS harness_results (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  test_name TEXT CHECK (test_name IN ('d1_ping', 'r2_storage', 'api_openrouter', 'api_elevenlabs', 'api_heygen', 'remotion_render')) NOT NULL,
  status TEXT CHECK (status IN ('success', 'failed')) NOT NULL,
  duration_ms INTEGER NOT NULL,
  error_message TEXT,
  metadata TEXT, -- JSON string format
  FOREIGN KEY (job_id) REFERENCES harness_jobs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_harness_jobs_status ON harness_jobs(status);
CREATE INDEX IF NOT EXISTS idx_harness_results_job_id ON harness_results(job_id);
```

---

## 2. Phase 2: Next.js Edge API Gateway
We will create three route handlers using Next.js route handlers under the Edge runtime.

### API Paths:
1. `POST /api/v1/harness/trigger`
   - **File:** `apps/sophia-ai-factory/src/app/api/v1/harness/trigger/route.ts`
   - **Role:** Insert a new `pending` job. Secures trigger with Telegram secret or session credentials.
2. `GET /api/v1/harness/jobs/poll`
   - **File:** `apps/sophia-ai-factory/src/app/api/v1/harness/jobs/poll/route.ts`
   - **Role:** Fetches the oldest `pending` job, updates its state to `processing`, and returns the job data.
   - **Secured with:** Custom header `X-Harness-Secret` checked against an environment secret token.
3. `PATCH /api/v1/harness/jobs/[id]`
   - **File:** `apps/sophia-ai-factory/src/app/api/v1/harness/jobs/[id]/route.ts`
   - **Role:** Updates job status to `completed` or `failed` and inserts execution step results into `harness_results`.
   - **Secured with:** Custom header `X-Harness-Secret`.

---

## 3. Phase 3: Local Node.js Daemon Script
We will implement a Node.js/TypeScript CLI daemon running locally on the operator's machine (e.g. Mac Studio) that polls the Next.js API.

**Target File:** `apps/sophia-ai-factory/src/tree/harness/daemon.ts`

### Execution Loop:
1. Every 10 seconds, perform a request to `GET /api/v1/harness/jobs/poll` with `X-Harness-Secret` header.
2. If a job is returned, execute the following audit suite:
   - **D1 Ping Check:** Call standard API health check and record execution duration.
   - **R2 Storage Write Check:** Attempt to write a mock file to the R2 bucket using current settings and immediately clean it up.
   - **API Providers Check:** Query the external endpoints of OpenRouter, ElevenLabs, and HeyGen to ensure API keys are functional and quota exists.
   - **Remotion Video Render Check:** Launch a child process using Node.js `child_process.exec` to run `npx remotion render template/test-composite.ts out/test-out.mp4 --overwrite` and check the exit code.
3. Call `PATCH /api/v1/harness/jobs/[id]` with the gathered list of check results (success, failure, duration, errors, metadata logs) to complete the transaction.

---

## 4. Phase 4: Verification and Quality Checks
1. Run lint checks: `npm run ci:lint`
2. Run type compilation checks: `npm run ci:typecheck`
3. Add unit test suite using Vitest under `apps/sophia-ai-factory/tests/harness/daemon.test.ts` to assert daemon poll, process execution, and error handling flow.
