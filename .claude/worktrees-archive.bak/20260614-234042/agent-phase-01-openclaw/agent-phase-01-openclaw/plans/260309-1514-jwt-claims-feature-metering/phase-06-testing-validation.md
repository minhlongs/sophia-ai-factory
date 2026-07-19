---
title: "Phase 6: Testing & Validation"
description: "Write tests and validate Phase 6 implementation"
status: pending
priority: P1
effort: 0.5h
---

# Phase 6: Testing & Validation

## Overview

Comprehensive testing for JWT claims enrichment and feature-level metering implementation.

## Test Files to Create

| File | Purpose |
|------|---------|
| `src/lib/auth/enriched-jwt.test.ts` | JWT creation, verification, nonce tracking |
| `src/lib/usage-metering/feature-attribution.test.ts` | Feature registry and attribution |
| `src/lib/security/rate-limiter.test.ts` | Tiered rate limiting |
| `src/lib/raas-gate.test.ts` | RaaS gate with JWT enrichment |

## Test Cases

### Enriched JWT Tests

```typescript
// File: src/lib/auth/enriched-jwt.test.ts

import { describe, it, expect, beforeEach } from 'vitest'
import {
  createEnrichedJwt,
  verifyEnrichedJwt,
  decodeEnrichedJwt,
  isJwtExpired,
} from './enriched-jwt'
import { checkJwtNonce, markJwtNonceAsUsed } from './jwt-nonce-tracker'

describe('EnrichedJwt', () => {
  const testUserId = 'user-test-123'
  const testLicenseNonce = 'license-test-abc'

  describe('createEnrichedJwt', () => {
    it('should create valid JWT with all claims', async () => {
      const result = await createEnrichedJwt(testUserId, testLicenseNonce)

      expect(result).not.toBeNull()
      expect(result?.token).toBeDefined()
      expect(result?.payload.sub).toBe(testUserId)
      expect(result?.payload.license_nonce).toBe(testLicenseNonce)
      expect(result?.payload.quota).toBeDefined()
      expect(result?.payload.exp).toBeGreaterThan(result?.payload.iat)
    })

    it('should include license tier in claims', async () => {
      const result = await createEnrichedJwt(testUserId, testLicenseNonce)
      expect(result?.payload.license_tier).toBeDefined()
    })

    it('should include Polar customer ID if available', async () => {
      // Mock license with Polar customer
      const result = await createEnrichedJwt(testUserId, testLicenseNonce)
      // Should have polar_customer_id if license has it
      expect(result?.payload.polar_customer_id).toBeDefined()
    })
  })

  describe('verifyEnrichedJwt', () => {
    it('should verify valid JWT and return payload', async () => {
      const { token } = await createEnrichedJwt(testUserId, testLicenseNonce)
      const payload = await verifyEnrichedJwt(token)

      expect(payload).not.toBeNull()
      expect(payload?.sub).toBe(testUserId)
    })

    it('should return null for invalid JWT', async () => {
      const payload = await verifyEnrichedJwt('invalid.token.here')
      expect(payload).toBeNull()
    })

    it('should return null for expired JWT', async () => {
      const { token } = await createEnrichedJwt(testUserId, testLicenseNonce, 1) // 1 second TTL
      await new Promise(resolve => setTimeout(resolve, 1500))
      const payload = await verifyEnrichedJwt(token)
      expect(payload).toBeNull()
    })
  })

  describe('nonce tracking', () => {
    it('should allow first use of nonce', async () => {
      const { payload } = await createEnrichedJwt(testUserId, testLicenseNonce)
      const check = await checkJwtNonce(payload.jti!)
      expect(check.valid).toBe(true)
    })

    it('should reject replayed nonce', async () => {
      const { payload } = await createEnrichedJwt(testUserId, testLicenseNonce)
      await markJwtNonceAsUsed(payload.jti!, testUserId, payload.exp)

      const check = await checkJwtNonce(payload.jti!)
      expect(check.valid).toBe(false)
      expect(check.reason).toBe('already-used')
    })
  })
})
```

### Feature Attribution Tests

```typescript
// File: src/lib/usage-metering/feature-attribution.test.ts

import { describe, it, expect } from 'vitest'
import {
  getFeatureDefinition,
  extractFeatureFromRequest,
  getAllFeatures,
  registerFeature,
} from './feature-attribution'

describe('FeatureAttribution', () => {
  describe('getFeatureDefinition', () => {
    it('should return correct feature for HeyGen', () => {
      const feature = getFeatureDefinition('heygen', '/api/heygen/createVideo', 'createVideo')
      expect(feature.featureKey).toBe('heygen.createVideo')
      expect(feature.featureName).toBe('Standard Video Generation')
    })

    it('should return correct feature for ElevenLabs', () => {
      const feature = getFeatureDefinition('elevenlabs', '/api/elevenlabs/textToSpeech', 'textToSpeech')
      expect(feature.featureKey).toBe('elevenlabs.textToSpeech')
      expect(feature.featureName).toBe('Text to Speech')
    })

    it('should return default for unknown endpoint', () => {
      const feature = getFeatureDefinition('unknown', '/api/unknown/action', 'action')
      expect(feature.featureKey).toBe('unknown.endpoint')
    })

    it('should apply credit multiplier for premium features', () => {
      const feature = getFeatureDefinition('heygen', '/api/heygen/createAvatar', 'createAvatar')
      expect(feature.creditMultiplier).toBe(2)
    })
  })

  describe('getAllFeatures', () => {
    it('should return all registered features', () => {
      const features = getAllFeatures()
      expect(features.length).toBeGreaterThan(0)
      expect(features.some(f => f.service === 'heygen')).toBe(true)
    })
  })

  describe('registerFeature', () => {
    it('should register new feature dynamically', () => {
      const newFeature = {
        featureKey: 'custom.newFeature',
        featureName: 'Custom Feature',
        service: 'custom',
        action: 'newFeature',
      }
      registerFeature(newFeature)

      const feature = getFeatureDefinition('custom', '/api/custom/newFeature', 'newFeature')
      expect(feature.featureKey).toBe('custom.newFeature')
    })
  })
})
```

