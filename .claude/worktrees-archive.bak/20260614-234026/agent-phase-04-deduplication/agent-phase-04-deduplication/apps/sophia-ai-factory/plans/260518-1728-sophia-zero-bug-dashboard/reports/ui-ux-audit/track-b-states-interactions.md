# UI/UX Audit — Track B: States + Interactions (Sophia /dashboard)

**Date:** 2026-05-18 · **Scope:** `src/app/[locale]/dashboard/**` (71 pages) + `src/forest/components/dashboard/` (10 widgets) · **Mode:** read-only audit

## §1 Loading state coverage

71 pages total · 49 have `loading.tsx` · **22 missing** (31%).

| Sample route | loading.tsx | Type |
|---|---|---|
| `/dashboard` (root) | ✅ | Skeleton (detailed, matches DashboardStats + CampaignList) |
| `/dashboard/campaigns` | ✅ | Skeleton (`@/seed/.../skeleton` w/ shimmer) |
| `/dashboard/missions` | ✅ | Hand-rolled `animate-pulse` divs |
| `/dashboard/videos` | ⚠️ | **Generic centered spinner only** (`Loader2`) |
| `/dashboard/voices` | ❌ | MISSING |
| `/dashboard/agents` | ❌ | MISSING |
| `/dashboard/experiments` | ❌ | MISSING |
| `/dashboard/templates` | ❌ | MISSING |
| `/dashboard/affiliate` (+ payouts) | ❌ | MISSING |
| `/dashboard/admin/*` (11 sub-routes: audit-log, crons, cost, funnel, storage, …) | ❌ | MISSING |
| `/dashboard/help/*` (3 pages) | ❌ | MISSING |
| `/dashboard/onboarding` | ❌ | MISSING |
| `/dashboard/videos/[id]/distribute` | ❌ | MISSING |

Distribution by implementation: **37 use `<Skeleton>` primitive · 11 hand-rolled `animate-pulse` · 1 spinner-only (`/videos`)**.

## §2 Error boundary coverage

49 pages with `error.tsx` — **same 22 routes missing as §1**. Implementations diverge:

| Sample | Bilingual? | Recoverable? | Classifies error? | Sentry? |
|---|---|---|---|---|
| `/dashboard/error.tsx` (root) | ✅ via `next-intl` `dashboard.errors` (auth/network/db/unknown keys exist in `messages/en.json`+`vi.json`) | ✅ `reset()` or login redirect | ✅ `classifyError()` → 4 kinds | ✅ tagged digest+kind |
| `/dashboard/campaigns/error.tsx` | ✅ (`errors.boundary`) | ✅ reset + home | ❌ generic message | ❌ |
| `/dashboard/missions/error.tsx` | re-exports `dashboard-error-boundary` (✅ classified) | ✅ | ✅ | ✅ |
| Most leaf errors | ✅ | ✅ reset | ❌ | ❌ |

**Inconsistency:** ~70% leaf `error.tsx` files use generic `errors.boundary` keys (no classification, no Sentry). Only root + missions delegate to the smart boundary.

## §3 Empty states — 5 sample list views

| Route | Verdict | Notes |
|---|---|---|
| `/dashboard/campaigns` | ✅ PASS | `<EmptyState icon={Megaphone}>` w/ CTA → `/dashboard/create` |
| `/dashboard/videos` | ✅ PASS | `<EmptyState icon={Video}>` w/ localized CTA |
| `/dashboard/sops` | ✅ PASS | `<EmptyState icon={Store}>` + first-SOP callout |
| `/dashboard/orders` | ⚠️ MIXED | Custom inline empty (not `EmptyState`); uses `orange-500`/`white/80` hardcoded colors instead of design tokens — diverges from `EmptyState` look |
| `/dashboard/missions` | ❓ unverified | Server page delegates to client `missions-client.tsx`; no `length === 0` check at top level (empty UX lives inside client component, not audited deeper here) |

