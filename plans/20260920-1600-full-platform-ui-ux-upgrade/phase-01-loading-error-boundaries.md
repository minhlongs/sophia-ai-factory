# Phase 01: Loading & Error Boundaries

## Context Links
- Plan: [plan.md](./plan.md)
- Error boundary: `apps/sophia-ai-factory/src/seed/components/dashboard/dashboard-error-boundary.tsx:32`
- Loading skeleton: `apps/sophia-ai-factory/src/seed/components/dashboard/dashboard-loading-skeleton.tsx:93`
- Root error: `apps/sophia-ai-factory/src/app/[locale]/error.tsx:1`
- Root loading: `apps/sophia-ai-factory/src/app/[locale]/loading.tsx:1`

## Overview
- Priority: P1
- Status: pending
- Effort: 2h
- Description: Create missing `loading.tsx` and `error.tsx` boundary files across all 15 dashboard subroutes and key public routes using existing `DashboardSkeleton` and `DashboardError` primitives to guarantee resilient UX.

## Key Insights
- Currently only 1 of 15+ dashboard subroutes has loading/error boundaries (`dashboard/settings/autonomy`).
- Next.js App Router requires `loading.tsx` for instant feedback on server component streaming and `error.tsx` ('use client') to prevent blank page crashes.
- `DashboardSkeleton` (`src/seed/components/dashboard/dashboard-loading-skeleton.tsx`) already supports `list`, `detail`, and `dashboard-home` variants.
- `DashboardError` (`src/seed/components/dashboard/dashboard-error-boundary.tsx`) already supports bilingual classification (auth, network, db, unknown).

## Requirements
### Functional
- Every dashboard subroute must render a localized skeleton immediately upon navigation.
- Every dashboard subroute must catch server and client errors gracefully with retry / login actions.
- Top-level `[locale]/dashboard` must render `dashboard-home` skeleton.
- List-based views (campaigns, approvals, missions, publish, creative-economy, youtube) use `list` skeleton variant.
- Detail/settings views (settings, setup, system-health, docs, handover) use `detail` skeleton variant.

### Non-Functional
- Skeletons must match Obsidian Cyber-Glass token styling (`bg-card`, `border-border`, `animate-pulse`/`animate-shimmer`).
- Zero console errors during loading/error lifecycle.
- Keep each new file under 30 lines (DRY import from seed primitives).

## Architecture
```
Route Navigation
  ├── Suspense Trigger → loading.tsx → DashboardSkeleton (seed/components/dashboard)
  └── Error Boundary  → error.tsx   → DashboardError    (seed/components/dashboard)
```

## File Ownership
This phase strictly owns and creates the following files:

