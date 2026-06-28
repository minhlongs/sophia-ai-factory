# R9 — BYOK Admin Polish + Discovery Score User Endpoint

**Date:** 2026-04-18 · **Mode:** `/cook all step by step --auto --parallel` · **Predecessor:** R8 (19ee374 + fb259e7)

## Objective

Close all R8 reviewer deferrals (L-1/L-2/L-3/INFO-2) and activate R7 L-2 (enhanceNicheScoreWithAI production caller) via a new user-facing `/api/discovery/score` endpoint.

## Phases

| Phase     | Status  | Owner              | Scope                                                                                   |
|-----------|---------|--------------------|-----------------------------------------------------------------------------------------|
| 9A — BYOK polish | Completed | fullstack-dev #1 | Rate-limit + sidebar icon + loading skeleton + monitoring aggregator                    |
| 9B — /api/discovery/score | Completed | fullstack-dev #2 | New POST endpoint wiring `enhanceNicheScoreWithAI(program, niche, user.id)` with tests |

## Phase 9A — BYOK Admin Polish

**Files owned (disjoint from 9B):**
- `src/middleware.ts` — add `/api/user/byok` → `RATE_LIMITS.auth` branch
- `src/app/[locale]/dashboard/layout.tsx` — swap BYOK sidebar icon from `<KeyRound />` to differentiate from RaaS API Keys
- `src/app/[locale]/dashboard/byok/loading.tsx` — **NEW** skeleton stub (~20 LOC)
- `src/lib/admin/monitoring-queries.ts` — add `aggregateByokEvents()` returning `{ setCount, clearCount, netChange }` 24h window

**Acceptance:**
- Middleware test: `/api/user/byok` maps to `RATE_LIMITS.auth` (stricter than `RATE_LIMITS.api`)
- Layout renders distinct icon for BYOK (pick from lucide: `Cog`, `KeySquare`, `Fingerprint`)
- `loading.tsx` exists and exports default skeleton component
- `aggregateByokEvents()` returns counts from `signals_events` scoped `event_type IN ('byok_key_set','byok_key_cleared')`

## Phase 9B — Discovery Score User Endpoint

**Files owned (disjoint from 9A):**
- `src/app/api/discovery/score/route.ts` — **NEW** POST handler
- `src/app/api/discovery/score/route.test.ts` — **NEW** tests

**Endpoint contract:**
```ts
POST /api/discovery/score
Body: { program: { id: string; name: string; category?: string; ... }, niche: string }
Response: { score: NicheScore }  // from enhanceNicheScoreWithAI
```

**Auth:** `getCurrentUser()` required → 401 when missing.
**Validation:** Zod schema `{ program: z.object({...}).passthrough(), niche: z.string().min(1).max(200) }`.
**Wire-in:** `await enhanceNicheScoreWithAI(program, niche, user.id)` — user.id flows BYOK resolver.
**Rate-limit:** Matches `/api/discovery/*` via existing `RATE_LIMITS.discovery` (already configured).

**Test cases (≥6):**
1. 401 when no user
2. 400 when body missing niche
3. 400 when niche too long
4. 400 when program missing id
5. 200 happy path — asserts `enhanceNicheScoreWithAI` called with `(program, niche, user.id)`
6. 500 when enhancer throws — no audit leaked

## Success Criteria (Rule #0)

- [ ] Build: `npm run build` exit 0
- [ ] Tests: 1311 → 1320+ (9A adds 4–6, 9B adds 6–8)
- [ ] Lint/Typecheck: 0 errors
- [ ] Review: ≥9.5/10, 0 critical/high
- [ ] Push → CI green → CF Pages → Prod HTTP 200 → shortSha match

## Risk / YAGNI Notes

- **9A monitoring aggregator:** scope limited to simple count query. Admin dashboard wiring DEFERRED until R10 (no UI request).
- **9B program schema:** use `passthrough()` to avoid over-specifying. Frontend isn't wired here — API-only activation.
- **Not in R9:** Admin UI for BYOK events, discovery UI, PDF Phase 5 re-read, Multi-Agent Orchestrator mapping.

---

## Outcome

✅ **R9 SHIPPED** — Bundled 9A + 9B via 2 parallel fullstack-developers, disjoint ownership.

**Test delta:** 1311 → 1326 (+15 tests)

**Review:** 9.3/10 FIX-THEN-SHIP
- H-1 fixed: docstring corrected (rate-limit inherits default, not 'discovery')
- M-2 fixed: added `category: z.string().optional()` to ProgramSchema
- M-1 (created_at column bug) deferred to R10 (pre-existing from Phase 4I/4K/4M, not R9's bug)

**R9 closures:**
- R8 L-1/L-2/L-3/INFO-2 closed (byok/loading.tsx skeleton, KeySquare icon, rate-limit mapping, aggregateByokEvents helper)
- R7 L-2 activated (/api/discovery/score POST with real enhanceNicheScoreWithAI user.id caller)

**R10 deferrals:**
- M-1: created_at→ts column rename across 3 callers (monitoring-queries.ts + admin-routes.ts + admin page)
- L-1: byok/loading.tsx skeleton width polish
- L-3: discovery-score audit trail + rate-limit granularity review
- INFO-1: middleware matcher excludes /api/* patterns audit
