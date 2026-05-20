# Phase 06 — Throttle SSE/Polling to Fix Renderer Crash

## Phase Implementation Report

### Executed Phase
- Phase: phase-06-create-renderer-crash
- Plan: plans/260519-0300-handover-funnel-critical-fixes/
- Status: completed

---

## Polling/SSE Sources Found

| File | Line | Current cadence | In shared layout? |
|------|------|-----------------|-------------------|
| `src/forest/components/dashboard/health-indicator.tsx` | 17 | 30s (`refetchInterval: 30000`) | YES — all 9 routes |
| `src/forest/components/dashboard/sidebar-quota-widget.tsx` | 36 | none (`staleTime: 60_000`, no `refetchInterval`) | YES — all 9 routes |
| `src/forest/components/agent-sidebar/use-agent-chat.ts` | 55 | N/A (SSE-style: fetch+ReadableStream, fires per user send) — BUT no unmount cleanup | YES — all 9 routes |
| `src/forest/components/missions/agent-team-panel.tsx` | 41 | 5s (`setInterval`) | NO — missions + agents page only |
| `src/forest/components/workflows/workflow-timeline.tsx` | 47 | 3s (`setInterval`) | NO — workflow detail page only |
| `src/forest/hooks/use-agent-stream.ts` | 43 | SSE `EventSource` with 5s reconnect | NO — missions task-feed only |

**AgentSidebar SSE status:** `useAgentChat` does NOT use `EventSource`. It uses `fetch POST + response.body.getReader()` — triggered only by user send action. No continuous background SSE. No polling cadence to reduce. Root issue was the **missing unmount cleanup** — if a stream was in-flight at navigation time, the HTTP connection stayed open indefinitely, blocking the document `load` event.

---

## Per-Source Changes

### 1. `use-agent-chat.ts` — Unmount abort (CRITICAL FIX)

**Root cause:** The `abortRef` was only invoked via `clearMessages()` (user-triggered). On component unmount during navigation, in-flight `fetch + getReader()` HTTP connections were never aborted. This kept the HTTP response stream open across route navigations, accumulating leaked connections that prevented `document.load` from firing on all 9 dashboard routes.

**Fix:** Added `useEffect(() => () => abortRef.current?.abort(), [])` — fires on unmount, aborting any in-progress stream. The existing `AbortController` ref already passed as `signal` to `fetch()`, so the abort propagates correctly.

**Added to import:** `useEffect` (was missing from `import { useState, useCallback, useRef }`).

### 2. `health-indicator.tsx` — 30s → 60s

`refetchInterval: 30000` → `refetchInterval: 60_000`

Layout-level React Query poll shared across ALL dashboard routes. Halved frequency to reduce steady-state network noise. No functional change — badge still updates within a minute.

### 3. `agent-team-panel.tsx` — 5s → 30s

`setInterval(..., 5_000)` → `setInterval(..., 30_000)` on missions/agents pages. Was the most aggressive interval in the codebase. Now at 30s minimum.

### 4. `workflow-timeline.tsx` — 3s → 30s

`POLL_INTERVAL_MS = 3000` → `POLL_INTERVAL_MS = 30_000` on workflow detail page only. Polling stops automatically when workflow reaches terminal status (`completed|failed`), so in most real-world cases this timer self-cancels after 1-2 ticks.

### 5. `sidebar-quota-widget.tsx` — no change

Has `staleTime: 60_000` but no `refetchInterval`. React Query will NOT auto-refetch after stale. Left alone — already correct.

---

## AgentSidebar Refactor Strategy

**No SSE → polling refactor needed.** The sidebar does not use `EventSource`. The fix is the unmount cleanup only. No new endpoint created — existing `POST /api/v1/agent-chat` was already correct.

---

## Heap Profile

Skipped — no local Chromium DevTools session available in this agent context. **Recommend operator verify:**
1. Open Chrome DevTools → Memory tab → Take snapshot on `/dashboard/create`
2. Navigate to 3 other dashboard routes and back
3. Take second snapshot, compare retained HTTP connections/streams
4. Expected: 0 retained ReadableStream objects from previous navigations (prior to fix: each navigation in-flight left 1 open)

---

## Quality Gates

- `npm run type-check` → **PASS** (0 errors)
- `npm run lint` → **PASS** (340 warnings, 0 errors — within ≤341 baseline)
- `npm test` (pre-push hook) → **PASS** (4572 tests, 34 skipped)

---

## Commit SHA

`cde49bc5fe0aabcb64f4abc9b5b8340b7f5ccd89`

Pushed to `origin/main` via pre-push hook (all gates passed).

---

## Risk Callouts

1. **WorkflowTimeline UX degradation (MEDIUM):** Raising 3s → 30s on the workflow detail page means running workflows show no progress updates for up to 30s. For short workflows (< 60s), this may look broken. Mitigation: workflows auto-stop polling on terminal status — this only affects users watching a running workflow. Operator can raise to 10s if acceptable vs the 30s minimum spec constraint.

2. **AgentTeamPanel UX degradation (LOW):** 5s → 30s on missions page. Agent status badges refresh less frequently. For a feature most users don't use heavily, acceptable.

3. **HealthIndicator badge lag (MINIMAL):** 30s → 60s means status badge can lag up to a minute. Users navigating away and back will see a slightly stale status briefly. React Query cache still shows the last value immediately.

4. **`load` event still blocked by other sources:** The unmount cleanup is the primary fix. If an operator deploys and the `load` event still doesn't fire on `/dashboard/create`, the next suspect is `SidebarQuotaWidget`'s `staleTime` preventing initial fetch completion, or `CmdKPalette` (not investigated — contains no `setInterval`/`EventSource` per grep). Check `cmd-k-palette.tsx` manually if issue persists.

---

## Unresolved Questions

1. **Is `WorkflowTimeline` 30s too slow for live workflow execution?** The 3s interval was clearly chosen to give responsive feedback. If workflow execution completes in < 60s, user will see the spinner for a long time with no state updates. Recommend operator decide: accept 30s (spec-compliant) or accept 10s as a live-progress exception with documented rationale.

2. **Is the renderer crash fully resolved by the unmount fix?** The phase analysis said "likely cumulative across test suite, not unique to create." The fix addresses the HTTP connection leak but doesn't prevent memory growth from other React state accumulated across 100 navigations. The 30s/60s throttling reduces background CPU/GC pressure which should further reduce crash probability.

3. **`/api/agents/stream` EventSource in `use-agent-stream.ts`:** This SSE is used only by `task-feed.tsx` on the missions page — not shared layout. Cleanup is correctly handled (`mountedRef` + `esRef?.close()`). Not modified. However if `TaskFeed` is ever moved into the layout, this would become a layout-level leak. Flag for architectural review.
