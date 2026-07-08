# Phase 5: OTel Production Rollout
> Status: pending | Priority: P1 | Parallel with Phase 4

## Context
OTel setup ready (Honeycomb config in wrangler.toml). `HONEYCOMB_API_KEY` secret not set. Zero production instrumented routes active.

## Requirements
1. Set `HONEYCOMB_API_KEY` via `wrangler secret put`
2. Add stage-aware dataset selection (`sophia-staging` vs `sophia-prod`)
3. Wire `instrumentRoute()` into 3-5 production API routes
4. Verify traces appear in Honeycomb within 60s

## Architecture
- **Stage detection:** Use `NODE_ENV` or CF environment binding to select dataset
- **Instrumentation:** Decorator/wrapper pattern on API route handlers — minimal code change per route
- **Sampling:** 0.02% in production (cost control), 100% in staging
- **Routes to instrument:** High-traffic API routes identified during scout

## Files to Modify
| File | Change |
|------|--------|
| `src/seed/telemetry/opentelemetry-setup.ts` | Add stage-aware dataset config |
| `wrangler.toml` / `wrangler.jsonc` | Add HONEYCOMB_API_KEY secret placeholder |
| 3-5 route files | Add `instrumentRoute()` wrapper to existing handlers |
| `.env.production.example` | Document HONEYCOMB_API_KEY requirement |

## Implementation Steps
1. Verify wrangler.toml Honeycomb config: endpoint, dataset, API version
2. Set secret: `wrangler secret put HONEYCOMB_API_KEY` (interactive)
3. Add stage detection: production vs staging → dataset name
4. Create `instrumentRoute()` helper: wraps handler, adds span, forwards request
5. Instrument 3-5 routes (start with highest-traffic: health, version, billing webhook)
6. Smoke test: deploy to staging, trigger route, verify trace in Honeycomb within 60s

## Out of Scope
- Custom span attributes per route (use defaults + standard attributes)
- Trace sampling rate changes (keep 0.02%)
- Sentry removal (dual-sampling intentional per existing decision)
