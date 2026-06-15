# Phase 01: Fix OpenClaw Fleet Executor

**Priority:** P1 (Buffer)  
**Status:** Not Started  
**Estimated Duration:** 4 hours

---

## Context Links

- **Deep Research Report:** Buffer item — "OpenClaw fleet executor stub"
- **File:** `src/forest/openclaw/spawn-agent-fleet-executor.ts`
- **Related:** `src/forest/openclaw/local-executor.ts`

---

## Overview

The OpenClaw fleet executor currently returns stub "queued" status instead of actually executing LLM calls. Need to verify circuit breaker and retry logic are production-ready, add structured logging.

**Current state (from audit):**
- `spawn-agent-fleet-executor.ts` has `FLEET_BREAKER` circuit breaker
- Has `withRetry` (max 3, base 1s, max 10s)
- Calls `localExecutor()` which uses BYOK API key resolution
- Returns stub queued status if no API key (BYOK expected)
- **Gap:** No structured logging; no metrics export to monitoring

---

## Requirements

### Functional
1. Ensure `localExecutor()` actually executes agent tasks via OpenRouter/LLM (not stub)
2. Add structured logging using `@/seed/utils/logger-utility`
3. Add metrics: task duration, success/failure, retry count, circuit breaker state changes
4. Verify circuit breaker opens after 5 failures (configurable)
5. Verify retry logic respects backoff (base 1s, max 10s)

### Non-Functional
1. No breaking changes to existing API (function signatures)
2. Logging compatible with Cloudflare tail (`console.log` acceptable but prefer `logger`)
3. Metrics export to Cloudflare Analytics or custom endpoint (if monitoring exists)
4. All new code follows 4-layer architecture (imports from seed/tree only)

---

## Implementation Steps

### Step 1: Inspect current executor

Read `src/forest/openclaw/spawn-agent-fleet-executor.ts`:
- Identify where "queued" stub is returned
- Find `localExecutor()` call and verify it actually executes
- Check circuit breaker configuration (`FLEET_BREAKER`)
- Check retry wrapper (`withRetry`)

### Step 2: Add structured logging

Import logger:
```typescript
import { logger } from '@/seed/utils/logger-utility';
```

Add logs:
```typescript
// Before executing
logger.debug('Fleet: executing task', { taskId: task.id, agentRole: task.agentRole });

// After success
logger.info('Fleet: task completed', { taskId, durationMs: Date.now() - start, retryCount });

// On failure
logger.error('Fleet: task failed', { taskId, error: err.message, durationMs });

// Circuit breaker open
logger.warn('Fleet: circuit breaker open — skipping dispatch', { taskId });
```

### Step 3: Verify circuit breaker and retry

- Confirm `FLEET_BREAKER` is a `CircuitBreaker` instance (likely from `src/forest/telemetry/circuit-breaker.ts` or similar)
- Check failure threshold (should be 5 consecutive failures)
- Check retry logic: `withRetry` should catch transient errors and retry with exponential backoff

If missing, implement simple circuit breaker:
```typescript
const FLEET_BREAKER = {
  failures: 0,
  state: 'closed' as const,
  recordSuccess() { this.failures = 0; },
  recordFailure() { this.failures++; if (this.failures >= 5) this.state = 'open'; },
  isAllowed() { return this.state === 'closed'; },
  // reset after cooldown (e.g., 30s) — implement if needed
};
```

### Step 4: Verify BYOK flow

- `localExecutor()` should resolve API key from org's BYOK config
- If no API key found, should throw error (not silently queue)
- Ensure error propagates to circuit breaker

### Step 5: Test manually

Run a task through executor (inngest event or direct call):
```bash
# Trigger test task via curl or inngest dev server
npx inngest dev
# Or call function directly in test
```

Check logs appear with `logger` format:
```bash
wrangler tail | grep -i "Fleet:"
```

### Step 6: Run tests

```bash
npm test -- src/forest/openclaw/__tests__/
```

Ensure all executor tests pass.

---

## Related Code Files

- `src/forest/openclaw/spawn-agent-fleet-executor.ts` — main executor
- `src/forest/openclaw/local-executor.ts` — actual LLM execution
- `src/seed/utils/logger-utility.ts` — logger
- `src/forest/telemetry/circuit-breaker.ts` (if exists)
- `src/forest/openclaw/__tests__/spawn-agent-fleet-executor.test.ts` (tests)

---

## Success Criteria

- Executor actually calls LLM (no stub "queued" in production paths)
- Structured logs emitted for start, success, failure, breaker state
- Circuit breaker prevents cascade failures
- Retry with backoff works for transient errors
- Tests pass

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| BYOK not configured → executor fails | Medium | High | Ensure error message guides user to Setup Wizard |
| Circuit breaker stuck open | Low | Medium | Implement reset cooldown (30s) |
| Logging noise increases costs | Low | Low | Use debug level for high-volume logs |
| LLM API rate limits | Medium | Medium | Respect retry-after headers; backoff correctly |

---

## Security Considerations

- **No secrets in logs:** Redact API keys, org IDs, user inputs
- **BYOK security:** API keys stored encrypted in D1; retrieved securely
- **Circuit breaker:** Prevents DoS on LLM provider during outage

---

**END OF PHASE 01**
