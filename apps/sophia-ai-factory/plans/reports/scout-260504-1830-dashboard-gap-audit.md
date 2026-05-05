# Dashboard GAP Audit — RaaS User Flow

**Date:** 2026-05-04 18:30 PT
**Scope:** `src/app/[locale]/dashboard/**` post-FREE100 redeem (MASTER tier)
**Verdict:** Navigable, no blockers. **40/49 pages missing error boundaries**, tier-gating inconsistent, empty states sparse.

## Inventory

- **49** page.tsx (24 user + 14 admin + 11 supporting)
- **9** error.tsx → **40 missing**
- **15** loading.tsx → **34 missing**
- API routes (heygen/videos/scripts) **EXIST** (scout false-positive ruled out)

## P0 — Broken/Blocking

| # | Page | Issue | Fix sketch |
|---|---|---|---|
| 1 | `/dashboard/wallet` | NO tier check; renders for FREE/BASIC tier with empty data + no upsell | Add `getUserTier()`, gate `< MASTER` → `<TierGateCard>` upsell |
| 2 | `/dashboard/analytics` | Has tier check but renders blank chart for non-ENTERPRISE | Replace blank state with upgrade CTA |
| 3 | 40 pages | NO `error.tsx` → generic NextJS 500 on crash (incl. wallet, integrations, byok, missions, workflows, all admin/*) | Add shared `<DashboardError>` boundary, propagate via `error.tsx` |

## P1 — Missing/Incomplete

| # | Issue | Fix sketch |
|---|---|---|
| 1 | Trial banner shows for paid MASTER (FREE100 sets `trial_ends_at`) | Gate banner: only show if `tier === 'BASIC'` AND trial near expiry |
| 2 | Empty states blank for: campaigns/videos/sops/workflows lists (zero-data new user) | Add `<EmptyState>` component with illustration + "Create first X" CTA |
| 3 | Tier-gating UX inconsistent (only api-docs hard-gates) | Build reusable `<TierGateCard>` component, apply to wallet/analytics/affiliate |
| 4 | 34 pages missing `loading.tsx` (slow SSR fetches block render) | Add Suspense fallback skeletons to integrations/byok/proposals/help |
| 5 | i18n: hardcoded "Video Generations" in billing; trial-banner has inline VI/EN ternary | Migrate to `t()` + `useLocale()` |

## P2 — Polish/UX

| # | Issue | Fix sketch |
|---|---|---|
| 1 | First-time MASTER user (FREE100 redeem) sees no welcome/feature-tour | Add `<MasterWelcomeBanner>` showing affiliate engine, admin, API access |
| 2 | `UsageSummaryResponse` type not exported from `lib/billing/types` | Export for DRY across billing/credits pages |
| 3 | `/dashboard/help/getting-started` likely thin (single page under help/) | Verify content, expand to FAQ/docs/tutorials if needed |
| 4 | No org/workspace switcher (all pages assume single-user) | Defer until team-invite feature ships |

## Stats

- Total: 13 issues (3 P0 / 5 P1 / 4 P2)
- P0+P1 effort estimate: **~6-8 hours** (1 dev session)
- P2 effort: **~2-3 hours** (defer-able)

## Recommended /cook scope

**Phase A — P0 hardening** (2h):
1. `<DashboardError>` boundary + propagate to 40 pages (single shared file + 40 error.tsx)
2. Wallet tier-gate (BASIC/FREE → upsell; MASTER → render)
3. Analytics blank → upgrade CTA

**Phase B — P1 UX completion** (3-4h):
4. Trial banner logic refine (skip if paid MASTER)
5. `<EmptyState>` + apply to 4 list pages
6. `<TierGateCard>` reusable + apply to gated features
7. `loading.tsx` skeletons for 34 pages (batch via shared template)
8. i18n cleanup (billing label + trial-banner)

**Phase C — P2 polish** (2-3h, OPTIONAL):
9. `<MasterWelcomeBanner>` for FREE100 redeemed users
10. Type export DRY
11. Help content expansion

## Verify checklist (post-fix)

- [ ] `npx tsc --noEmit` → 0 errors
- [ ] `npm run build` → exit 0
- [ ] `npm test` → pass rate ≥ pre-fix baseline
- [ ] Browser: redeem FREE100 → check wallet (MASTER → renders), analytics (upsell), error boundary (force throw)
- [ ] Mobile: sidebar collapse/expand on phone viewport

## Unresolved questions

1. **Phase scope** — A only (P0 critical fixes), A+B (recommended full sweep), or A+B+C (everything)?
2. `<TierGateCard>` reusable across whole app or dashboard-only? Recommend app-wide (`src/components/ui/tier-gate-card.tsx`).
3. Empty-state illustrations — reuse existing icon set (lucide-react) or commission custom SVGs?
4. Workspace/team switcher — defer or include in P1? (Affects MASTER tier roadmap; recommend defer.)
