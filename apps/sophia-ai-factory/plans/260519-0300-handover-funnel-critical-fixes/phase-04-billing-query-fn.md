# Phase 04 — Billing useQuery missing queryFn

## Context Links
- Audit: `plans/reports/ui-ux-designer-260519-0240-dashboard-usability.md` §Flow 3 finding #2, §Flow 5 finding #2; screenshot `29-billing-page.png`
- Billing client: `src/app/[locale]/dashboard/billing/billing-client.tsx` (lines 42-51 — broken useQuery calls)
- QueryProvider: `src/forest/components/providers/query-provider.tsx` (no default queryFn)
- Comparable broken pattern: `src/forest/components/license/license-status-card.tsx` (line 33), `src/forest/components/license/license-alert-panel.tsx` (line 31 — HAS queryFn so works)

## Overview
- Priority: 🔴 Critical
- Status: pending
- `/dashboard/billing` shows infinite "Loading billing data…" spinner. Page has no timeout/fallback. The `useQuery({queryKey: [url]})` pattern at line 42 has NO `queryFn` — React Query v5 requires a `queryFn` or a `defaultOptions.queries.queryFn`. Neither exists. Query stays `isLoading=true` forever.

## Key Insights
- Audit found this pattern in `billing-client.tsx` AND `license-status-card.tsx`. Both broken the same way.
- React Query v5 removed implicit fetcher behavior — must define `queryFn` explicitly or via `QueryClient` default.
- Other useQuery callers in the codebase (`license-alert-panel.tsx`, `health-indicator.tsx`, `agent-performance-card.tsx`) HAVE explicit `queryFn` — so they work.
- Fix has two valid approaches:
  - **A** (broad): Add `defaultOptions.queries.queryFn` to `QueryProvider` that treats `queryKey[0]` as URL. Fixes all "queryKey is URL" patterns at once.
  - **B** (narrow): Add explicit `queryFn` to the two broken files (`billing-client.tsx`, `license-status-card.tsx`).
- Recommendation: **A** — DRY, fixes future regressions, matches existing convention (queryKey already shaped like `['/api/...', extra]`).

## Requirements
- `/dashboard/billing` resolves to usage data view within 3s (or shows real error message)
- `license-status-card` also loads (collateral fix)
- All existing useQuery callers with explicit `queryFn` continue to work (no override)
- Default queryFn handles JSON parsing + non-2xx errors gracefully
- Timeout: 10s safety net (so spinner doesn't hang on truly stuck request)

## Architecture
- Layer: **forest (providers) + dashboard client (no logic change)**
- Pattern: extend QueryClient `defaultOptions.queries` with `queryFn` that:
  - Takes first segment of queryKey as URL
  - Appends remaining segments as query params if they're strings
  - Calls `fetch(url, { credentials: 'include' })`
  - Throws on non-2xx
  - Returns parsed JSON

## Related Code Files
- Modify: `src/forest/components/providers/query-provider.tsx`
- Reference (no change but verify fix): `src/app/[locale]/dashboard/billing/billing-client.tsx`
- Reference (will also load after fix): `src/forest/components/license/license-status-card.tsx`
- Skim for collateral fixes: grep `useQuery<.*>\({\s*queryKey` — find all callers without `queryFn`

## Implementation Steps
1. Open `src/forest/components/providers/query-provider.tsx`.
2. Add default queryFn:
   ```ts
   defaultOptions: {
     queries: {
       queryFn: async ({ queryKey }) => {
         const [url, ...params] = queryKey as [string, ...unknown[]];
         if (typeof url !== 'string' || !url.startsWith('/api/')) {
           throw new Error(`Invalid queryKey: expected first element to be an /api/ URL string`);
         }
         // Build URL with optional query params
         const fetchUrl = params.length > 0 && params[0]
           ? `${url}?${new URLSearchParams({ id: String(params[0]) })}`
           : url;
         const res = await fetch(fetchUrl, { credentials: 'include' });
         if (!res.ok) {
           const text = await res.text().catch(() => '');
           throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
         }
         return res.json();
       },
       staleTime: 30 * 1000,
       gcTime: 5 * 60 * 1000,
       refetchOnWindowFocus: false,
       retry: 2,
     },
   }
   ```
3. Run existing tests — `npm test -- billing license` to catch regressions.
4. Check all useQuery callers don't conflict:
   - Files WITH explicit `queryFn` (license-alert-panel, health-indicator, etc.) — these override default, no change in behavior.
   - Files WITHOUT (billing-client, license-status-card, possibly others) — now use default. Verify queryKey is URL-shaped.
5. Build + deploy locally:
   ```bash
   npm run build
   npm run dev
   # visit /en/dashboard/billing — should resolve
   ```
6. Add minimal unit test for QueryProvider default queryFn (mock fetch, assert URL build + JSON parse).

## Todo List
- [ ] Add `defaultOptions.queries.queryFn` to QueryProvider
- [ ] Verify billing page resolves with real data in dev
- [ ] Verify license-status-card resolves
- [ ] Grep for other useQuery callers without queryFn — list them
- [ ] No regression on health-indicator, license-alert-panel, agent-performance
- [ ] Unit test for default queryFn (success + error path)
- [ ] Build passes

## Success Criteria
```ts
test('billing page loads without infinite spinner', async ({ page }) => {
  await loginAsBasicUser(page);
  await page.goto(`${PROD_URL}/en/dashboard/billing`);
  // Spinner should disappear within 5s
  await expect(page.getByText(/loading billing data/i)).toBeHidden({ timeout: 5000 });
  // Either data renders OR clear error message
  const hasData = await page.getByText(/usage|breakdown|api calls/i).isVisible().catch(() => false);
  const hasError = await page.getByText(/error|failed/i).isVisible().catch(() => false);
  expect(hasData || hasError).toBe(true);
});
```

## Risk Assessment
- **Medium risk**. QueryProvider is used by entire dashboard.
- If default queryFn URL parsing logic is wrong, ALL useQuery callers break.
- Mitigation: validate queryKey shape (must start with `/api/`); fallback to a clear error.
- Existing callers with explicit `queryFn` are UNAFFECTED (their queryFn overrides default).
- Watch for callers that use queryKey for cache-tag purposes only (not as fetch URL) — verify none in dashboard.

## Security Considerations
- Default queryFn uses `credentials: 'include'` — cookies sent. Correct for our auth model.
- URL validation: only allow `/api/*` prefix — prevents accidental cross-origin or non-API requests.
- Error message clipped to 200 chars to avoid leaking response bodies in client error logs.
- No new auth surface.

## Dependencies
- None. Can run in parallel with phases 01, 02, 03, 05.

## Unresolved Questions
1. Should we ALSO add a global timeout to the QueryClient (`networkMode: 'always'` + custom AbortController)? Audit recommends a "timeout + error fallback" for billing — but UX may be that 10s is acceptable for slow data. Operator decision.
2. Should retry count be reduced from 2 to 1 for billing-specific calls? Bandwidth/Cloudflare cost consideration.
3. Are there other dashboard routes silently broken from this same missing-queryFn bug? Audit's "stuck-loading" list (campaigns/missions/workflows/sops/account/settings/support/wallet/create) — investigate as part of Phase 06; some may share root cause.
