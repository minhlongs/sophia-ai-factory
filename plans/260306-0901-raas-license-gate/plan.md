---
title: "ROIaaS PHASE 1 - License Key Gating Implementation"
description: "HMAC-SHA256 validation + timestamp expiration + nonce tracking for production-grade license gating"
status: completed
priority: P1
effort: 8h (completed: ~7h)
branch: main
tags: [raas, security, license, middleware]
created: 2026-03-06
---

# ROIaaS PHASE 1 - License Key Gating

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Client Request                                │
│              X-RaaS-License-Key: raas_{tier}_{ts}_{nonce}_{hmac}│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  src/proxy.ts (Middleware)                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ shouldApplyRaasGate() - Skip public routes               │  │
│  │ raasGate() - Extract + validate license key              │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  src/lib/raas-service.ts (NEW)                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 1. Parse: Split key into components                      │  │
│  │ 2. HMAC: Verify signature with timingSafeEqual           │  │
│  │ 3. Expiration: Check timestamp                           │  │
│  │ 4. Nonce: Check Redis for replay attacks                 │  │
│  │ 5. Revocation: Check revoked keys set                    │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  src/lib/raas-key-generator.ts (NEW)                             │
│  generateLicenseKey(tier, expiresAt) → raas_{tier}_{ts}_{nonce}_{hmac}
└─────────────────────────────────────────────────────────────────┘
```

## License Key Format

```
Format: raas_{tier}_{timestamp}_{nonce}_{hmac}
Example: raas_premium_1735689600_a1b2c3d4e5f6_e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855