### Files to Create (15 Dashboard Subroutes + Top-Level Dashboard + 3 Public Routes)
1. `apps/sophia-ai-factory/src/app/[locale]/dashboard/loading.tsx`
2. `apps/sophia-ai-factory/src/app/[locale]/dashboard/error.tsx`
3. `apps/sophia-ai-factory/src/app/[locale]/dashboard/approvals/loading.tsx`
4. `apps/sophia-ai-factory/src/app/[locale]/dashboard/approvals/error.tsx`
5. `apps/sophia-ai-factory/src/app/[locale]/dashboard/campaigns/loading.tsx`
6. `apps/sophia-ai-factory/src/app/[locale]/dashboard/campaigns/error.tsx`
7. `apps/sophia-ai-factory/src/app/[locale]/dashboard/creative-economy/loading.tsx`
8. `apps/sophia-ai-factory/src/app/[locale]/dashboard/creative-economy/error.tsx`
9. `apps/sophia-ai-factory/src/app/[locale]/dashboard/docs/loading.tsx`
10. `apps/sophia-ai-factory/src/app/[locale]/dashboard/docs/error.tsx`
11. `apps/sophia-ai-factory/src/app/[locale]/dashboard/handover/loading.tsx`
12. `apps/sophia-ai-factory/src/app/[locale]/dashboard/handover/error.tsx`
13. `apps/sophia-ai-factory/src/app/[locale]/dashboard/missions/loading.tsx`
14. `apps/sophia-ai-factory/src/app/[locale]/dashboard/missions/error.tsx`
15. `apps/sophia-ai-factory/src/app/[locale]/dashboard/monetization/loading.tsx`
16. `apps/sophia-ai-factory/src/app/[locale]/dashboard/monetization/error.tsx`
17. `apps/sophia-ai-factory/src/app/[locale]/dashboard/playbook/loading.tsx`
18. `apps/sophia-ai-factory/src/app/[locale]/dashboard/playbook/error.tsx`
19. `apps/sophia-ai-factory/src/app/[locale]/dashboard/playbooks/loading.tsx`
20. `apps/sophia-ai-factory/src/app/[locale]/dashboard/playbooks/error.tsx`
21. `apps/sophia-ai-factory/src/app/[locale]/dashboard/publish/loading.tsx`
22. `apps/sophia-ai-factory/src/app/[locale]/dashboard/publish/error.tsx`
23. `apps/sophia-ai-factory/src/app/[locale]/dashboard/reality-loop/loading.tsx`
24. `apps/sophia-ai-factory/src/app/[locale]/dashboard/reality-loop/error.tsx`
25. `apps/sophia-ai-factory/src/app/[locale]/dashboard/settings/loading.tsx`
26. `apps/sophia-ai-factory/src/app/[locale]/dashboard/settings/error.tsx`
27. `apps/sophia-ai-factory/src/app/[locale]/dashboard/setup/loading.tsx`
28. `apps/sophia-ai-factory/src/app/[locale]/dashboard/setup/error.tsx`
29. `apps/sophia-ai-factory/src/app/[locale]/dashboard/system-health/loading.tsx`
30. `apps/sophia-ai-factory/src/app/[locale]/dashboard/system-health/error.tsx`
31. `apps/sophia-ai-factory/src/app/[locale]/dashboard/youtube/loading.tsx`
32. `apps/sophia-ai-factory/src/app/[locale]/dashboard/youtube/error.tsx`
33. `apps/sophia-ai-factory/src/app/[locale]/marketplace/loading.tsx`
34. `apps/sophia-ai-factory/src/app/[locale]/marketplace/error.tsx`
35. `apps/sophia-ai-factory/src/app/[locale]/pricing/loading.tsx`
36. `apps/sophia-ai-factory/src/app/[locale]/pricing/error.tsx`
37. `apps/sophia-ai-factory/src/app/[locale]/affiliate/loading.tsx`
38. `apps/sophia-ai-factory/src/app/[locale]/affiliate/error.tsx`

### Files to Modify
- None (all new files).

## Implementation Steps
1. Create `loading.tsx` in `src/app/[locale]/dashboard/` rendering `<DashboardSkeleton variant="dashboard-home" />`.
2. Create `error.tsx` in `src/app/[locale]/dashboard/` exporting default `DashboardError` from `@/seed/components/dashboard/dashboard-error-boundary`.
3. Create `loading.tsx` and `error.tsx` for each of the 15 dashboard subroutes:
   - For list routes (`campaigns`, `approvals`, `missions`, `publish`, `creative-economy`, `youtube`, `playbooks`, `monetization`), set `variant="list"`.
   - For detail/settings routes (`settings`, `setup`, `system-health`, `docs`, `handover`, `playbook`, `reality-loop`), set `variant="detail"`.
4. Create `loading.tsx` and `error.tsx` for public routes (`marketplace`, `pricing`, `affiliate`).
5. Verify with `npm run type-check`.

## Todo List
- [ ] Create top-level dashboard `loading.tsx` and `error.tsx`
- [ ] Create 15 dashboard subroute `loading.tsx` files
- [ ] Create 15 dashboard subroute `error.tsx` files
- [ ] Create public route `loading.tsx` and `error.tsx` files
- [ ] Run `npm run type-check` to verify 0 errors

## Success Criteria
- [ ] Every dashboard route has a corresponding `loading.tsx` and `error.tsx`
- [ ] TypeScript check passes with 0 errors
- [ ] No regression on existing tests

## Risk Assessment & Mitigations
- **Risk:** Next.js client component hydration mismatch in `error.tsx`.
  - **Mitigation:** Ensure all `error.tsx` files start with `'use client'` directive.
- **Risk:** Missing digest logging.
  - **Mitigation:** Rely on canonical `DashboardError` which handles Sentry and digest capturing.

## Security Considerations
- Error boundaries must not leak sensitive stack traces, DB connection strings, or API keys in production UI. `DashboardError` masks error internals into classified categories (`auth`, `network`, `db`, `unknown`).

## Next Steps
- Hand off to Phase 02 for design system polish on dashboard components.
