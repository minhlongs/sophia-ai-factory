---
title: "Phase 2: Cryptographic Hashing Utility"
description: "SHA-256, HMAC-SHA256, and hash chain verification utilities"
status: completed
priority: P0
effort: 1.5h
parent_plan: 260308-1126-roiaas-compliance-audit
created: 2026-03-08
completed: 2026-03-08
---

# Phase 2: Cryptographic Hashing Utility

> **Mục tiêu:** Tạo utility module cho cryptographic operations - không external dependencies

---

## Context Links

- **Parent Plan:** `plans/260308-1126-roiaas-compliance-audit/plan.md`
- **Phase 1:** `phase-01-database-schema.md` (prerequisite)
- **Research:** `plans/reports/research-compliance-audit-260308-1117.md` (Appendix A)

---

## Overview

**Priority:** P0 | **Effort:** 1.5h | **Status:** pending

Utility module cung cấp:
- `sha256()` - One-way hashing
- `hmacSha256()` - Keyed hashing for signatures
- `verifyHashChain()` - Audit trail integrity check
- `timingSafeEqual()` - Constant-time comparison (chống timing attacks)

**Library:** Chỉ dùng Node.js `crypto` module (built-in, không external deps)

---

## Key Insights

Từ research report (Pattern 5: Multi-Algorithm Fingerprinting):

```typescript
// Recommended approach
import { createHash, createHmac, timingSafeEqual } from 'crypto'

// SHA-256 cho content hashing
const hash = createHash('sha256').update(data).digest('hex')

// HMAC-SHA256 cho receipts (có secret key)
const hmac = createHmac('sha256', secret).update(data).digest('hex')

// timingSafeEqual chống timing attacks
const valid = timingSafeEqual(buf1, buf2)
```

**Salt/Pepper Pattern:**
- `AUDIT_HASH_SALT`: Public salt (stored in env)
- `AUDIT_RECEIPT_SECRET`: Private key cho HMAC (NEVER commit)

---

## Requirements

### Functional

- [ ] `sha256(data: string): string` - 64-char hex output
- [ ] `hmacSha256(data: string, secret: string): string` - 64-char hex
- [ ] `verifyHashChain(logs: RaasAuditLogRow[]): { valid: boolean, firstInvalidIndex?: number }`
- [ ] `timingSafeEqual(a: string, b: string): boolean`
- [ ] `computeContentHash(entry, previousHash): string` - Deterministic hashing

### Non-Functional

- [ ] 100% unit test coverage
- [ ] Không external dependencies (chỉ `node:crypto`)
- [ ] TypeScript strict types (no `:any`)
- [ ] Error handling (throw on invalid input)

---

## Architecture

### Module Structure

```
src/lib/audit/
├── crypto-utils.ts        # Main utility functions
├── crypto-utils.test.ts   # Unit tests
└── index.ts               # Barrel exports
```

### API Design

```typescript
// crypto-utils.ts
import { createHash, createHmac, timingSafeEqual as nodeTimingSafeEqual } from 'node:crypto'

/**
 * Compute SHA-256 hash of string
 * @param data - Input string to hash
 * @returns 64-character hexadecimal string
 */
export function sha256(data: string): string

/**
 * Compute HMAC-SHA256 signature
 * @param data - Data to sign
 * @param secret - Secret key (32+ bytes recommended)
 * @returns 64-character hexadecimal string
 */
export function hmacSha256(data: string, secret: string): string

/**
 * Constant-time string comparison (chống timing attacks)
 * @param a - First string
 * @param b - Second string
 * @returns true if strings match
 */
export function timingSafeEqual(a: string, b: string): boolean

/**
 * Compute content hash for audit log entry
 * @param entry - Audit log data
 * @param previousHash - Hash of previous log (null for first)
 * @returns 64-character hexadecimal string
 */
export function computeContentHash(
  entry: AuditLogEntry,
  previousHash: string | null
): string

/**
 * Verify integrity of hash chain
 * @param logs - Array of audit logs (sorted by created_at ASC)
 * @returns { valid: boolean, firstInvalidIndex?: number }
 */
export function verifyHashChain(logs: RaasAuditLogRow[]): {
  valid: boolean
  firstInvalidIndex?: number
}
```

