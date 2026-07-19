# Wave 9 Cook Report — Performance & Cost Optimization

**Date:** 2026-05-09 04:21 UTC  
**Phase:** Performance/Cost Focus (F-PC-1 through F-PC-6)  
**Status:** SHIPPED ✅

---

## 6 Fixes Deployed

| ID | Priority | Fix | Impact |
|----|----------|-----|--------|
| F-PC-1 | P0 | Public pages gain `export const revalidate = 60` (ISR) | Full Worker invocation → edge cache (was no-store) |
| F-PC-2 | P1 | publishTokenRefreshCron `*/30` → `0 * * * *` (hourly) | 50% Inngest step reduction |
| F-PC-3 | P1 | wrangler.toml uptime-check cron `*/5` → `*/15` | 3× binding ops reduction |
| F-PC-4 | P1 | Dashboard uses `nextDynamic()` for OnboardingTourModal, MasterWelcomeBanner | On-demand lazy-load heavy widgets |
| F-PC-5 | P2 | telegram webhook console.warn → logger.warn (structured) | Workers Logs sampling enabled |
| F-PC-6 | P1 | Sentry: tracesSampleRate 0.1→0.02 (client), 0.1→0.05 (server); replaysSampleRate 0.1→0.01 | 5-10× transaction burn reduction |

---

## Verification

✅ **TypeScript:** 0 errors  
✅ **Tests:** 2810/2810 passed (no regression)  
✅ **i18n Validation:** clean (no orphaned keys)  
✅ **Bundle Check:** no size regression  

---

## Cost Estimate (Q2 2026)

- Inngest: ~50% monthly step reduction
- Cloudflare Workers binding ops: ~3× reduction (uptime-check)
- Sentry: ~5-10× transaction burn reduction
- **Net:** Estimated 40-50% cost floor on observability + cron spend

---

## Deferred to Phase 2

F-PC-7 through F-PC-12:
- OpenNext server-functions/ 159MB pre-bundle audit
- Missing composite indexes (EXPLAIN QUERY PLAN)
- `/api/health` Cache-Control headers
- KV writes in middleware-path (emitUsageEvent)
- Sentry double-init consolidation
- status_checks unbounded retention purge

---

## Git Status

All changes committed. CI/CD GREEN. Production deployed via Cloudflare Workers.
