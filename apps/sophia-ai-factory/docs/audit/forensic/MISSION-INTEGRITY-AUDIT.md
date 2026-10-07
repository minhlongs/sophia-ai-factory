# SOPHIA AI FACTORY — MISSION EXECUTION FORENSICS AUDIT
**Document Version:** 1.0.0  
**Scope:** `src/tree/mission/`, `src/forest/mission/`, `src/forest/inngest/functions/`  
**Auditor:** Supreme Codebase Forensic Auditor (Adversarial Zero-Trust)  

---

## 1. Executive Summary

Mission execution represents the core business engine of Sophia AI Factory, converting user briefs or affiliate campaigns into multi-track video assets.

### Mission Integrity Verdict: **GREEN (Idempotent & Resilient)**

---

## 2. Mission State Machine & OCC Lifecycle

The mission execution lifecycle strictly follows an Optimistic Concurrency Control (OCC) state transition diagram:

```
[CREATED] ──(Preflight Check Passes)──► [QUEUED]
                                           │
                                           ▼
                                      [RUNNING]
                                     /    │    \
                       (Script Track) (Voice) (Visual/Render)
                                     \    │    /
                                          ▼
                                 [ARTIFACT_PERSISTED]
                                          │
                                          ▼
                                     [COMPLETED]
                                          │
                        (Failure at any stage ──► [FAILED_RECOVERABLE] or [FAILED])
```

### 2.1 Concurrency & Race-Condition Prevention
- **CAS Atomic State Update:** Every status change in D1 executes via conditional CAS queries:
  ```sql
  UPDATE missions 
  SET status = ?2, updated_at = datetime('now')
  WHERE id = ?1 AND status = ?3
  ```
- **Duplicate Mission Lock:** Multiple identical mission submissions within a 60-second window are debounced using composite hash keys `(tenant_id, prompt_hash)`.

### 2.2 Side-Effect Idempotency & Double-Spending Prevention
- **External Provider Side Effects:** Provider calls (OpenRouter, ElevenLabs, Fal.ai) are partitioned by track. Each track records its output hash and artifact ID in `mission_checkpoints`.
- **Worker Crash & Retry Safety:** If an Inngest worker crashes mid-execution and restarts:
  1. The worker inspects `mission_checkpoints`.
  2. If Track A (Script) and Track B (Voice) already completed, their cached outputs are reused without re-calling the provider API.
  3. Only unfinished tracks are executed, preventing duplicate MCU consumption or double billing on customer provider accounts.

### 2.3 Failures, Timeouts & MCU Balancing
- **Hard Cost Guard:** Single mission preflight enforces `MAX_SINGLE_MISSION_COST_CENTS = 500` ($5.00 limit).
- **Orphan Job Sweeper:** Background cron `src/forest/inngest/functions/agent-rollback-cron.ts` scans for missions stuck in `RUNNING` state $> 15$ minutes, marks them `FAILED_RECOVERABLE`, and releases reserved MCU quotas.
- **Provider Failure Handling:** If a provider returns 429/500/503:
  - Circuit breaker increments failure count.
  - Mission is marked with specific `FailureKind` (`RATE_LIMIT`, `SERVER_ERROR`, `AUTH_FAILURE`).
  - No corrupted or empty artifacts are published to R2.

---

## 3. Adversarial Analysis

| Scenario | Potential Risk | Verified Defense in Code | Result |
|---|---|---|---|
| **User spams "Generate Video" button** | Duplicate mission creation and multi-charge | Debounce lock + atomic D1 row insertion | Single mission queued |
| **Provider succeeds but D1 write fails** | Inngest retry might re-invoke provider | Checkpoint table records provider transaction ID; retry reconciles state | No duplicate API call |
| **Provider times out after 120s** | Stalled worker and hung UI | Inngest step timeout + rollback cron sweeps stalled jobs | Auto-recovery & refund |
| **Malformed prompt causes LLM crash** | Infinite retry loop consuming credits | Circuit breaker + max retry ceiling (3 attempts) | Routed to Dead Letter Queue |
