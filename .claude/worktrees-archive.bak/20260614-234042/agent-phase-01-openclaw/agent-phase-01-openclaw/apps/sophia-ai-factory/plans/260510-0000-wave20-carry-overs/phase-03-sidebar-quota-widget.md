# Phase 03 — Sidebar Quota Usage Widget (7C)

## Context Links

- Wave 19 Phase 07 carry-over (7C)
- Source: `src/app/[locale]/dashboard/layout.tsx:84-303` (sidebar `<aside>` block)
- Existing data: `GET /api/billing/usage-summary` returns `usage.videoGenerations`, `limits.videoGenerations`, `license.tier`
- Existing card: `src/forest/components/dashboard/quota-usage-bar.tsx` (full-card variant — too big for sidebar)

## Overview

- **Priority:** P2
- **Effort:** 2h
- **Status:** ⏳ IN PROGRESS
- **Description:** Compact at-a-glance quota widget at bottom of dashboard left sidebar so users know "X / Y videos used this month" without navigating to /billing. MASTER tier shows ∞ symbol.

## Key Insights

- `[locale]/layout.tsx` already wraps everything in `<QueryProvider>` — widget can `useQuery(['/api/billing/usage-summary'])` and ride existing cache (billing page already prefetches it).
- `dashboard/layout.tsx` is a **server component** — widget MUST be a client component imported into JSX tree.
- Endpoint already returns 404 when no license — widget must hide gracefully on 404 (new BASIC user pre-checkout).
- MASTER tier limit is reported as `Infinity` numerically — JSON serializes `Infinity` as `null` in Next.js. Endpoint sends `999999` as sentinel for unlimited; widget renders ∞ icon when `limit >= 999999` OR tier === 'MASTER'.

## Requirements

### Functional
- F1. Place compact widget at bottom of sidebar nav, ABOVE upgrade CTA + HealthIndicator + SignOutButton.
- F2. Show "Videos this month: <used>/<limit>" with horizontal progress bar.
- F3. Color thresholds: ok <75%, warning ≥75%, critical ≥90%.
- F4. MASTER tier renders "<used> / ∞" with no progress bar (or full subtle bar).
- F5. Click → links to `/dashboard/billing`.
- F6. Bilingual i18n (en.json + vi.json).
- F7. Hide silently on fetch error / 404 (no license yet).

### Non-Functional
- NF1. <120 LOC component.
- NF2. No `:any`. Reuse `UsageSummaryResponse` type from `billing-page-types.ts`.
- NF3. Tests cover: rendering with data, MASTER tier ∞, hidden on error, click navigates.

## Architecture

```
src/forest/components/dashboard/sidebar-quota-widget.tsx (NEW client component)
   └── useQuery('/api/billing/usage-summary')
   └── computes pct = used/limit
   └── renders compact card → Link to /dashboard/billing

src/app/[locale]/dashboard/layout.tsx (MODIFY)
   └── import SidebarQuotaWidget
   └── render inside aside footer block, above HealthIndicator
```

## Related Code Files

### Modify
- `src/app/[locale]/dashboard/layout.tsx` — mount widget in footer block
- `messages/en.json` + `messages/vi.json` — add `dashboard.sidebar.quotaWidget.*` keys

### Create
- `src/forest/components/dashboard/sidebar-quota-widget.tsx`
- `src/forest/components/dashboard/__tests__/sidebar-quota-widget.test.tsx`

## Implementation Steps

1. Create client component `sidebar-quota-widget.tsx`:
   - `useQuery<UsageSummaryResponse>(['/api/billing/usage-summary'])`
   - Hide if loading / error / no data
   - Compute `pct = Math.min(100, Math.round((used/limit)*100))`
   - Render compact `<Link>` card with bar + "X/Y videos" label
   - MASTER tier → ∞ icon, no bar
2. Mount in `dashboard/layout.tsx` between `<ReplayTourLink>` and `userTier !== MASTER` upgrade CTA
3. Add 4 i18n keys: `title`, `videosLabel`, `unlimited`, `viewBilling`
4. Write 4 tests (load, render, MASTER, error)
5. `npm run build` + `npm test`
6. Commit + CF-direct deploy + SHA verify

## Todo List

- [x] Create `sidebar-quota-widget.tsx`
- [x] Mount in dashboard layout
- [x] i18n keys (en + vi)
- [x] Tests (4 cases)
- [x] `npm run build` → 0 errors
- [x] `npm test` → all pass
- [x] Code review pass
- [x] Commit + CF deploy + SHA verify

## Success Criteria

- [ ] BASIC user with 5/100 videos sees "5/100 Videos" + green bar in sidebar.
- [ ] MASTER user (FREE100) sees "12 / ∞" with no bar.
- [ ] User pre-checkout (no license) sees nothing — no broken UI.
- [ ] Click on widget → navigates to `/dashboard/billing`.

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| `usage-summary` endpoint adds cache pressure (every dashboard load) | M | L | TanStack Query dedupes via shared key; staleTime 60s |
| MASTER `Infinity` JSON serialization | L | L | API returns 999999 sentinel; widget checks `>= 999999` OR `tier === 'MASTER'` |
| Sidebar visual clutter on small viewports | L | L | `hidden md:flex` already on parent — desktop only |

## Security Considerations

- Endpoint `/api/billing/usage-summary` already requires auth (getCurrentUser); widget is just consumer.
- No new attack surface.

## Next Steps

- Phase 04 (Account Export + Change-Email) is independent — can ship after this.
