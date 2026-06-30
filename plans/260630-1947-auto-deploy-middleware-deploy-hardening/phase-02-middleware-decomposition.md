# Phase 02: Middleware Decomposition

**Priority:** P3 | **Effort:** 3-4h | **Status:** completed

## Context Links
- Parent: [plan.md](plan.md)
- Target file: `src/middleware.ts` (355 lines, 47 fix commits)
- Existing modules: `middleware-helpers.ts`, `middleware-api-handler.ts`, `middleware/sensitive-routes.ts`, `middleware/auth.ts`, `middleware/mfa.ts`, `middleware/cors.ts`, `middleware/request-size-limit.ts`

## Overview

Extract orchestration logic from `proxyImpl()` into focused handler modules. Each handler ≤100 lines, single responsibility. Current helpers already handle CSRF, CORS, auth, MFA — but orchestration (what calls what, in what order) is a 200-line block in `proxyImpl()`.

## Current State — proxyImpl() Sections

| Lines | Concern | Already Modular? |
|-------|---------|------------------|
| 63-70 | Internal/static short-circuit | ❌ inline |
| 73-77 | Unsupported locale redirect | ❌ inline |
| 79-100 | ?tab=signup redirect | ❌ inline |
| 102-105 | CORS preflight | ✅ `handleCorsPrelight()` |
| 107-122 | CSP nonce + CSRF check | ⚠️ partial |
| 125-196 | API route handling | ⚠️ partial (`handleApiRoute`) |
| 200-272 | Dashboard page routes | ❌ inline |
| 275-278 | Auth callback bypass | ❌ inline |
| 280-300 | Public page (intl + CSP) | ❌ inline |

## Requirements

### Functional
- Each handler is a separate file in `src/middleware/`
- Main `middleware.ts` becomes thin router: scan path → delegate to handler
- Zero behavior change — all existing redirects, headers, CSRF seeds preserved
- Existing 6525 tests continue to pass with zero modifications

### Non-Functional
- Each handler module ≤100 lines
- Import structure follows 4-layer rules
- No new dependencies

## Architecture

```
middleware.ts (thin router, ~60 lines)
  └── proxyImpl → route(pathname) →
       ├── static/internal → next()
       ├── unsupported locale → redirect
       ├── ?tab=signup → redirect
       ├── CORS preflight → handleCorsPrelight()
       ├── /api/* → middleware/api-pipeline.ts (new)
       │    ├── cron auth
       │    ├── size limit
       │    ├── handleApiRoute
       │    ├── auth guard
       │    └── MFA gate
       ├── /dashboard/* → middleware/dashboard-pipeline.ts (new)
       │    ├── requireAuth
       │    ├── MFA gate
       │    └── admin tier gate
       ├── /auth/callback → next()
       └── public pages → middleware/public-pipeline.ts (new)
            ├── intl redirect
            ├── CSP headers
            └── CSRF seed
```

## Related Code Files

| Action | File |
|--------|------|
| Modify | `src/middleware.ts` (thin to ~60 lines) |
| Create | `src/middleware/api-pipeline.ts` (~80 lines) |
| Create | `src/middleware/dashboard-pipeline.ts` (~80 lines) |
| Create | `src/middleware/public-pipeline.ts` (~60 lines) |
| Read | `src/middleware-helpers.ts` |
| Read | `src/middleware-api-handler.ts` |
| Read | `src/middleware/*.ts` (all existing modules) |

## Implementation Steps

1. Extract API pipeline → `src/middleware/api-pipeline.ts`
2. Extract dashboard pipeline → `src/middleware/dashboard-pipeline.ts`
3. Extract public page pipeline → `src/middleware/public-pipeline.ts`
4. Thin `proxyImpl()` to ~60-line router delegating to pipelines
5. Run full test suite (must be 0 regressions)
6. Run type-check + lint + build

## Todo List
- [x] Extract API pipeline handler
- [x] Extract dashboard pipeline handler
- [x] Extract public page pipeline handler
- [x] Thin proxyImpl to router
- [x] Verify: npm test (6525+ pass, 0 fail)
- [x] Verify: npm run build (0 errors)
- [x] Verify: npm run lint (0 errors)

## Success Criteria
- [x] middleware.ts 107 lines (116 after compression; proxyImpl router is ~45 lines)
- [x] Each pipeline module ≤ 100 lines (94, 99, 43)
- [x] 0 test regressions (6525 pass, same as before)
- [x] 0 build errors
- [x] All middleware behaviors preserved (verified by existing tests)

## Risk Assessment
| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Redirect loop regression | Medium | Existing tests cover redirect behavior |
| CSP header missing | Low | CSP test coverage exists |
| Import path breakage | Low | Follow existing barrel patterns |
| CI gate failure | Low | Same logic, just moved to modules |

## Next Steps
- After Phase 02 complete → code review → merge → monitor middleware error rate in production
