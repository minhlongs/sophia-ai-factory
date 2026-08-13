# Resilience Checklist — Circuit Breaker (Updated 2026-08-14)

## Overview

Every external HTTP call in Sophia must use circuit breaker protection.
The circuit breaker prevents cascading failures and provides graceful degradation
when upstream services fail.

**Rule:** No bare `try/catch` for external HTTP without failure kind classification.

## Canonical Imports

```typescript
import {
  shouldAllowRequest,
  recordSuccess,
  recordFailure,
} from '@/seed/security/circuit-breaker'

import {
  classifyError,
  classifyHttpStatus,
  FailureKind,
} from '@/seed/types/failure-kind'
```

All circuit breaker code lives in `seed/security/` — foundational layer, importable
from all layers (seed, tree, forest, land).

## Required Pattern

```typescript
const SERVICE = 'service-name'; // unique, lowercase, kebab-case

// 1. Guard: reject if circuit is open
if (!shouldAllowRequest(SERVICE)) {
  throw new Error(`${SERVICE} Circuit breaker open for ${SERVICE}`);
}

try {
  // 2. Make the external HTTP call
  const res = await fetch(url, { /* ... */ });

  // 3. Record success or classify failure
  if (res.ok) {
    recordSuccess(SERVICE);
    return await res.json();
  } else {
    const kind = classifyHttpStatus(res.status);
    recordFailure(SERVICE, kind);
    throw new Error(`${SERVICE} API ${res.status}`);
  }
} catch (error) {
  // 4. Prevent double-classification of CB re-throws
  if (error instanceof Error && error.message.includes('Circuit breaker open')) {
    throw error;
  }

  // 5. Classify and record the failure
  const kind = classifyError(error);
  recordFailure(SERVICE, kind);
  throw error;
}
```

## Per-Kind Error Classification

| FailureKind | HTTP Trigger | Circuit Behavior | Cooldown |
|---|---|---|---|
| `AUTH_FAILURE` | 401, 403 | Open immediately | 0s (permanent) |
| `RATE_LIMIT` | 429 | Open after threshold | 60s |
| `TIMEOUT` | 408, AbortError | Open after threshold | 120s |
| `NETWORK` | DNS, conn refused, TLS | Open after threshold | 180s |
| `SERVER_ERROR` | 5xx | Open after threshold | 300s |
| `UNKNOWN` | Catch-all | Open after threshold | 120s |

## State Machine

```
CLOSED → DEGRADED (3 failures) → OPEN (5 failures) → HALF_OPEN → CLOSED (on success)
                                ↓ HALF_OPEN probe fails → OPEN (re-open immediately)
```

## Service Registry

All services with active circuit breaker wiring:

### Seed Layer (foundational — imports from tree/forest/land)
| Service | File |
|---|---|
| `openrouter` | `seed/inference/openrouter-client.ts` |
| `elevenlabs` | `seed/ai/elevenlabs-api-client.ts` |
| `zunef` | `seed/inference/zunef-client.ts` |
| `sentry-forwarder` | `seed/observability/sentry-forwarder.ts` |
| `langfuse` | `seed/observability/telemetry/langfuse-client.ts` |
| `heygen-health` | `seed/health/heygen-health-check.ts` |
| `nhà cung cấp dịch vụ AI-api` | `seed/ai/nhà cung cấp dịch vụ AI-adapter.ts` |

### Tree Layer (domain logic — imports from seed only)
| Service | File |
|---|---|
| `telegram-bot` | `tree/telegram/telegram-client.ts` |
| `apollo` | `tree/apollo/apollo-client.ts` |
| `resend-email` | `tree/email/sender.ts`, `tree/email/outbox.ts` |
| `twitter-oauth` | `tree/publishing/twitter-oauth-client.ts` |
| `reddit-oauth` | `tree/publishing/reddit-oauth-client.ts` |
| `bluesky` | `tree/publishing/bluesky.ts` |
| `threads-oauth` | `tree/publishing/threads-oauth-client.ts` |
| `telegram-publisher` | `tree/publishing/providers/telegram-publisher.ts` |
| `tiktok-token` | `tree/publishing/tiktok/tiktok-token-manager.ts` |
| `muapi-media` | `tree/clients/muapi-media-client.ts` |
| `provider-connectivity` | `tree/audit/checks/provider-connectivity.ts` |
| `llm-router` | `tree/agent-fleet/llm-router.ts` |
| `mcp-gateway` | `tree/agent-fleet/mcp-gateway.ts` |
| `telegram-gateway-notify` | `tree/gateway/adapters/telegram-notification-adapter.ts` |

