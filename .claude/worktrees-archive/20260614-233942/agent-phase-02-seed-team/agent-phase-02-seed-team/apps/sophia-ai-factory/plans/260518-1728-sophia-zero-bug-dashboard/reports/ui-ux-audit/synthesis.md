# UI/UX Pro Max — Synthesis & Ranked Action List

**Date:** 2026-05-18 | **Mode:** /ui-ux-pro-max --auto --parallel | **Inputs:** 3 parallel track reports

Audit scope: 71 dashboard pages of Sophia AI Factory at https://sophia.agencyos.network. Stack: Next 16 + React 19 + Tailwind 4 + Radix + lucide-react. Dark theme default. Reference pattern: **Data-Dense Dashboard** (Fira-pair recommendation rejected — keep Geist).

---

## Ranked Top 10 Issues

| # | Severity | Issue | Source | Pages affected | Est. fix |
|---:|---|---|---|---:|---:|
| 1 | 🔴 CRITICAL | Form inputs lack `htmlFor`/`id` pairing → screen-reader broken on ~68% of forms | C§3 | ~15 forms | M |
| 2 | 🔴 CRITICAL | Button primitive default `h-9` (36px) — fails WCAG 2.5.5 (44px). Banner close buttons 28×28 | C§5 | global | S |
| 3 | 🔴 CRITICAL | Status badge color drift — red/amber/emerald in 4-6 shades each across ~40 files. No canonical `<StatusBadge>` | A§3 | ~40 files | M |
| 4 | 🟠 HIGH | 22 / 71 routes missing both `loading.tsx` AND `error.tsx` — CLS + un-recovered errors | B§1+§2 | 22 routes | S |
| 5 | 🟠 HIGH | Icon-only buttons missing `aria-label` (~50% of close/expand) | C§2 | ~25 buttons | S |
| 6 | 🟠 HIGH | Focus rings missing on sidebar nav, MobileNav, handover wizard buttons — Safari shows nothing | C§1 | global | S |
| 7 | 🟡 MEDIUM | Dark chart palette monochromatic violet (1.05:1 between series) — analytics unreadable | A§3 | analytics/* | M |
| 8 | 🟡 MEDIUM | Smart root `error.tsx` (Sentry tagging + i18n) NOT re-exported by ~30 leaf `error.tsx` — generic fallback only | B§3 | 30 routes | S |
| 9 | 🟡 MEDIUM | `<Link>`-wrapped clickable cards lack `cursor-pointer` — 0/10 widgets sampled | B§5 | 10+ widgets | S |
| 10 | 🟢 LOW | Semantic emoji literals (`⚠️ 🚀 🎬 ✓ ✗ …`) used as UI icons in ~10 places — should use lucide | A§5 | 10 places | S |

Effort key: S = ≤30 LOC · M = 30-200 LOC · L = 200+ LOC

---

## Concrete Refactor Proposals (top 5 — actionable in 1-2 dev-days each)

### R1 — `<StatusBadge>` primitive (closes #3)

**Where**: `src/seed/components/ui/status-badge.tsx` (NEW), ~80 LOC. Sibling to existing primitives.

**Why**: ~40 inline patterns like `bg-red-500/15 text-red-300 border-red-500/30 px-2 py-0.5 rounded-full text-xs` drift across files. Centralizing eliminates 4-6 shade variance per state.

**API sketch**:
```tsx
<StatusBadge tone="bad" size="sm">2 crons failing</StatusBadge>
<StatusBadge tone="warn">3 stale (>24h)</StatusBadge>
<StatusBadge tone="ok" icon={CheckCircle2}>Healthy</StatusBadge>
```

Tones: `ok | warn | bad | info | muted`. Each maps to a single canonical shade pair (per dark/light). Codemod to migrate the 40 inline call sites: ~2h.

---

### R2 — Bump Button primitive default size + add `focus-visible` ring (closes #2 + #6)

**Where**: `src/seed/components/ui/button.tsx` (existing).

**Change**:
- `default` variant: `h-9 px-4` → `h-11 px-4` (44px WCAG touch target)
- Add `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` to base class
- Add new `sm` variant at `h-9` for opt-in dense contexts (data tables only)

Visual regression risk: medium. Run Playwright `.toHaveScreenshot()` baseline regen after change (Phase 03 infra ready).

---

### R3 — `<FormField>` primitive with `useId()` (closes #1)

**Where**: `src/seed/components/ui/form-field.tsx` (NEW), ~60 LOC.

**Pattern**:
```tsx
<FormField label={t('settings.email')} hint={t('settings.email_hint')} error={errors.email}>
  <Input type="email" placeholder="ban@example.com" />
</FormField>
```

Internally: generate `useId()` → set `htmlFor` on label + `id` on cloned child input. Solves the 68% un-associated label gap in one swap. Codemod the ~15 forms: ~3h.

---

### R4 — Sweep `loading.tsx` + `error.tsx` to 22 missing routes (closes #4 + #8)

**Where**: 22 leaf route dirs under `src/app/[locale]/dashboard/` (list in track-b-states-interactions.md §1-§2).

**Pattern** (per route):
```tsx
// loading.tsx
export { default } from '../loading';
```
```tsx
// error.tsx
export { default } from '../error';
```

44 files total, ~88 LOC. Re-exporting the root smart `error.tsx` brings Sentry tagging + bilingual i18n to all 30 leaf routes for free.

Also: convert `/dashboard/videos/loading.tsx` (spinner) to skeleton layout matching siblings.

---

### R5 — `aria-label` sweep on icon-only buttons (closes #5)

**Where**: ~25 spots across dashboard (banner close, list expanders, sidebar collapse). Use grep:
```bash
grep -rn "<button[^>]*>\s*<\(X\|ChevronUp\|ChevronDown\|MoreVertical\)" src/app/[locale]/dashboard src/forest/components/dashboard
```

Add `aria-label={t('common.close')}` (or context-specific i18n key). Use existing `common.*` namespace.

~25 LOC + ~3 new i18n keys per locale (VI + EN). Pair with Track C P2 fix.

---

## Optional R6-R10 (parallel polish — defer if Phase 04 budget tight)

- **R6** — Convert 11 hand-rolled `animate-pulse` skeletons to `<Skeleton shimmer />` primitive (B§7) — uniform shimmer language
- **R7** — Replace 16x `text-violet-400` literals in `dashboard/layout.tsx` with `text-[var(--neon-purple)]` token (A§2)
- **R8** — Add `cursor-pointer` to 10 `<Link>`-wrapped cards (B§5) — 10 LOC
- **R9** — Replace ~10 emoji literal UI icons with lucide equivalents (A§5)
- **R10** — Repaint `--chart-1..5` to AAA-compliant qualitative palette (A§3) — analytics/* still readable on dark bg

---

## Quick wins (≤1 hour each, no design review needed)

- Add `cursor-pointer` everywhere `<Link>` wraps a card (R8)
- Add `prefers-reduced-motion` audit comment to globals.css §366-382 (Track B verified — well-disciplined already)
- Fix pricing-editor `overflow-hidden` → `overflow-x-auto min-w-[640px]` (Track C P3)
- Remove `text-[10px]`/`text-[11px]` in sidebar metadata if not necessary (Track C unresolved Q1)

---

## What's already excellent (keep as-is)

- Geist Sans/Mono font stack (Vietnamese support intact, no Fira swap needed)
- Recent `--destructive` AAA fix (P04 hygiene)
- lucide-react canonical (72 imports)
- `space-y-6` page rhythm consistent
- `--muted-foreground` AA-compliant both themes
- Root `error.tsx` `classifyError()` + Sentry tagging + i18n (gold standard)
- `<EmptyState>` primitive (`seed/components/ui/empty-state.tsx`) — adopted by campaigns/videos/sops
- `prefers-reduced-motion` discipline (globals.css §366-382, `motion-safe:` on 14+ animations)
- z-index scale clean (10/20/30/40/50 — no z-9999 hacks)
- Image alt text present on all 3 sampled
- 9/11 admin tables wrapped in `overflow-x-auto`
- Viewport meta correct (pinch-zoom allowed)

---

## Estimated Phase 04 effort (R1-R5 + quick wins)

| Refactor | Effort | Files |
|---|---:|---:|
| R1 StatusBadge + codemod | 6h | 1 new + ~40 sites |
| R2 Button h-11 + focus-visible | 2h + visual review | 1 |
| R3 FormField + codemod | 4h | 1 new + ~15 forms |
| R4 loading/error sweep | 3h | 44 |
| R5 aria-label sweep | 2h | ~25 + 3 i18n keys × locales |
| Quick wins bundle | 2h | ~10 |
| **Total** | **~19 hours** | ~130 files |

Solo dev: ~2.5 days. Parallel agents (split by refactor): ~1 day.

---

## References

- Track A — Tokens: `./track-a-tokens.md` (200 lines)
- Track B — States & Interactions: `./track-b-states-interactions.md` (161 lines)
- Track C — A11y & Responsive: `./track-c-a11y-responsive.md` (192 lines)
- ui-ux-pro-max design system reference: searched 2026-05-18 via `python3 ~/.claude/skills/ui-ux-pro-max/scripts/search.py "saas dashboard data-dense dark professional analytics admin" --design-system`

## Unresolved

1. R2 visual regression — accept the larger button heights as design baseline OR roll out only to non-table contexts?
2. R3 codemod scope — auto-rewrite via ts-morph OR manual one-by-one (15 forms is ~2h either way)?
3. R7 chart palette — should we adopt the ui-ux-pro-max recommended cool-blue+orange+neutral OR brand-preserve with derived shades?
4. R10 chart repaint — block analytics-* routes until done OR ship behind feature flag?
5. Should `<StatusBadge>`, `<FormField>`, `<Skeleton shimmer>` etc. be promoted from `seed/components/ui/` to a future `@sophia/ui` workspace package? (Cross-app reuse if Sophia spawns sister products.)
