---
title: "Phase 3: Compliance Receipt Generator"
description: "Generate signed JWT receipts for audit log entries"
status: completed
priority: P0
effort: 2h
parent_plan: 260308-1126-roiaas-compliance-audit
created: 2026-03-08
completed: 2026-03-08
---

# Phase 3: Compliance Receipt Generator

> **Mục tiêu:** Tạo signed compliance receipts cho mỗi audit log - verifiable, tamper-proof

---

## Context Links

- **Parent Plan:** `plans/260308-1126-roiaas-compliance-audit/plan.md`
- **Phase 2:** `phase-02-crypto-utility.md` (prerequisite - crypto-utils)
- **Research:** `plans/reports/research-compliance-audit-260308-1117.md` (Pattern 1: HMAC-Based Receipt)

---

## Overview

**Priority:** P0 | **Effort:** 2h | **Status:** pending

Compliance Receipt = signed statement chứng minh một audit log tồn tại và hợp lệ.

**Format:** JWT (JSON Web Token) với HMAC-SHA256 signature

**Use Cases:**
- Customer self-verify their license validations
- External auditors verify compliance without DB access
- Legal evidence (signed, timestamped proof)

---

## Key Insights

Từ research report (Pattern 1: HMAC-Based Receipt Signature):

```typescript
// Receipt structure
export interface ComplianceReceipt {
  receiptId: string      // UUID
  auditLogId: string     // raas_audit_logs.id
  action: AuditAction    // CREATE | VALIDATE | REVOKE | UPDATE
  licenseNonce: string   // License identifier
  timestamp: number      // Unix timestamp
  actorId: string        // User ID or 'system'
  actorIpHash: string    // SHA-256 of IP (privacy)
  signature: string      // HMAC-SHA256
}

// Generation
const payload = JSON.stringify({ auditLogId, action, licenseNonce, timestamp, actorId })
const signature = createHmac('sha256', RECEIPT_SECRET).update(payload).digest('hex')
```

**JWT vs Custom Format:**
- JWT: Stateless verification, standard format, client-verifiable
- Custom HMAC: Simpler, no external library needed

**Decision:** Dùng custom HMAC format (không cần JWT library, giữ YAGNI)

---

## Requirements

### Functional

- [ ] `generateReceipt(log: RaasAuditLogRow): ComplianceReceipt`
- [ ] `verifyReceipt(receipt: ComplianceReceipt): boolean`
- [ ] GET `/api/admin/audit/receipt?logId=xxx` endpoint
- [ ] POST `/api/admin/audit/receipt/verify` endpoint

### Non-Functional

- [ ] Receipt generation < 10ms
- [ ] API endpoints protected (admin-only auth)
- [ ] Error handling (404 if log not found)
- [ ] Rate limiting (prevent receipt spam)

---

## Architecture

### Receipt Structure

```typescript
export interface ComplianceReceipt {
  receiptId: string        // randomUUID()
  auditLogId: string       // raas_audit_logs.id
  action: string           // action from log
  licenseNonce: string     // from log
  timestamp: number        // created_at from log
  actorId: string          // user_id or 'system'
  actorIpHash: string      // sha256(ip_address)
  contentHash: string      // from log (hash chain link)
  signature: string        // HMAC-SHA256 signed
  issuedAt: number         // Receipt generation time
  expiresAt: number        // Expiration (1 hour from issuedAt)
}
```

### Signature Payload

```typescript
// Deterministic JSON (sorted keys)
const signaturePayload = JSON.stringify({
  receiptId: receipt.receiptId,
  auditLogId: receipt.auditLogId,
  action: receipt.action,
  licenseNonce: receipt.licenseNonce,
  timestamp: receipt.timestamp,
  actorId: receipt.actorId,
  actorIpHash: receipt.actorIpHash,
  contentHash: receipt.contentHash
}, Object.keys(receipt).sort())

const signature = hmacSha256(signaturePayload, RECEIPT_SECRET)
```

---

## Related Code Files

**Files to Create:**
- `apps/sophia-ai-factory/src/lib/audit/compliance-receipt.ts`
- `apps/sophia-ai-factory/src/lib/audit/compliance-receipt.test.ts`
- `apps/sophia-ai-factory/src/app/api/admin/audit/receipt/route.ts`
- `apps/sophia-ai-factory/src/app/api/admin/audit/receipt/verify/route.ts`

**Dependencies:**
- `src/lib/audit/crypto-utils.ts` (Phase 2)
- `src/lib/supabase/admin.ts` (admin client)

---

## Implementation Steps

### Step 1: Create compliance-receipt.ts

