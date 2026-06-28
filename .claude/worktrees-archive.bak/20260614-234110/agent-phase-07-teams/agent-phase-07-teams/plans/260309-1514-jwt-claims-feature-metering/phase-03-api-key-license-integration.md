---
title: "Phase 3: API Key License Context Resolution"
description: "Integrate API key validation with license context resolution for enriched JWT issuance"
status: pending
priority: P1
effort: 1.5h
---

# Phase 3: API Key License Context Resolution

## Overview

When API key is validated, resolve associated license context and issue enriched JWT for downstream enforcement.

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/raas-gate.ts` | Modify | Add JWT enrichment on API key validation |
| `src/lib/security/api-key-validator.ts` | Modify | Return license context with validation result |
| `src/middleware.ts` | Modify | Attach enriched JWT to request headers |

## Implementation Steps

### Step 3.1: Update API Key Validator

```typescript
// File: src/lib/security/api-key-validator.ts
// Add to ValidationResult interface:

export interface ValidationResult {
  valid: boolean
  error?: 'missing-key' | 'invalid-format' | 'expired' | 'revoked' | 'rate-limited' | 'not-found'
  apiKey?: ApiKeyInfo

  // NEW: License context for JWT enrichment
  licenseContext?: {
    licenseNonce: string
    tier: string
    polarCustomerId?: string
    agencyId?: string
  }
}

// Modify checkApiKey function to fetch license context:
export async function checkApiKey(
  keyId: string,
  signature: string
): Promise<ValidationResult> {
  // ... existing validation code ...

  // After successful validation, fetch associated license
  const supabase = createAdminClient()
  const { data: license } = await supabase
    .from('raas_licenses')
    .select('license_nonce, tier, polar_customer_id, agency_id')
    .eq('created_by', data.owner_id)
    .order('created_at', { ascending: false })
    .single()

  return {
    valid: true,
    apiKey: { ... },
    // NEW: License context
    licenseContext: license ? {
      licenseNonce: license.license_nonce,
      tier: license.tier,
      polarCustomerId: license.polar_customer_id || undefined,
      agencyId: license.agency_id || undefined,
    } : undefined,
  }
}
```

### Step 3.2: Update RaaS Gate Middleware

```typescript
// File: src/lib/raas-gate.ts
// Add JWT enrichment function:

import { createEnrichedJwt } from '@/lib/auth/enriched-jwt'

/**
 * RaaS Gate validation result
 */
export interface RaasGateResult {
  valid: boolean
  tier?: string
  response?: Response
  receipt?: string
  enrichedJwt?: string  // NEW: Enriched JWT for downstream use
  licenseNonce?: string
}

/**
 * RaaS Gate middleware with JWT enrichment
 */
export async function raasGate(request: Request): Promise<RaasGateResult> {
  const apiKey = request.headers.get('X-API-Key')

  if (!apiKey) {
    return {
      valid: false,
      response: createForbiddenResponse('Missing API key'),
    }
  }

  // Validate API key
  const validationResult = await validateApiKey(apiKey)

  if (!validationResult.valid) {
    return {
      valid: false,
      response: createForbiddenResponse(`Invalid API key: ${validationResult.error}`),
    }
  }

  // NEW: Issue enriched JWT if license context available
  const { apiKey: keyInfo, licenseContext } = validationResult

  if (licenseContext && keyInfo) {
    const jwtResult = await createEnrichedJwt(
      keyInfo.ownerId,
      licenseContext.licenseNonce
    )

    if (jwtResult) {
      // Log enriched JWT issuance
      await logAuditEvent({
        action: 'enriched_jwt_issued',
        userId: keyInfo.ownerId,
        metadata: {
          licenseNonce: licenseContext.licenseNonce.slice(0, 8) + '...',
          tier: licenseContext.tier,
          expiresAt: jwtResult.payload.exp,
        },
      })

      return {
        valid: true,
        tier: licenseContext.tier,
        licenseNonce: licenseContext.licenseNonce,
        enrichedJwt: jwtResult.token,  // Attach to result
      }
    }
  }

  // Fallback without enriched JWT
  return {
    valid: true,
    tier: licenseContext?.tier,
    licenseNonce: licenseContext?.licenseNonce,
  }
}
```

### Step 3.3: Update Middleware Integration

```typescript
// File: src/middleware.ts
// Update RaaS gate integration section:

if (shouldApplyRaasGate(pathname)) {
  const raasResult = await raasGate(request)

  if (!raasResult.valid && raasResult.response) {
    return raasResult.response
  }

  // Attach RaaS context
  if (raasResult.valid) {
    if (raasResult.tier) {
      request.headers.set('x-raas-tier', raasResult.tier)
    }
    if (raasResult.licenseNonce) {
      request.headers.set('x-raas-license-nonce', raasResult.licenseNonce)
    }
    // NEW: Attach enriched JWT
    if (raasResult.enrichedJwt) {
      request.headers.set('x-raas-jwt', raasResult.enrichedJwt)
    }
  }

  // Attach compliance receipt
  if (raasResult.receipt) {
    request.headers.set('x-raas-receipt', raasResult.receipt)
  }
}
```

### Step 3.4: API Key to License Mapping

```sql
-- Ensure raas_api_keys has foreign key to licenses
-- File: supabase/migrations/260309-1516-add-license-fk-to-api-keys.sql

ALTER TABLE raas_api_keys
ADD COLUMN IF NOT EXISTS associated_license_nonce TEXT REFERENCES raas_licenses(license_nonce);

-- Create index for fast lookup
CREATE INDEX IF NOT EXISTS idx_raas_api_keys_license_nonce
ON raas_api_keys(associated_license_nonce);

-- Comment for documentation
COMMENT ON COLUMN raas_api_keys.associated_license_nonce IS 'License associated with this API key for JWT enrichment';
```

## Verification

```bash
# Test API key validation with license context
npm test -- src/lib/security/api-key-validator.test.ts

# Test RaaS gate enrichment
npm test -- src/lib/raas-gate.test.ts

# Integration test
curl -X POST http://localhost:3000/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{"userId":"user-123","licenseNonce":"license-abc"}'

# Should return enriched JWT
```

## Success Criteria

- [ ] API key validation returns license context
- [ ] RaaS gate issues enriched JWT on successful validation
- [ ] Middleware attaches enriched JWT to request headers
- [ ] API key to license mapping exists in database

## Unresolved Questions

1. Should API keys be explicitly linked to a single license, or dynamically resolve the "active" license?
2. What happens if user has multiple licenses - should we issue multiple JWTs or pick the highest tier?
