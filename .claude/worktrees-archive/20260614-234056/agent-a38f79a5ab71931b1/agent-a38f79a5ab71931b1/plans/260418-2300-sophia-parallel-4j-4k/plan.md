---
name: Sophia Round 3 Parallel — Phase 4J + Phase 4K
status: shipped
priority: P2
estimate: 1.5h (parallel ≈ 45 min wall-clock)
session: PM-19 2026-04-18
parent: 260418-2200-sophia-parallel-4gfix-4i (shipped b7c750d9)
pdf_bullet: Giai đoạn 4 (provider coverage) + 7 (admin observability surface)
mode: --auto --parallel
commit: 32bb4690
shipped_at: 2026-04-18 03:36 UTC
final_tests: 1212/1212
review_score: 9.6/10
---

# Round 3 — Phase 4J + Phase 4K (parallel)

Two file-disjoint slices.

## File Ownership Matrix (STRICT)

| Phase | Owner | Files                                                                                | Conflicts |
|-------|-------|--------------------------------------------------------------------------------------|-----------|
| 4J    | Dev-A | `src/lib/ai/anthropic-adapter.ts` (NEW)<br/>`src/lib/ai/anthropic-adapter.test.ts` (NEW)<br/>`src/app/api/cron/workflow-stepper/route.ts` (modify — anthropic branch)<br/>`src/app/api/cron/workflow-stepper/route.test.ts` (modify — +2 tests) | none |
| 4K    | Dev-B | `src/app/[locale]/(admin)/admin/monitoring/page.tsx` (modify — LLM Trace section)<br/>`src/lib/admin/monitoring-queries.ts` (modify — add getTraceStats SSR helper)<br/>`src/lib/admin/monitoring-queries.test.ts` (modify or NEW — +3 tests for getTraceStats) | none |

Zero overlap — 4J touches `lib/ai/` + `cron/workflow-stepper`; 4K touches `lib/admin/` + admin page.

## Phase 4J — Anthropic API Adapter

Currently `routeLlm` returns `provider: 'anthropic'` for complex prompts, but Phase 4G-FIX gates it to mock (`REAL_LLM_PROVIDERS = {'openrouter','local-mekongd'}`). 4J unlocks the branch with a thin Anthropic-native adapter.

**Scope MVP:**
- `callAnthropic({ model, messages, apiKey })` pure async fn hitting `https://api.anthropic.com/v1/messages`
- Env gate: `ANTHROPIC_API_KEY` (shared key — BYOK later)
- Add `'anthropic'` to `REAL_LLM_PROVIDERS` in workflow-stepper
- Branch in workflow-stepper: if `decision.provider === 'anthropic'` + `ANTHROPIC_API_KEY` present → call adapter; else preserve `llmDegraded=true` + mock
- 5 unit tests for adapter (happy path / missing key / HTTP error / empty response / network throw) + 2 integration tests in workflow-stepper route (anthropic success / anthropic swallowed to mock)

**Scope-not-touched:**
- Streaming responses (sync-per-tick cron)
- BYOK per-user Anthropic keys (workflows.org_id→user_id schema gap)
- Anthropic tool-use / vision

**Success criteria:**
- Adapter standalone: 5 tests pass
- Workflow-stepper: `anthropic` provider + key → fetch anthropic.com, ok:true
- Workflow-stepper: `anthropic` provider + no key → mock + `llm_router_unsupported` warn + ok:false + errorClass `LLM_LIVE_FAILED_FALLBACK`
- `tsc --noEmit` clean

## Phase 4K — Admin Monitoring: Embed 4H + 4I Data

Current `/admin/monitoring` page server-renders cache/workflow/signals stats via `@/lib/admin/monitoring-queries`. 4K adds an "LLM Trace (24h)" section surfacing the same data as `/api/admin/llm-trace-stats` (Phase 4I), but SSR-direct (no HTTP round-trip).

**Why not client-fetch from /api routes?** Keeps page SSR, avoids Bearer auth from browser, reuses D1 binding. API route remains for external ops tooling.

**Scope MVP:**
- Add `getTraceStats()` SSR helper in `monitoring-queries.ts` — queries `signals_events WHERE event_type='llm_call_trace'` 24h, calls pure `aggregateTraceStats(rows)` imported from `@/app/api/admin/llm-trace-stats/route`
- Degraded path: returns `null` if D1 unavailable (same pattern as existing queries)
- Modify page.tsx: new section with 4 cards — Total Calls / Success Rate / Avg Duration / Top Provider+Model mini tables
- Preserve existing cache/workflow/signals sections
- 3 unit tests for `getTraceStats`: happy path / D1 missing → null / D1 throws → null

**Scope-not-touched:**
- Charts / time-series (snapshot only)
- Client-side live refresh
- Rewriting existing cards

**Success criteria:**
- Page renders with new section when D1 has trace rows
- Section shows "No LLM traces yet" when empty or degraded (no error banners)
- 3 getTraceStats tests pass
- `tsc --noEmit` clean

## Common constraints
- Both phases ≥9.5 auto-ship threshold
- Rule #0 pipeline (build + tests + push + CI + prod HTTP 200 + shortSha match)
- Tests baseline 1202 → expected 1202 + 7 (4J) + 3 (4K) = 1212

## Rollback
- 4J: delete adapter file + revert REAL_LLM_PROVIDERS / anthropic branch; anthropic still unsupported (no regression vs current)
- 4K: revert page.tsx + monitoring-queries.ts; dashboard loses section only

## Risk
- **LOW** — 4J is env-gated (ANTHROPIC_API_KEY not set in prod yet); 4K is additive-only SSR on existing page

## Shipped

### Verification Report
- Build: ✅ exit code 0
- Tests: ✅ 1212/1212 (passed, +10 from baseline 1202)
- Git Push: ✅ commit 32bb4690 → main
- CI/CD: ✅ GitHub Actions green (Tests & Deploy + Post-Merge Tests both success)
- Prod: ✅ HTTP 200, shortSha match with commit 32bb4690
- Review: ✅ 9.6/10 SHIP
- Timestamp: 2026-04-18 03:36 UTC