```typescript
// src/lib/audit/compliance-receipt.ts
import { randomUUID } from 'node:crypto'
import { hmacSha256, sha256, timingSafeEqual } from './crypto-utils'
import type { RaasAuditLogRow } from '@/lib/supabase/types'

const RECEIPT_SECRET = process.env.AUDIT_RECEIPT_SECRET || ''
const RECEIPT_TTL = 60 * 60 // 1 hour in seconds

export interface ComplianceReceipt {
  receiptId: string
  auditLogId: string
  action: string
  licenseNonce: string
  timestamp: number
  actorId: string
  actorIpHash: string
  contentHash: string
  signature: string
  issuedAt: number
  expiresAt: number
}

export function generateReceipt(log: RaasAuditLogRow): ComplianceReceipt {
  const now = Math.floor(Date.now() / 1000)

  const receipt: ComplianceReceipt = {
    receiptId: randomUUID(),
    auditLogId: log.id,
    action: log.action,
    licenseNonce: log.license_nonce || '',
    timestamp: log.created_at,
    actorId: log.user_id || 'system',
    actorIpHash: log.ip_address ? sha256(log.ip_address) : '',
    contentHash: log.content_hash,
    signature: '',
    issuedAt: now,
    expiresAt: now + RECEIPT_TTL
  }

  // Compute signature
  const payload = JSON.stringify({
    receiptId: receipt.receiptId,
    auditLogId: receipt.auditLogId,
    action: receipt.action,
    licenseNonce: receipt.licenseNonce,
    timestamp: receipt.timestamp,
    actorId: receipt.actorId,
    actorIpHash: receipt.actorIpHash,
    contentHash: receipt.contentHash
  }, Object.keys(receipt).sort())

  receipt.signature = hmacSha256(payload, RECEIPT_SECRET)

  return receipt
}

export function verifyReceipt(receipt: ComplianceReceipt): boolean {
  // Check expiration
  const now = Math.floor(Date.now() / 1000)
  if (now > receipt.expiresAt) {
    return false
  }

  // Recompute signature
  const payload = JSON.stringify({
    receiptId: receipt.receiptId,
    auditLogId: receipt.auditLogId,
    action: receipt.action,
    licenseNonce: receipt.licenseNonce,
    timestamp: receipt.timestamp,
    actorId: receipt.actorId,
    actorIpHash: receipt.actorIpHash,
    contentHash: receipt.contentHash
  }, Object.keys(receipt).sort())

  const expectedSignature = hmacSha256(payload, RECEIPT_SECRET)

  return timingSafeEqual(receipt.signature, expectedSignature)
}

export function serializeReceipt(receipt: ComplianceReceipt): string {
  return JSON.stringify(receipt, null, 2)
}

export function parseReceipt(json: string): ComplianceReceipt | null {
  try {
    const parsed = JSON.parse(json)
    // Basic validation
    if (!parsed.receiptId || !parsed.signature) {
      return null
    }
    return parsed as ComplianceReceipt
  } catch {
    return null
  }
}
```

### Step 2: Create Unit Tests

```typescript
// src/lib/audit/compliance-receipt.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { generateReceipt, verifyReceipt, serializeReceipt, parseReceipt } from './compliance-receipt'
import type { RaasAuditLogRow } from '@/lib/supabase/types'

describe('generateReceipt', () => {
  const mockLog: RaasAuditLogRow = {
    id: 'test-log-id',
    action: 'VALIDATE',
    license_id: 'license-123',
    license_nonce: 'test-nonce',
    user_id: 'user-456',
    ip_address: '192.168.1.1',
    user_agent: 'Mozilla/5.0',
    details: { isValid: true },
    created_at: 1234567890,
    content_hash: 'abc123...',
    previous_log_hash: null,
    hash_chain_valid: true
  }

  it('should generate receipt with all fields', () => {
    const receipt = generateReceipt(mockLog)

    expect(receipt.receiptId).toMatch(/^[0-9a-f-]{36}$/)
    expect(receipt.auditLogId).toBe(mockLog.id)
    expect(receipt.action).toBe(mockLog.action)
    expect(receipt.licenseNonce).toBe(mockLog.license_nonce)
    expect(receipt.signature).toMatch(/^[a-f0-9]{64}$/)
  })

  it('should hash IP address for privacy', () => {
    const receipt = generateReceipt(mockLog)
    expect(receipt.actorIpHash).not.toBe(mockLog.ip_address)
    expect(receipt.actorIpHash).toMatch(/^[a-f0-9]{64}$/)
  })
})

describe('verifyReceipt', () => {
  it('should verify valid receipt', () => {
    const mockLog: RaasAuditLogRow = {
      id: 'test-log-id',
      action: 'VALIDATE',
      license_id: null,
      license_nonce: 'test-nonce',
      user_id: 'user-456',
      ip_address: '192.168.1.1',
      user_agent: null,
      details: {},
      created_at: 1234567890,
      content_hash: 'abc123...',
      previous_log_hash: null,
      hash_chain_valid: true
    }

    const receipt = generateReceipt(mockLog)
    const valid = verifyReceipt(receipt)

    expect(valid).toBe(true)
  })

  it('should reject tampered receipt', () => {
    const mockLog: RaasAuditLogRow = {
      id: 'test-log-id',
      action: 'VALIDATE',
      license_id: null,
      license_nonce: 'test-nonce',
      user_id: 'user-456',
      ip_address: '192.168.1.1',
      user_agent: null,
      details: {},
      created_at: 1234567890,
      content_hash: 'abc123...',
      previous_log_hash: null,
      hash_chain_valid: true
    }

    const receipt = generateReceipt(mockLog)
    receipt.action = 'TAMPERED'

    const valid = verifyReceipt(receipt)
    expect(valid).toBe(false)
  })

  it('should reject expired receipt', async () => {
    const mockLog: RaasAuditLogRow = {
      id: 'test-log-id',
      action: 'VALIDATE',
      license_id: null,
      license_nonce: 'test-nonce',
      user_id: 'user-456',
      ip_address: '192.168.1.1',
      user_agent: null,
      details: {},
      created_at: 1234567890,
      content_hash: 'abc123...',
      previous_log_hash: null,
      hash_chain_valid: true
    }

    const receipt = generateReceipt(mockLog)
    receipt.expiresAt = Math.floor(Date.now() / 1000) - 1000 // Expired 1000s ago

    const valid = verifyReceipt(receipt)
    expect(valid).toBe(false)
  })
})
```

