# Phase 4 — High Auth Fixes

**Status:** pending | **Priority:** P1 | **Effort:** 3h

## Context
- Parent: [plan.md](plan.md)
- Source: [security-audit-report](../../reports/security-audit-260701-0428-full-codebase.md)

## Findings Addressed

| ID | Severity | File | Issue | Fix |
|----|----------|------|-------|-----|
| H1 | High | `src/seed/auth/mfa/login-challenge.ts:17,52-64,92-93` | MFA pending expires 10min, session 7 days | Match session TTL to MFA TTL |
| H2 | High | `src/app/api/auth/admin-challenge/route.ts:128,143` | Reads `totp_secret` instead of `totp_secret_enc` | Decrypt before verify |
| H3 | High | 29 admin route files | Session role check instead of DB | Replace with `requireAdmin()` |
| M10 | Medium | `src/seed/auth/better-auth-server.ts:63-75` | No password complexity | Add password policy config |
| M11 | Medium | `src/app/api/auth/logout/route.ts:13-18` | No server-side session invalidation | Call `auth.api.revokeSession()` |
| M12 | Medium | `src/middleware/cors.ts:17-18,37-38` | CORS reflects any origin | Add origin allowlist |

## Key Files
- `src/seed/auth/mfa/login-challenge.ts` — session invalidation on MFA expiry (H1)
- `src/app/api/auth/admin-challenge/route.ts` — fix column read (H2)
- `src/seed/auth/better-auth-server.ts` — password policy (M10)
- `src/app/api/auth/logout/route.ts` — session revocation (M11)
- `src/middleware/cors.ts` — origin allowlist (M12)
- 29 admin routes in `src/app/api/admin/*/route.ts` (H3)

## Success Criteria
- [ ] MFA pending expiry invalidates the session (can't wait 10min to bypass)
- [ ] Admin MFA challenge works with encrypted totp_secret_enc
- [ ] All 29 admin routes use `requireAdmin()` (DB check) not session role
- [ ] Password policy enforced: min 8 chars, uppercase, lowercase, number
- [ ] Logout invalidates session server-side (not just client cookies)
- [ ] CORS has origin allowlist (not wildcard reflect)
- [ ] Existing auth tests pass
