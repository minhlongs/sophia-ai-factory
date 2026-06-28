# Phase 4.7 — Admin Monitoring Dashboard MVP

**Date:** 2026-04-17 PM-12
**PDF mapping:** Giai đoạn 4 Bước 4.7 "Dashboard Monitoring" (React admin dashboard with real-time metrics).
**Mode:** `/cook --auto` (YAGNI, single-pass, ship to prod).

---

## Scope

Server-rendered `/admin/monitoring` page showing LLM + workflow + signals health. NO client polling, NO Recharts in MVP (stat cards + tables sufficient). Next.js `revalidate: 60s` + manual refresh button.

Also closes **Phase 4E deferred item M-2** (hit_count increment) because the dashboard is the first real consumer.

## Files

**New (3):**
- `src/lib/admin/monitoring-queries.ts` — typed D1 aggregates (`getCacheStats`, `getWorkflowStats`, `getSignalsStats`)
- `src/lib/admin/monitoring-queries.test.ts` — unit tests with `vi.mock('@/lib/db/client')`
- `src/app/[locale]/(admin)/admin/monitoring/page.tsx` — Server Component, admin-guarded, grid of stat cards

**Modified (2):**
- `src/lib/llm/cache/llm-cache.ts` — add fire-and-forget `UPDATE hit_count` inside `lookupCache` on fresh hit
- `src/lib/llm/cache/llm-cache.test.ts` — test for hit_count increment behavior
- `src/app/components/admin/admin-sidebar.tsx` — add "Monitoring" nav item (uses `Activity` lucide icon)

**Docs (2):**
- `docs/project-changelog.md` — Phase 4.7 entry
- `docs/development-roadmap.md` — mark Bước 4.7 shipped

## Design decisions

1. **Server-side only** — edge-friendly, no WebSocket / SSE / polling infra. `revalidate: 60s` means fresh-ish data; operator can reload for real-time.
2. **No Recharts in MVP** — shadcn `Card` + progress bars + top-N tables communicate the same numbers. Can add charts in 4.7.1 if operator asks.
3. **No new D1 table** — aggregate over `llm_cache`, `workflows`, `signals_events`. No `llm_call_trace` yet (Phase 4B stored calls differently per existing code).
4. **hit_count increment** — after a fresh cache hit, fire-and-forget `UPDATE llm_cache SET hit_count = hit_count + 1 WHERE hash = ?`. Closes M-2 from Phase 4E deferred list. Without this, dashboard shows zero hits forever.
5. **Auth** — same pattern as `/admin/users`: `getCurrentUser()` → `redirect('/dashboard')` if `role !== 'admin'`.
6. **DB client** — `createServerClient()` (sync, canonical per CLAUDE.md).

## Deferred (not Phase 4.7)

- Real-time polling (Server-Sent Events / 30s client poll)
- Recharts line/pie charts for time-series
- Per-model breakdown (joins llm_cache with trace table)
- Alerts (threshold → email / telegram) — Phase 4.7.2
- LLM call trace table (Phase 4B used signals_events; a dedicated `llm_call_trace` D1 table is Phase 4B.2)

## Success criteria

- Build 0 TS errors
- Tests green (+N for monitoring-queries + hit_count increment)
- `/admin/monitoring` renders cards with D1 aggregates for authenticated admin
- Non-admin redirects to `/dashboard`
- Commit + push + CI green + prod HTTP 200 + `/api/version` shortSha match
