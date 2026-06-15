---
title: Phase 5 - Testing & Security
description: Unit tests, integration tests, security verification for webhook license generation
status: pending
priority: P1
effort: 1.5h
---

# Phase 5: Testing & Security

## Overview

Comprehensive testing and security verification for the webhook auto-license generation system.

## Current Status

**NOT IMPLEMENTED** - Phase 1 implementation needs unit tests.

## Next Steps

To implement Phase 5:

1. **Create unit tests** for `polar-webhook-handler.ts`:
   - Test `generateLicenseOnPayment()` with various scenarios
   - Test idempotency for retry scenarios
   - Test error handling for missing `RAAS_LICENSE_SECRET`

2. **Create unit tests** for `raas-audit.ts` functions:
   - `createLicense()` with metadata
   - `revokeLicense()` and `logLicenseRevocation()`
   - `getLicenseByNonce()` and `getLicenses()`

3. **Create integration tests** for webhook endpoint:
   - Test signature verification (valid/invalid)
   - Test event processing with mocked Polar data

4. **Create load tests** for webhook handler:
   - 10 VUs, 30s test
   - Monitor p95 response time < 500ms

5. **Run full test suite**:
   - `npm test -- polar-webhook-handler.test.ts`
   - `npm test -- raas-audit.test.ts`

## Unit Tests

### Test File: `src/lib/payments/polar-webhook-handler.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { processWebhookEvent } from './polar-webhook-handler'
import { createLicense, getLicenseBySubscriptionId } from '@/lib/raas-audit'

// Mock dependencies
vi.mock('@/lib/raas-audit')
vi.mock('@/lib/supabase/admin')

describe('Polar Webhook License Generation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('subscription.created event', () => {
    it('generates license key on successful subscription', async () => {
      const mockEventData = {
        id: 'sub_test_123',
        status: 'active',
        metadata: {
          userId: 'user_123',
          tier: 'PREMIUM',
          telegram_chat_id: 'chat_456',
        },
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      }

      const result = await processWebhookEvent(
        { type: 'subscription.created', data: mockEventData },
        'webhook_test_789'
      )

      expect(result.success).toBe(true)
      expect(createLicense).toHaveBeenCalledWith(
        expect.objectContaining({
          tier: 'PREMIUM',
          metadata: expect.objectContaining({
            polar_subscription_id: 'sub_test_123',
            user_id: 'user_123',
          }),
        })
      )
    })

    it('does not generate license if user_id missing', async () => {
      const mockEventData = {
        id: 'sub_test_123',
        status: 'active',
        metadata: {}, // No user_id
      }

      const result = await processWebhookEvent(
        { type: 'subscription.created', data: mockEventData },
        'webhook_test_789'
      )

      expect(result.success).toBe(true) // Still succeeds, just no license
      expect(createLicense).not.toHaveBeenCalled()
    })
  })

  describe('subscription.cancelled event', () => {
    it('soft-revokes license on cancellation', async () => {
      const mockEventData = {
        id: 'sub_test_123',
        status: 'canceled',
        current_period_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      }

      const result = await processWebhookEvent(
        { type: 'subscription.cancelled', data: mockEventData },
        'webhook_test_789'
      )

      expect(result.success).toBe(true)
      // Verify revokeLicenseBySubscription called
    })
  })

  describe('subscription.active event', () => {
    it('reactivates previously revoked license', async () => {
      const mockEventData = {
        id: 'sub_test_123',
        status: 'active',
      }

      const result = await processWebhookEvent(
        { type: 'subscription.active', data: mockEventData },
        'webhook_test_789'
      )

      expect(result.success).toBe(true)
      // Verify reactivateLicenseBySubscription called
    })
  })

  describe('idempotency', () => {
    it('does not generate duplicate license on retry', async () => {
      const mockEventData = {
        id: 'sub_test_123',
        status: 'active',
        metadata: { userId: 'user_123', tier: 'PREMIUM' },
      }

      // First call
      await processWebhookEvent(
        { type: 'subscription.created', data: mockEventData },
        'webhook_test_789'
      )

      // Second call (retry)
      const result = await processWebhookEvent(
        { type: 'subscription.created', data: mockEventData },
        'webhook_test_789'
      )

      expect(result.success).toBe(true)
      expect(result.message).toBe('Event already processed')
      expect(createLicense).toHaveBeenCalledTimes(1) // Only once
    })
  })
})
```

### Test File: `src/lib/raas-audit.test.ts`

```typescript
describe('License Lifecycle Functions', () => {
  describe('createLicense', () => {
    it('creates license with polar_subscription_id', async () => {
      const license = await createLicense({
        tier: 'PREMIUM',
        nonce: 'test-nonce-123',
        keyHash: 'test-hash',
        expiresAt: 1735689600,
        polarSubscriptionId: 'sub_test_123',
      })

      expect(license.polar_subscription_id).toBe('sub_test_123')
    })
  })

  describe('getLicenseBySubscriptionId', () => {
    it('finds license by subscription ID', async () => {
      // Create test license
      await createLicense({
        tier: 'PREMIUM',
        nonce: 'test-nonce-456',
        keyHash: 'test-hash',
        expiresAt: 0,
        polarSubscriptionId: 'sub_test_456',
      })

      const license = await getLicenseBySubscriptionId('sub_test_456')

      expect(license).toBeDefined()
      expect(license?.nonce).toBe('test-nonce-456')
    })
  })

  describe('revokeLicenseBySubscription', () => {
    it('soft-revokes license', async () => {
      // Setup
      await createLicense({
        tier: 'PREMIUM',
        nonce: 'test-nonce-789',
        keyHash: 'test-hash',
        expiresAt: 0,
        polarSubscriptionId: 'sub_test_789',
      })

      // Revoke
      await revokeLicenseBySubscription('sub_test_789', { soft: true })

      // Verify
      const license = await getLicenseBySubscriptionId('sub_test_789')
      expect(license?.is_revoked).toBe(true)
      expect(license?.metadata.soft_revoke).toBe(true)
    })
  })

  describe('reactivateLicenseBySubscription', () => {
    it('reactivates revoked license', async () => {
      // Setup revoked license
      await createLicense({
        tier: 'PREMIUM',
        nonce: 'test-nonce-000',
        keyHash: 'test-hash',
        expiresAt: 0,
        polarSubscriptionId: 'sub_test_000',
        isRevoked: true,
      })

      // Reactivate
      await reactivateLicenseBySubscription('sub_test_000')

      // Verify
      const license = await getLicenseBySubscriptionId('sub_test_000')
      expect(license?.is_revoked).toBe(false)
    })
  })
})
```

## Integration Tests

### Test File: `src/app/api/webhooks/polar/polar-webhook-integration.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { Polar } from '@polar-sh/sdk'

