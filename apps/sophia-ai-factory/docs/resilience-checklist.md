# Resilience Checklist — Circuit Breaker Implementation

## Overview

All external HTTP calls MUST use circuit breaker protection. This ensures service
degradation doesn't cascade and provides graceful degradation when upstream services fail.

## Circuit Breaker Pattern

### Import

```typescript
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker'
import { classifyError, classifyHttpStatus, FailureKind } from '@/seed/types/failure-kind'
```

### Usage Pattern

```typescript
// Before external HTTP call
if (!shouldAllowRequest('service-name')) {
  throw new Error('[service-name] Circuit breaker open for service-name')
}

try {
  const result = await callExternalService()
  recordSuccess('service-name')
  return result
} catch (error) {
  const kind = classifyError(error)
  recordFailure('service-name', kind)
  throw error
}
```

### Per-Kind Error Classification

| Error Kind | Circuit Behavior | Example |
|------------|------------------|---------|
| `AUTH_FAILURE` | Open circuit immediately (no cooldown) | 401/403 from API |
| `RATE_LIMIT` | Cooldown with backoff | 429 responses |
| `SERVER_ERROR` | Retry with backoff | 5xx errors |

## Services Requiring Circuit Breaker

- [ ] OpenRouter (`@/forest/ai/openrouter-provider.ts`)
- [ ] ElevenLabs (`@/forest/voice/elevenlabs-api-client.ts`)
- [ ] D-ID (`@/forest/did/did-client.ts`)
- [ ] HeyGen (`@/seed/ai/heygen-client.ts`)
- [ ] NOWPayments (`@/land/billing/nowpayments-client.ts`)
- [ ] ClickBank (`@/land/payouts/clickbank-client.ts`)
- [ ] Replicate (`@/seed/ai/replicate-client.ts`)
- [ ] fal.ai (`@/seed/ai/fal-client.ts`)

## Test Mocking Pattern

All test files must include circuit breaker mocks:

```typescript
vi.mock('@/seed/security/circuit-breaker', () => ({
  shouldAllowRequest: vi.fn().mockReturnValue(true),
  recordSuccess: vi.fn(),
  recordFailure: vi.fn(),
}));

vi.mock('@/seed/types/failure-kind', () => ({
  classifyError: vi.fn().mockReturnValue('SERVER_ERROR'),
  classifyHttpStatus: vi.fn().mockReturnValue('SERVER_ERROR'),
}));
```

## Code Review Checklist

- [ ] External HTTP call has `shouldAllowRequest` check before it
- [ ] Success path calls `recordSuccess`
- [ ] Error path calls `recordFailure` with `classifyError` or `classifyHttpStatus`
- [ ] `AUTH_FAILURE` errors open circuit immediately (no cooldown)
- [ ] Test file includes circuit breaker mocks
- [ ] No bare `try/catch` for external HTTP without failure kind classification
