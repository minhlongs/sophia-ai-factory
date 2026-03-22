---
phase: 5
title: "Production Monitoring"
priority: P2
status: pending
effort: 2h
---

# Phase 5 — Production Monitoring

## Context Links
- [Deployment Architecture](../../docs/system-architecture.md) — "Monitoring & Observability" section
- [Sentry Configs](../../sentry.server.config.ts)

## Overview

Add CF Analytics integration, `/api/health` endpoint, basic error tracking dashboard. Replace Vercel-centric monitoring with Cloudflare-native tools.

## Key Insights

- Sentry configs exist but have `any` types (Phase 1 fixes types)
- Current monitoring: console errors only, no structured tracking
- Cloudflare provides: Workers Analytics Engine, Web Analytics, D1 metrics
- Health endpoint needed for uptime monitoring (UptimeRobot, Pingdom, etc.)

## Requirements

### Functional
- `GET /api/health` — returns system status (DB connectivity, service versions)
- CF Web Analytics snippet on all pages
- Error tracking via Sentry (already partially configured)
- `/dashboard/health` page showing system status

### Non-functional
- Health endpoint < 200ms response time
- No external service dependency for basic health check
- Sentry DSN via env var (not hardcoded)

## Related Code Files

### Files to modify
- `sentry.server.config.ts` — fix types, verify DSN config
- `sentry.client.config.ts` — fix types, add performance monitoring
- `app/layout.tsx` — add CF Web Analytics script

### Files to create
- `app/api/health/route.ts` — health check endpoint
- `app/(dashboard)/health/page.tsx` — health dashboard page
- `lib/monitoring/health-checker.ts` — D1 ping, service status checks

## Implementation Steps

1. Create `app/api/health/route.ts`:
   - Check D1 connectivity (`SELECT 1`)
   - Return `{ status: 'ok', version, uptime, db: 'connected', timestamp }`
   - Return 503 if DB unreachable
2. Create `lib/monitoring/health-checker.ts`:
   - `checkD1()` — ping D1 with simple query
   - `getSystemStatus()` — aggregate all checks
3. Fix Sentry configs (types from Phase 1):
   - Enable performance monitoring (`tracesSampleRate`)
   - Configure error boundaries
4. Add CF Web Analytics:
   - Get beacon token from CF dashboard
   - Add `<script>` to `app/layout.tsx`
5. Create health dashboard page:
   - Show D1 status, last mission count, API key count
   - Auto-refresh every 30s

## Todo List

- [ ] Create `/api/health` endpoint
- [ ] Create health checker module
- [ ] Fix Sentry configs
- [ ] Add CF Web Analytics script
- [ ] Create health dashboard page
- [ ] Write health endpoint tests

## Success Criteria

- `curl /api/health` returns 200 with JSON status
- Sentry captures errors in production
- CF Web Analytics tracking page views
- Health dashboard shows live system status

## Risk Assessment

- **D1 cold start on health check** — keep query simple (`SELECT 1`)
- **Sentry bundle size** — use `@sentry/nextjs` tree-shaking
