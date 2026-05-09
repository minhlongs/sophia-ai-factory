# Phase 2 Wave 13 Group I4 — Implementation Report

**Date:** 2026-05-09
**Status:** COMPLETED

---

## Files Modified

| File | Lines | Action |
|------|-------|--------|
| `src/app/api/v1/missions/[id]/stream/route.ts` | +52 / ~135 total | SSE cursor + Last-Event-ID |
| `src/forest/components/raas/mission-detail.tsx` | +80 / ~275 total | SSE subscription + reconnect UX |
| `src/forest/components/byok/byok-provider-picker.tsx` | 186 | NEW |
| `messages/en.json` | +6 keys | i18n append |
| `messages/vi.json` | +6 keys | i18n append |

---

## Task 1 — SSE Last-Event-ID Reconnect

**Cursor type:** `updated_at` unix-ms timestamp from `engine_missions` row.

**Flow:**
1. Server reads `Last-Event-ID` header on each request (browser sets automatically)
2. Parses as int → `resumeCursor` (0 = no prior events)
3. Every `status` event emits `id: <updated_at>` line per SSE spec §9.2.6
4. Heartbeat `ping` events also emit `id: <server_now_ms>` so cursor advances even when mission is idle
5. On reconnect: if `data.updated_at <= emittedCursor` → skip emission (dedup), continue poll loop
6. Terminal state after reconnect → sends `done` again so client cleanly closes

No schema change — `updated_at` already present on `engine_missions`.

---

## Task 2 — Mission Detail Reconnect UX

**SSE subscription added** via `useEffect` (after initial REST fetch populates card).

- Listens to `status` events → merges into `mission` state (status, credits_used, completed_at)
- Listens to `done` event → `es.close()` — no lingering connection after terminal state
- `onerror` → starts 5s timer; if still erroring, sets `reconnecting=true` → yellow banner shown
- On successful `status` event → clears timer, `setReconnecting(false)`
- Cleanup on unmount: `clearTimeout` + `es.close()`
- Existing REST fetch still runs for instant initial render

i18n key used: `dashboard.missions.sse_reconnecting`

---

## Task 3 — BYOK Provider Picker

**LOC:** 186 lines (`byok-provider-picker.tsx`)

**Supported providers (with model counts):**
- `anthropic` → 3 models (Opus 4.7, Sonnet 4.6, Haiku 3.5)
- `openrouter` → 3 models (GPT-4o, Claude Sonnet, Llama 3.1 8B)
- `openai` → 3 models (GPT-4o, GPT-4o Mini, o1-mini)

**Cost preview:** input/output $/1k tokens displayed inline per model.

**API:** `GET /api/user/byok` → filters response to only providers with model coverage.

**Emission:** `onSelect({ providerId, modelId })` or `onSelect(null)` for system default.

**Integration point:** `MissionLauncher` accepts optional `selectedModel` prop (wire-in is OPTIONAL per task — picker is self-contained, ready to integrate).

---

## i18n Keys Added (12 total, 6 per locale)

```
dashboard.missions.sse_reconnecting   (en + vi)
byok.picker.placeholder               (en + vi)
byok.picker.system_default            (en + vi)
byok.picker.aria_label                (en + vi)
byok.picker.no_providers              (en + vi)
byok.picker.cost_preview              (en + vi)
```

---

## QA Results

- `npx tsc --noEmit`: 0 errors
- `npm test`: 2898 pass / 31 skipped (293 test files)

---

## Unresolved Questions

- `MissionLauncher` → `byok-provider-picker` wiring left as optional (YAGNI: mission creation via `/api/raas/missions` POST currently ignores `model` field — needs backend schema change before full wiring makes sense)
- SSE stream uses long-polling (2s interval) not true push — `updated_at` cursor prevents redundant re-delivery but doesn't eliminate poll overhead; acceptable for current scale
