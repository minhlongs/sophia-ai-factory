---
title: "Phase 2: JWT Claims Enrichment Service"
description: "Create enriched JWT service with license tier, quota, and Polar context"
status: pending
priority: P1
effort: 2h
---

# Phase 2: JWT Claims Enrichment Service

## Overview

Create a new service to issue and verify enriched JWTs containing license metadata for fast Cloudflare Worker enforcement.

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/auth/enriched-jwt.ts` | Create | JWT claims enrichment service |
| `src/lib/auth/jwt-nonce-tracker.ts` | Create | JWT nonce tracking for replay prevention |
| `src/lib/security/jwt-validator.ts` | Modify | Add nonce verification |
| `src/app/api/auth/token/route.ts` | Modify | Issue enriched JWT on token request |

## Implementation Steps

### Step 2.1: Create Enriched JWT Service

```typescript
// File: src/lib/auth/enriched-jwt.ts

/**
 * JWT Claims Enrichment Service
 *
 * Issues JWTs with embedded license metadata for fast Worker enforcement.
 * Contains tier, quota, Polar customer ID, and dunning state.
 *
 * @module auth/enriched-jwt
 */

import { SignJWT, jwtVerify } from 'jose'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/utils/logger-utility'
import { getEffectiveQuotaLimits } from '@/lib/quota/quota-checker'
import type { QuotaLimit } from '@/lib/usage-metering/types'

/**
 * Enriched JWT payload with license context
 */
export interface EnrichedJwtPayload {
  // Standard claims
  sub: string           // user_id
  iat: number           // issued at (seconds)
  exp: number           // expiration (seconds)
  jti?: string          // JWT ID (for replay prevention)

  // RaaS License claims
  license_nonce: string
  license_tier: 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER'
  license_issued_at: number
  license_expires_at?: number

  // Quota claims (cached at issuance)
  quota: QuotaLimit

  // Tenant isolation
  agency_id?: string

  // Polar billing context
  polar_customer_id?: string
  polar_subscription_status?: 'active' | 'inactive' | 'past_due' | 'canceled'

  // Dunning state (cached)
  dunning_state?: 'ok' | 'grace_period' | 'suspended' | 'delinquent'

  // Feature permissions (optional)
  permissions?: string[]
}

/**
 * JWT configuration
 */
const JWT_CONFIG = {
  algorithm: 'HS256' as const,
  ttlSeconds: 3600, // 1 hour
}

/**
 * Get JWT secret from environment
 */
function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET=REDACTED || process.env.NEXT_PUBLIC_JWT_SECRET=REDACTED

  if (!secret) {
    logger.warn('[Enriched JWT] JWT_SECRET=REDACTED not set, using insecure default')
    return new TextEncoder().encode('insecure-dev-secret-change-in-production')
  }

  return new TextEncoder().encode(secret)
}

/**
 * Fetch license metadata for JWT enrichment
 */
async function fetchLicenseContext(licenseNonce: string): Promise<{
  tier: string
  agencyId?: string
  polarCustomerId?: string
  polarStatus?: string
  expiresAt?: number
  createdAt: number
} | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('raas_licenses')
    .select('tier, agency_id, polar_customer_id, polar_subscription_status, expires_at, created_at')
    .eq('license_nonce', licenseNonce)
    .single()

  if (error || !data) {
    logger.error('[Enriched JWT] Failed to fetch license', error as Error)
    return null
  }

  return {
    tier: data.tier,
    agencyId: data.agency_id || undefined,
    polarCustomerId: data.polar_customer_id || undefined,
    polarStatus: data.polar_subscription_status || undefined,
    expiresAt: data.expires_at ? data.expires_at * 1000 : undefined,
    createdAt: data.created_at,
  }
}

/**
 * Fetch dunning state for license
 */
async function fetchDunningState(licenseNonce: string): Promise<'ok' | 'grace_period' | 'suspended' | 'delinquent'> {
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('dunning_states')
    .select('state')
    .eq('license_nonce', licenseNonce)
    .single()

  return (data?.state as 'ok' | 'grace_period' | 'suspended' | 'delinquent') || 'ok'
}

/**
 * Create enriched JWT with license context
 *
 * @param userId - User ID (sub claim)
 * @param licenseNonce - License identifier
 * @param ttlSeconds - Token TTL (default: 1 hour)
 * @returns Signed JWT token
 */