describe('Polar Webhook Integration', () => {
  it('handles real Polar webhook payload', async () => {
    // Use Polar SDK to create test event
    const polar = new Polar({ access_token: process.env.POLAR_ACCESS_TOKEN })

    // This would require Polar test environment
    // For now, use mocked payload
    const mockPayload = {
      type: 'subscription.created',
      data: {
        id: 'sub_integration_test',
        status: 'active',
        metadata: {
          userId: 'user_integration',
          tier: 'PREMIUM',
        },
      },
    }

    // Send to webhook endpoint
    const response = await fetch('http://localhost:3000/api/webhooks/polar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'webhook-id': 'test-webhook-id',
        'webhook-timestamp': Date.now().toString(),
        'webhook-signature': 'test-signature',
      },
      body: JSON.stringify(mockPayload),
    })

    expect(response.status).toBe(200)
  })
})
```

## Security Tests

### Signature Verification

```typescript
describe('Webhook Security', () => {
  it('rejects invalid signature', async () => {
    const response = await fetch('http://localhost:3000/api/webhooks/polar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'webhook-id': 'test-id',
        'webhook-timestamp': Date.now().toString(),
        'webhook-signature': 'invalid-signature',
      },
      body: JSON.stringify({ type: 'subscription.created', data: {} }),
    })

    expect(response.status).toBe(400)
  })

  it('rejects missing signature', async () => {
    const response = await fetch('http://localhost:3000/api/webhooks/polar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // No webhook-signature header
      },
      body: JSON.stringify({ type: 'subscription.created', data: {} }),
    })

    expect(response.status).toBe(400)
  })
})
```

### License Key Security

```typescript
describe('License Key Security', () => {
  it('generates unique nonce for each license', async () => {
    const nonce1 = await generateLicenseForUser('user_1', 'PREMIUM')
    const nonce2 = await generateLicenseForUser('user_2', 'PREMIUM')

    expect(nonce1).not.toBe(nonce2)
  })

  it('hashes license key before storage', async () => {
    const license = await createLicense({ ... })

    // Verify stored value is hash, not plain key
    expect(license.key_hash).toHaveLength(64) // SHA256 hex length
    expect(license.key_hash).not.toContain('raas_')
  })
})
```

## Load Testing

### k6 Script: `tests/load/webhook-load-test.js`

```javascript
import http from 'k6/http'
import { check } from 'k6'

export const options = {
  vus: 10,
  duration: '30s',
}

export default function () {
  const payload = JSON.stringify({
    type: 'subscription.created',
    data: {
      id: `sub_load_${__VU}_${__ITER}`,
      status: 'active',
      metadata: { userId: `user_${__ITER}`, tier: 'PREMIUM' },
    },
  })

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'webhook-id': `load-${__VU}-${__ITER}`,
      'webhook-timestamp': Date.now().toString(),
      'webhook-signature': 'test-signature',
    },
  }

  const res = http.post('http://localhost:3000/api/webhooks/polar', payload, params)

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  })
}
```

## Success Criteria

- [ ] All unit tests pass (100% coverage for webhook handler)
- [ ] All integration tests pass
- [ ] Security tests verify signature validation
- [ ] Load test: 10 VUs, 30s, 0 failures, p95 < 500ms
- [ ] No console.log in production code
- [ ] No `:any` types in test files

## Files to Create

| File | Purpose |
|------|---------|
| `src/lib/payments/polar-webhook-handler.test.ts` | Webhook handler unit tests |
| `src/lib/raas-audit.test.ts` | License lifecycle tests |
| `tests/load/webhook-load-test.js` | k6 load testing script |

## CI/CD Integration

Add to GitHub Actions workflow:

```yaml
- name: Run webhook tests
  run: npm test -- polar-webhook-handler.test.ts raas-audit.test.ts

- name: Run security tests
  run: npm test -- webhook-security.test.ts
```

## Test Coverage Targets

- **Unit Tests**: 100% coverage for webhook handler functions
- **Integration Tests**: End-to-end webhook flow
- **Security Tests**: Signature verification, idempotency, rate limiting
- **Load Tests**: 10 VUs, 30s, p95 < 500ms, 0 failures
