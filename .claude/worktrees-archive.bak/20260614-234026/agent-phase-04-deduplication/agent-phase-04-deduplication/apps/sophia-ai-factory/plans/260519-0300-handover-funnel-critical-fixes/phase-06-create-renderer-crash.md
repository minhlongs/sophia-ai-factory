# Phase 06 — Create page renderer crash + stuck-load routes

## Context Links
- Audit: `plans/reports/ui-ux-designer-260519-0240-dashboard-usability.md` §Flow 3 findings #3, #4; screenshot `09-create-page.png`
- Audit: list of 9 routes with stuck `load` event (campaigns, missions, workflows, sops, account, settings, support, wallet, create)
- Create page: `src/app/[locale]/dashboard/create/page.tsx` (server) + form: `src/app/[locale]/dashboard/components/campaign-creation-form-with-template-selector.tsx`
- Dashboard layout (shared on all routes): `src/app/[locale]/dashboard/layout.tsx`
- Long-lived clients in layout: `AgentSidebar` (SSE), `HealthIndicator` (30s polling), `SidebarQuotaWidget`, `CmdKPalette`
- Agent chat hook: `src/forest/components/agent-sidebar/use-agent-chat.ts` (uses fetch+reader, manual SSE)

## Overview
- Priority: 🔴 Critical
- Status: pending
- `/dashboard/create` crashes the chromium renderer (confirmed twice in audit). Document `load` event never fires. The same `load`-event-never-fires affects 9 dashboard routes — suggests the issue is shared infrastructure (dashboard layout), not the create page itself.
- Renderer crash is likely a memory leak from leaked SSE/abort controllers in `AgentSidebar` or `HealthIndicator` accumulating across navigations.

## Key Insights
- Page server-component is tiny (40 lines) and pure: fetches static templates, renders form.
- Client form `CreateProjectFormWithTemplates` is 137 lines; only one `useEffect` calling `getOffersForUser()` then setState. No long-lived listeners.
- `TemplateSelector` is pure render of buttons. No images, no animations.
- **The shared layer is suspect**: every dashboard route mounts `AgentSidebar` + `HealthIndicator` + `SidebarQuotaWidget` + `CmdKPalette` via `<Suspense>`. ANY of these can leak:
  - `AgentSidebar` uses `useAgentChat` which holds an `AbortController` ref. If sidebar unmounts mid-stream, controller may not abort cleanly → SSE socket stays open → `load` event never fires → memory grows.
  - `HealthIndicator` does `refetchInterval: 30000` via React Query — fine if cleaned up on route change, but cumulative if multiple tabs open.
- Audit hypothesis: 9 routes have stuck `load`. Single common factor = shared `DashboardLayout` mounts. Diagnose by removing AgentSidebar temporarily and re-running E2E.
- Renderer crash specifically on `/dashboard/create` likely a CUMULATIVE memory issue triggered by test order — not unique to create. Mitigated by per-test isolation in subsequent runs (audit confirms).

