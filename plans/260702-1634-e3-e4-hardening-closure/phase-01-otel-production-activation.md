---
phase: 1
title: "OTel Production Activation"
status: pending
effort: "~15 min"
priority: P1
---

# Phase 1: OTel Production Activation

## Overview

Activate OpenTelemetry on production Worker. Code + env config already exist — only missing `HONEYCOMB_API_KEY` secret on the production Worker.

## Requirements

- Set `HONEYCOMB_API_KEY` as wrangler secret on `sophia-ai-factory` production Worker
- Ensure `OTEL_SAMPLERATE=0.01` (1% sampling) is configured
- Deploy via `npm run deploy:full`
- Verify traces flow to Honeycomb `sophia-prod` dataset
- Update roadmap status

## Architecture

```
echo "$KEY" | wrangler secret put HONEYCOMB_API_KEY --remote
  → Worker env picks up at next deploy
  → OTel SDK initializes with 1% samplerate
  → Traces → Honeycomb OTLP endpoint → sophia-prod dataset
```

## Related Code Files

- Read (no modify): `src/seed/telemetry/opentelemetry-setup.ts`
- Read (no modify): `src/seed/telemetry/instrument-api.ts`
- Modify: `docs/development-roadmap.md` (update E3 status)

## Implementation Steps

1. **Set production secret:**
   ```bash
   cd apps/sophia-ai-factory
   echo "<HONEYCOMB_API_KEY>" | wrangler secret put HONEYCOMB_API_KEY --remote
   ```
2. **Verify secret exists:**
   ```bash
   npx wrangler secret list --remote | grep HONEYCOMB
   ```
3. **Deploy:**
   ```bash
   npm run deploy:full
   ```
4. **Verify SHA match:**
   ```bash
   LOCAL_SHA=$(git rev-parse HEAD | cut -c1-8)
   LIVE_SHA=$(curl -s https://sophia.agencyos.network/api/version | grep -o '"shortSha":"[^"]*"' | cut -d'"' -f4)
   [ "$LOCAL_SHA" = "$LIVE_SHA" ] && echo "MATCH"
   ```
5. **Verify traces:**
   - Log into Honeycomb → check `sophia-prod` dataset for incoming traces (within minutes of deploy)
   - Confirm spans appear: API routes, Inngest functions, fetch calls
6. **Update roadmap:** Set E3 status to ✅ COMPLETE in `docs/development-roadmap.md`

## Success Criteria

- [ ] `wrangler secret list` shows `HONEYCOMB_API_KEY`
- [ ] `npm run deploy:full` exits 0
- [ ] `/api/version` shortSha matches local commit
- [ ] Traces visible in Honeycomb `sophia-prod` dataset
- [ ] Roadmap E3 updated to complete

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Wrong dataset name | Low | Already set to `sophia-prod` in `.env.production.example` |
| Secret mismatch during build | Low | `HONEYCOMB_API_KEY` is optional — code handles missing key gracefully |
| 1% samplerate too low | Low | Can adjust via env var without redeploy |
