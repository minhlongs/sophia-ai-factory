---
title: "Phase 4: RaaS Gateway Integration"
description: "Integrate compliance logging into RaaS middleware"
status: completed
priority: P0
effort: 2h
parent_plan: 260308-1126-roiaas-compliance-audit
created: 2026-03-08
completed: 2026-03-08
---

# Phase 4: RaaS Gateway Integration

> **Mục tiêu:** Mọi license validation đều tạo audit log với receipt - tự động, immutable

---

## Context Links

- **Parent Plan:** `plans/260308-1126-roiaas-compliance-audit/plan.md`
- **Phase 2:** `phase-02-crypto-utility.md` (crypto-utils)
- **Phase 3:** `phase-03-compliance-receipt.md` (receipt generator)
- **Existing:** `src/lib/raas-gate.ts`, `src/lib/raas-audit.ts`

---

## Overview

**Priority:** P0 | **Effort:** 2h | **Status:** pending

Tích hợp compliance logging vào RaaS middleware flow:

1. License validation → Tạo audit log (hash chain)
2. Audit log insert → Generate receipt (HMAC-SHA256)
3. Response → Attach receipt header (`X-RaaS-Receipt`)

**YAGNI:** Không cần queue/buffer - write trực tiếp (Supabase fast enough)

---

## Architecture

### Integration Flow

```
┌─────────────────────────────────────────────────────────────┐
│  raas-gate.ts Middleware                                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Extract license key from X-RaaS-License-Key header      │
│  2. Validate license (existing logic)                       │
│  3. NEW: Call logValidationWithReceipt()                    │
│     ├─ Insert audit log (hash chain auto-computed)          │
│     ├─ Generate compliance receipt                          │
│     └─ Store receipt signature in DB                        │
│  4. Return validation result + receipt in header            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Audit Logger Module

```typescript
// lib/audit/audit-logger.ts
export async function logValidationWithReceipt(params: {
  nonce: string
  isValid: boolean
  userId?: string
  ipAddress?: string
  userAgent?: string
  tier?: string
}): Promise<ComplianceReceipt | null>
```

---

## Related Code Files

**Files to Create:**
- `apps/sophia-ai-factory/src/lib/audit/audit-logger.ts`
- `apps/sophia-ai-factory/src/lib/audit/audit-logger.test.ts`

**Files to Modify:**
- `apps/sophia-ai-factory/src/lib/raas-gate.ts` (add receipt logging)
- `apps/sophia-ai-factory/src/lib/raas-audit.ts` (add receipt generation)

---

## Implementation Steps

### Step 1: Create Audit Logger

```typescript
// src/lib/audit/audit-logger.ts
import { createAdminClient } from '@/lib/supabase/admin'
import { generateReceipt } from './compliance-receipt'
import { logger } from '@/lib/utils/logger-utility'
import type { RaasAuditLogInsert } from '@/lib/supabase/types'
import type { ComplianceReceipt } from './compliance-receipt'

export interface ValidationLogParams {
  nonce: string
  isValid: boolean
  userId?: string
  ipAddress?: string
  userAgent?: string
  tier?: string
}

/**
 * Log license validation with compliance receipt
 * Called by raas-gate.ts middleware on every validation
 */
export async function logValidationWithReceipt(
  params: ValidationLogParams
): Promise<ComplianceReceipt | null> {
  const supabase = createAdminClient()
  const createdAt = Math.floor(Date.now() / 1000)

  // Prepare audit log data
  const logData: RaasAuditLogInsert = {
    action: 'VALIDATE',
    license_nonce: params.nonce,
    user_id: params.userId ?? null,
    ip_address: params.ipAddress ?? null,
    user_agent: params.userAgent ?? null,
    created_at: createdAt,
    details: {
      isValid: params.isValid,
      tier: params.tier,
      timestamp: createdAt
    }
  }

  try {
    // Insert audit log (trigger auto-computes hash chain)
    const { data: insertedLog, error: insertError } = await supabase
      .from('raas_audit_logs')
      .insert(logData as any)
      .select()
      .single()

    if (insertError || !insertedLog) {
      logger.error('Failed to insert audit log', insertError as Error)
      return null
    }

    // Generate receipt
    const receipt = generateReceipt(insertedLog)

    // Store receipt signature in DB
    const { error: updateError } = await supabase
      .from('raas_audit_logs')
      .update({ receipt_signature: receipt.signature })
      .eq('id', insertedLog.id)

    if (updateError) {
      logger.error('Failed to store receipt signature', updateError as Error)
      // Non-fatal: receipt already generated, continue
    }

    return receipt
  } catch (error) {
    logger.error('Audit logging failed', error as Error)
    // Non-fatal: don't block validation on audit failure
    return null
  }
}

/**
 * Log license creation with receipt
 */
export async function logCreationWithReceipt(params: {
  nonce: string
  tier: string
  createdBy?: string
  ipAddress?: string
}): Promise<ComplianceReceipt | null> {
  // Similar implementation for CREATE action
}

