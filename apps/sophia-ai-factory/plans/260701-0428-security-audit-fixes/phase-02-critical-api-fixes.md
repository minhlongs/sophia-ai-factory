# Phase 2 — Critical API Fixes

**Status:** pending | **Priority:** P0 | **Effort:** 3h

## Context
- Parent: [plan.md](plan.md)
- Source: [security-audit-report](../../reports/security-audit-260701-0428-full-codebase.md)

## Findings Addressed

| ID | Severity | File | Issue | Fix |
|----|----------|------|-------|-----|
| C2 | Critical | `src/forest/middleware/rate-limiter.ts` | Per-isolate in-memory bypass | Wire D1 `sql-rate-limiter.ts` in middleware |
| C3 | Critical | `src/forest/middleware/rate-limiter.ts:51-55` | MOCK_AI_SERVICES bypass | Remove bypass from production logic |
| C4 | Critical | `src/app/api/webhooks/amazon/route.ts:49-54` | Unsigned payloads when secret missing | Return 500 on missing secret |
| C4 | Critical | `src/app/api/webhooks/awin/route.ts:48-51` | Same | Same |
| C4 | Critical | `src/app/api/webhooks/accesstrade/route.ts:48-51` | Same | Same |
| M2 | Medium | `src/seed/security/cron-auth.ts:37` | Non-timing-safe === | Use `timingSafeEqual()` |
| M3 | Medium | `src/seed/security/cron-auth.ts:47-48` | CRON_SECRET in URL query | Remove query param auth |
| M6 | Medium | `src/seed/security/sql-rate-limiter.ts:75-84` | Same MOCK_AI bypass | Remove bypass |

## Key Files
- `src/forest/middleware/rate-limiter.ts` — replace in-memory with D1
- `src/seed/security/sql-rate-limiter.ts` — remove MOCK bypass
- `src/seed/security/cron-auth.ts` — timingSafeEqual + remove query auth
- `src/middleware/dashboard-pipeline.ts` — rate limiter wiring
- `src/app/api/webhooks/{amazon,awin,accesstrade}/route.ts` — missing secret = 500

## Success Criteria
- [ ] Rate limiter uses D1-backed store for auth endpoints
- [ ] `NEXT_PUBLIC_MOCK_AI_SERVICES` no longer bypasses production rate limiting
- [ ] Amazon/Awin/AccessTrade webhooks return 500 when secret not configured
- [ ] CRON_SECRET uses timing-safe comparison
- [ ] CRON_SECRET not accepted via ?token= query param
- [ ] All existing tests pass (rate limiter tests, cron auth tests)
- [ ] Build + type-check pass
