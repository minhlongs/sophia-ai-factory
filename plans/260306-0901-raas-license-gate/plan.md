---
title: "ROIaaS PHASE 1 - License Key Gating Implementation"
description: "HMAC-SHA256 validation + timestamp expiration + nonce tracking for production-grade license gating"
status: in_progress
priority: P1
effort: 8h
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

### Phase 1: Core Validation Service (2h)
- **File:** `src/lib/raas-service.ts` (CREATE)
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
- **Success:** 100% unit test coverage (36 tests passing)

### Phase 2: Key Generator Utility (1h)
- **File:** `src/lib/raas-key-generator.ts` (CREATE)
- **Status:** COMPLETED
- **Dependencies:** Node.js `crypto` module
- **Tasks:**
  - [ ] `generateLicenseKey(tier, expiresAt)` - Create new key
  - [ ] `generateMasterKey(tier)` - Perpetual key (no expiration)
  - [ ] `revokeKey(key)` - Add to revocation set
- **Success:** CLI-testable utility

### Phase 3: Update raas-gate.ts (2h)
- **File:** `src/lib/raas-gate.ts` (MODIFY)
- **Changes:**
  - [ ] Replace `validateLicenseKey()` with `raas-service.ts` calls
  - [ ] Add `RAAS_LICENSE_SECRET` env var requirement
  - [ ] Add Redis connection for nonce/revocation checks
  - [ ] Preserve backward-compat: `RAAS_V1_FORMAT=true` fallback
- **Success:** All existing tests pass + new HMAC tests

### Phase 4: Middleware Integration (1h)
- **File:** `src/proxy.ts` (READ ONLY - already integrated)
- **Verification:**
  - [ ] Confirm `raasGate()` is called for all `/api/*` routes
  - [ ] Verify public routes excluded (health, setup, webhooks, auth)
  - [ ] Test tier extraction passed to route handlers
- **Success:** Manual test with valid/invalid keys

### Phase 5: Testing & Documentation (2h)
- **Files:** `src/lib/raas-gate.test.ts`, `docs/raas-license-gating.md`
- **Tasks:**
  - [ ] Add HMAC validation tests
  - [ ] Add expiration tests
  - [ ] Add nonce replay attack tests
  - [ ] Add revocation tests
  - [ ] Write admin guide (bilingual EN/VI)
- **Success:** `npm test` passes 100%, docs committed

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

## Success Criteria

| Criterion | Target | Verification |
|-----------|--------|--------------|
| Build | ✅ 0 errors | `npm run build` |
| Tests | ✅ 100% pass | `npm test` (25+ tests) |
| Coverage | ✅ 90% lines | `npm run test:coverage` |
| Lint | ✅ 0 errors | `npm run lint` |
| Security | ✅ No `:any` types | `grep -r ": any" src` |
| Docs | ✅ Bilingual | `docs/raas-license-gating.md` EN+VI |

## Unresolved Questions (từ Research Report)

| Question | Status | Decision Needed |
|----------|--------|-----------------|
| **Q1:** Multi-tier keys? | OPEN | Single key per subscription vs per-tier |
| **Q2:** Nonce re-use detection | PARTIAL | Redis required - graceful degradation if down? |
| **Q3:** Master tier perpetual? | OPEN | No expiration vs 100-year term |
| **Q4:** Selective route gating? | OPEN | All `/api/*` or tier-based routing |
| **Q5:** Key rotation strategy | OPEN | Support `RAAS_LICENSE_SECRET_OLD` during rotation |

## References

- **Research Report:** `plans/reports/research-260306-0859-raas-license-gating.md`
- **Existing Code:** `src/lib/raas-gate.ts` (209 lines), `src/lib/raas-gate.test.ts` (138 lines)
- **Security Patterns:** `src/lib/security/webhook-signature-verification.ts`
- **Redis Client:** `src/lib/redis.ts` (reuse existing)
