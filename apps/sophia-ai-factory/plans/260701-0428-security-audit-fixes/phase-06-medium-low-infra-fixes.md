# Phase 6 — Medium + Low Infra Fixes

**Status:** pending | **Priority:** P2 | **Effort:** 2h

## Context
- Parent: [plan.md](plan.md)
- Source: [security-audit-report](../../reports/security-audit-260701-0428-full-codebase.md)

## Findings Addressed

| ID | Severity | File | Issue | Fix |
|----|----------|------|-------|-----|
| M1 | Medium | `src/middleware/cors.ts:17-18` | CORS wildcard origin | Origin allowlist |
| M4 | Medium | `src/app/api/csp-report/route.ts:36-39` | CSP report logs PII | Strip document-uri, referrer |
| M5 | Medium | `src/app/api/health/route.ts:18` | Health leaks internal errors | Generic error to client |
| L1 | Low | `src/seed/security/content-security-policy-configuration.ts:31-33` | CSP unsafe-inline styles | Document risk acceptance |
| L2 | Low | `src/middleware.ts:56-63` | Missing security headers on errors | Add `applySecurityHeaders()` |
| L3 | Low | `src/seed/security/account-lockout.ts:81-84` | Lockout fails open | Return degraded state |
| L4 | Low | `.env.production.example:81-82` | Dead ADMIN_USER/ADMIN_PASS | Remove from example |
| L5 | Low | `src/seed/config/environment-config.ts:19-20` | Required UPSTASH Redis | Make optional |
| L6 | Low | `src/seed/cache/edge-cache.ts:105-108` | Vary header stripped | Preserve Vary: Origin |

## Key Files
- `src/middleware/cors.ts` — origin allowlist (M1, overlaps with Phase 4 M12)
- `src/app/api/csp-report/route.ts` — URL PII scrubbing (M4)
- `src/app/api/health/route.ts` — error sanitization (M5)
- `src/middleware.ts` — security headers on error responses (L2)
- `src/seed/security/account-lockout.ts` — degraded state (L3)
- `.env.production.example` — remove dead creds (L4)
- `src/seed/config/environment-config.ts` — optional Redis (L5)
- `src/seed/cache/edge-cache.ts` — Vary preservation (L6)

## Success Criteria
- [ ] CSP report scrubs URLs before logging
- [ ] Health endpoint returns generic error (no internal details)
- [ ] Security headers on all middleware error responses
- [ ] Account lockout returns degraded state on DB error (not open)
- [ ] No dead credentials in env examples
- [ ] UPSTASH Redis vars optional in Zod schema
- [ ] Edge cache preserves functional Vary headers
