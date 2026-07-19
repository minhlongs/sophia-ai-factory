# R10 — Close R9 Reviewer Deferrals (M-1 + L-1 + L-3 + INFO-1)

**Date:** 2026-04-20 · **Mode:** `/cook next … --auto --parallel` · **Predecessor:** R9 (a10b3c5 + cc4378d)

## Objective

Close all R9 reviewer deferrals in a single bundled ship:
- **M-1** (med): `created_at` → `ts` column rename across 3 SQL callers (schema has `ts INTEGER -- unix ms`, `created_at` doesn't exist — queries silently return 0 rows)
- **L-1** (low): `dashboard/byok/loading.tsx` skeleton width alignment with real page layout
- **L-3** (low): `/api/discovery/score` audit trail + dedicated `RATE_LIMITS.discovery` bucket (OpenRouter cost exposure)
- **INFO-1** (info): middleware matcher `/((?!api|…).*)` excludes `/api/*` → `/api` rate-limit branch may be dead code; audit + document or fix

## Phases

| Phase     | Status  | Owner              | Scope                                                                                   |
|-----------|---------|--------------------|-----------------------------------------------------------------------------------------|
| 10A — M-1 column rename | Planned | fullstack-dev #1 | Fix 3 callers: `monitoring-queries.ts:162,196` + `llm-trace-stats/route.ts:56` (use bind param `Date.now() - hoursBack*3600*1000` against `ts` column) |
| 10B — L-1+L-3+INFO-1 | Planned | fullstack-dev #2 | Skeleton width polish + audit trail on `/api/discovery/score` + new `RATE_LIMITS.discovery` bucket + middleware matcher audit |

## Phase 10A — M-1 Column Rename (unix-ms epoch)

**Files owned (disjoint from 10B):**
- `src/lib/admin/monitoring-queries.ts` — lines 162 (aggregateByokEvents), 196 (getTraceStats)
- `src/app/api/admin/llm-trace-stats/route.ts` — line 56 (trace props select)
- `src/lib/admin/monitoring-queries.test.ts` — update tests to assert new query + bind param
- `src/app/api/admin/llm-trace-stats/route.test.ts` — update existing test to assert new query

**Fix pattern (unix-ms aware):**
```ts
// BEFORE (silently zero — column doesn't exist):
WHERE event_type = ? AND created_at >= datetime('now', '-' || ? || ' hours')

// AFTER (unix ms epoch):
const cutoffMs = Date.now() - hoursBack * 3600 * 1000
d1.prepare(`SELECT … FROM signals_events WHERE event_type = ? AND ts >= ?`)
  .bind(eventType, cutoffMs)
```

**Acceptance:**
- All 3 `created_at >= datetime('now', …)` replaced with `ts >= ?` bind
- `ts` uses `Date.now() - hoursBack * 3600 * 1000` (unix milliseconds matching schema comment)
- Uses existing `idx_signals_events_type_ts` index (now correctly hit)
- Tests assert prepared SQL contains `ts >=` and bind contains numeric cutoff

## Phase 10B — L-1 + L-3 + INFO-1

**Files owned (disjoint from 10A):**
- `src/app/[locale]/dashboard/byok/loading.tsx` — width polish
- `src/app/api/discovery/score/route.ts` — add audit trail
- `src/app/api/discovery/score/route.test.ts` — +2 tests (audit emit + rate-limit bucket)
- `src/middleware/rate-limit-config.ts` — add `discovery` bucket config
- `src/middleware.ts` — wire `/api/discovery` → `RATE_LIMITS.discovery` branch + INFO-1 audit comment OR delete dead /api branch if matcher truly excludes it
- `plans/260420-1113-r10-close-r9-deferrals/reports/middleware-matcher-audit.md` — INFO-1 audit finding

**L-1 — Skeleton width:**
Match real page `max-w-2xl mx-auto space-y-6 p-6` from `dashboard/byok/page.tsx` (check first).

**L-3 — Audit trail + rate-limit:**
- Add `discovery` bucket to `RATE_LIMITS` — e.g. `{ requests: 30, windowMs: 60_000 }` (stricter than default `api` 100/min because OpenRouter $$)
- Route mapping in middleware: `else if (pathname.startsWith('/api/discovery'))` → `RATE_LIMITS.discovery`
- Emit `track(D1Events.DISCOVERY_SCORE_REQUESTED, user.id, { program_id, niche_len })` after 200 response
- Test: assert `track()` called with correct event + actor

**INFO-1 — Middleware matcher audit:**
Investigate whether Next.js middleware matcher `["/((?!api|…).*)"]` excludes `/api/*` at routing layer. If YES:
- `/api` rate-limit branch never runs at middleware level
- Rate-limit must be in per-route wrappers OR CF edge rules
- Either delete dead /api branch OR change matcher to include /api/* with explicit opt-out patterns

Document finding in `reports/middleware-matcher-audit.md`. If fix is non-trivial, scope to R11.

## Success Criteria (Rule #0)

- [ ] Build: `npm run build` exit 0
- [ ] Tests: 1326 → 1332+ (10A updates 2–3 existing + 10B adds 2–3 new)
- [ ] Lint/Typecheck: 0 errors
- [ ] Review: ≥9.5/10, 0 critical/high
- [ ] Push → CI green → CF Workers → Prod HTTP 200 → shortSha match

## Risk / YAGNI Notes

- **10A index coverage:** Query now uses `ts >= ?` which hits `idx_signals_events_type_ts` (event_type first) — actual speedup vs dead `created_at` column.
- **10B audit trail:** Scoring is cheap read-like op, but OpenRouter API costs money — audit provides cost attribution + abuse detection.
- **10B INFO-1:** If middleware matcher truly excludes /api, the existing /api rate-limit branch (lines 69-180 in middleware.ts) is dead — but likely rate-limit fires from per-route middleware (e.g. `src/app/api/admin/middleware.ts`). Audit first, don't delete hastily.
- **Not in R10:** Deeper PDF a16z Solo-Company mapping (Multi-Agent Orchestrator, Agent Marketplace, Statsig A/B) — reserved for R11+.

## Outcome

✅ **R10 SHIPPED** — 10A + 10B bundled via parallel fullstack-developers. Tests 1326 → 1328 (+2 new from 10B). **9.6/10 SHIP** (0 critical/high).

**Closures:**
- M-1: 3-site `created_at` → `ts >= ?` bind rename + bonus fix `SELECT props` → `SELECT props_json AS props` (latent aggregation bug)
- L-1: skeleton width alignment polish
- L-3: `DISCOVERY_SCORE_REQUESTED` audit trail + `RATE_LIMITS.discovery` (30req/60s) wired
- INFO-1: Middleware matcher audit complete — dead code at routing layer (defer widening to R11)

**R11 Deferrals:**
- R9 M-2: `ProgramSchema` vs `AffiliateProgram` contract drift (2-line Zod tighten)
- INFO-1: Matcher widening vs per-route wrapper dedupe (HIGH-risk scope)
- L-R10-1: Redundant try/catch around `track()` (cosmetic)
- PDF a16z Solo-Company mapping docs (Multi-Agent Orchestrator, Agent Marketplace, Statsig A/B)
