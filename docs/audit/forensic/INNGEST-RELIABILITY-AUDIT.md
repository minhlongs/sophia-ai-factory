# INNGEST & BACKGROUND JOB RELIABILITY FORENSIC AUDIT

**Target:** Sophia AI Factory Inngest Functions & Asynchronous Workflow Orchestration  
**Audit Standard:** Code is the authority. Tests are evidence.  
**Audit Date:** 2026-09-18  

---

## 1. Executive Summary

| Inngest Function | Trigger Event | Concurrency / Retries | Side-Effect Memoization | Severity & Reliability |
|---|---|---|---|:---:|
| `agent-mission-executor` | `agent.mission.started` | `retries: 0` | Wrapped in `step.run('execute-agent')` | **GREEN (Hardened)** |
| `agent-rollback-cron` | Cron (`*/5 * * * *`) | `retries: 0` | Exponential backoff scanner | **GREEN** |
| `ops-telegram-alert` | System events | Default | Non-billable message dispatch | **GREEN** |
| `email-outbox-flush` | Cron (`*/2 * * * *`) | `retries: 0` | Resend API client | **GREEN** |

---

## 2. Inngest Step Memoization & Anti-Double-Billing Audit

### 2.1 The Vulnerability Scenario
If an Inngest function executes an external, billable AI provider invocation (such as Anthropic Claude or OpenRouter) as plain synchronous code without `step.run()`, any network disconnect, D1 database lockup, or unhandled exception occurring *after* the AI response causes the entire function to throw.
Upon automatic retry, the function executes from line 1 again, issuing a **second** paid API request and double-charging customer BYOK credentials.

### 2.2 Hardening Verification
In `src/forest/inngest/functions/agent-mission-executor.ts`:
```typescript
const execution = await step.run('execute-agent', async () =>
  executeAgent(definition, context, providerRegistry)
);
```
- The external AI call is encapsulated inside `step.run()`.
- Inngest commits the JSON return value to its durable step store.
- On any subsequent execution or retry, `step.run` retrieves the cached output without invoking `executeAgent` or calling external provider APIs.
- Retries are explicitly pinned to `retries: 0` to prevent uncoordinated retries. Automatic retry decisions are delegated to the stateful `agent-rollback-cron` which enforces exponential backoff.

---

## 3. Terminal Failure Propagation

When `agent-rollback-cron` exhausts the maximum retry attempts for a failed run:
1. `agent_runs` status is set to `'cancelled'` with error code `'RETRIES_EXHAUSTED'`.
2. `creative_missions` status is transitioned to `'failed'` via `markMissionFailed(run.missionId)`.
3. The customer UI immediately reflects the failure state, stopping any infinite spinners and allowing the user to modify their prompt or retry manually.

---

## 4. Edge Worker Inngest Dispatch Resiliency & State Machine Rollback (Risk #6)

### 4.1 The Vulnerability Scenario
When a user starts mission execution, `beginMissionExecution(missionId)` atomically transitions the D1 row from `draft`/`planned` to `status = 'running'`, `current_phase = 'executing'`.
If the subsequent outbound HTTPS request from Cloudflare Workers edge (`inngest.send`) suffered network latency, socket timeout, or an upstream Inngest 504 gateway timeout:
1. The action threw and returned an error to the client.
2. The D1 `creative_missions` row remained trapped in `status = 'running'`.
3. Subsequent attempts by the user to restart execution failed immediately with `EXECUTION_START_INVALID: running → running not allowed`.
4. Because Inngest never received the event, `agentMissionExecutor` never executed, leaving zero rows in `agent_runs` and causing `agent-rollback-cron` to remain blind to the orphaned mission.

### 4.2 Hardening Verification
1. **Transient Error Retry (`sendInngestWithRetry`):**
   - In `src/seed/inngest/send-with-retry.ts`, implemented `sendInngestWithRetry` with `isTransientInngestError`: catches `fetch failed`, socket timeouts, connection resets, and HTTP 500/502/503/504/429 status codes.
   - Employs jittered exponential backoff (up to 2 retries, 100ms base, 500ms max cap).
2. **D1 State Machine Rollback on Terminal Dispatch Failure:**
   - In `src/land/creative-mission/actions.ts` (`startMissionExecution`):
     ```typescript
     try {
       await sendInngestWithRetry(() => inngest.send({ ... }));
     } catch (sendErr) {
       // Rollback mission in D1 to prevent permanent 'running' lockout
       await db.prepare(
         `UPDATE creative_missions
          SET status = ?, current_phase = ?, updated_at = ?
          WHERE id = ? AND status = 'running'`
       ).bind(mission.status, mission.current_phase ?? 'init', now, missionId).run();
       throw sendErr;
     }
     ```
   - Restores the mission row to its pre-execution state, enabling instant retry upon network recovery.
3. **Cron Re-dispatch Reversion:**
   - In `src/forest/inngest/functions/agent-rollback-cron.ts` (`redispatchRun`): wrapped `inngest.send` with `sendInngestWithRetry`.
   - On dispatch failure, atomically reverts `agent_runs` back to `status = 'failed'`, ensuring the row is preserved for subsequent scan passes instead of being stranded in `running`.

Verified by `src/seed/inngest/__tests__/send-with-retry.test.ts`, `src/land/creative-mission/__tests__/actions.test.ts`, and `src/forest/inngest/functions/__tests__/agent-rollback-cron.test.ts`.
