---
title: "Phase 03 — Health + Version Endpoints"
description: "Harden health endpoint with structured component-level status checks; version endpoint unchanged."
status: TODO
priority: P1
effort: 2h
branch: main
tags: [health, version, observability, seams, probes]
created: 2026-08-16
---

# Phase 03 — Health + Version Endpoints

## Context Links

- Health route: `src/app/api/health/route.ts` (basic liveness, ~33 lines)
- Version route: `src/app/api/version/route.ts` (SHA verification, ~100 lines)
- HeyGen health check: `src/seed/health/heygen-health-check.ts` (KV-cached ping pattern)
- Uptime cron: `src/app/api/cron/uptime-check/route.ts` (5-min schedule, pings `/api/health`)
- Deploy verification: `.claude/rules/sophia-deploy-verify.md`
- Admin ops snapshot: `src/app/api/admin/ops/snapshot/route.ts` (reads HeyGen CB state)
- Dashboard indicator: `src/forest/components/dashboard/health-indicator.tsx` (fetches `/api/health`)

## Overview

**Priority:** P1
**Status:** TODO
**Description:** Strengthen the health endpoint with component-level status checks (DB, KV, circuit breaker) in a structured JSON response. The version endpoint remains unchanged. These seams serve as the foundation for deploy checklist verification (Phase 06) and BYOK audit health checks (Phase 04). The existing uptime-check cron already pings `/api/health` every 5 minutes.

## Key Insights

- **Current `/api/health`** (`src/app/api/health/route.ts`): basic worker liveness, returns `{ status, timestamp, environment }`. No component checks.
- **`/api/version`** already works well: public `shortSha`/`deployedAt`/`opennextVersion`, admin full payload behind `INTROSPECT_TOKEN`. No changes needed.
- **HeyGen health check** (`seed/health/heygen-health-check.ts`): pings HeyGen API, caches in KV (60s TTL), integrates with circuit breaker. Good pattern to generalize.
- **Uptime cron** (`cron/uptime-check/route.ts`): pings `/api/health` every 5 min, classifies as ok/degraded/down, records to D1, sends Telegram alerts. Will benefit from richer health response.
- **Admin ops snapshot** (`admin/ops/snapshot/route.ts`): reads HeyGen circuit state via `getCircuitState()`. Component status in health endpoint provides unified view.
- Middleware excludes `/api/health` and `/api/version` from auth/CORS/MFA (lines 198-202 of `middleware.ts`).
- Rate limit: `/api/health` matches health rate limit tier (`forest/middleware/rate-limit-config.ts:82`).

## Requirements

### Functional
1. `GET /api/health` returns structured JSON:
   ```json
   {
     "status": "healthy" | "degraded" | "unhealthy",
     "timestamp": "ISO-8601",
     "version": { "shortSha": "...", "deployedAt": "..." },
     "components": {
       "database": { "status": "ok", "latencyMs": 2 },
       "kv": { "status": "ok", "latencyMs": 1 },
       "circuitBreaker": { "status": "closed", "openServices": [] }
     }
   }
   ```
2. Public path: minimal response (status + timestamp + version only)
3. Deep path (with `HEALTH_TOKEN` bearer): full component details
4. Health endpoint response time < 200ms
5. No external API calls in health check (no-tech doctrine)
6. `GET /api/version` unchanged

### Non-functional
1. Health endpoint does not mutate state (GET only, idempotent)
2. No PII in health responses
3. Component checks are non-blocking — failure of one does not block others
4. Compatible with existing uptime-check cron (backward compatible response shape)

## Architecture

```
┌─────────────────────────────────────────────────┐
│  GET /api/health                                 │
│  ├── Public path: { status, timestamp, version } │
│  └── Deep path (HEALTH_TOKEN): + components      │
│      ├── DB: SELECT 1 (latency measurement)      │
│      ├── KV: GET circuit:probe (latency)          │
│      └── Circuit: aggregateState across services  │
├─────────────────────────────────────────────────┤
│  Component Probe Module (new)                    │
│  src/seed/health/component-probes.ts             │
│  ├── probeDatabase(): D1 SELECT 1               │
│  ├── probeKv(): KV GET test key                  │
│  └── probeCircuitBreaker(): aggregate states     │
├─────────────────────────────────────────────────┤
│  GET /api/version (unchanged)                    │
│  ├── Public: { shortSha, deployedAt, opennextV } │
│  └── Auth (INTROSPECT_TOKEN): + fullSha, branch  │
└─────────────────────────────────────────────────┘
```