### Forest Layer (orchestrators — imports from seed, tree)
| Service | File |
|---|---|
| `oauth-token-refresher` | `forest/publishing/oauth-token-refresher.ts` |
| `raas-gateway` | `forest/worker/lib/metering-reconciler-license-validator.ts` |
| `agent-runner` | `forest/agents/runner.ts` |
| `clickbank-feed` | `forest/ingestion/adapters/clickbank-adapter.ts` |

### Land Layer (business workflows — imports from seed, tree, forest)
| Service | File |
|---|---|
| `d-id` | `land/did/did-client.ts` |
| `heygen` | `land/video/heygen-helpers.ts` |
| `runpod` | `land/video/publishing/path-b-cinematic.ts` |
| `amazon-pa` | `land/affiliates/providers/amazon.ts` |
| `telegram-notify` | `land/wallet/payout-telegram-notify.ts` |
| `visual-prompt-ai` | `land/video/generation/visual-prompt-generator.ts` |
| `payos` | `land/payments/payos.ts` |
| `clickbank` | `land/ingestion/adapters/clickbank-adapter.ts` |
| `hunter` | `land/hunter/hunter-client.ts` |

### API Routes (app layer)
| Service | File |
|---|---|
| `instagram-oauth` | `app/api/oauth/instagram/callback/route.ts` |
| `linkedin-oauth` | `app/api/oauth/linkedin/callback/route.ts` |
| `zalo-oauth` | `app/api/oauth/zalo/callback/route.ts` |
| `pinterest-oauth` | `app/api/oauth/pinterest/callback/route.ts` |
| `telegram-error-digest` | `app/api/cron/error-digest/route.ts` |
| `resend-error-digest` | `app/api/cron/error-digest/route.ts` |
| `posthog-api` | `app/api/cron/weekly-signals-digest/weekly-digest-ai.ts` |
| `openrouter` | `app/api/cron/weekly-signals-digest/weekly-digest-ai.ts` |
| `resend-email` | `app/api/cron/weekly-signals-digest/weekly-digest-delivery.ts` |
| `telegram-bot` | `app/api/cron/weekly-signals-digest/weekly-digest-delivery.ts` |
| `openrouter-workflow-stepper` | `app/api/cron/workflow-stepper/workflow-stepper-llm-executor.ts` |
| `runpod-trigger` | `app/api/internal/runpod-trigger/route.ts` |
| `runpod-status` | `app/api/internal/runpod-status/route.ts` |
| `tts-coqui` | `app/api/internal/tts/route.ts` |
| `fly-render-py` | `app/api/internal/render-py/route.ts` |
| `telegram-uptime-alert` | `app/api/cron/uptime-check/route.ts` |

## Code Review Checklist

When reviewing code that makes external HTTP calls:

- [ ] File imports `shouldAllowRequest`, `recordSuccess`, `recordFailure` from `@/seed/security/circuit-breaker`
- [ ] File imports `classifyError`, `classifyHttpStatus` from `@/seed/types/failure-kind`
- [ ] `shouldAllowRequest(SERVICE)` guard before every external `fetch()`
- [ ] Success path calls `recordSuccess(SERVICE)`
- [ ] Non-OK HTTP responses classify with `classifyHttpStatus(res.status)` → `recordFailure(SERVICE, kind)`
- [ ] Caught errors classify with `classifyError(error)` → `recordFailure(SERVICE, kind)`
- [ ] Re-throw guard: errors containing `'Circuit breaker open'` are re-thrown without double-classification
- [ ] `AUTH_FAILURE` (401/403) opens circuit immediately (no cooldown wait)
- [ ] No bare `try/catch` for external HTTP without failure kind classification
- [ ] Service name is unique, lowercase, kebab-case (no spaces or uppercase)

## Common Pitfalls

1. **Missing re-throw guard** — Without `if (err.message.includes('Circuit breaker open')) throw err`,
   a CB-open error gets classified again, artificially inflating failure counts.

2. **Double classification** — Don't call `recordFailure` in both the HTTP error branch AND the
   catch block for the same error. One path or the other, never both.

3. **Silent swallowing** — Catch blocks that swallow errors (empty `catch {}`) must still call
   `recordFailure` so the circuit breaker knows the service is failing.

4. **Using wrong service name** — Each external service needs a unique, consistent service name.
   If two call sites use the same upstream, they share a circuit.

5. **Missing imports** — Circuit breaker lives in `seed/security/`. The file must import from
   `@/seed/security/circuit-breaker` and `@/seed/types/failure-kind`.

## Running Verification

```bash
# Scan for any remaining unwired external fetch calls
npx tsx src/seed/utils/quality-gate-enforcer.ts

# Run existing circuit breaker tests
npx vitest run src/seed/security/circuit-breaker.test.ts
```