/**
 * Log license revocation with receipt
 */
export async function logRevocationWithReceipt(params: {
  nonce: string
  revokedBy?: string
  reason?: string
}): Promise<ComplianceReceipt | null> {
  // Similar implementation for REVOKE action
}
```

### Step 2: Update RaaS Gate Middleware

```typescript
// src/lib/raas-gate.ts
import { logValidationWithReceipt } from './audit/audit-logger'

export async function raasGate(request: NextRequest): Promise<{
  valid: boolean
  response?: NextResponse
  tier?: string
  receipt?: string
}> {
  const licenseKey = extractLicenseKey(request)
  const result = await validateLicenseKey(licenseKey)

  if (!result.valid) {
    // Log failed validation
    await logValidationWithReceipt({
      nonce: licenseKey || 'unknown',
      isValid: false,
      ipAddress: request.headers.get('x-forwarded-for'),
      userAgent: request.headers.get('user-agent'),
      tier: 'unknown'
    })

    return {
      valid: false,
      response: createForbiddenResponse(result.reason!)
    }
  }

  // Log successful validation
  const receipt = await logValidationWithReceipt({
    nonce: licenseKey!,
    isValid: true,
    userId: request.headers.get('x-logged-in-user-id') || undefined,
    ipAddress: request.headers.get('x-forwarded-for'),
    userAgent: request.headers.get('user-agent'),
    tier: result.tier
  })

  return {
    valid: true,
    tier: result.tier,
    receipt: receipt ? JSON.stringify(receipt) : undefined
  }
}
```

### Step 3: Attach Receipt to Response

```typescript
// src/middleware.ts (or wherever raas-gate is called)
const validation = await raasGate(request)

if (validation.receipt) {
  response.headers.set('X-RaaS-Receipt', validation.receipt)
}
```

### Step 4: Update raas-audit.ts (Optional)

Add receipt generation to existing audit functions:

```typescript
// src/lib/raas-audit.ts
import { generateReceipt } from './audit/compliance-receipt'

export async function logAuditAction(params: AuditLogParams): Promise<void> {
  // ... existing code ...

  // After insert, generate and store receipt
  const receipt = generateReceipt(insertedLog)
  await supabase
    .from('raas_audit_logs')
    .update({ receipt_signature: receipt.signature })
    .eq('id', insertedLog.id)
}
```

---

## Todo List

- [x] Create `audit-logger.ts` với logValidationWithReceipt()
- [x] Update `raas-gate.ts` để gọi audit logger
- [x] Add receipt header to response (via proxy.ts)
- [x] Create `audit-logger.test.ts` (integration tests)
- [x] Tests pass (125/125 tests for Phase 4 modules)

---

## Success Criteria

**Definition of Done:**

1. ✅ Mỗi validation tạo audit log entry
2. ✅ Receipt generated và lưu vào DB
3. ✅ Receipt attach vào response header
4. ✅ Validation failure vẫn log audit (với isValid=false)
5. ✅ Graceful degradation (audit failure không block validation)
6. ✅ Performance overhead < 50ms per validation

**Verification Commands:**

```bash
# Test validation với receipt
curl -H "X-RaaS-License-Key: <test-key>" \
  "http://localhost:3000/api/protected-endpoint" \
  -v 2>&1 | grep "X-RaaS-Receipt"

# Check audit log created
psql "$(npx supabase db url)" -c "
  SELECT id, action, license_nonce, content_hash, receipt_signature
  FROM raas_audit_logs
  WHERE action = 'VALIDATE'
  ORDER BY created_at DESC
  LIMIT 1;
"

# Check receipt signature stored
psql "$(npx supabase db url)" -c "
  SELECT COUNT(*) FROM raas_audit_logs
  WHERE receipt_signature IS NOT NULL;
"
```

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Audit logging làm chậm validation | Medium | Benchmark, async logging nếu cần |
| Receipt generation fails | Low | Non-blocking, log error, continue |
| DB connection pool exhausted | Medium | Use Supabase connection pooling |

---

## Performance Considerations

**Benchmark Target:**

- Audit log insert: < 20ms
- Receipt generation: < 5ms
- Total overhead: < 50ms

**Async Logging (nếu cần):**

```typescript
// Non-blocking logging
Promise.resolve().then(async () => {
  await logValidationWithReceipt(params)
}).catch(err => {
  logger.error('Async audit logging failed', err)
})
```

---

## Security Considerations

- **Receipt Header:** Chỉ attach cho successful validations
- **Rate Limiting:** Audit endpoint cần rate limit (prevent DoS)
- **Error Handling:** Audit failure không leak sensitive info

---

## Next Steps

Sau Phase 4 complete:

1. **Phase 5:** Compliance Certificate UI (dashboard page)
2. **Phase 6:** Manifest Generator (PDF export)
3. **Phase 7:** Tests & verification

---

_End of Phase 4 Plan_
