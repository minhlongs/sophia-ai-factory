# M1/M2 Pentest Remediation Report

**Date:** 2026-05-18
**Phase:** Phase 05b pentest MEDIUM findings

## Files Changed/Created

| File | Action |
|------|--------|
| `src/app/api/promo/validate/route.ts` | Modified — added inner try/catch around `request.json()` → 400 on malformed |
| `src/app/api/promo/redeem-free/route.ts` | Modified — same pattern |
| `src/app/api/admin/promo-codes/route.ts` | Created — GET→404, POST/PUT/DELETE/PATCH→405 |
| `src/security-tests/m1-malformed-json.test.ts` | Created — 7 regression tests |
| `src/security-tests/m2-admin-promo-bare-path.test.ts` | Created — 5 regression tests |

## Test Pass Count

- `m1-malformed-json.test.ts`: 7/7 pass
- `m2-admin-promo-bare-path.test.ts`: 5/5 pass
- **Total new tests: 10/10**

## Local Verification

- TypeCheck (`pnpm tsc --noEmit`): 0 errors
- Lint: 341/341 warnings (at cap, 0 errors)
- Tests: 10/10 pass

## Staging Redeploy

- Deploy SHA: `bcb05e7e` (matches local HEAD)
- Version ID: `c0639404-fb72-4cc5-96cb-f0015a5c1378`

## Live Verify

### M1 — `/api/promo/validate` malformed JSON
```
POST {not json → HTTP 400 {"error":"invalid_json"}
```
Status: FIXED (was 500, now 400)

### M2 — `/api/admin/promo-codes` bare path
```
GET /api/admin/promo-codes → HTTP 404 {"error":"not_found"}
```
Status: FIXED (was HTML fall-through, now 404 JSON)

## Doctrine Impact

- ASVS L2 V5.1.1 strengthened: all `/api/promo/*` routes now guard malformed JSON at parse boundary.
- Layer 6 Security score remains **9/10** — these were MEDIUM findings, not ceiling-changers.
- No new `:any` types in production code. No new lint warnings.