Empty vs loading visually differentiated everywhere (icon + title + CTA vs greyed-out skeleton rows). No "no items found" plain-text regressions found in sample. `EmptyState` primitive exists at `src/seed/components/ui/empty-state.tsx` and is well-designed but **inconsistently adopted** (orders uses bespoke).

## §4 Interaction findings — 10 dashboard widgets sampled

| Component | onClick/Link count | `cursor-pointer` | hover: state | transition | Outlier dur |
|---|---:|:---:|:---:|:---:|---|
| cross-sell-banner | 3 | ❌ 0 | ✅ 3 | ✅ 2 | — |
| plan-upgrade-widget | 3 | ❌ 0 | ✅ 2 | ✅ 1 | — |
| referral-share-widget | 2 | ❌ 0 | ❌ 0 (no hover on buttons) | ❌ 0 | — |
| sidebar-quota-widget | 1 | ❌ 0 | ✅ 1 | ✅ 2 | `duration-500` (progress bar) |
| mission-control-widget | 1 | ❌ 0 | ✅ 1 | ✅ 1 | — |
| handover-onboarding-banner | 2 | ❌ 0 | ✅ 2 | ✅ 3 | — |
| quota-usage-bar | 1 | ❌ 0 | ❌ 0 | ✅ 1 | `duration-500` |
| mission-control/primary-cta | 0 (Link wrapper external) | ❌ 0 | ✅ 3 | ✅ 1 | — |
| mission-control/tier-badge | 1 | ❌ 0 | ❌ 0 | ❌ 0 | — |
| health-indicator | 1 | ❌ 0 | ✅ 2 | ✅ 1 | — |

**Findings:**
- **0/10 widgets use `cursor-pointer`** on clickable cards/links — violates `cursor-pointer` rule. Native `<button>`/`<a>` browsers default `cursor:pointer`, but `<Link>` wrapping a `<div>` (e.g. card-shape CTAs) won't. Verified: `cross-sell-banner` wraps clickable card in `<Link>` w/o cursor.
- **No `hover:scale` found** → CLS-safe (good).
- **All durations omitted (defaults to 150ms via Tailwind)** EXCEPT 5 sites of `duration-500` on progress fills — acceptable for progress meters (not micro-interactions), but should add `motion-reduce:duration-0`.
- **0 widgets use `duration-150|200|300`** — relying on Tailwind default (150ms). Spec-compliant but explicit is better.

## §5 Loading button findings — 3 forms

| Form | Disabled during pending | Inline spinner | Label swap |
|---|:---:|:---:|---|
| `settings/branding/email-branding-form.tsx` | ✅ `disabled={loading}` | ❌ no spinner | ✅ "Đang lưu... / Saving..." |
| `settings/components/youtube-connection-settings.tsx` | ✅ `disabled={isPending}` (uses `useTransition`) | ❌ | ⚠️ no label change (just disabled+opacity) |
| `forest/components/byok/byok-key-form.tsx` | ✅ `disabled={isPending \|\| !validation.ok}` | ❌ | ✅ `{isPending ? t('saving') : t('save_button')}` + `disabled:cursor-not-allowed` |

**Verdict:** PASS on disable + label, **FAIL on inline spinner** across all 3. Users see no motion proving submission is in-flight.

## §6 prefers-reduced-motion status

✅ Implemented in `src/app/globals.css:366-382`. Global block disables 12 named animations (gradient, float, fade-in-up, shimmer, glow-pulse, pulse-ring, blink, scale-pop, drift, text-gradient, card-hover, stagger-reveal) + sets `transform:none !important`. Skeleton primitive uses `motion-safe:animate-pulse`. Spinner in `videos/loading.tsx` also has `motion-reduce:animate-none`. **Gap:** progress-bar `transition-all duration-500` (5 sites) not gated.

## §7 Skeleton consistency findings

49 loading files — **3 patterns coexist**:
- **37** import `<Skeleton shimmer>` from `@/seed/components/ui/skeleton` (canonical).
- **11** hand-rolled `<div className="animate-pulse">` (incl. `missions/loading.tsx`). Style diverges (no shimmer, plain pulse on `bg-muted`).
- **1** spinner-only `videos/loading.tsx` — visually different (no layout placeholder, causes content-jump on hydration → violates `content-jumping` rule).