**Data flow:**
- Entry: HTTP GET from deploy scripts, load balancers, uptime-check cron
- Transform: read-only probes against DB, KV, circuit state
- Exit: structured JSON with aggregate status

**Status aggregation logic:**
- All components OK → `"healthy"`
- Any component degraded → `"degraded"`
- Database unreachable → `"unhealthy"`

## Related Code Files

| File | Action | Notes |
|------|--------|-------|
| `src/app/api/health/route.ts` | Modify | Add component checks, structured response |
| `src/seed/health/component-probes.ts` | Create | Reusable probe functions |
| `src/app/api/version/route.ts` | Read-only | No changes needed |
| `src/seed/utils/circuit-breaker.ts` | Read-only | `getCircuitState()` for health |
| `src/seed/db/client.ts` | Read-only | DB probe query |

## Implementation Steps

1. Read current `/api/health` implementation (33 lines, basic liveness)
2. Create `src/seed/health/component-probes.ts` — reusable probe functions
3. Define `HealthResponse` and `ComponentStatus` TypeScript interfaces
4. Add DB probe: `SELECT 1` with latency measurement via D1
5. Add KV probe: lightweight GET with latency measurement
6. Add circuit breaker aggregate: `getCircuitState()` across all providers
7. Implement status aggregation: healthy/degraded/unhealthy logic
8. Gate component details behind `HEALTH_TOKEN` bearer
9. Add `Cache-Control: no-cache` header (health must be fresh)
10. Write tests: healthy response, degraded response, component failure isolation
11. Verify: `npm test` passes, `npm run type-check` clean

## Todo List

- [ ] Read current `/api/health` implementation
- [ ] Create `src/seed/health/component-probes.ts` — probe functions
- [ ] Define `HealthResponse` and `ComponentStatus` interfaces
- [ ] Add DB probe with latency measurement
- [ ] Add KV probe with latency measurement
- [ ] Add circuit breaker aggregate check
- [ ] Implement status aggregation logic (healthy/degraded/unhealthy)
- [ ] Gate component details behind `HEALTH_TOKEN`
- [ ] Add `Cache-Control: no-cache` header
- [ ] Write tests for health endpoint
- [ ] Write tests for component failure isolation
- [ ] Run `npm test` — all pass
- [ ] Run `npm run type-check` — clean

## Success Criteria

- `GET /api/health` returns structured JSON with `status`, `timestamp`, `version`, `components`
- Public path returns minimal response (no component details) — backward compatible with uptime-check cron
- Deep path with `HEALTH_TOKEN` returns full component status
- DB failure → `database.status = "error"`, overall status = `"unhealthy"`
- KV failure → `kv.status = "error"`, overall status = `"degraded"`
- Circuit breaker open → `circuitBreaker.status = "open"`, overall status = `"degraded"`
- Response time < 200ms
- All existing deploy verification steps still work

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| DB probe adds latency to health endpoint | Low | Low | `SELECT 1` is sub-ms on D1 |
| HEALTH_TOKEN not set in production | Medium | Low | Public path works without token; component details gracefully omitted |
| Circuit breaker state read fails | Low | Medium | Catch error, report `"unknown"` status, still return overall response |
| Uptime cron breaks on new response shape | Low | High | Public path shape is backward compatible |

## Security Considerations

- Health endpoint is publicly accessible (intended — used by deploy scripts, monitoring)
- Component details gated behind `HEALTH_TOKEN` to prevent information leakage
- No PII in any health response
- No mutation operations (GET only)
- `HEALTH_TOKEN` stored as Cloudflare Workers secret, not in code

## Next Steps

- Depends on: nothing (independent phase)
- Blocks: Phase 04 (BYOK audit uses health seam pattern), Phase 06 (deploy checklist verifies health)
- Follow-up: Add uptime tracking, historical health data in R2
