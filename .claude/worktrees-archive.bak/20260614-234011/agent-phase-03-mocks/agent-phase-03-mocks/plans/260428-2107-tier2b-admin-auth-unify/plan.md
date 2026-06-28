# Plan — TIER-2B Admin Auth Unification

**Date:** 2026-04-28 21:07
**Source phase:** `plans/260428-0253-go-live-100-fixes/phase-02-tier2-backlog.md` (TIER-2B)
**Goal:** Replace 5 fragmented admin auth implementations with single `requireAdmin(request)` helper.

## Phase Map

| Phase | Title | Status | Notes |
|-------|-------|--------|-------|
| 01 | Implement requireAdmin + refactor 31 routes | ✅ Completed (2026-04-28) | Single sprint |

## Context

- Audit: composite 67/100 → ~80/100 after Tier-1; this phase pushes to ~83/100
- Scout report: 31 admin routes; 5 duplicate Basic Auth implementations + 3 `x-admin-key` routes
- Better Auth `user.role` field already exists; `users.role` D1 column already exists (migration 0001)
- No new migration required — schema already supports role-based authz
- Audit log table `raas_audit_logs` already exists (migration 0019)

## Phase 01 — Unification (this session)

**Estimate:** 1 session, single agent (parallel sub-edits).

**Scope:**
- Build `src/lib/auth/require-admin.ts` — single helper returning `{ user } | NextResponse`
- Refactor all 31 admin routes to use `requireAdmin(request)`
- Delete 5 duplicate Basic Auth implementations
- Add audit log writer helper for admin mutations
- Mark `ADMIN_USER`, `ADMIN_PASS`, `ADMIN_API_KEY` for removal from CF secrets (post-deploy)
- Add unit tests for requireAdmin (401 unauth, 403 non-admin, 200 admin)

**Files:** see `phase-01-implement-require-admin.md`.

## Key Dependencies

- Better Auth v1.6.2 (`getCurrentUser` from `@/lib/better-auth-session`)
- D1 binding `DB` (sync `createServerClient()`)
- `users.role` and Better Auth `"user".role` columns (existing)

## Success Criteria

- Single `requireAdmin` import path used by all 31 admin routes
- Zero references to `ADMIN_USER`, `ADMIN_PASS`, `ADMIN_API_KEY` in `src/`
- `npm run build` exit 0
- `npm test` 100% pass (existing 1584+ + new requireAdmin coverage)
- Production verified GREEN with admin routes returning 401/403 for unauth/non-admin
- At least 1 admin user seeded with `role='admin'` (manual SQL or migration seed)

## Risk Assessment

- **R1** — Production may have existing admin sessions using Basic Auth scripts. After deploy, those break. Mitigation: ensure 1 user has `role='admin'` in D1 before deploy.
- **R2** — Better Auth `"user".role` may not auto-populate from `users.role` on signup. Mitigation: requireAdmin checks both via session.user.role.
- **R3** — `x-admin-key` callers (cron scripts) break. Mitigation: those scripts already deprecated; quota admin routes used only via UI.

## Next Steps

After Phase 01 GREEN: schedule TIER-2C (MFA), TIER-2D (Sentry), TIER-2A (TS cleanup).