All use Suspense via Next.js convention (no manual `useState` loading flags found at page level).

## §8 Top 5 issues (ranked)

| # | Severity | Issue | Files affected | Fix LOC |
|---|---|---|---|---|
| 1 | **HIGH** | 22 routes missing `loading.tsx` + `error.tsx` (all admin sub-pages, voices, agents, experiments, templates, affiliate, help, onboarding) | 22×2 = 44 files | ~440 (use re-export pattern: `export { default } from '@/.../shared-loading'` — 2 LOC each) |
| 2 | **HIGH** | `/dashboard/videos/loading.tsx` is spinner-only → CLS on hydration (rule `content-jumping`) | 1 file | ~30 |
| 3 | **MED** | 0/10 dashboard widgets use `cursor-pointer` on Link-wrapped cards; violates `cursor-pointer` rule | 10 widgets | ~10 |
| 4 | **MED** | Loading buttons lack inline spinners (3 sampled forms fail) | 3+ forms | ~5 per form |
| 5 | **MED** | Error boundary inconsistency: only root + missions classify errors / report to Sentry. ~30 leaf `error.tsx` use generic `errors.boundary` keys | ~30 files | ~60 (re-export `DashboardError` like missions does) |

## §9 Three concrete refactor proposals (≤10 LOC each)

### Proposal A — Standardize all dashboard `error.tsx` to root boundary

`src/app/[locale]/dashboard/campaigns/error.tsx:1-25` (current 25 LOC) →

```tsx
// Before: 25 LOC custom inline boundary, generic message, no classify, no Sentry
// After:
'use client';
import DashboardError from '@/seed/components/dashboard/dashboard-error-boundary';
export default DashboardError;
```

Apply to ~30 leaf `error.tsx` files. Saves ~600 LOC, unifies error UX, adds Sentry coverage everywhere.

### Proposal B — Fix `videos/loading.tsx` content-jump

`src/app/[locale]/dashboard/videos/loading.tsx:1-9` (replace 9 LOC spinner) with skeleton matching VideoGallery grid:

```tsx
import { Skeleton } from "@/seed/components/ui/skeleton";
export default function VideosLoading() {
  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      <Skeleton shimmer className="h-8 w-48" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1,2,3,4,5,6].map(i => <Skeleton key={i} shimmer className="aspect-video rounded-xl" />)}
      </div>
    </div>
  );
}
```

### Proposal C — Add cursor-pointer + inline spinner to Link-card pattern

`src/forest/components/dashboard/cross-sell-banner.tsx` (and 9 peers) where `<Link>` wraps a card:

```tsx
// Before:  <Link href={...} className="flex items-center gap-3 p-4 rounded-lg hover:bg-muted">
// After:   <Link href={...} className="flex items-center gap-3 p-4 rounded-lg cursor-pointer transition-colors duration-200 hover:bg-muted">
```

For loading buttons (e.g. `email-branding-form.tsx:128-133`), add inline spinner:

```tsx
{loading ? <><Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" /> {savingLabel}</> : saveLabel}
```

## §10 Unresolved questions

1. `missions-client.tsx` empty-state UX not inspected (client component) — does it use `<EmptyState>` or inline? Worth a follow-up.
2. Are the 22 missing `loading.tsx` routes intentional (server-rendered, no async data → no Suspense needed)? Audit-log/cost/funnel admin pages likely hit D1 — should have skeletons.
3. `/dashboard/orders/page.tsx` uses hardcoded `orange-*` color tokens for empty state (`bg-orange-500` etc.) instead of design-system tokens (`bg-primary`) — is this intentional brand divergence or technical debt?
4. Progress-bar `duration-500` (5 sites) not gated by `motion-reduce` — accessibility nit or by-design (since global CSS @media block doesn't override Tailwind `transition-all` utility)?
5. No `aria-busy` attribute on any pending form submit — adds screen-reader signal alongside `disabled`. Worth a sweep?