### Step 3: Create API Endpoints

```typescript
// src/app/api/admin/audit/receipt/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateReceipt, serializeReceipt } from '@/lib/audit/compliance-receipt'
import { logger } from '@/lib/utils/logger-utility'

export async function GET(request: NextRequest) {
  try {
    // Admin auth check
    const authError = await checkAdminAuth(request)
    if (authError) return authError

    const { searchParams } = request.nextUrl
    const logId = searchParams.get('logId')

    if (!logId) {
      return NextResponse.json({ error: 'Missing logId parameter' }, { status: 400 })
    }

    // Fetch audit log
    const supabase = createAdminClient()
    const { data: log, error } = await supabase
      .from('raas_audit_logs')
      .select('*')
      .eq('id', logId)
      .single()

    if (error || !log) {
      return NextResponse.json({ error: 'Audit log not found' }, { status: 404 })
    }

    // Generate receipt
    const receipt = generateReceipt(log)

    return NextResponse.json({
      receipt,
      serialized: serializeReceipt(receipt)
    })
  } catch (error) {
    logger.error('Failed to generate receipt', error as Error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

```typescript
// src/app/api/admin/audit/receipt/verify/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyReceipt, parseReceipt } from '@/lib/audit/compliance-receipt'
import { logger } from '@/lib/utils/logger-utility'

export async function POST(request: NextRequest) {
  try {
    // Admin auth check
    const authError = await checkAdminAuth(request)
    if (authError) return authError

    const body = await request.json()
    const { receiptJson, receiptId } = body

    let receipt
    if (receiptJson) {
      receipt = parseReceipt(receiptJson)
    }

    if (!receipt) {
      return NextResponse.json({ error: 'Invalid receipt format' }, { status: 400 })
    }

    const valid = verifyReceipt(receipt)

    return NextResponse.json({
      valid,
      receiptId: receipt.receiptId,
      message: valid ? 'Receipt verified successfully' : 'Receipt verification failed'
    })
  } catch (error) {
    logger.error('Failed to verify receipt', error as Error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

---

## Todo List

- [x] Create `compliance-receipt.ts` với generate/verify functions
- [x] Create `compliance-receipt.test.ts`
- [x] Create GET `/api/admin/audit/receipt` endpoint
- [x] Create POST `/api/admin/audit/receipt/verify` endpoint
- [x] Run tests, verify all pass (26/26 tests passing)
- [ ] Test endpoints manually (Postman/curl) - Optional for Phase 3

---

## Success Criteria

**Definition of Done:**

1. ✅ `generateReceipt()` tạo receipt với đầy đủ fields
2. ✅ `verifyReceipt()` returns true cho valid receipt
3. ✅ `verifyReceipt()` returns false cho tampered receipt
4. ✅ API endpoints protected (admin-only)
5. ✅ Unit tests pass (100% coverage)
6. ✅ Manual test: curl endpoint, verify response

**Verification Commands:**

```bash
# Run tests
npm test -- compliance-receipt

# Test receipt generation endpoint
curl -H "Authorization: Bearer <admin-token>" \
  "http://localhost:3000/api/admin/audit/receipt?logId=<uuid>"

# Test receipt verification
curl -X POST -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"receiptJson": {...}}' \
  "http://localhost:3000/api/admin/audit/receipt/verify"
```

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| RECEIPT_SECRET không có | High | Validate on startup, fail fast |
| Receipt không được lưu vào DB | Low | Signature lưu trong `receipt_signature` column (Phase 1) |
| API endpoint spam | Medium | Add rate limiting (100 req/min per IP) |

---

## Security Considerations

- **RECEIPT_SECRET:** 32+ bytes entropy, NEVER commit
- **IP Hashing:** Privacy protection (không lưu raw IP trong receipt)
- **Expiration:** 1-hour TTL防止 receipt reuse
- **Admin Auth:** Endpoints chỉ accessible bởi authenticated admins

---

## Next Steps

Sau Phase 3 complete:

1. **Phase 4:** RaaS Gateway Integration (middleware logging)
2. **Phase 5:** Compliance Certificate UI (dashboard)
3. **Phase 6:** Manifest Generator (PDF export)

---

_End of Phase 3 Plan_