Components:
- raas_        : Fixed prefix
- {tier}       : basic | premium | enterprise | master
- {timestamp}  : Unix timestamp (seconds) - expiration
- {nonce}      : crypto.randomBytes(16).toString('hex') - 32 chars
- {hmac}       : HMAC-SHA256(tier:timestamp:nonce, SECRET) - 64 chars
```

## Phases

Phase 1 ✅ COMPLETED
- **File:** `src/lib/raas-service.ts` (CREATE) - 299 lines
- **Dependencies:** `src/lib/security/webhook-signature-verification.ts` (reuse `timingSafeEqual`)
- **Tasks:**
  - [x] `parseLicenseKey()` - Split key, validate format
  - [x] `verifyHmac()` - timingSafeEqual comparison
  - [x] `checkExpiration()` - timestamp validation
  - [x] `checkNonce()` - Redis cache for replay prevention
  - [x] `checkRevocation()` - Redis revoked keys set
  - [x] `validateLicenseKey()` - Main validation function
  - [x] `revokeLicenseKey()` - Key revocation utility
  - [x] `generateNonce()` - Random nonce generator
- **Success:** 100% unit test coverage (48 tests passing)
- **Test Report:** `src/lib/raas-service.test.ts` - 48/48 tests PASSING

### Phase 2: Key Generator Utility (1h) ✅ COMPLETED
- **File:** `src/lib/raas-key-generator.ts` (CREATE) - 163 lines
- **Status:** COMPLETED (2026-03-06)
- **Dependencies:** Node.js `crypto` module
- **Tasks:**
  - [x] `generateLicenseKey(tier, expiresAt)` - Create new key
  - [x] `generateMasterKey(tier)` - Perpetual key (no expiration)
  - [x] `revokeKey(key)` - Add to revocation set
- **Success:** CLI-testable utility, 21 tests passing
- **Test Report:** `reports/fullstack-developer-260306-0903-phase2-key-generator.md`

### Phase 3: Update raas-gate.ts ✅ COMPLETED
- **File:** `src/lib/raas-gate.ts` (MODIFY) - 259 lines
- **Changes:**
  - [x] Replace `validateLicenseKey()` with `raas-service.ts` calls
  - [x] Add `RAAS_LICENSE_SECRET` env var requirement
  - [x] Add Redis connection for nonce/revocation checks
  - [x] Preserve backward-compat: `RAAS_V1_FORMAT=true` fallback
- **Success:** All existing tests pass + new HMAC tests
- **Integration:** `src/proxy.ts` middleware auto-applies to `/api/*` routes

### Phase 4: Middleware Integration ✅ COMPLETED
- **File:** `src/proxy.ts` (READ ONLY - already integrated)
- **Verification:**
  - [x] Confirm `raasGate()` is called for all `/api/*` routes
  - [x] Verify public routes excluded (health, setup, webhooks, auth)
  - [x] Test tier extraction passed to route handlers
- **Success:** Manual test with valid/invalid keys - PASS

### Phase 5: Testing & Documentation ✅ COMPLETED
- **Files:** `src/lib/raas-gate.test.ts`, `docs/raas-license-gating.md`
- **Success:** `npm test` passes 100%, docs committed
- **Test Results:**
  - raas-service.test.ts: 48 tests passing
  - raas-key-generator.test.ts: 21 tests passing
  - raas-gate.test.ts: 11 tests passing
  - Total: 80 tests, 100% pass
- **Documentation:** `docs/raas-license-gating.md` (bilingual EN/VI)

## File Dependencies

```
src/lib/raas-key-generator.ts
  └─> Node.js crypto (builtin)

src/lib/raas-service.ts
  └─> src/lib/security/webhook-signature-verification.ts (timingSafeEqual)
  └─> src/lib/redis.ts (reuse existing Redis client)
  └─> src/lib/raas-key-generator.ts (for validation)

src/lib/raas-gate.ts (updated)
  └─> src/lib/raas-service.ts
  └─> src/lib/utils/logger-utility.ts (existing)

src/proxy.ts (no changes)
  └─> src/lib/raas-gate.ts (existing integration)
```

## Environment Variables Required

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RAAS_LICENSE_SECRET` | YES (prod) | - | 32-byte base64 key for HMAC |
| `RAAS_BYPASS_DEV` | NO | `false` | Dev bypass toggle |
| `RAAS_V1_FORMAT` | NO | `false` | Allow old format (migration) |
| `REDIS_URL` | NO | - | For nonce/revocation tracking |
| `RAAS_REDIS_TTL` | NO | `3600` | Nonce cache TTL (seconds) |

## Test Strategy

### Unit Tests (raas-service.test.ts)
```typescript
describe('parseLicenseKey', () => {
  it('should reject invalid format', () => {})
  it('should extract components from valid key', () => {})
})

describe('verifyHmac', () => {
  it('should return true for valid HMAC', () => {})
  it('should return false for tampered key', () => {})
  it('should resist timing attacks', () => {})
})

describe('checkExpiration', () => {
  it('should reject expired keys', () => {})
  it('should accept valid keys', () => {})
  it('should handle master tier (no expiration)', () => {})
})

describe('checkNonce', () => {
  it('should reject reused nonce', () => {})
  it('should cache new nonce', () => {})
})
```

### Integration Tests
```typescript
describe('raasGate middleware', () => {
  it('should allow valid HMAC key', async () => {})
  it('should block expired key', async () => {})
  it('should block replay attack (reused nonce)', async () => {})
  it('should block revoked key', async () => {})
  it('should bypass in dev mode', async () => {})
})
```

## Success Criteria ✅ MET

| Criterion | Target | Status | Verification |
|-----------|--------|--------|--------------|
| Build | ✅ 0 errors | PASSED | `npm run build` |
| Tests | ✅ 100% pass | PASSED | 80 tests passing |
| Coverage | ✅ 90% lines | PASSED | `npm run test:coverage` |
| Lint | ✅ 0 errors | PASSED | `npm run lint` |
| Security | ✅ No `:any` types | PASSED | `grep -r ": any" src` = 0 |
| Docs | ✅ Bilingual | PASSED | `docs/raas-license-gating.md` EN+VI |

## Completed Files Summary

| File | Status | Lines | Tests |
|------|--------|-------|-------|
| `src/lib/raas-service.ts` | ✅ Created | 299 | 48 tests |
| `src/lib/raas-service.test.ts` | ✅ Created | 479 | Unit tests |
| `src/lib/raas-key-generator.ts` | ✅ Created | 182 | 21 tests |
| `src/lib/raas-key-generator.test.ts` | ✅ Created | 227 | Unit tests |
| `src/lib/raas-gate.ts` | ✅ Modified | 259 | 11 tests |
| `src/lib/raas-gate.test.ts` | ✅ Existing | 173 | Integration tests |

## Test Results Summary

```
raas-service.test.ts:      48/48 tests PASSING
raas-key-generator.test.ts: 21/21 tests PASSING
raas-gate.test.ts:         11/11 tests PASSING
──────────────────────────────────────────────
TOTAL:                      80/80 tests PASSING (100%)
```

## Unresolved Questions (from Research Report)

| Question | Status | Decision Needed |
|----------|--------|-----------------|
| **Q1:** Multi-tier keys? | CLOSED | Single key per subscription per-tier |
| **Q2:** Nonce re-use detection | CLOSED | Redis required - graceful degradation if down |
| **Q3:** Master tier perpetual? | CLOSED | timestamp=0 (perpetual) |
| **Q4:** Selective route gating? | CLOSED | All `/api/*` routes (not tier-based) |
| **Q5:** Key rotation strategy | OPEN | Support `RAAS_LICENSE_SECRET_OLD` during rotation |

## References

- **Research Report:** `plans/reports/research-260306-0859-raas-license-gating.md`
- **Completed Code:** `src/lib/raas-service.ts`, `src/lib/raas-key-generator.ts`, `src/lib/raas-gate.ts`
- **Security Patterns:** `src/lib/security/webhook-signature-verification.ts`
- **Redis Client:** `src/lib/redis.ts` (reuse existing)
