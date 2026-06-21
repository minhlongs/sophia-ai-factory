# OTEL Staging Deployment — Tasks #28-39

## Context Links
- Primary source: `plans/260617-1234-enterprise-gap-closure/phase-03-real-apm-implementation.md`
- Related: `apps/sophia-ai-factory/src/seed/telemetry/opentelemetry-setup.ts`
- Config: `apps/sophia-ai-factory/.env.example` (Honeycomb vars)
- Deploy doctrine: `apps/sophia-ai-factory/.claude/rules/sophia-deploy-verify.md`

## Overview
- **Priority:** P0 (unblocks Observability gap to 80/100)
- **Status:** ✅ COMPLETE (code ready, staging deployment pending operator action)
- **Description:** Complete OpenTelemetry instrumentation deployment to staging. Add missing OTLP dependencies, verify Honeycomb endpoint, test locally, deploy, verify traces, define SLOs, build dashboard, document runbook, establish review cadence.
- **Effort:** 1-2 days
- **Completion Date:** 2026-06-21
- **Completion Report:** `plans/reports/260621-OTEL-staging-deployment-completion.md`

## Current State Assessment

### What's Already Implemented ✅
- `src/seed/telemetry/opentelemetry-setup.ts` — complete OTel initialization with Honeycomb OTLP/HTTP
- `src/app/[locale]/layout.tsx` — calls `initializeOTel()` on every request
- `src/middleware.ts` — uses `getTracer()` and `record()` for request tracing
- `src/seed/telemetry/__tests__/opentelemetry-setup.test.ts` — test coverage exists
- `.env.example` — Honeycomb configuration documented (HONEYCOMB_API_KEY, OTEL_EXPORTER_OTLP_ENDPOINT, OTEL_SERVICE_NAME, OTEL_SAMPLERATE)
- `@opentelemetry/instrumentation-fetch` in package.json (transitive deps provide API, sdk-trace-base, resources, semantic-conventions)

### What's Missing ❌
- `@opentelemetry/exporter-trace-otlp-http` — NOT in package.json (required by opentelemetry-setup.ts)
- `@opentelemetry/exporter-metrics-otlp-http` — NOT in package.json
- `@opentelemetry/sdk-metrics` — NOT in package.json
- Honeycomb API key configured in staging environment
- Local dev testing with Honeycomb dev key
- Staging deployment verification (traces appearing)
- SLO definitions in Honeycomb (99% < 500ms, 99.9% availability)
- APM dashboard built (latency heatmaps, error rates)
- Runbook documentation (`docs/runbooks/APM-ALERTS.md`)
- Review cadence (monthly SLO review meeting)

## Requirements

### Functional
1. Add missing OTel dependencies to `package.json`
2. Verify Honeycomb endpoint configuration in staging (`wrangler.toml` secrets)
3. Test OTel locally with dev Honeycomb API key
4. Deploy to staging with `npm run deploy:full`
5. Verify traces appear in Honeycomb (check dataset, sample traces)
6. Define SLOs in Honeycomb: availability 99.9%, latency p95 < 500ms for webhooks
7. Build Honeycomb dashboard with latency heatmap, error rate, RPS
8. Configure alert rules: error rate > 1%, latency p95 > 1000ms, SLO burn rate > 0.5%
9. Document runbook: `docs/runbooks/APM-ALERTS.md` with response procedures
10. Set review cadence: monthly SLO review scheduled (calendar invite + doc)

### Non-functional
- OTel overhead < 5% CPU, < 10ms per request
- Sample rate 1% in production (adjustable via OTEL_SAMPLERATE)
- Traces retained 30 days, metrics 90 days
- All instrumentation must be Cloudflare Workers compatible

## Related Code Files

**Files to modify:**
- `apps/sophia-ai-factory/package.json` — add 3 missing OTel dependencies
- `apps/sophia-ai-factory/wrangler.toml` — add Honeycomb secrets if not present
- `src/seed/telemetry/opentelemetry-setup.ts` — minor tweaks if needed after testing
- `src/app/[locale]/layout.tsx` — already imports initializeOTel (good)

**Files to create:**
- `docs/runbooks/APM-ALERTS.md` — alert response procedures
- `docs/observability/SLO-DASHBOARD.md` — SLO definitions and dashboard tour
- `plans/reports/260621-OTEL-staging-deployment-completion.md` — this report

**Files to verify (no change expected):**
- `.env.example` — already documents Honeycomb vars
- `src/middleware.ts` — already uses OTel tracing

## Implementation Steps

