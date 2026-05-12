# Wave 14 J2 — SSE Heartbeat-Cursor Fix + Observability

**Phase:** Wave 14 Group J2
**Date:** 2026-05-09
**Base commit:** 3c9b6f41

## Summary

Fixed MEDIUM #1 from Wave 13 code review: heartbeat was advancing `emittedCursor` to server
wall-clock time, which caused clock-skew dedup to silently suppress legitimate DB state events.

## Cursor Separation Strategy

Two distinct variables now track separate concerns:

- `eventCursor` — advances ONLY when a real DB `updated_at` is emitted. Used for SSE `id:` lines
  and all dedup comparisons. Never touched by heartbeat.
- `lastHeartbeatTs` — wall-clock timestamp of last keepalive tick. Updates on heartbeat; never
  written to `eventCursor`.

Heartbeat emits `: ping <ts>` SSE comment line (per spec §9.2.6), NOT an event frame with `id:`.
This prevents `Last-Event-ID` from being polluted by server clock values that have no relation
to DB `updated_at`.

Initial connect now emits `id: 0` (or `id: <resumeCursor>`) on the `connected` event so
EventSource has a baseline cursor from the first frame.

## Files Modified

| File | Change |
|---|---|
| `src/app/api/v1/missions/[id]/stream/route.ts` | Renamed `emittedCursor→eventCursor`, added `lastHeartbeatTs`, added `sseHeartbeat()`, added Sentry breadcrumbs, logger disconnect |
| `src/app/api/v1/missions/[id]/stream/route.test.ts` | NEW — 7 tests |
| `src/lib/observability/sentry-options.ts` | Added `ALLOWED_BREADCRUMB_CATEGORIES`, `BREADCRUMB_DATA_SAFELIST`, `buildBeforeBreadcrumb()`, wired into all 3 option builders |

## Tests Added (7)

1. `connected event carries id: 0 when no Last-Event-ID header`
2. `heartbeat emits `: ping` comment line (no `id:`) and does not advance eventCursor`
3. `event after heartbeat is still emitted (dedup uses eventCursor not heartbeat ts)`
4. `reconnect with Last-Event-ID skips already-seen state and emits next state`
5. `terminal status is re-emitted on reconnect when cursor matches existing terminal`
6. `Sentry breadcrumb emitted on connect with sse category`
7. `logger.info sse_disconnect called on stream close`

## Sentry Observability

- `buildBeforeBreadcrumb` added to all 3 Sentry option builders (client, server, edge)
- Allowed categories: `console`, `fetch`, `xhr`, `navigation`, `ui`, `http`, `sse`
- `mission_id`, `event_cursor`, `resume_cursor` are safelisted — not stripped as PII
- Breadcrumbs emitted in stream route: `connect`, `reconnect`, `db_error`, `disconnect`
- Connection drop logged via `logger.info('sse_disconnect', ...)` for downstream metrics

## Heartbeat Interval

15s confirmed. CF Workers timeout ~5min. Heartbeat at 15s leaves 20 heartbeats before timeout — appropriate.

## Results

- `npx tsc --noEmit`: 0 errors in owned files (1 pre-existing error in unrelated `raas/missions/route.ts`)
- `npx vitest run`: 2919 passed / 0 failed (296 test files)
- Heartbeat test uses 18s fake-timer advance across 9 poll cycles to guarantee heartbeat fires between polls
