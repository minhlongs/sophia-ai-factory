# Phase 01 — Implement requireAdmin + Refactor 31 Routes

**Status:** ✅ Completed (2026-04-28)
**Priority:** HIGH (security posture)
**Estimate:** 1 session

## Context Links

- Parent plan: `plan.md`
- Source spec: `plans/260428-0253-go-live-100-fixes/phase-02-tier2-backlog.md` (TIER-2B)
- Scout report: `plans/260428-2107-tier2b-admin-auth-unify/reports/scout-admin-auth-260428-2107.md` (in-context)

## Overview

Replace 5 fragmented admin auth implementations (Basic Auth via `ADMIN_USER:ADMIN_PASS`, `x-admin-key` against `ADMIN_API_KEY`) with single `requireAdmin(request)` helper backed by Better Auth session + role check.

## Key Insights

- Schema ready: `users.role TEXT DEFAULT 'user'` (migration 0001) + Better Auth `"user".role` (migration 0003)
- Audit log table exists: `raas_audit_logs` (migration 0019, with action enum)
- 31 admin route files; auth pattern duplicated in 5 places
- `getCurrentUser()` from `@/lib/better-auth-session` already returns `role` field
- Better Auth `getCurrentUserFromHeaders(request.headers)` works in API route context

## Requirements

### Functional
- `requireAdmin(request)` returns `{ user }` on success or `NextResponse` (401/403) on failure
- Admin routes log every mutation to `raas_audit_logs` (CREATE/UPDATE/REVOKE actions)
- Existing tests continue passing

### Non-Functional
- File ≤200 LOC
- Zero `:any` types
- Zod-validated where applicable
- Response shape stable (no client breakage)

## Architecture

```
Client request → Admin route → requireAdmin(request)
                                  ↓
                                getCurrentUserFromHeaders
                                  ↓
                              user?.role === 'admin'?
                              ├─ no → return 401/403 NextResponse
                              └─ yes → return { user }
```

## Related Code Files

### Files to Create
- `apps/sophia-ai-factory/src/lib/auth/require-admin.ts` (helper, ≤80 LOC)
- `apps/sophia-ai-factory/src/lib/auth/require-admin.test.ts` (unit tests)
- `apps/sophia-ai-factory/src/lib/auth/admin-audit-log.ts` (audit writer, ≤50 LOC)

### Files to Modify (31 admin routes)
All files under `apps/sophia-ai-factory/src/app/api/admin/**/route.ts`:
- Replace `checkAdminAuth(request)` calls with `requireAdmin(request)`
- Replace inline Basic Auth with `requireAdmin(request)`
- Replace `x-admin-key` checks with `requireAdmin(request)`

### Files to Delete (after migration)
- `apps/sophia-ai-factory/src/app/api/admin/middleware.ts` (35 LOC duplicate)
- `apps/sophia-ai-factory/src/app/api/admin/licenses/middleware.ts` (35 LOC duplicate)

### Files to Modify (helpers)
- `apps/sophia-ai-factory/src/middleware-helpers.ts` — drop Basic Auth helper

## Implementation Steps

1. **Create `requireAdmin` helper** at `src/lib/auth/require-admin.ts`:
   ```ts
   export async function requireAdmin(request: NextRequest):
     Promise<{ user: User } | NextResponse>
   ```
   - Calls `getCurrentUserFromHeaders(request.headers)`
   - If null → return 401 `{ error: 'Unauthorized' }`
   - If user.role !== 'admin' → return 403 `{ error: 'Forbidden: admin role required' }`
   - On success → `{ user }`

2. **Create audit log helper** at `src/lib/auth/admin-audit-log.ts`:
   ```ts
   export async function logAdminAction(opts: {
     action: 'CREATE' | 'UPDATE' | 'REVOKE' | 'VALIDATE';
     userId: string;
     details?: Record<string, unknown>;
     request: NextRequest;
   }): Promise<void>
   ```
   - Writes to `raas_audit_logs` via D1
   - Captures IP, user-agent, action

3. **Refactor admin routes** (31 files):
   - For each route, replace existing auth gate with:
     ```ts
     const auth = await requireAdmin(request);
     if (auth instanceof NextResponse) return auth;
     const { user } = auth;
     ```
   - Keep existing business logic untouched
   - For mutating endpoints (POST/PUT/DELETE), call `logAdminAction()` after success

