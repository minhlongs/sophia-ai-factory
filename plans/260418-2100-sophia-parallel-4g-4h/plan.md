---
name: Sophia Parallel Shipment — Phase 4G MVP + Phase 4H JSON Cache-Stats
status: shipped
priority: P2
estimate: 2h (parallel ≈ 1h wall-clock)
session: PM-17 2026-04-18
parent: 260418-1800-sophia-phase4e3-llm-cache-purge-cron (shipped 078fabe)
pdf_bullet: Giai đoạn 6.2 (cache wiring) + operator JSON observability
mode: --auto --parallel
commit: dde51a24
shipped_at: 2026-04-18
final_tests: 1193/1193
review_score: 9.5/10
---

# Sophia Parallel Shipment — 4G MVP + 4H JSON

Two file-disjoint slices spawned in parallel.

## File Ownership Matrix (STRICT)

| Phase | Owner | Files (touched)                                                      | Conflicts |
|-------|-------|----------------------------------------------------------------------|-----------|
| 4G    | Dev-A | `src/app/api/cron/workflow-stepper/route.ts` (modify, ~+30 LOC)<br/>`src/app/api/cron/workflow-stepper/route.test.ts` (NEW, ~5 tests) | none |
| 4H    | Dev-B | `src/app/api/admin/llm-cache-stats/route.ts` (NEW, ~60 LOC)<br/>`src/app/api/admin/llm-cache-stats/route.test.ts` (NEW, ~4 tests) | none |

**Zero overlap** — different routes, different tests, different imports.

## Phase 4G MVP — Dark-Launched Real LLM in Workflow Stepper

Replaces the hardcoded mock string at `executeStep:47` with a real LLM call via
the existing `callWithCache` + `routeLlm` pipeline. Dark-launched behind
`WORKFLOW_REAL_LLM_ENABLED=1` env gate (default OFF → current behavior preserved).

**Why:** Closes the "executeStep STUB" comment in prior ship memory.
Completes the cost-optimization loop end-to-end for workflows:
route → cache → fetch → write → expire → DELETE.

**Live-fetch implementation:** Uses `OPENROUTER_API_KEY` env (shared fallback
for MVP). BYOK refactor requires `workflows.org_id → user_id` join which
is out of scope (tracked as Phase 4G-BYOK).

**Cache key shape:** `{ orgId: workflow.org_id, model: decision.model, promptHash: sha256(prompt) }` — reuses `CacheKey` from `@/lib/llm/cache/llm-cache`.

**Scope-not-touched:**
- BYOK per-user key (needs schema change)
- Streaming responses (cron is sync-per-tick)
- Retry / exponential backoff (caller already has try/catch + rethrow)
- Multi-step prompt chaining (single-step MVP)

**Success criteria:**
- `WORKFLOW_REAL_LLM_ENABLED≠1` → identical behavior to today (existing test suite still green)
- `WORKFLOW_REAL_LLM_ENABLED=1 && !OPENROUTER_API_KEY` → falls back to mock, logs warning
- `=1 && key present` → calls OpenRouter via `fetch`, returns text, wraps with `callWithCache`
- LLM trace emitted via `recordLlmCall` with real duration + ok flag
- 5 unit tests: disabled gate / missing key / cache hit / cache miss+live / live error

## Phase 4H — Admin JSON Cache-Stats Endpoint

Exposes `llm_cache_stats` RPC as a headless JSON endpoint for external
scraping (Grafana, PostHog, custom ops dashboards).

**Why:** Current admin monitoring page is server-rendered HTML only.
Operator tools and ratio-based alerts need machine-readable JSON.
`/api/admin/llm-cache-stats` closes that gap with zero new DB plumbing
(reuses `getCacheStats()` from `monitoring-queries.ts`).

**Auth:** CRON_SECRET-guarded Bearer (same pattern as llm-cache-purge).
Consistent with machine-to-machine ops routes. Human-operator access
stays on server-rendered `/admin/monitoring` page.

**Return shape:**
```json
{ "ok": true, "ts": "2026-04-18T21:05:00.000Z",
  "stats": { "total": N, "fresh": N, "expired": N, "totalHits": N, "tokensSaved": N },
  "hitRate": 0.42 }
```

Degraded: `{ "ok": false, "reason": "D1_UNAVAILABLE", ... }` with status 200.

**Success criteria:**
- 401 on missing/wrong Bearer
- 200 `ok:true` with stats + hitRate on success
- 200 `ok:false` on D1 degraded
- 4 unit tests: auth fail / happy path / D1 degraded / throws

## Common constraints

- Both phases: `npx tsc --noEmit` clean on touched files
- Both phases: ≥9.5 auto-ship threshold (combined PR)
- Rule #0: push → CI green → prod HTTP 200 + shortSha match
- Tests baseline 1184 → expected 1184 + 5 (4G) + 4 (4H) = 1193

## Rollback

- Zero D1 schema changes (4H reuses existing RPC; 4G reuses existing cache)
- 4G fully gated → `unset WORKFLOW_REAL_LLM_ENABLED` restores mock
- 4H is new route → delete file + remove nothing else

## Risk

- **LOW** — both env-gated and/or additive-only
- 4G worst case: LLM call fails → catch path marks mission failed (existing behavior for exceptions)
- 4H worst case: D1 down → 200 `ok:false` (never pages)

## Shipped

**Commit:** dde51a24 (2026-04-18 02:37 UTC)

**Test Delta:** 1184 → 1193 (+9 tests)
- Phase 4G workflow-stepper/route.test.ts: 5 new unit tests (disabled gate / missing key / cache hit / cache miss+live / live error)
- Phase 4H llm-cache-stats/route.test.ts: 4 new unit tests (auth fail / happy path / D1 degraded / throws)

**Code Review:** 9.5/10 SHIP
- Zero critical findings
- Parallel file ownership enforced (4G + 4H no overlap)
- Both phases env-gated or additive (zero rollback friction)

**Prod Verify:** HTTP 200 shortSha=dde51a24 matches HEAD

**Rule #0:** All 3 gates green
- Build: ✅ exit code 0
- Tests: ✅ 1193/1193 pass
- CI/CD: ✅ GitHub Actions complete + CF Pages deployed
