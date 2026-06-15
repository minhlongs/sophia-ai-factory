---
name: Sophia Phase 4E.3 LLM Cache Purge Cron
status: shipped
priority: P2
estimate: 1h
session: PM-16 2026-04-18
parent: 260418-1500-sophia-phase4f1-resolve-org-id (Phase 4F.1 shipped 9c34c3b)
pdf_bullet: Giai đoạn 6.2 Semantic Cache (ops hygiene slice)
commit: 078fabe
shipped_at: 2026-04-18
final_tests: 1184/1184
review_score: 9.7/10
---

# Phase 4E.3 — LLM Cache Purge Cron

Closes the `purge job deferred to Phase 4E.3` TODO in migration 0008.
Prevents unbounded `llm_cache` growth once `LLM_CACHE_ENABLED` flips ON.
Completes the cost-optimization loop: write → TTL → expire → DELETE.

## Scope

New daily cron `/api/cron/llm-cache-purge` that executes
`DELETE FROM llm_cache WHERE expires_at < datetime('now')` and returns
the row count. CRON_SECRET-guarded, D1 failure = silent 200 (fire-and-forget).

## Phases

| Phase | File(s)                                                       | Status |
|-------|---------------------------------------------------------------|--------|
| 1     | `src/app/api/cron/llm-cache-purge/route.ts` (new, <100 LOC)  | done   |
| 1     | `src/app/api/cron/llm-cache-purge/route.test.ts` (4 tests)   | done   |
| 2     | `wrangler.toml` (add `"0 7 * * *"` → crons array)            | done   |

## Out of scope

- Per-org metrics emission (future 4E.3b if needed; YAGNI now)
- BatchDelete > N rows (not needed — D1 handles tens-of-thousands)
- PostHog telemetry for purge count (could add but adds dep for cold path)
- `LLM_CACHE_ENABLED` flip (separate operational decision)

## Success criteria

- Cron route: 401 on missing CRON_SECRET (prod), 200 ok:true on success
- D1 failure → 200 ok:false (never page founder)
- Uses existing `idx_llm_cache_org_expires` index (composite; seq-scan on expires_at column is fine since cache is small)
- 4 unit tests cover: auth fail / D1 missing / D1 delete success / D1 throws
- `npx tsc --noEmit` clean on touched files
- Tests 1180 → 1184+ (+4 tests)
- Code review ≥9.5 (auto-ship threshold)
- Rule #0: push → CI green → prod HTTP 200 + shortSha match

## Locked decisions (auto-mode)

- **Schedule:** `"0 7 * * *"` UTC = 14:00 Vietnam ICT — off-peak, after
  daily 01–06 UTC batch crons, before 08 UTC user-activity spike.
- **Cron pattern:** GET + POST handler like existing `error-digest` —
  CF triggers will hit via `scheduled()` eventually, HTTP exposure
  stays CRON_SECRET-guarded.
- **DB access:** raw D1 binding via `globalThis.DB` (same as error-digest).
  No createServerClient wrapper because we want `meta.changes` count.
- **Return shape:** `{ok: true, deleted: N, ts: ISO}` on success.
  Matches existing cron conventions.
- **Env gate:** Purge runs regardless of `LLM_CACHE_ENABLED` — safe
  no-op when cache empty. No dark-launch needed.

## Rollback

- Zero D1 schema changes (DELETE only, no DDL)
- Revert = remove route file + revert wrangler.toml crons entry
- `git revert` single commit

## Risk

- **LOW** — DELETE targets only expired rows (expires_at < now). Newly
  written rows have expires_at = now+24h, so zero chance of touching
  live data.
- Cache re-fill on next request is natural behavior (write-through).

## Landscape position

- 4E ✅ (exact-match cache)
- 4E H-1 ✅ (org scoping)
- 4F ✅ (cache wiring MVP)
- 4F.1 ✅ (resolveOrgId unification)
- **4E.3 → this (ops hygiene)**
- 4E.2 ⏭ semantic similarity (embeddings, needs AI binding)
- 4E.4 ⏭ per-org llm_cache_stats admin variant
- 4G ⏭ Supervisor executeStep real LLM + cache wiring

## Shipped

**Commit:** 078fabe (2026-04-18)

**Test Delta:** 1180 → 1184 (+4 tests)
- route.test.ts: 4 new unit tests (auth fail / D1 missing / delete success / D1 throws)

**Code Review:** 9.7/10 SHIP
- Clean DELETE-only logic, no schema churn
- Proper D1 error handling (200 ok:false fallback)
- Consistent with existing cron conventions (error-digest pattern)

**Prod Verify:** HTTP 200 shortSha=078fabe3 matches HEAD

**Rule #0:** All 3 gates green
- Build: ✅ exit code 0
- Tests: ✅ 1184/1184 pass
- CI/CD: ✅ GitHub Actions complete + CF Pages deployed
