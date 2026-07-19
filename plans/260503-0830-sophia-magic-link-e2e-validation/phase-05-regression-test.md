# Phase 05 — Regression Test (Vitest integration)

## Context Links
- Existing test pattern: `apps/sophia-ai-factory/src/lib/handover/__tests__/handover-magic-link.test.ts`
- Validate route: `apps/sophia-ai-factory/src/app/api/welcome/validate/[token]/route.ts`
- Cookie signer: `src/lib/auth/sign-cookie-value.ts`
- Better-auth server: `src/lib/better-auth-server.ts`

## Overview
- Priority: P1
- Status: pending
- Description: Add a deterministic Vitest integration test that exercises the `/api/welcome/validate/[token]` POST handler end-to-end with mocked D1 + mocked Better Auth `internalAdapter`, asserting the Set-Cookie name matches what setup-wizard layout will read.

## Key Insights
- True E2E (with real PROD) is owned by Phase 02 (one-shot manual). Regression test must be CI-friendly = deterministic, no network, fast (<1s).
- The bug class to lock in: cookie NAME divergence between issuer (`route.ts`) and reader (Better Auth `getSession`). A snapshot-style assertion on the exact `Set-Cookie` header string catches re-introduction.
- Existing `handover-magic-link.test.ts` already mocks `getD1Raw` cleanly — copy that pattern.

## Requirements
**Functional**
- Test 1: POST `/api/welcome/validate/[token]` with valid token mints a `Set-Cookie` header containing `__Secure-better-auth.session_token=...; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=...`
- Test 2: When `NODE_ENV='development'`, cookie name is `better-auth.session_token` (no `__Secure-` prefix) AND no `Secure` attribute
- Test 3: Cookie value is a HMAC-signed `${sessionToken}.${signature}` (per `signCookieValue`)
- Test 4: When `BETTER_AUTH_SECRET` missing → no Set-Cookie header (logs error, does not throw)
- Test 5: When `internalAdapter.createSession` returns null → response has `success: true` but no Set-Cookie (sad-path, user redirected to /login on next nav — acceptable degradation)

**Non-functional**
- Zero `:any` types
- Zero network — all D1 + Better Auth mocked
- Runs in `<1s`
- File: `src/app/api/welcome/validate/[token]/__tests__/route.test.ts`

## Architecture
```
Test setup:
  vi.mock('@/lib/db/client') → fake D1 returning seeded handover row
  vi.mock('@/lib/better-auth-server') → fake auth.$context.internalAdapter.createSession()
  vi.mock('@/lib/utils/logger-utility') → spy on warn/error
  vi.stubEnv('NODE_ENV', 'production' | 'development')
  vi.stubEnv('BETTER_AUTH_SECRET', 'test-secret-32-bytes-min-for-hmac')

Each test:
  Build NextRequest with token route param
  Call POST(request, { params: Promise.resolve({ token }) })
  Assert response status, body, headers['set-cookie']
```

## Related Code Files
**To create**
- `apps/sophia-ai-factory/src/app/api/welcome/validate/[token]/__tests__/route.test.ts`

**To inspect (read-only)**
- `route.ts` lines 138-186 (cookie minting logic)
- `sign-cookie-value.ts` (signature format)
- `handover-magic-link.test.ts` (mock pattern reference)

## Implementation Steps
1. Read `handover-magic-link.test.ts` for mock pattern
2. Stub `validateMagicLinkToken` to return a fake handover row matching `CustomerHandoverRow`
3. Stub `consumeMagicLink` as no-op
4. Stub `getAuth().$context.internalAdapter.createSession` to return `{ token: 'fake-session-tok', expiresAt: new Date(Date.now()+86400_000) }`
5. Stub `writeAuditLog` as no-op
6. Stub `checkRateLimit` to return null (pass-through)
7. Build helper `buildRequest(token: string): NextRequest`
8. Test 1 (production): assert Set-Cookie regex `^__Secure-better-auth\.session_token=[^;]+; Path=/; Secure; HttpOnly; SameSite=Lax; Expires=[^;]+$` and that cookie value matches `^.+\..+$` (signed format)
9. Test 2 (development): set `NODE_ENV='development'`, assert NO `__Secure-` prefix, NO `Secure` attribute
10. Test 3: extract cookie value, verify it = `signCookieValue('fake-session-tok', secret)` exactly
11. Test 4 (no secret): `vi.stubEnv('BETTER_AUTH_SECRET', '')`, assert no Set-Cookie + logger.error called with `Missing BETTER_AUTH_SECRET`
12. Test 5 (createSession null): make `createSession` resolve null, assert no Set-Cookie + logger.warn called with `Session not created`
13. Run `npm test -- route.test.ts` — all 5 pass
14. Run full suite: `npm test` — no regressions

## Todo List
- [x] Read existing mock pattern from `handover-magic-link.test.ts`
- [x] Scaffold test file with imports + mocks
- [x] Implement Test 1 (prod cookie name) ✅
- [x] Implement Test 2 (dev cookie name) ✅
- [x] Implement Test 3 (signed value format) ✅
- [x] Implement Test 4 (missing secret) ✅
- [x] Implement Test 5 (null session) ✅
- [x] Run isolated: `npm test -- --run welcome/validate` → 5/5 pass
- [x] Run full suite: `npm test` → 2472/2472 pass, 31 skipped, no regressions
- [x] Committed in phase commit

## Success Criteria
- All 5 tests pass deterministically
- File <200 lines (per project rule)
- Zero `:any` types
- Zero network calls
- Full suite (`npm test`) passes (844+ tests still GREEN)
- Test runs in <1s

## Risk Assessment
- **R1:** Better Auth `$context` shape changes between minor versions → mitigation: type cast at the mock boundary; document the shape assumption with a code comment linking to `route.ts:70-79`
- **R2:** `vi.stubEnv` doesn't propagate to dynamic imports → mitigation: stub BEFORE importing the route module, or use `vi.resetModules()` between tests
- **R3:** Cookie attribute order might vary across Next.js versions → mitigation: assert via parsed cookie object (split on `; `), not raw regex on string

## Security Considerations
- Mock secret is non-real (`test-secret-32-bytes-min-for-hmac`)
- No real PII in test fixtures

## Next Steps
- Phase 06 documents the test as the regression-prevention artifact
- If Phase 02 fails: still implement Phase 05 (test will protect future fix from regression)
