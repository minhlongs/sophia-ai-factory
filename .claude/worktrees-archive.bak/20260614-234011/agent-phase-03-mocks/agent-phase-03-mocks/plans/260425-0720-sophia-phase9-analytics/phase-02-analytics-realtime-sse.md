# Phase 02 — Real-Time SSE Analytics Endpoint

## Context Links
- Research: `plans/reports/researcher-analytics-phase9-assessment-240425.md` § A.1 "Real-time dashboard polling"
- Parent plan: [plan.md](./plan.md)
- Existing usage route: `src/app/api/analytics/usage/route.ts` (reuse query helpers)

## Overview
- **Priority:** P1
- **Status:** Pending
- **Wave:** 1 (parallel-safe)
- **Effort:** ~5h
- **Owner:** sse-agent

Add Server-Sent Events endpoint streaming live analytics to founder dashboard (<30s latency).

## Key Insights
- Cloudflare Workers natively support SSE via `ReadableStream` — no WebSocket infra needed
- Existing query helpers (`fetchUsageMetrics`, `fetchRevenueMetrics`) already optimized for D1 — reuse
- Broadcaster pattern: single in-memory pub/sub allows multiple clients per worker isolate
- 30s tick interval — query D1, push delta to all subscribers
- Auth: must verify admin via `getCurrentUser()` before opening stream

## Requirements

### Functional
- `GET /api/analytics/realtime` returns `Content-Type: text/event-stream`
- Streams JSON events every 30s with: `{ activeClients, currentARR, topFeatures[], errorRate }`
- Supports `?org_id=...` filter (admin only without filter; customer scoped to own org)
- Heartbeat ping every 15s to keep connection alive (Cloudflare timeout = 100s idle)
- Auto-closes on auth failure / client disconnect

### Non-Functional
- Reuse existing query modules — no SQL duplication
- File sizes: route.ts < 150 lines, sse-broadcaster.ts < 150 lines
- Zero `:any` types
- Zod validation for `org_id` query param

## Architecture
```
Browser ──SSE──► /api/analytics/realtime
                     │
                     ▼
              auth check (getCurrentUser)
                     │
                     ▼
              SSEBroadcaster.subscribe(clientId, orgId)
                     │
                     ▼ (every 30s)
              fetchRealtimeSnapshot(orgId) → push to client
                     │
                     ▼
              client.close() → broadcaster.unsubscribe
```

## Related Code Files

### Modify
- None (additive only — Phase 02 has zero overlap with other phases)

### Create
- `src/app/api/analytics/realtime/route.ts` — SSE GET handler (auth + stream wiring)
- `src/lib/analytics/sse-broadcaster.ts` — pub/sub broadcaster + snapshot fetcher

### Delete
- None

## Implementation Steps

1. **Create `sse-broadcaster.ts`:**
   - Class `SSEBroadcaster` with `subscribe(id, orgId, encoder, controller)`, `unsubscribe(id)`, `broadcast(orgId, payload)`.
   - Internal Map<clientId, { orgId, controller }>.
   - Helper `fetchRealtimeSnapshot(orgId)` calling existing `fetchUsageMetrics` + `fetchRevenueMetrics` with last-1h window.
   - Singleton instance exported.
2. **Create `realtime/route.ts`:**
   - Import `getCurrentUser` from `@/lib/better-auth-session`.
   - Validate query: `z.object({ org_id: z.string().optional() })`.
   - Auth gate: 401 if no user; 403 if non-admin requests other org_id.
   - Return `Response` with `ReadableStream` body, headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`.
   - Inside `start(controller)`:
     - Subscribe to broadcaster with unique `clientId = crypto.randomUUID()`.
     - Send initial snapshot immediately.
     - Set 30s `setInterval` → `fetchRealtimeSnapshot` → `controller.enqueue(encoder.encode('data: ' + JSON.stringify(payload) + '\n\n'))`.
     - Set 15s heartbeat: `controller.enqueue(': ping\n\n')`.
   - Inside `cancel()`: clear intervals, unsubscribe.
3. **Add type:** `RealtimeAnalyticsSnapshot` in `src/lib/analytics/types.ts` (additive).
4. **Manual smoke test:** `curl -N http://localhost:3000/api/analytics/realtime` (with auth cookie) — should stream events.
5. **Build verify:** `npm run build` (0 errors).
6. **Commit:** `feat(analytics): add SSE realtime endpoint for founder dashboard`

## Todo List
- [ ] Create `src/lib/analytics/sse-broadcaster.ts` (broadcaster + snapshot fetcher)
- [ ] Create `src/app/api/analytics/realtime/route.ts` (SSE handler)
- [ ] Add `RealtimeAnalyticsSnapshot` type
- [ ] Auth gate (admin vs customer org scoping)
- [ ] Zod query validation
- [ ] Heartbeat ping (15s)
- [ ] 30s data tick
- [ ] Connection cleanup on cancel
- [ ] Manual SSE smoke test via curl
- [ ] Build green

## Success Criteria
- `curl -N` shows `data: {...}` events every 30s
- Heartbeat `: ping` every 15s
- 401 without auth, 403 cross-org admin attempt
- Zero TS errors, no `:any`, files < 200 lines
- Reuses existing query helpers (no SQL duplication)

## Risk Assessment
- **R1:** Long-lived SSE on CF Workers — verify isolate doesn't recycle mid-stream. Mitigate: heartbeat + client auto-reconnect (frontend concern, document for Phase 05 wiring).
- **R2:** Memory leak if broadcaster doesn't unsubscribe on disconnect → unit test `cancel()` cleanup path.
- **R3:** D1 rate limits if many clients → cap subscribers per worker isolate (e.g., 100), return 503 if exceeded.

## Security Considerations
- Auth via `getCurrentUser()` REQUIRED — no anonymous SSE
- Admin role check before allowing `?org_id=other_org`
- Strip secrets from snapshot payload (no API keys, no internal IDs beyond orgId)

## File Ownership (NO OVERLAP)
Phase 02 owns:
- `src/app/api/analytics/realtime/route.ts` (NEW)
- `src/lib/analytics/sse-broadcaster.ts` (NEW)
- `src/lib/analytics/types.ts` — additive `RealtimeAnalyticsSnapshot` only ⚠️ shared with Phase 01 (additive-only changes; merge by union)

## Next Steps
Phase 05 (tier adoption + dashboard page wiring) consumes this SSE endpoint via EventSource client.
