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
