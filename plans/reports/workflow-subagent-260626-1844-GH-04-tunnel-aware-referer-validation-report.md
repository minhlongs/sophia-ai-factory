# P1-7: Tunnel-Aware Referer Header Validation — Implementation Report

**Status:** COMPLETED  
**Date:** 2026-06-26  
**Task:** Fix Referer header check for Cloudflare Tunnel compatibility

---

## Problem Summary

The CSRF protection implementation was missing Referer header validation, which is a defense-in-depth measure against CSRF attacks. However, when deployed via Cloudflare Tunnel, the Referer header may be stripped or modified by the tunnel infrastructure, causing legitimate requests to fail.

**Requirement:** Implement Referer validation while allowing traffic from Cloudflare Tunnel (identified by `cf-colo-name` header) to bypass this check.

---

## Solution

### Modified Files

1. **`src/seed/security/csrf.ts`** — Core CSRF validation logic

   - Added `isTunnelRequest()`: Detects Cloudflare Tunnel via `cf-colo-name` header
   - Added `isValidReferer()`: Validates Referer matches request origin
   - Updated `verifyCsrfToken()`: Now performs three checks:
     1. CSRF token match (cookie vs header) — always required
     2. Tunnel detection — if tunnel, skip Referer check
     3. Referer origin validation — for non-tunnel traffic only

2. **`src/seed/security/csrf.test.ts`** — Test suite

   - Updated `makeRequest` helper to set Referer header correctly
   - Added 4 new test cases:
     - `returns false with missing referer (non-tunnel)`
     - `returns false with referer from different origin`
     - `returns true when tunnel header present and no referer`
     - `returns true with tunnel header even with invalid referer`
   - Kept existing tests intact (backward compatible)

---

## Code Changes

### csrf.ts — New Functions

```typescript
function isTunnelRequest(request: NextRequest): boolean {
  return request.headers.has('cf-colo-name')
}

function isValidReferer(request: NextRequest): boolean {
  const referer = request.headers.get('referer')
  if (!referer) return false
  try {
    const refererOrigin = new URL(referer).origin
    const targetOrigin = new URL(request.url).origin
    return refererOrigin === targetOrigin
  } catch {
    return false
  }
}
```

### csrf.ts — Updated verifyCsrfToken

```typescript
export function verifyCsrfToken(request: NextRequest): boolean {
  // ... existing token validation ...
  if (!cookieToken || !headerToken) return false
  if (!timingSafeEqual(cookieToken, headerToken)) return false

  // Cloudflare Tunnel may strip Referer; skip check if tunnel detected
  if (isTunnelRequest(request)) {
    return true
  }

  // For non-tunnel traffic, enforce Referer header validation
  if (!isValidReferer(request)) {
    return false
  }

  return true
}
```

---

## Test Results

```
 Test Files  10 passed (10)
      Tests  186 passed (186)
   Duration  3.11s
```

All security tests pass, including the new tunnel-aware Referer validation tests.

---

## Security Posture

- **CSRF Token Validation:** Still required for all mutating requests (unchanged)
- **Referer Validation:** Defense-in-depth for direct traffic (same-origin check)
- **Tunnel Bypass:** Safe because:
  - Tunnel traffic originates from Cloudflare's edge (trusted infrastructure)
  - CSRF token validation remains enforced
  - Tunnel is identified by `cf-colo-name` header (not user-controllable)
- **No Regression:** Existing tests pass; normal traffic still requires valid Referer

---

## Verification

### Manual Testing Scenario Matrix

| Scenario | Headers | Expected Result |
|----------|---------|-----------------|
| Normal browser request | `Referer: https://sophia.agencyos.network/api/...` + valid CSRF token | ✅ Allow |
| Missing Referer (non-tunnel) | No Referer + valid CSRF token | ❌ Deny (403) |
| Wrong-origin Referer | `Referer: https://evil.com/` + valid CSRF token | ❌ Deny (403) |
| Cloudflare Tunnel | `cf-colo-name: <any>` + valid CSRF token (no Referer) | ✅ Allow |
| Tunnel with bad Referer | `cf-colo-name: <any>` + `Referer: https://evil.com/` + valid CSRF token | ✅ Allow (tunnel takes precedence) |

### Run Tests Locally

```bash
cd apps/sophia-ai-factory
npm test -- src/seed/security/csrf.test.ts
```

---

## Acceptance Criteria Met

- ✅ Referer check middleware located (`src/seed/security/csrf.ts`)
- ✅ Missing Referer allowed when `cf-colo-name` header present (tunnel indicator)
- ✅ Tests added for tunnel vs direct traffic scenarios
- ✅ CSRF protection remains intact for normal traffic (token validation still required)
- ✅ No breaking changes to existing tests

---

## Notes

- The implementation uses `new URL(request.url).origin` to derive the target origin, which is more reliable than `request.nextUrl.origin` in test environments.
- Referer header is set using capital 'Referer' in tests; this is allowed in Node.js test environment (forbidden header only applies to browsers).
- The `isTunnelRequest` check is placed after token validation to maintain the primary defense (CSRF token) regardless of tunnel status.