### Type Definitions

```typescript
// crypto-utils.ts
export interface AuditLogEntry {
  action: string
  license_nonce: string
  user_id: string
  ip_address: string
  created_at: number
  details?: Record<string, unknown>
}
```

---

## Related Code Files

**Files to Create:**
- `apps/sophia-ai-factory/src/lib/audit/crypto-utils.ts`
- `apps/sophia-ai-factory/src/lib/audit/crypto-utils.test.ts`
- `apps/sophia-ai-factory/src/lib/audit/index.ts`

**Files to Read:**
- `apps/sophia-ai-factory/src/lib/supabase/types.ts` (RaasAuditLogRow type)

---

## Implementation Steps

### Step 1: Create crypto-utils.ts

```typescript
// src/lib/audit/crypto-utils.ts
import { createHash, createHmac, timingSafeEqual as nodeTimingSafeEqual } from 'node:crypto'

const SALT = process.env.AUDIT_HASH_SALT || ''

export function sha256(data: string): string {
  if (!data || typeof data !== 'string') {
    throw new Error('Invalid input: data must be a non-empty string')
  }
  return createHash('sha256')
    .update(`${SALT}${data}`)
    .digest('hex')
}

export function hmacSha256(data: string, secret: string): string {
  if (!data || typeof data !== 'string') {
    throw new Error('Invalid input: data must be a non-empty string')
  }
  if (!secret || typeof secret !== 'string') {
    throw new Error('Invalid input: secret must be a non-empty string')
  }
  return createHmac('sha256', secret)
    .update(data)
    .digest('hex')
}

export function timingSafeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'hex')
  const bBuf = Buffer.from(b, 'hex')

  if (aBuf.length !== bBuf.length) {
    return false
  }

  return nodeTimingSafeEqual(aBuf, bBuf)
}

export function computeContentHash(
  entry: AuditLogEntry,
  previousHash: string | null
): string {
  const content = [
    entry.action,
    entry.license_nonce,
    entry.user_id,
    entry.ip_address,
    entry.created_at.toString(),
    previousHash || ''
  ].join('|')

  return sha256(content)
}

export function verifyHashChain(logs: RaasAuditLogRow[]): {
  valid: boolean
  firstInvalidIndex?: number
} {
  if (logs.length === 0) {
    return { valid: true }
  }

  let previousHash: string | null = null

  for (let i = 0; i < logs.length; i++) {
    const log = logs[i]

    // Verify previous_hash links correctly
    if (log.previous_log_hash !== previousHash) {
      return { valid: false, firstInvalidIndex: i }
    }

    // Verify content_hash matches
    const expectedHash = computeContentHash(
      {
        action: log.action,
        license_nonce: log.license_nonce || '',
        user_id: log.user_id || '',
        ip_address: log.ip_address || '',
        created_at: log.created_at,
      },
      previousHash
    )

    if (log.content_hash !== expectedHash) {
      return { valid: false, firstInvalidIndex: i }
    }

    previousHash = log.content_hash
  }

  return { valid: true }
}
```

### Step 2: Create Unit Tests

