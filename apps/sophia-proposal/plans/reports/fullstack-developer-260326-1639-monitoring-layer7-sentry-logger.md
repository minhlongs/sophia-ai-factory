# Phase Implementation Report

## Executed Phase
- Phase: monitoring-layer7-sentry-structured-logging
- Plan: none (direct task)
- Status: completed

## Files Modified

| File | Action | Notes |
|------|--------|-------|
| `sentry.client.config.ts` | created | Browser error tracking, no-op if DSN not set |
| `sentry.server.config.ts` | created | Server/API route error tracking |
| `sentry.edge.config.ts` | created | CF Workers / middleware error tracking |
| `lib/logger.ts` | created | Structured JSON logger, 4 levels, ~80 lines |
| `app/api/admin/provision/route.ts` | modified | console.error → logger.error with context |
| `app/api/onboarding/route.ts` | modified | console.error → logger.error with context |
| `middleware.ts` | modified | console.error → logger.error with path+method context |

## Tasks Completed
- [x] Installed @sentry/nextjs (--legacy-peer-deps)
- [x] Created sentry.client.config.ts — guarded by NEXT_PUBLIC_SENTRY_DSN check
- [x] Created sentry.server.config.ts — guarded by NEXT_PUBLIC_SENTRY_DSN check
- [x] Created sentry.edge.config.ts — guarded by NEXT_PUBLIC_SENTRY_DSN check
- [x] Created lib/logger.ts — JSON structured logger wrapping console methods
- [x] Replaced console.error in app/api/admin/provision/route.ts
- [x] Replaced console.error in app/api/onboarding/route.ts
- [x] Replaced console.error in middleware.ts
- [x] Build verified: npx next build — pass, 0 errors

## Tests Status
- Type check: pass (build succeeded with 0 TS errors)
- Build: pass (Next.js 15.5 — all routes compiled)
- Unit tests: not modified (no existing logger tests; logger is a pure utility)

## Implementation Notes

### Sentry Config Strategy
- **Not** wrapping next.config.js with `withSentryConfig` — intentional to avoid
  opennextjs-cloudflare build issues
- Three separate runtime files (client / server / edge) per Sentry SDK conventions
- Sentry init is completely silent (no-op) unless `NEXT_PUBLIC_SENTRY_DSN` is set
  AND is not the placeholder `https://placeholder@sentry.io/0`
- Client sets their real DSN in Cloudflare env vars — zero code change required

### Logger Format
```json
{
  "timestamp": "2026-03-26T16:39:00.000Z",
  "level": "error",
  "message": "POST /api/onboarding error",
  "context": { "path": "/api/onboarding", "method": "POST" },
  "error": { "name": "Error", "message": "...", "stack": "..." }
}
```

### Monitoring Score Impact
- Before: 5/10 (no error tracking, unstructured logging, no alerting)
- After: ~7.5/10
  - Sentry SDK ready (DSN plug-in) +1.5
  - Structured JSON logging +1
  - Request context on errors +0.5
  - Still missing: Sentry source maps upload, Vercel Analytics, uptime alerting

## Issues Encountered
None — build clean on first attempt. Middleware size increased to 37.2 kB due to
logger import; acceptable for CF Workers (limit 1 MB).

## Next Steps
To reach full 8/10 on Layer 7:
1. Set `NEXT_PUBLIC_SENTRY_DSN` in Cloudflare/Vercel env vars with real DSN
2. Add Vercel Analytics or Cloudflare Analytics for APM (free tier available)
3. Configure uptime monitor (Better Uptime / Cloudflare Health Checks) for /api/health
4. Upload source maps to Sentry via CI (sentry-cli after build)

## Unresolved Questions
- Should logger.debug calls be suppressed in CF Workers (edge) even in development?
  Currently debug is suppressed in NODE_ENV=production only — CF Workers always set
  NODE_ENV=production so debug is already silenced at edge.
- Should we replace console.error in all 72 files or only key API routes as specified?
  Currently replaced only the 3 specified files per task scope (YAGNI).