export async function createEnrichedJwt(
  userId: string,
  licenseNonce: string,
  ttlSeconds: number = JWT_CONFIG.ttlSeconds
): Promise<{ token: string; payload: EnrichedJwtPayload } | null> {
  try {
    // 1. Fetch license context
    const licenseContext = await fetchLicenseContext(licenseNonce)
    if (!licenseContext) {
      return null
    }

    // 2. Get effective quota limits
    const quota = await getEffectiveQuotaLimits(licenseNonce, licenseContext.tier)

    // 3. Fetch dunning state
    const dunningState = await fetchDunningState(licenseNonce)

    // 4. Generate JWT ID for replay prevention
    const jti = crypto.randomUUID()

    // 5. Build enriched payload
    const now = Math.floor(Date.now() / 1000)
    const payload: EnrichedJwtPayload = {
      sub: userId,
      iat: now,
      exp: now + ttlSeconds,
      jti,
      license_nonce: licenseNonce,
      license_tier: licenseContext.tier as EnrichedJwtPayload['license_tier'],
      license_issued_at: licenseContext.createdAt,
      license_expires_at: licenseContext.expiresAt,
      quota,
      agency_id: licenseContext.agencyId,
      polar_customer_id: licenseContext.polarCustomerId,
      polar_subscription_status: licenseContext.polarStatus,
      dunning_state: dunningState,
    }

    // 6. Sign JWT
    const token = await new SignJWT(payload)
      .setProtectedHeader({ alg: JWT_CONFIG.algorithm })
      .setIssuedAt(now)
      .setExpirationTime(now + ttlSeconds)
      .setJti(jti)
      .sign(getJwtSecret())

    logger.info('[Enriched JWT] Created enriched JWT', {
      userId,
      licenseNonce: licenseNonce.slice(0, 8) + '...',
      tier: licenseContext.tier,
      expiresAt: new Date((now + ttlSeconds) * 1000).toISOString(),
    })

    return { token, payload }
  } catch (error) {
    logger.error('[Enriched JWT] Failed to create JWT', error as Error)
    return null
  }
}

/**
 * Verify enriched JWT
 *
 * @param token - JWT token string
 * @returns Verified payload or null
 */
export async function verifyEnrichedJwt(
  token: string
): Promise<EnrichedJwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      algorithms: [JWT_CONFIG.algorithm],
      clockTolerance: 60, // 60 second tolerance
    })

    return payload as EnrichedJwtPayload
  } catch (error) {
    logger.warn('[Enriched JWT] JWT verification failed', error as Error)
    return null
  }
}

/**
 * Decode JWT without verification (for debugging)
 */
export function decodeEnrichedJwt(token: string): EnrichedJwtPayload | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null

    const payloadStr = Buffer.from(parts[1], 'base64url').toString('utf-8')
    return JSON.parse(payloadStr) as EnrichedJwtPayload
  } catch {
    return null
  }
}

/**
 * Extract quota from JWT payload
 */
export function extractQuotaFromJwt(payload: EnrichedJwtPayload): QuotaLimit {
  return payload.quota
}

/**
 * Check if JWT is expired
 */
export function isJwtExpired(token: string): boolean {
  const payload = decodeEnrichedJwt(token)
  if (!payload) return true

  const now = Math.floor(Date.now() / 1000)
  return payload.exp < now
}
```

### Step 2.2: Create JWT Nonce Tracker

```typescript
// File: src/lib/auth/jwt-nonce-tracker.ts

/**
 * JWT Nonce Tracker
 *
 * Prevents replay attacks by tracking JWT jti claims.
 *
 * @module auth/jwt-nonce-tracker
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/utils/logger-utility'

/**
 * Check if JWT nonce has been used (replay attack prevention)
 *
 * @param nonce - JWT jti claim
 * @returns true if nonce is valid (not used), false if replay detected
 */