```typescript
// src/lib/audit/crypto-utils.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import {
  sha256,
  hmacSha256,
  timingSafeEqual,
  computeContentHash,
  verifyHashChain
} from './crypto-utils'

describe('sha256', () => {
  it('should return 64-char hex string', () => {
    const hash = sha256('test-data')
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('should be deterministic (same input = same output)', () => {
    const hash1 = sha256('test-data')
    const hash2 = sha256('test-data')
    expect(hash1).toBe(hash2)
  })

  it('should throw on invalid input', () => {
    expect(() => sha256('')).toThrow()
    expect(() => sha256(null as any)).toThrow()
  })
})

describe('hmacSha256', () => {
  it('should return 64-char hex string', () => {
    const hmac = hmacSha256('test-data', 'secret-key')
    expect(hmac).toMatch(/^[a-f0-9]{64}$/)
  })

  it('should produce different output with different secrets', () => {
    const hmac1 = hmacSha256('test-data', 'secret-1')
    const hmac2 = hmacSha256('test-data', 'secret-2')
    expect(hmac1).not.toBe(hmac2)
  })
})

describe('timingSafeEqual', () => {
  it('should return true for equal strings', () => {
    const hash = sha256('test')
    expect(timingSafeEqual(hash, hash)).toBe(true)
  })

  it('should return false for different strings', () => {
    const hash1 = sha256('test-1')
    const hash2 = sha256('test-2')
    expect(timingSafeEqual(hash1, hash2)).toBe(false)
  })
})

describe('verifyHashChain', () => {
  it('should verify valid hash chain', () => {
    const logs = [
      {
        action: 'CREATE',
        license_nonce: 'nonce-1',
        user_id: 'user-1',
        ip_address: '127.0.0.1',
        created_at: 1000,
        content_hash: 'hash-1',
        previous_log_hash: null
      },
      {
        action: 'VALIDATE',
        license_nonce: 'nonce-2',
        user_id: 'user-1',
        ip_address: '127.0.0.1',
        created_at: 1001,
        content_hash: 'hash-2',
        previous_log_hash: 'hash-1'
      }
    ]

    // Compute actual hashes
    logs[0].content_hash = computeContentHash(
      { action: logs[0].action, license_nonce: logs[0].license_nonce, user_id: logs[0].user_id, ip_address: logs[0].ip_address, created_at: logs[0].created_at },
      null
    )
    logs[1].previous_log_hash = logs[0].content_hash
    logs[1].content_hash = computeContentHash(
      { action: logs[1].action, license_nonce: logs[1].license_nonce, user_id: logs[1].user_id, ip_address: logs[1].ip_address, created_at: logs[1].created_at },
      logs[0].content_hash
    )

    const result = verifyHashChain(logs)
    expect(result.valid).toBe(true)
  })

  it('should detect tampered log', () => {
    const logs = [
      {
        action: 'CREATE',
        license_nonce: 'nonce-1',
        user_id: 'user-1',
        ip_address: '127.0.0.1',
        created_at: 1000,
        content_hash: 'original-hash',
        previous_log_hash: null
      }
    ]

    // Tamper with log
    logs[0].action = 'MODIFIED'

    const result = verifyHashChain(logs)
    expect(result.valid).toBe(false)
    expect(result.firstInvalidIndex).toBe(0)
  })
})
```

### Step 3: Create Barrel Export

```typescript
// src/lib/audit/index.ts
export * from './crypto-utils'
```

### Step 4: Run Tests

```bash
cd apps/sophia-ai-factory
npm test -- crypto-utils.test.ts
```

---

## Todo List

- [x] Create `crypto-utils.ts` với tất cả functions
- [x] Create `crypto-utils.test.ts` với 100% coverage
- [x] Create `index.ts` barrel export
- [x] Run tests, fix failures
- [x] Verify build passes (`npm run build`)

---

## Success Criteria

**Definition of Done:**

1. ✅ `sha256()` returns consistent 64-char hex
2. ✅ `hmacSha256()` produces different output với different secrets
3. ✅ `timingSafeEqual()` prevents timing attacks
4. ✅ `verifyHashChain()` detects tampered logs
5. ✅ Unit tests pass (100% coverage)
6. ✅ Build passes (0 TypeScript errors)

**Verification Commands:**

```bash
# Run tests
npm test -- crypto-utils

# Check coverage
npm test -- --coverage --testPathPattern=crypto-utils

# Verify build
npm run build

# Check no external deps added
grep -E "^  \"(crypto|@noble|jose)\"" package.json || echo "No external crypto deps (good)"
```

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Salt không có trong env | Low | Fallback to empty string, log warning |
| timingSafeEqual fails với different lengths | Medium | Handle length mismatch gracefully |
| Hash chain verification slow | Low | Benchmark, optimize nếu cần |

---

## Security Considerations

- **AUDIT_HASH_SALT:** Nên có trong .env (không commit)
- **AUDIT_RECEIPT_SECRET:** PHẢI có, 32+ bytes entropy
- **timingSafeEqual:** Dùng cho TẤT CẢ signature comparisons

---

## Next Steps

Sau Phase 2 complete:

1. **Phase 3:** Compliance Receipt Generator (dùng crypto-utils)
2. **Phase 4:** Integrate vào RaaS middleware
3. **Phase 7:** Tests & verification

---

_End of Phase 2 Plan_
