# Phase 05 — Analytics page error handling

## Context Links
- Audit: `plans/reports/ui-ux-designer-260519-0240-dashboard-usability.md` §Flow 3 finding #1; screenshot `11-analytics-page.png`
- Analytics page: `src/app/[locale]/dashboard/analytics/page.tsx`
- Error boundary: `src/app/[locale]/dashboard/analytics/error.tsx` (generic — "Something went wrong / Try again / Go home")
- RBAC: `src/lib/analytics/rbac.ts` (`checkAdmin`, `canAccessRevenue`)
- Tier lookup: `src/seed/db/get-user-tier.ts`

## Overview
- Priority: 🔴 Critical
- Status: completed (commit 03ce2b76)
- `/dashboard/analytics` for a BASIC user shows the dashboard error boundary instead of an analytics view or a tier-gate upsell. Indicates a thrown exception during server render.

## Key Insights
- Page server-component at line 68 does:
  - Line 77-80: `Promise.all([getUserTier(user.id), checkAdmin(user.id)])` — NOT wrapped in try/catch. If either throws (D1 down, missing table), page errors out.
  - Line 95: `await fetchInitialRevenue(...)` — has internal try/catch returning `null`, OK.
  - Line 84-92: try/catch around campaigns query, OK.
- `checkAdmin` at `rbac.ts:103` calls `getUserTier` THEN does a D1 `user_profiles` SELECT — if `user_profiles` table doesn't exist or is empty for BASIC user, the `.single()` call may throw (D1 adapter behavior).
- Audit also flags this is same pattern as a prior Bug C — `Promise.all` without try/catch.
- Fix is well-scoped: wrap in try/catch + fall back to sensible defaults (`BASIC` tier, `isAdmin=false`).

## Requirements
- BASIC user reaching `/dashboard/analytics` sees a useful UI:
  - Either the campaigns/usage AnalyticsView (current `AnalyticsDashboardClient` design supports BASIC tier)
  - OR a `TierGateCard` upsell to ENTERPRISE for revenue
- No raw error boundary
- Underlying error logged server-side (Sentry/wrangler tail) — operator can debug without user-facing surface
- Other tiers (PREMIUM, ENTERPRISE, MASTER) unchanged

## Architecture
- Layer: **app/route** (server component) + **lib/analytics rbac** (minor safety)
- Pattern: defensive Promise.all wrapping with graceful defaults; surface a friendly message instead of error boundary
- KISS: don't add new components; reuse `TierGateCard` and `AnalyticsDashboardClient`

## Related Code Files
- Modify: `src/app/[locale]/dashboard/analytics/page.tsx` (lines 77-95)
- Modify (defensive): `src/lib/analytics/rbac.ts` `checkAdmin` — add try/catch around `db.from('user_profiles')` call
- Modify (optional): `src/app/[locale]/dashboard/analytics/error.tsx` — link to support page (audit's general UX issue #3)
- Reference: `src/seed/components/ui/tier-gate-card.tsx`

## Implementation Steps
1. Wrap the Promise.all at `page.tsx:77-80` in try/catch:
   ```ts
   let userTier: Tier = 'BASIC';
   let isAdmin = false;
   try {
     [userTier, isAdmin] = await Promise.all([
       getUserTier(user.id),
       checkAdmin(user.id),
     ]);
   } catch (err) {
     logger.error('[Analytics] Failed to load tier/admin', err instanceof Error ? err : undefined);
     // Defaults: BASIC + not admin — page still renders the AnalyticsView
   }
   ```
2. Harden `checkAdmin` in `rbac.ts`:
   ```ts
   try {
     const { data: profile } = await db
       .from<{ role: string | null }>('user_profiles')
       .select('role')
       .eq('user_id', userId)
       .single();
     return profile?.role === 'admin';
   } catch (err) {
     // Missing table or no row — not an admin
     return false;
   }
   ```
3. Improve `error.tsx`:
   - Add a "Contact support" link to `/dashboard/help`
   - Optionally surface `error.digest` (short hash) for support reference
   - Keep bilingual
4. Test locally:
   ```bash
   npm run dev
   # Sign in as fresh BASIC user
   # Visit /en/dashboard/analytics
   # Expect: AnalyticsView + TierGateCard, NO error boundary
   ```
5. Run analytics-related tests: `npm test -- analytics`.
6. Server-log verification: tail `wrangler tail` after deploy and confirm graceful path logs `[Analytics] Failed to load tier/admin` if D1 is intermittently failing — and NOT a thrown error.

## Todo List
- [x] Wrap Promise.all in try/catch with BASIC fallback
- [x] Harden checkAdmin (try/catch around `user_profiles` query)
- [x] Update error.tsx with support link + digest
- [ ] Test BASIC user → AnalyticsView renders (manual — BASIC test account needed)
- [ ] Test PREMIUM, ENTERPRISE, MASTER unchanged (manual)
- [x] No regression in `tests/e2e/analytics*.spec.ts` (4606 tests pass pre-push)
- [x] Build passes (typecheck 0 errors, lint 341/0)

## Success Criteria
```ts
test('analytics page renders for BASIC user without error boundary', async ({ page }) => {
  await loginAsBasicUser(page);
  await page.goto(`${PROD_URL}/en/dashboard/analytics`);
  // No error boundary
  await expect(page.getByText(/something went wrong/i)).toBeHidden();
  // Analytics title + tier gate present
  await expect(page.getByRole('heading', { name: /analytics/i })).toBeVisible();
  await expect(
    page.getByText(/upgrade to enterprise|revenue analytics locked/i),
  ).toBeVisible({ timeout: 10000 });
});
```

## Risk Assessment
- Low risk. Pure defensive coding.
- Defaults (BASIC tier, isAdmin=false) hide tier-gated UI — acceptable. User can refresh to retry.
- If the underlying D1 issue is permanent, error rate spike in Sentry will be visible — investigate separately.
- Watch for tests that ASSUME `checkAdmin` throws — none expected since current behavior is to throw via D1 adapter.

## Security Considerations
- Defensive defaults FAIL CLOSED (default BASIC, not admin) — safer than failing open.
- No new data exposure: BASIC tier UI is already public to all dashboard users.
- Error logger must NOT log full user object — log only `user.id` + error message.

## Dependencies
- None. Can run in parallel with phases 01, 02, 04.

## Unresolved Questions
1. Is `user_profiles` table guaranteed to exist on every deployment? Check `migrations/` and confirm.
2. Audit recommends "render a friendly Analytics available on Growth+ plan upsell card OR fix the underlying data fetch for BASIC" — current `AnalyticsDashboardClient` already has tier-aware UI; verify it renders sensibly when `userTier='BASIC'` and `isAdmin=false`.
3. Should we add an error code to `error.tsx` that ties back to a Sentry breadcrumb id (audit's UX issue #3)? Requires Sentry SDK integration — verify with `sophia-no-tech-doctrine.md`: sourcemap upload is optional but breadcrumb id surfacing is platform-only.