export async function checkJwtNonce(nonce: string): Promise<{
  valid: boolean
  reason?: 'already-used' | 'expired' | 'invalid'
}> {
  if (!nonce || nonce.length < 8) {
    return { valid: false, reason: 'invalid' }
  }

  const supabase = createAdminClient()

  // Check if nonce exists and is unused
  const { data, error } = await supabase
    .from('jwt_nonces')
    .select('used_at, expires_at')
    .eq('nonce', nonce)
    .single()

  if (error && error.code !== 'PGRST116') { // PGRST116 = not found
    logger.error('[JWT Nonce] Database error', error as Error)
    return { valid: false, reason: 'invalid' }
  }

  // Nonce not found = first use (valid)
  if (!data) {
    return { valid: true }
  }

  // Check if already used
  if (data.used_at) {
    logger.warn('[JWT Nonce] Replay attempt detected', { nonce: nonce.slice(0, 8) + '...' })
    return { valid: false, reason: 'already-used' }
  }

  // Check expiration
  const now = Math.floor(Date.now() / 1000)
  if (data.expires_at < now) {
    return { valid: false, reason: 'expired' }
  }

  return { valid: true }
}

/**
 * Mark JWT nonce as used (called after successful validation)
 *
 * @param nonce - JWT jti claim
 * @param userId - User ID
 */
export async function markJwtNonceAsUsed(
  nonce: string,
  userId: string,
  expiresAt: number
): Promise<boolean> {
  const supabase = createAdminClient()
  const now = Math.floor(Date.now() / 1000)

  const { error } = await supabase
    .from('jwt_nonces')
    .insert({
      nonce,
      user_id: userId,
      issued_at: now,
      expires_at: Math.floor(expiresAt),
      used_at: now,
    })
    .onConflict('nonce')
    .update({ used_at: now })

  if (error) {
    logger.error('[JWT Nonce] Failed to mark nonce as used', error as Error)
    return false
  }

  return true
}

/**
 * Cleanup expired nonces (cron job)
 */
export async function cleanupExpiredNonces(): Promise<number> {
  const supabase = createAdminClient()
  const now = Math.floor(Date.now() / 1000)

  const { data, error } = await supabase
    .from('jwt_nonces')
    .delete()
    .lt('expires_at', now)
    .select('id')

  if (error) {
    logger.error('[JWT Nonce] Cleanup failed', error as Error)
    return 0
  }

  const count = data?.length || 0
  logger.info('[JWT Nonce] Cleanup complete', { deletedCount: count })

  return count
}
```

### Step 2.3: Update JWT Validator

```typescript
// File: src/lib/security/jwt-validator.ts
// Add to existing jwt-validator.ts:

import { checkJwtNonce, markJwtNonceAsUsed } from '@/lib/auth/jwt-nonce-tracker'

// Modify validateJwt function to check nonce:
export async function validateJwt(
  authHeader: string | null
): Promise<JwtValidationResult> {
  // ... existing code ...

  const result = await jwtVerify(token, jwks, { ... })

  // NEW: Check nonce for replay prevention
  const jti = result.payload.jti as string | undefined
  if (jti) {
    const nonceCheck = await checkJwtNonce(jti)
    if (!nonceCheck.valid) {
      logger.warn('[JWT Validator] Nonce check failed', { reason: nonceCheck.reason })
      return {
        valid: false,
        error: 'invalid-signature', // Treat replay as signature failure
      }
    }

    // Mark nonce as used
    await markJwtNonceAsUsed(jti, result.payload.sub as string, result.payload.exp as number)
  }

  // ... rest of existing code ...
}
```

### Step 2.4: Update Token API Route

```typescript
// File: src/app/api/auth/token/route.ts

import { createEnrichedJwt } from '@/lib/auth/enriched-jwt'

export async function POST(req: Request) {
  const { userId, licenseNonce } = await req.json()

  // Issue enriched JWT
  const result = await createEnrichedJwt(userId, licenseNonce)

  if (!result) {
    return Response.json(
      { error: 'Failed to create token' },
      { status: 500 }
    )
  }

  return Response.json({
    token: result.token,
    expires_in: 3600,
    token_type: 'Bearer',
  })
}
```

## Verification

```bash
# Build check
npm run build

# Test JWT creation/verification
npm test -- src/lib/auth/enriched-jwt.test.ts

# Test nonce tracking
npm test -- src/lib/auth/jwt-nonce-tracker.test.ts
```

## Success Criteria

- [ ] `createEnrichedJwt()` issues valid JWTs with all claims
- [ ] `verifyEnrichedJwt()` validates and returns payload
- [ ] Nonce tracker prevents replay attacks
- [ ] Token API route issues enriched JWTs
- [ ] All tests pass

## Unresolved Questions

1. Should we use separate JWT secret for enriched tokens vs. Supabase tokens?
2. What's the optimal nonce cleanup frequency (hourly/daily)?
