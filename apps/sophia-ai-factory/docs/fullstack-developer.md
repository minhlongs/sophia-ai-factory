# Fullstack Developer — Resilience Checklist

> Reference for implementing external HTTP calls with circuit breaker protection.

## Circuit Breaker — Mandatory Pattern

Every external HTTP call **must** follow this pattern:

```typescript
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError, classifyHttpStatus } from '@/seed/types/failure-kind';

const SERVICE_NAME = 'my-external-service'; // unique per provider

// 1. Guard — check circuit before making call
if (!shouldAllowRequest(SERVICE_NAME)) {
  throw new Error(`[circuit-breaker] Circuit open for ${SERVICE_NAME}`);
}

try {
  const res = await fetch(url, options);

  if (!res.ok) {
    const kind = classifyHttpStatus(res.status);
    recordFailure(SERVICE_NAME, kind);
    throw new Error(`API error ${res.status}`);
  }

  // 2. Success — record for healthy tracking
  recordSuccess(SERVICE_NAME);
  return await res.json();
} catch (error) {
  // 3. Failure — classify and record
  if (error instanceof Error && error.message.includes('[circuit-breaker]')) {
    throw error; // don't double-classify circuit breaker throws
  }
  const kind = classifyError(error);
  recordFailure(SERVICE_NAME, kind);
  throw error;
}
```

## FailureKind Classification

| FailureKind | Trigger | Behavior |
|-------------|---------|----------|
| `AUTH_FAILURE` | HTTP 401/403 | Circuit opens immediately |
| `RATE_LIMIT` | HTTP 429 | 60s cooldown, then HALF_OPEN probe |
| `TIMEOUT` | AbortSignal / fetch timeout | 120s cooldown |
| `SERVER_ERROR` | HTTP 5xx | 300s cooldown |
| `NETWORK` | DNS, connection refused, TLS | 180s cooldown |
| `UNKNOWN` | Catch-all | 120s cooldown |

## State Machine

```
CLOSED → (failures ≥ 3) → DEGRADED → (failures ≥ 5) → OPEN → (cooldown expires) → HALF_OPEN → (probe success) → CLOSED
                                                                                                    → (probe failure) → OPEN
```

**Critical rules:**
- HALF_OPEN probe failure → immediately re-OPEN (don't stay stuck)
- Failure window decay: entries older than `failureWindowMs` auto-reset failureCount
- LRU eviction uses `lastAccessAt` — healthy services should not be evicted
- AUTH_FAILURE opens circuit immediately (no cooldown wait)

## Quality Gates

Before any code with external HTTP calls ships:

- [ ] Circuit breaker guard (`shouldAllowRequest`) before every fetch
- [ ] `recordSuccess` on successful response path
- [ ] `classifyHttpStatus` + `recordFailure` on non-OK HTTP responses
- [ ] `classifyError` + `recordFailure` in catch blocks
- [ ] Re-throw guard for circuit breaker errors (don't double-classify)
- [ ] Unit tests cover: guard, success recording, failure recording, error classification
- [ ] No `console.log` — use `@/seed/utils/logger-utility`
- [ ] No bare `try/catch` without failure kind classification

## Testing Pattern

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';

vi.mock('@/seed/security/circuit-breaker', () => ({
  shouldAllowRequest: vi.fn(() => true),
  recordSuccess: vi.fn(),
  recordFailure: vi.fn(),
}));

describe('MyExternalService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls shouldAllowRequest before fetch', async () => {
    await callMyService();
    expect(shouldAllowRequest).toHaveBeenCalledWith('my-service');
  });

  it('records success on 200 response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    await callMyService();
    expect(recordSuccess).toHaveBeenCalledWith('my-service');
  });

  it('records failure on 500 response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    await expect(callMyService()).rejects.toThrow();
    expect(recordFailure).toHaveBeenCalledWith('my-service', expect.any(String));
  });

  it('skips fetch when circuit is open', async () => {
    vi.mocked(shouldAllowRequest).mockReturnValue(false);
    await expect(callMyService()).rejects.toThrow('[circuit-breaker]');
    expect(fetch).not.toHaveBeenCalled();
  });
});
```

## Unwired Sites — Remaining (as of Batch 4)

These are known unwired sites. Most are low-risk (fire-and-forget notifications, one-shot validators):

| File | Service | Risk | Priority |
|------|---------|------|----------|
| `seed/validation/services.ts` | 6 setup wizard validators | Low (one-shot, user-initiated) | P3 |
| `tree/gateway/adapters/telegram-notification-adapter.ts` | Telegram sendMessage/getMe | Medium | P2 |
| `tree/email/missions/email-test.ts` | Resend (test email) | Low | P3 |
| `workers/ultracode-worker.ts` | Telegram (worker notifications) | Medium | P2 |
| `app/api/cron/uptime-check/route.ts` | Telegram (uptime alerts) | Medium | P2 |
| `app/api/internal/runpod-status/route.ts` | RunPod status | Medium | P2 |
| `app/api/internal/runpod-trigger/route.ts` | RunPod trigger | Medium | P2 |
| `app/api/setup-wizard/test-resend/route.ts` | Resend (test route) | Low | P3 |

### Recently Resolved (Batch 5)
| File | Service | Status |
|------|---------|--------|
| `app/api/cron/workflow-stepper/workflow-stepper-llm-executor.ts` | OpenRouter (LLM) | ✅ Wired — guard + classifyHttpStatus + recordSuccess + re-throw guard + classifyError |
