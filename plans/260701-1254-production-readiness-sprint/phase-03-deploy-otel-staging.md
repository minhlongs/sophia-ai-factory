# Phase 03 — Deploy OTEL to Staging + Verify Honeycomb

**Priority:** P0 | **Effort:** 1h | **Status:** pending | **Depends on:** Phase 02

## Overview

Deploy the fixed OTEL instrumentation to staging, add Honeycomb API key, and verify traces appear in Honeycomb UI.

## Prerequisites

- [ ] `HONEYCOMB_API_KEY` provisioned in Honeycomb.io (create if not exists)
- [ ] Honeycomb dataset created (default: `sophia-prod`)
- [ ] Phase 02 complete (register hook enabled, browser→Node platform fix)

## Implementation Steps

### 1. Add HONEYCOMB_API_KEY to wrangler secrets (~10 min)

```bash
# Add to staging environment (if separate env exists)
npx wrangler secret put HONEYCOMB_API_KEY --env staging

# Or add to default (production)
npx wrangler secret put HONEYCOMB_API_KEY
```

Also add `HONEYCOMB_DATASET` and `OTEL_SERVICE_NAME` if needed:
```bash
npx wrangler secret put HONEYCOMB_DATASET
npx wrangler secret put OTEL_SERVICE_NAME
```

### 2. Deploy to staging (~15 min)

```bash
cd apps/sophia-ai-factory
npm run deploy:full
```

Watch for:
- `[OTel] Initialized` log in wrangler tail
- No "module factory edge crash" errors
- HTTP 200 on production URL

### 3. Verify traces in Honeycomb (~20 min)

1. Open Honeycomb UI → dataset (default: `sophia-prod`)
2. Check for spans within last 5 minutes
3. Look for span names:
   - `api.*` spans (from `instrument-api.ts`)
   - `inngest.*` spans (from `instrument-inngest.ts`)
   - `fetch` spans (from FetchInstrumentation auto-instrumentation)
4. Verify span attributes: `http.method`, `http.route`, `component`, `duration_ms`
5. Check metrics tab for `duration_ms` histogram

### 4. Triage any issues (~15 min)

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| No spans in Honeycomb | API key wrong or endpoint blocked | Verify `HONEYCOMB_API_KEY` secret; check `OTEL_EXPORTER_OTLP_ENDPOINT` |
| Span names missing | Service name mismatch | Check `OTEL_SERVICE_NAME` env |
| `@opentelemetry/api: Registered a global for diag` warnings | Harmless — normal OTel init | Suppress via `OTEL_LOG_LEVEL=error` |
| Module factory crash reappears | Node platform import also problematic | Fall back to custom fetch-based exporter using `@opentelemetry/exporter-trace-otlp-http` base |

### 5. Verify SAML/production HTTP (~10 min)

```bash
# Verify deploy SHA matches
LOCAL_SHA=$(git rev-parse HEAD | cut -c1-8)
LIVE_SHA=$(curl -s https://sophia.agencyos.network/api/version | grep -o '"shortSha":"[^"]*"' | cut -d'"' -f4)
[ "$LOCAL_SHA" = "$LIVE_SHA" ] && echo "✅ MATCH" || echo "❌ STALE"

# Health check
curl -sI https://sophia.agencyos.network | head -1  # must be HTTP/2 200
```

## Success Criteria

- [ ] `npm run deploy:full` exits 0
- [ ] `/api/version` shortSha matches local
- [ ] Traces visible in Honeycomb UI (spans + metrics)
- [ ] No crash in wrangler tail logs
- [ ] HTTP 200 on production URL
