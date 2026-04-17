# Phase 1 — D1 Signal Layer

## Context Links
- `apps/sophia-ai-factory/src/lib/signals/posthog-capture.ts` (existing PostHog path — DO NOT modify)
- `apps/sophia-ai-factory/src/lib/signals/event-types.ts` (event enum — extend, don't replace)
- `apps/sophia-ai-factory/migrations/0001-init.sql` (style reference)
- `apps/sophia-ai-factory/src/lib/db/client.ts` (`createServerClient()` — sync, no `await`)
- Reports: `plans/reports/synthesis-260417-1011-sophia-claudekit-mekong-mapping.md` §"Recommended Scope #2"

## Overview
- **Priority:** P0
- **Status:** pending
- **Owner:** dev-A (fullstack-developer)
- **Effort:** 8h
- Founder-owned D1 telemetry — independent of PostHog (BYOK provider). Source of truth for the weekly digest (Phase 3).

## Key Insights
- Sophia has TWO signal paths after this phase:
  - **PostHog** (existing): cross-product analytics, BYOK key required, queryable via PostHog UI.
  - **D1 `signals_events`** (NEW): founder-owned, queryable via `wrangler d1 execute`, never leaves CF account.
- Use `signals_events` as **source of truth** for ops decisions; PostHog stays for product analytics dashboards.
- **No JSONB in D1** — store `props_json` as `TEXT`, `JSON.parse` on read.
- `org_id` NULLABLE — pre-signup events (e.g., demo) have no org.

## Requirements

### Functional
- New table `signals_events` capturing 6 event types: `tier_conversion`, `payment_success`, `payment_failed`, `agent_dispatch`, `api_rate_limit_hit`, `byok_call`.
- Helper `track(event, actor, props, orgId?)` writes to D1 fire-and-forget (non-blocking).
- Instrumentation in 4 call sites (see Related Code Files).

### Non-Functional
- Helper MUST NOT block the request path — Promise w/ `.catch()` swallow + `logger.warn`.
- Edge runtime compatible (`globalThis` env binding access pattern).
- Zero `:any`. Full Zod validation on `props`.
- Append-only — no UPDATE/DELETE on `signals_events` from app code.

## Architecture

### Table schema
```sql
CREATE TABLE signals_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ts          INTEGER NOT NULL,                      -- unix ms
  event_type  TEXT    NOT NULL,                      -- one of EventType enum
  actor       TEXT    NOT NULL,                      -- userId | 'system' | 'cron' | 'webhook'
  org_id      TEXT,                                  -- nullable; FK loosely to org_members.org_id
  props_json  TEXT    NOT NULL DEFAULT '{}'          -- serialized JSON, validated by Zod before insert
);
CREATE INDEX idx_signals_events_ts          ON signals_events (ts);
CREATE INDEX idx_signals_events_type_ts     ON signals_events (event_type, ts);
CREATE INDEX idx_signals_events_org_ts      ON signals_events (org_id, ts);
```

### Track helper (`src/lib/signals/track.ts`)
```ts
import { z } from 'zod'
import { logger } from '@/lib/utils/logger-utility'
import { createServerClient } from '@/lib/db/client'
import { D1EventType, schemaForEvent } from './d1-event-types'

export function track<T extends D1EventType>(
  event: T,
  actor: string,
  props: unknown,
  orgId?: string | null,
): void {
  // Fire-and-forget: never blocks request
  void (async () => {
    try {
      const safe = schemaForEvent(event).parse(props)
      const db = createServerClient()
      await db.prepare(
        'INSERT INTO signals_events (ts, event_type, actor, org_id, props_json) VALUES (?, ?, ?, ?, ?)',
      ).bind(Date.now(), event, actor, orgId ?? null, JSON.stringify(safe)).run()
    } catch (err) {
      logger.warn('[signals/d1] track failed', {
        event, error: err instanceof Error ? err.message : String(err),
      })
    }
  })()
}
```

### Event enum (`src/lib/signals/d1-event-types.ts`) — separate from PostHog `event-types.ts` to avoid coupling
```ts
export const D1Events = {
  TIER_CONVERSION:    'tier_conversion',
  PAYMENT_SUCCESS:    'payment_success',
  PAYMENT_FAILED:     'payment_failed',
  AGENT_DISPATCH:     'agent_dispatch',
  API_RATE_LIMIT_HIT: 'api_rate_limit_hit',
  BYOK_CALL:          'byok_call',
  BYOK_TIMEOUT:       'byok_timeout',  // reserved for Phase 5
} as const
export type D1EventType = typeof D1Events[keyof typeof D1Events]
// + Zod schemas per event (see Implementation Steps step 3)
```

### Data flow
```
Call site (route handler / cron / webhook)
   │  track('payment_success', userId, { amount_usd, tier, provider }, orgId)
   ▼
src/lib/signals/track.ts (fire-and-forget Promise)
   │
   ▼
D1 INSERT into signals_events
   │
   ▼
Phase 3 weekly digest reads via SELECT WHERE ts > now-7d
```

## Related Code Files

### Create
- `apps/sophia-ai-factory/migrations/0005-signals-events.sql` — table + indexes
- `apps/sophia-ai-factory/src/lib/signals/track.ts` — helper
- `apps/sophia-ai-factory/src/lib/signals/d1-event-types.ts` — enum + Zod schemas
- `apps/sophia-ai-factory/src/lib/signals/track.test.ts` — unit tests (mock D1, verify fire-and-forget + schema rejection)

### Modify (instrumentation — surgical 1-2 line `track()` calls only)
- `apps/sophia-ai-factory/src/app/api/webhooks/nowpayments/route.ts` — emit `payment_success` / `payment_failed` / `tier_conversion` after IPN tier activation
- `apps/sophia-ai-factory/src/lib/gateway/openclaw-gateway.ts` (or nearest agent dispatcher) — emit `agent_dispatch`
- `apps/sophia-ai-factory/src/middleware.ts` — emit `api_rate_limit_hit` when 429 returned
- BYOK adapters (`src/lib/ai/text-to-speech-generator-elevenlabs.ts`, `src/lib/discovery/affiliate-openrouter-niche-enhancer.ts`) — emit `byok_call` per provider call (provider name + status only, **no key material**)

### Delete
- none

## Implementation Steps
1. Create `migrations/0005-signals-events.sql` with table + 3 indexes.
2. Run migration locally: `npx wrangler d1 execute sophia-raas-db --local --file=migrations/0005-signals-events.sql`.
3. Create `src/lib/signals/d1-event-types.ts` with 7-event enum + Zod schema-per-event (`schemaForEvent(event)` returns the right Zod schema).
4. Create `src/lib/signals/track.ts` per Architecture spec.
5. Create `src/lib/signals/track.test.ts` — verify: schema rejection logs warn but doesn't throw; D1 failure logs warn; happy path inserts row.
6. Instrument NOWPayments webhook (4 lines: success, failed, tier_conversion).
7. Instrument agent dispatcher (1 line per dispatch).
8. Instrument middleware rate-limit branch (1 line in 429 path).
9. Instrument BYOK adapters (1 `track('byok_call', …, { provider, status_code, latency_ms })` per outbound call) — coordinate w/ Phase 5 owner so wrappers compose cleanly (Phase 5 wraps fetch; this phase emits the event).
10. Run remote migration in PR review (NOT in this PR — flag in PR description for ops to apply via `npx wrangler d1 execute sophia-raas-db --remote --file=migrations/0005-signals-events.sql` after merge).
11. `npm run build && npm test` from `apps/sophia-ai-factory/`.

## File Ownership (Parallel Mode)
- **Owns exclusively:** all files under `apps/sophia-ai-factory/src/lib/signals/d1-*` + `track.ts` + migration `0005-*` + the 4 instrumented call sites listed above.
- **Coordination point:** BYOK adapters — Phase 5 owns timeout wrapper, Phase 1 owns the `track()` call inside it. Phase 1 lands FIRST (helper exists), Phase 5 imports `track` from Phase 1.

## Dependencies
- **Blocks:** Phase 3
- **Blocked by:** Phase 0

## Todo List
- [ ] Create migration `0005-signals-events.sql`
- [ ] Apply migration locally + verify table
- [ ] Create `d1-event-types.ts` w/ Zod schemas
- [ ] Create `track.ts` helper
- [ ] Create `track.test.ts` (≥4 cases)
- [ ] Instrument NOWPayments webhook
- [ ] Instrument agent dispatcher
- [ ] Instrument middleware 429 branch
- [ ] Instrument 2 BYOK adapters
- [ ] `npm run build` 0 errors
- [ ] `npm test` all pass
- [ ] PR description flags remote migration step

## Success Criteria
- `wrangler d1 execute sophia-raas-db --local --command "SELECT COUNT(*) FROM signals_events"` returns ≥1 after running test suite that triggers a track call.
- All 6 event types reachable from at least one production code path.
- Fire-and-forget verified: artificially fail D1 → request still returns normally.

## Risk Assessment
- **R1:** D1 write latency on hot path → mitigated by fire-and-forget pattern.
- **R2:** Zod schema rejecting valid events → unit tests cover all 6 event types w/ realistic payloads.
- **R3:** Instrumented BYOK adapter accidentally logs API key → schema whitelist forbids key fields; props limited to `provider, status_code, latency_ms, error_class`.

## Security Considerations
- `props_json` validated by Zod whitelist BEFORE insert — prevents PII leak.
- BYOK keys NEVER in props (forbidden in schema).
- D1 query for digest scoped by `org_id` if multi-tenant later — table already has the column.

## Next Steps
- Phase 3 (weekly digest) consumes this table.
- Phase 5 (timeout guard) imports `track` to emit `byok_timeout`.