### Rate Limiter Tests

```typescript
// File: src/lib/security/rate-limiter.test.ts

import { describe, it, expect, beforeEach } from 'vitest'
import {
  checkTieredRateLimit,
  TIER_RATE_LIMITS,
  type TieredRateLimitResult,
} from './rate-limiter'
import { createEnrichedJwt } from '@/lib/auth/enriched-jwt'

describe('TieredRateLimit', () => {
  describe('TIER_RATE_LIMITS', () => {
    it('should have limits for all tiers', () => {
      expect(TIER_RATE_LIMITS.BASIC).toBeDefined()
      expect(TIER_RATE_LIMITS.PREMIUM).toBeDefined()
      expect(TIER_RATE_LIMITS.ENTERPRISE).toBeDefined()
      expect(TIER_RATE_LIMITS.MASTER).toBeDefined()
    })

    it('should have higher limits for higher tiers', () => {
      expect(TIER_RATE_LIMITS.PREMIUM.requestsPerMinute)
        .toBeGreaterThan(TIER_RATE_LIMITS.BASIC.requestsPerMinute)
      expect(TIER_RATE_LIMITS.ENTERPRISE.requestsPerMinute)
        .toBeGreaterThan(TIER_RATE_LIMITS.PREMIUM.requestsPerMinute)
    })
  })

  describe('checkTieredRateLimit', () => {
    it('should use BASIC tier limit without JWT', async () => {
      const result = await checkTieredRateLimit(null, 'test-identifier')
      expect(result.tier).toBe('BASIC')
      expect(result.limit).toBe(TIER_RATE_LIMITS.BASIC.requestsPerMinute)
    })

    it('should use correct tier limit with JWT', async () => {
      const { token } = await createEnrichedJwt('user-123', 'license-premium')
      const result = await checkTieredRateLimit(token, 'test-identifier')

      expect(result.tier).toBeDefined()
      expect(result.limit).toBeGreaterThan(0)
    })

    it('should block when limit exceeded', async () => {
      const identifier = `rate-limit-test-${Date.now()}`

      // Make requests until limit exceeded
      for (let i = 0; i < TIER_RATE_LIMITS.BASIC.requestsPerMinute + 10; i++) {
        const result = await checkTieredRateLimit(null, identifier)
        if (!result.allowed) {
          expect(result.retryAfter).toBeGreaterThan(0)
          return
        }
      }

      // If we get here, rate limiting didn't work
      throw new Error('Rate limiting should have blocked requests')
    })
  })
})
```

## Integration Tests

```typescript
// File: src/test/integration/phase-6-jwt-enrichment.test.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest'

describe('Phase 6 Integration', () => {
  it('should issue enriched JWT on API key validation', async () => {
    // 1. Create API key
    // 2. Validate API key via RaaS gate
    // 3. Verify enriched JWT is issued
    // 4. Verify JWT contains license context
  })

  it('should capture feature-level usage events', async () => {
    // 1. Make request to feature endpoint
    // 2. Verify usage event created with feature_key
    // 3. Verify feature attribution is correct
  })

  it('should enforce per-tier rate limits', async () => {
    // 1. Create users with different tiers
    // 2. Make requests until rate limited
    // 3. Verify each tier has correct limit
  })

  it('should prevent JWT replay attacks', async () => {
    // 1. Issue JWT
    // 2. Use JWT (mark nonce as used)
    // 3. Try to reuse JWT
    // 4. Verify rejection with "already-used" reason
  })
})
```

## Validation Checklist

### Manual Testing

- [ ] Issue enriched JWT via `/api/auth/token` endpoint
- [ ] Decode JWT and verify claims (tier, quota, Polar ID)
- [ ] Make request with enriched JWT and verify rate limiting
- [ ] Trigger rate limit and verify 429 response with headers
- [ ] Check database for feature-level usage events
- [ ] Verify JWT nonce is tracked after use
- [ ] Attempt JWT replay and verify rejection

### Automated Testing

- [ ] All unit tests pass: `npm test`
- [ ] All integration tests pass
- [ ] Build passes: `npm run build`
- [ ] No TypeScript errors
- [ ] No console.log statements in production code

## Success Criteria

- [ ] 100% test coverage for enriched-jwt.ts
- [ ] 100% test coverage for feature-attribution.ts
- [ ] 80%+ coverage for rate-limiter.ts
- [ ] All integration tests pass
- [ ] Build passes with 0 errors
- [ ] No linting errors

## Unresolved Questions

None - testing phase should validate all implementation decisions.
