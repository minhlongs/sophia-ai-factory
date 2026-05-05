# Dashboard GAP Fix — All 13 Issues

**Date:** 2026-05-04 18:30 PT
**Source:** `plans/reports/scout-260504-1830-dashboard-gap-audit.md`
**Mode:** /cook --auto, parallel 3-dev execution
**Scope:** 3 P0 + 5 P1 + 4 P2 (defer #4 workspace switcher → roadmap note)

## Phases (parallel)

| Phase | Owner | Files | Status |
|---|---|---|---|
| **A** Boundaries + Skeletons | Dev A | 40 NEW error.tsx + 34 NEW loading.tsx + 2 shared components | pending |
| **B** Tier-gating + UX | Dev B | TierGateCard + EmptyState + wallet/analytics + 4 lists + MasterWelcomeBanner | pending |
| **C** Banner + i18n + Polish | Dev C | trial-banner gate + i18n cleanup + type export + help verify | pending |

## Verification

1. `npx tsc --noEmit` → 0 errors
2. `npm run build` → exit 0
3. `npm test` → ≥ 2796 pass
4. `npm run deploy:full` → SHA match `/api/version`
5. Browser: wallet gate, analytics upsell, error boundary force-throw

## Unresolved (deferred)

- Workspace/team switcher → roadmap note only (no code change)
