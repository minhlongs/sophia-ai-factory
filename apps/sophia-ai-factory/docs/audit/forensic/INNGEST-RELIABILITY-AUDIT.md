# SOPHIA AI FACTORY — INNGEST BACKGROUND ENGINE FORENSICS AUDIT
**Document Version:** 1.0.0  
**Scope:** `src/forest/inngest/`, `src/forest/inngest/functions/`  
**Auditor:** Supreme Codebase Forensic Auditor (Adversarial Zero-Trust)  

---

## 1. Executive Summary

Sophia AI Factory utilizes Inngest as its serverless event-driven background job orchestrator. Inngest handles multi-step AI video generation, token rotation crons, account deletion cascades, and revenue attribution workflows.

### Inngest Reliability Verdict: **GREEN (Idempotent & Resilient)**

---

## 2. Inngest Job Reliability & Concurrency Analysis

### 2.1 Function Registry & Signatures
- **Client Instance:** Single canonical client defined at `src/seed/inngest/client.ts`.
- **Event Schemas:** Strictly typed TypeScript interfaces defining payload schemas for all dispatched events (e.g. `mission.create`, `video.scripting`, `video.voice.dubbing`, `affiliate.sync`).

### 2.2 Retry Boundaries & Circuit Breaking
- **Exponential Backoff:** Configured with progressive backoff curves to handle transient network blips gracefully.
- **Provider Circuit Breaker Integration:** All external HTTP calls within Inngest steps check `shouldAllowRequest()` before invocation. If an external provider trips (e.g. OpenRouter returns 503), the step backs off without burning retry budgets.
- **Max Attempt Caps:** Step functions are capped at 3 retries. After exhausting retries, jobs are routed to dead-letter handlers or marked `FAILED_RECOVERABLE`.

### 2.3 Step-Level Idempotency & Checkpointing
- In multi-track video generation (`src/forest/inngest/functions/production-graph-runner.ts` and `src/forest/mission/multi-track-orchestrator.ts`), each track execution runs inside an isolated `step.run()` block.
- Completed track outputs are committed to D1 checkpoints. If a subsequent step fails, re-running the job resumes from the last successful checkpoint rather than restarting from zero.

---

## 3. Background Job Matrix

| Function Name | Trigger Event / Cron | Concurrency Limit | Failure Action |
|---|---|---|---|
| `productionGraphRunner` | `mission.execute` | Per-user limited | Checkpoint rollback & user notification |
| `videoScripting` | `video.script` | Unlimited | Step retry with backoff |
| `videoVoiceDubbing` | `video.voice` | Unlimited | Checkpoint save, circuit break on 429 |
| `batchVideoFanout` | `campaign.fanout` | 5 concurrent per org | Partial success tracking |
| `accountDeleteFinalizeCron` | `cron(0 * * * *)` | 1 | Log error & retry on next tick |
| `approvalTimeoutCron` | `cron(*/10 * * * *)` | 1 | Auto-expire stale mission approvals |
| `tokenRefreshCron` | `cron(0 0 * * *)` | 1 | Log refresh status |