## Requirements
- Document `load` event fires within 10s on all dashboard routes (no SSE keeping it open)
- No chromium renderer crash in 100 sequential navigations to `/dashboard/create`
- AgentSidebar functionality preserved (it's the help-bubble UX)
- HealthIndicator continues to show status (audit says "good addition")
- Memory growth across 50 page navigations <50MB

## Architecture
- Layer: **forest (components) + app/layout**
- Pattern: ensure cleanup on unmount; convert long-lived listeners to React Query (centrally cleaned up); reduce shared SSE lifetime
- KISS: smallest change that stops the leak — don't redesign AgentSidebar

## Related Code Files
- Investigate then modify: `src/forest/components/agent-sidebar/agent-sidebar.tsx` (mount/unmount lifecycle)
- Investigate then modify: `src/forest/components/agent-sidebar/use-agent-chat.ts` (line 42 — `abortRef`; ensure cleanup `useEffect` aborts on unmount)
- Investigate: `src/forest/components/dashboard/health-indicator.tsx` (refetch interval) — likely fine
- Investigate: `src/forest/components/dashboard/sidebar-quota-widget.tsx`
- Investigate: `src/forest/components/cmd-k/cmd-k-palette.tsx`
- Modify (if needed): `src/app/[locale]/dashboard/layout.tsx` — convert `<Suspense>` mounts to lazy `<dynamic>` with `ssr: false` to defer hydration
- Modify: `src/app/[locale]/dashboard/create/page.tsx` — add explicit `<Suspense>` boundary and verify template count is reasonable

## Implementation Steps
1. **Reproduce locally first** (do not change code blindly):
   ```bash
   npm run build && npm run dev
   # Open DevTools → Performance tab → Record
   # Navigate /en/dashboard/create → wait 30s → take heap snapshot
   # Compare with snapshot from /en/dashboard (which works)
   ```
2. **Identify the leaker**. Use Chrome heap snapshot diff or `window.performance.getEntriesByType('resource')` to find listeners that didn't clean up.
3. **Audit `use-agent-chat.ts`** for cleanup:
   - Verify the `abortRef.current?.abort()` is called on component unmount
   - Add `useEffect(() => () => abortRef.current?.abort(), [])` if missing
4. **Audit `agent-sidebar.tsx`**:
   - Confirm component lifecycle correctly tears down chat state
   - Add a `useEffect` cleanup that drains any in-flight fetch readers
5. **Reduce shared mounts**:
   - Wrap `AgentSidebar`, `CmdKPalette` in `next/dynamic({ ssr: false })` — defers JS load to after first paint
   - HealthIndicator: keep but verify React Query's automatic cleanup is happening
6. **Specific to create page**:
   - Wrap `CreateProjectFormWithTemplates` import in `next/dynamic({ ssr: false })` to defer hydration after first paint
   - Verify `getOffersForUser()` server action doesn't return huge payload — if affiliate programs list is large, paginate
7. Add E2E test that asserts `load` event fires within 5s:
   ```ts
   test('dashboard pages fire document load event', async ({ page }) => {
     for (const route of ['/en/dashboard/create','/en/dashboard/campaigns',/* ...9 */]) {
       await page.goto(`${PROD_URL}${route}`, { waitUntil: 'load', timeout: 10_000 });
       // If timeout, this throws — making the test red
     }
   });
   ```
8. Add stress test: 100 sequential navigations to `/dashboard/create`, assert no crash:
   ```ts
   test('create page survives 100 navigations', async ({ page }) => {
     for (let i = 0; i < 100; i++) {
       await page.goto(`${PROD_URL}/en/dashboard/create`);
       await expect(page.getByRole('heading')).toBeVisible();
     }
   });
   ```

## Todo List
- [ ] Reproduce renderer crash locally with heap snapshot
- [ ] Identify which long-lived listener doesn't clean up
- [ ] Fix unmount cleanup in `use-agent-chat.ts` (abortRef)
- [ ] Verify HealthIndicator + SidebarQuotaWidget cleanup
- [ ] Wrap AgentSidebar + CmdKPalette in `next/dynamic({ ssr: false })`
- [ ] Wrap create-page form in `next/dynamic({ ssr: false })`
- [ ] Add E2E load-event assertion across 9 routes
- [ ] Add 100-navigation stress test
- [ ] Build passes
- [ ] Memory growth <50MB across 50 navs (heap profile)

## Success Criteria
```ts
test('all 9 stuck-load routes now fire load event', async ({ page }) => {
  const routes = [
    '/en/dashboard/create','/en/dashboard/campaigns','/en/dashboard/missions',
    '/en/dashboard/workflows','/en/dashboard/sops','/en/dashboard/account',
    '/en/dashboard/settings','/en/dashboard/support','/en/dashboard/wallet',
  ];
  await loginAsBasicUser(page);
  for (const r of routes) {
    const res = await page.goto(`${PROD_URL}${r}`, { waitUntil: 'load', timeout: 8000 });
    expect(res?.status()).toBe(200);
  }
});

test('create page survives stress test', async ({ page }) => {
  await loginAsBasicUser(page);
  for (let i = 0; i < 100; i++) {
    await page.goto(`${PROD_URL}/en/dashboard/create`, { waitUntil: 'load', timeout: 5000 });
    // No browser crash = test passes by reaching this line
  }
  await expect(page.getByRole('heading')).toBeVisible();
});
```

## Risk Assessment
- **High risk**. Touches shared layout — affects every dashboard route.
- AgentSidebar is a feature users depend on (help bubble); if hidden behind dynamic+ssr:false, slight UX regression on first paint.
- `next/dynamic({ ssr: false })` means component flashes in after hydration — visible blink may bother users.
- Mitigation: deploy to a feature-flagged path first if available, or run extended Playwright before mergeing.
- Specific failure modes:
  - If AgentSidebar's SSE was correctly cleaning up and the leak is elsewhere, this phase finds wrong root cause. Re-run heap snapshot diff.
  - 100-navigation test may be too aggressive — start with 25.

## Security Considerations
- No new auth/CSP changes.
- `next/dynamic({ ssr: false })` does NOT introduce client-only auth bypass — auth still server-checked in layout.tsx.
- Memory bound is a defense-in-depth against accidental DoS (heavy users opening many tabs).

## Dependencies
- Depends on Phase 04 (billing) being deployed first — billing's broken `useQuery` may itself contribute to dashboard hang on certain routes (`/dashboard/wallet` uses similar pattern).
- Depends on Phase 05 (analytics) being deployed first — same reasoning.
- Phase 06 fix is most disruptive; run last so previous phases are stable.

## Unresolved Questions
1. **Is the renderer crash on `/dashboard/create` actually unique to that route, or is it cumulative across the test suite?** Audit confirms "mitigated by per-test isolation" — strongly suggests cumulative. Operator: confirm we're not chasing a ghost.
2. **Should AgentSidebar SSE connection be lazy (deferred until user clicks help bubble)?** Currently mounts on every route — wasteful. Big UX upgrade if deferred but design review needed.
3. **9 stuck-load routes audit list — are these REALLY broken or is `waitUntil:'load'` just a strict assertion that long-poll SSE always violates?** If SSE is by-design, the audit may be measuring the wrong thing. Validate by checking if these routes work normally for users (just don't fire `load` event).
4. **What's the polling interval budget for dashboard layout total?** HealthIndicator (30s), SidebarQuotaWidget (?), AgentSidebar (event-driven). Combined network noise should be <10 req/min.
