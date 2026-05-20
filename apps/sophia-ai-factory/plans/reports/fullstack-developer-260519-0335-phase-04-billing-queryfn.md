# Phase 04 — Billing useQuery queryFn Fix

**Status:** completed
**Commit:** `77caddf0`

---

## Files Modified

| File | Change |
|---|---|
| `src/seed/utils/fetch-json.ts` | NEW — reusable typed JSON fetcher helper |
| `src/app/[locale]/dashboard/billing/billing-client.tsx` | Add queryFn to 2 useQuery calls (usage-summary + dunning-status) |
| `src/forest/components/license/license-status-card.tsx` | Add queryFn (license/status with nonce param) |
| `src/forest/components/license/usage-meter.tsx` | Add queryFn (license/usage with nonce param) |
| `src/forest/components/dashboard/sidebar-quota-widget.tsx` | Add queryFn (quota/status) |

---

## Components with missing queryFn (found by grep)

Grep pattern: `useQuery` across all `.ts/.tsx`, filter by missing `queryFn`.

| File | Missing queryFn | Fixed |
|---|---|---|
| `billing-client.tsx` | 2 calls | yes |
| `license-status-card.tsx` | 1 call | yes |
| `usage-meter.tsx` | 1 call | yes |
| `sidebar-quota-widget.tsx` | 1 call | yes |

**Already had explicit queryFn (no change needed):**
- `license-alert-panel.tsx` — queryFn present
- `health-indicator.tsx` — queryFn present
- `discovery/dashboard.tsx` — queryFn present
- `use-mission-control-data.ts` — queryFn present
- `use-usage-metrics.ts` — queryFn present
- `system-health-client.tsx` — queryFn present
- `agent-health-card.tsx` — queryFn present
- `agent-performance-card.tsx` — queryFn present

---

## New Helper

`src/seed/utils/fetch-json.ts` — `fetchJson<T>(url: string): Promise<T>`
- `credentials: 'include'` for cookie auth
- Throws `Error("HTTP ${status} on ${url}: ${body.slice(0,200)}")` on non-2xx
- Seed layer: importable by any layer per architecture rules

---

## Quality Gates

- Type check: **0 errors** (`npm run type-check`)
- Lint: **341 warnings, 0 errors** (matches baseline, no new errors introduced)
- Pre-push hooks: passed (4572 tests pass, secretlint clean)

---

## Commit SHA

`77caddf0` — pushed to `origin/main`

---

## Unresolved Questions

1. `license-status-card.tsx` and `usage-meter.tsx` — the `nonce` is passed as `?nonce=` query param. Confirm the API routes `/api/license/status` and `/api/license/usage` accept `nonce` via query string (vs path param or body). If not, the URL shape needs adjustment.
2. Should `fetchJson` add an `AbortSignal` timeout (e.g. 10s) to prevent long-hanging requests on flaky edge? Currently relies on browser's default timeout.