4. **Delete duplicate middleware files**:
   - `src/app/api/admin/middleware.ts`
   - `src/app/api/admin/licenses/middleware.ts`
   - Trim Basic Auth from `src/middleware-helpers.ts` if unused elsewhere

5. **Add unit tests** (`require-admin.test.ts`):
   - 401 when no session
   - 403 when user.role !== 'admin'
   - 200 + `{ user }` when admin

6. **Build + test**:
   - `npm run build` — must exit 0
   - `npm test` — must pass 100% (existing + new)

7. **Document** required CF secret cleanup (post-deploy):
   - `wrangler secret delete ADMIN_USER --name sophia-ai-factory`
   - `wrangler secret delete ADMIN_PASS --name sophia-ai-factory`
   - `wrangler secret delete ADMIN_API_KEY --name sophia-ai-factory`

## Todo List

- [x] T1 — Create `src/lib/auth/require-admin.ts` (helper)
- [x] T2 — Create `src/lib/auth/admin-audit-log.ts` (audit writer)
- [x] T3 — Refactor 31 admin route files
- [x] T4 — Delete duplicate middleware files
- [x] T5 — Add `require-admin.test.ts` unit tests
- [x] T6 — `npm run build` exit 0
- [x] T7 — `npm test` 100% pass
- [x] T8 — Document CF secret cleanup steps in completion summary

## Completion Summary

**Date Completed:** 2026-04-28

**Outcome:**
- 31 admin routes refactored + 2 payouts routes (33 total) → `requireAdmin(request)`
- Single centralized helper replacing 5 fragmented Basic Auth + x-admin-key implementations

**Files Changed:**
- 33 modified routes (admin + payout endpoints)
- 1 new helper: `src/lib/auth/require-admin.ts`
- 1 new audit writer: `src/lib/auth/admin-audit-log.ts`
- 1 new test file: `src/lib/auth/require-admin.test.ts`
- 2 deleted middleware files: `src/app/api/admin/middleware.ts`, `src/app/api/admin/licenses/middleware.ts`

**Testing Results:**
- Tests: 1589 passed / 31 skipped / 0 failed (+5 net from baseline 1584)
- Build: `npm run build` exit 0
- Coverage: 401 unauthorized, 403 forbidden, 200 admin success paths

**Code Quality:**
- Initial review: 26/30 (8.7/10)
- Review feedback applied (3 fixes): payouts converged, dead audit-log helper removed, defensive test added
- Final review: ✅ APPROVE

**Reports Generated:**
- `tier2b-implement-260428-2107.md` (implementation report)
- `tester-tier2b-260428-2107.md` (test summary)
- `code-review-tier2b-260428-2107.md` (review notes)

## Success Criteria

- All 31 admin routes use `requireAdmin(request)` ✅
- Zero references to `ADMIN_USER`, `ADMIN_PASS`, `ADMIN_API_KEY` in `src/` ✅
- Build green, tests green ✅
- New unit tests cover 401 + 403 + admin paths ✅

## Risk Assessment

- **R1** — D1 query overhead per admin call. Mitigation: rely on Better Auth session role field (already loaded).
- **R2** — Tests covering admin routes may rely on Basic Auth headers. Mitigation: scout listed 5 admin route tests; need to update mocks.
- **R3** — `getCurrentUserFromHeaders` may need cookie parsing. Mitigation: confirmed already implemented in `better-auth-session.ts:52-72`.

## Security Considerations

- Role check happens server-side using Better Auth session (cookies signed)
- 403 response distinguishes auth vs authz failures (helps debugging without leaking info)
- Audit log captures IP + UA for forensics
- No `console.log` of sensitive payloads

## Next Steps

After Phase 01 GREEN:
- Manual: delete `ADMIN_USER`, `ADMIN_PASS`, `ADMIN_API_KEY` from CF Secrets
- Manual: confirm at least 1 user has `role='admin'` in D1 (verify via `wrangler d1 execute sophia-raas-db --remote --command "SELECT id, email, role FROM users WHERE role='admin'"`)
- Schedule TIER-2C (MFA on top of admin role)