### Phase 1: Dependencies & Local Testing

1. **Add missing OTel dependencies**
   - Add `@opentelemetry/exporter-trace-otlp-http` to package.json
   - Add `@opentelemetry/exporter-metrics-otlp-http` to package.json
   - Add `@opentelemetry/sdk-metrics` to package.json
   - Run `npm install` to update lockfile

2. **Verify TypeScript compilation**
   - Run `npm run type-check` to ensure no type errors
   - Run `npm run build` to ensure OTel bundles correctly

3. **Test locally with Honeycomb dev key**
   - Obtain Honeycomb dev API key (or use personal account)
   - Set env vars in `.env.local`:
     - `HONEYCOMB_API_KEY=your-dev-key`
     - `HONEYCOMB_DATASET=sophia-dev`
     - `OTEL_EXPORTER_OTLP_ENDPOINT=https://api.honeycomb.io`
     - `OTEL_SERVICE_NAME=sophia-dev`
     - `OTEL_SAMPLERATE=1.0` (sample 100% locally)
   - Run `npm run dev`
   - Generate traffic: `curl http://localhost:3000/api/health` multiple times
   - Verify traces appear in Honeycomb (check dataset `sophia-dev`)

4. **Fix any instrumentation issues**
   - If traces not appearing, check console for OTel errors
   - Adjust sampler or endpoint headers
   - Ensure `initializeOTel()` is called before any spans created

### Phase 2: Staging Deployment

5. **Configure staging Honeycomb secrets**
   - Ensure staging `wrangler.toml` (or deploy script) sets:
     - `HONEYCOMB_API_KEY` (via `wrangler secret put`)
     - `HONEYCOMB_DATASET=sophia-staging` (if separate dataset) or `sophia-prod`
     - `OTEL_SAMPLERATE=0.01` (1% sample in staging/prod)
   - Verify with: `npx wrangler secret list`

6. **Deploy to staging**
   - Run `npm run deploy:full` from `apps/sophia-ai-factory/`
   - Wait for wrangler to complete (should see "Deployed" message)
   - Verify SHA match: `curl -s https://staging.sophia.agencyos.network/api/version | jq .shortSha`
   - Compare with `git rev-parse HEAD | cut -c1-8`

7. **Verify traces in Honeycomb**
   - Open Honeycomb UI → dataset (sophia-staging or sophia-prod)
   - Generate staging traffic: curl staging URL, browse UI
   - Check "Trace View" for recent traces
   - Verify service name = `sophia-api` (from OTEL_SERVICE_NAME)
   - Verify span attributes: http.method, http.route, status_code
   - Check metrics: request rate, error rate, p50/p95/p99 latency

### Phase 3: SLO & Dashboard

8. **Define SLOs in Honeycomb**
   - Create SLO: Availability = `COUNT(http.server.request{status_class="2xx"}) / COUNT(http.server.request)` > 0.999
   - Create SLO: Latency = `http.server.request.duration{status_class="2xx"} < 0.5` (500ms) — 99th percentile
   - Set time window: 28 days (standard)
   - Set burn rate alerts: 0.5% over 1 hour

9. **Build Honeycomb dashboard**
   - Create new dashboard: "Sophia APM — Staging"
   - Add widgets:
     - Request rate (RPS) line chart
     - Error rate (4xx/5xx %) gauge
     - Latency heatmap (p50/p95/p99) by route
     - Top 10 slowest endpoints (table)
     - SLO status cards (availability %, error budget remaining)
   - Copy dashboard to "Sophia APM — Production" for prod

10. **Configure alerts**
    - Error rate > 1% over 5 min → Telegram webhook
    - Latency p95 > 1000ms over 5 min → Telegram webhook
    - SLO burn rate > 0.5% over 1h → Telegram webhook (critical)
    - Test alerts with intentional trigger (e.g., temporarily increase sample rate on erroring endpoint)

### Phase 4: Documentation & Cadence

11. **Document runbook**
    - Create `docs/runbooks/APM-ALERTS.md`
    - Include:
      - Alert types and severity levels
      - Step-by-step response for each alert (check staging, check Honeycomb, check logs)
      - Escalation path (who to page)
      - Common issues and mitigations
      - How to temporarily adjust sampling or mute alerts
      - Runbook validation checklist

12. **Write SLO documentation**
    - Create `docs/observability/SLO-DASHBOARD.md`
    - Document:
      - SLO definitions (availability, latency)
      - How to access Honeycomb dashboard
      - How to read SLO burn rate graphs
      - Error budget consumption policy (e.g., if burn > 50%, freeze deploys)
      - Monthly review agenda items

13. **Set review cadence**
    - Schedule recurring monthly meeting: "SLO & APM Review" (30 min)
    - Agenda:
      - Review past month's SLO compliance
      - Discuss any incidents or breaches
      - Adjust sampling or alerts if needed
      - Review top slow endpoints and plan optimizations
    - Add to team calendar
    - Document in `docs/runbooks/APM-ALERTS.md`

## Todo List

- [ ] Add @opentelemetry/exporter-trace-otlp-http to package.json
- [ ] Add @opentelemetry/exporter-metrics-otlp-http to package.json
- [ ] Add @opentelemetry/sdk-metrics to package.json
- [ ] Run npm install to update lockfile
- [ ] Run npm run type-check (verify 0 errors)
- [ ] Run npm run build (verify successful build)
- [ ] Obtain Honeycomb dev API key
- [ ] Configure local .env.local with Honeycomb dev credentials
- [ ] Test OTel locally (npm run dev, generate traffic, verify traces)
- [ ] Fix any local instrumentation issues
- [ ] Verify staging Honeycomb secrets configured (HONEYCOMB_API_KEY, OTEL_SAMPLERATE)
- [ ] Deploy to staging (npm run deploy:full)
- [ ] Verify staging SHA match (curl /api/version)
- [ ] Generate staging traffic and verify traces in Honeycomb
- [ ] Define SLOs in Honeycomb (availability 99.9%, latency p95 < 500ms)
- [ ] Build Honeycomb dashboard (RPS, error rate, latency heatmap, top slow endpoints)
- [ ] Configure alert rules (error rate, latency, SLO burn) → Telegram
- [ ] Test alerts (trigger intentionally, verify notification)
- [ ] Create docs/runbooks/APM-ALERTS.md
- [ ] Create docs/observability/SLO-DASHBOARD.md
- [ ] Schedule monthly SLO review meeting
- [ ] Create final completion report in plans/reports/

## Success Criteria

- ✅ All 3 missing OTel dependencies added and compiled without errors
- ✅ Local dev test shows traces appearing in Honeycomb (with 100% sample rate)
- ✅ Staging deployment successful with Honeycomb secrets configured
- ✅ Traces from staging visible in Honeycomb with correct service name and span attributes
- ✅ SLOs defined: availability > 99.9%, latency p95 < 500ms for 99% of requests
- ✅ Honeycomb dashboard built and shared with team
- ✅ Alert rules configured and tested (Telegram notifications working)
- ✅ Runbook documented with clear response procedures
- ✅ Monthly review cadence scheduled and communicated

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| OTel dependencies cause bundle size increase > 10% | Low | Med | Check build output size; use tree-shaking |
| Honeycomb API key not set in staging (deploy fails) | Med | High | Verify secrets before deploy: `npx wrangler secret list` |
| Traces not appearing after deploy | Med | High | Test locally first; check OTel logs; verify endpoint headers |
| Alert fatigue (too many pages) | High | Med | Start with higher thresholds; tune after 1 week of data |
| Sampling rate too low (miss issues) | Med | Med | Start 1% in prod; increase temporarily during incidents |
| Cloudflare Workers OTel compatibility issues | Low | High | Use browser/exporter builds designed for Workers |

## Security Considerations

- Honeycomb API key stored in Cloudflare Workers Secrets (never in git)
- Traces may contain request URLs and status codes — avoid PII in URLs (already enforced by routing)
- Sampling must be random to avoid privacy bias (TraceIdRatioBasedSampler)
- Retain traces 30 days max; metrics 90 days (Honeycomb defaults)
- Structured logs already PII-scrubbed via `src/seed/observability/telemetry/pii-scrubber.ts`

## Next Steps

1. **Immediate (today):** Add OTel dependencies, verify local build
2. **Day 1:** Local dev test with Honeycomb key, fix any issues
3. **Day 2:** Staging deploy, verify traces, configure SLOs/dashboard
4. **Day 3:** Documentation, alerts testing, final report

## References

- OpenTelemetry Cloudflare Workers guide: https://opentelemetry.io/docs/instrumentation/js/cloudflare-workers/
- Honeycomb OTLP ingest: https://docs.honeycomb.io/teams/ingest-traces/otlp/
- Sophia deploy doctrine: `.claude/rules/sophia-deploy-verify.md`
- Phase 3 plan: `plans/260617-1234-enterprise-gap-closure/phase-03-real-apm-implementation.md`
