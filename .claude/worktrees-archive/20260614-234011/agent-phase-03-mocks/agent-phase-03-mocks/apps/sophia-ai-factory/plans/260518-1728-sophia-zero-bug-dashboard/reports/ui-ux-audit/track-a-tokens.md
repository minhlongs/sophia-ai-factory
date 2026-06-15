# Track A — Color / Typography / Spacing Tokens Audit

**Scope:** `/dashboard` (~36 routes), `src/app/globals.css` (402 lines), `src/app/[locale]/layout.tsx`.
**Mode:** read-only. Brand neon palette preserved per Sophia identity.

---

## §1 Token Inventory (globals.css)

Convention: contrast ratio = WCAG 2 relative luminance, target ≥4.5 normal text, ≥3 large/icons. Dark theme = default (forcedTheme).

| Var | Light | Dark | Role | WCAG (text on bg) |
|---|---|---|---|---|
| `--background` | `#ffffff` | `#020817` | base bg | — |
| `--foreground` | `#0f172a` | `#f8fafc` | base text | L 15.8 / D 17.4 ✅ |
| `--card` | `#ffffff` | `#020817` | card bg | identical to bg (no elevation contrast) ⚠️ |
| `--card-foreground` | `#0f172a` | `#f8fafc` | card text | ✅ |
| `--primary` | `#0f172a` | `#f8fafc` | CTA bg | ✅ |
| `--primary-foreground` | `#f8fafc` | `#0f172a` | CTA text | ✅ |
| `--secondary` | `#f1f5f9` | `#1e293b` | subtle bg | ✅ pairs |
| `--muted` | `#f1f5f9` | `#1e293b` | subtle bg | ✅ |
| `--muted-foreground` | `#64748b` | `#94a3b8` | de-emphasized text | L 4.62 / D 6.78 ✅ |
| `--accent` | `#f1f5f9` | `#1e293b` | hover bg | duplicates `--secondary` ⚠️ |
| `--destructive` | `#b91c1c` (red-700) | `#f87171` (red-400) | error | L 7.74 / D 7.33 ✅ (recent fix) |
| `--destructive-foreground` | `#f8fafc` | `#f8fafc` | error fg | ✅ |
| `--border` | `#e2e8f0` | `#1e293b` | borders | low-contrast by design |
| `--ring` | `#0f172a` | `#cbd5e1` | focus ring | ✅ |
| `--neon-cyan` | `#06b6d4` | `#00f0ff` | brand accent | D on `#020817` = 14.6 ✅ |
| `--neon-purple` | `#7c3aed` | `#7000ff` | brand accent | D = 3.93 (large ok, normal text fails 4.5) ⚠️ |
| `--neon-pink` | `#db2777` | `#ff00ff` | brand accent | D = 5.77 ✅ |
| `--chart-1..5` light | `#e76e50..#e9c46a` warm | semantic charts | mid contrast ok |
| `--chart-1..5` dark | `#22005c..#0f005d` violet | semantic charts | ⚠️ all in same hue 1.05–1.4:1 between series — indistinguishable |

**Critical findings:** L1 `--card`==`--background` both themes → no elevation contrast. L2 `--accent`==`--secondary` → duplicate token. L3 dark chart palette monochromatic violet → fails data-dense pattern.

---

## §2 Brand Identity Findings

`--neon-cyan` / `--neon-purple` / `--neon-pink` defined but usage mixed with raw Tailwind `text-violet-*` / `bg-violet-*` literals.

| Site | Pattern | Verdict |
|---|---|---|
| `dashboard/layout.tsx:285–390` sidebar nav | `text-violet-400 hover:text-violet-300` repeated 16x | hardcoded |
| `dashboard/layout.tsx:111` brand wordmark | `from-[var(--neon-cyan)] to-[var(--neon-purple)]` | token ✅ |
| `dashboard/layout.tsx:119` active nav | `from-violet-500/20 to-cyan-500/20 text-[var(--neon-cyan)]` | mixed |
| `admin/page.tsx:272,313`, `sop-marketplace/page.tsx:54`, `admin/api-key-usage/page.tsx:68` | `text-violet-400` icons | hardcoded |
| `settings/branding/email-branding-form.tsx:131` | `bg-violet-700 hover:bg-violet-600` | hardcoded |
| `analytics/components/charts.tsx:20` | hex array `["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899"]` | bypasses brand |

**Verdict:** tokens declared but not enforced. `text-violet-400` (`#a78bfa`) is the de-facto neon-purple alias — drift inevitable. ~80% dashboard violet usage is literal.

---

## §3 Color Smell Tests (semantic duplication)

Same status, multiple shades. Each row = de-facto component drift.

| Semantic | Shades observed | Sample refs |
|---|---|---|
| Error text | red-200/300/400/500 + `text-destructive` | admin/page.tsx:158,284; admin/api-key-usage/page.tsx:138,166; settings/branding/email-branding-form.tsx:123; admin/migrations/migrations-client.tsx:110 |
| Error bg | red-500/10, /15, red-900/30, /40, red-950/30 | admin/page.tsx:158; admin/handover/list/handover-list-client.tsx:26; admin/heygen-webhooks/heygen-webhooks-client.tsx:90 |
| Warn text | amber-200/300/400, yellow-300/400/500/700 | admin/page.tsx:147,286; admin/migrations/migrations-client.tsx:125,138; integrations/integration-card.tsx:36; settings/crypto-compliance-tab.tsx:101 |
| Success text | emerald-300/400/500, green-400/600/700 | admin/migrations/migrations-client.tsx:205,215; admin/deploy-status/deploy-status-client.tsx:135,161; admin/ops/ops-snapshot-card.tsx:226 |
| Surface card | `bg-card` (token) 107x vs `bg-zinc-800/900` (literal) 317 zinc | literals concentrate in settings/branding/* + admin/migrations/* |

**Hardcoded hex outside globals.css:** analytics/components/charts.tsx:20,44,87,114 (6 chart colors + 2 fills); settings/branding/branding-form-client.tsx:102,279 + email-branding-form.tsx:20,116 (user-editable defaults — acceptable).

**Verdict:** state badges have 4–6 shade variants per semantic. No canonical `<StatusBadge>`. Each page reinvents.

---

## §4 Typography Findings

**Loaded fonts** (`src/app/[locale]/layout.tsx:50–60`):
- `Geist Sans` (variable, weights 100–900) → `--font-geist-sans` → `body { font-family }`
- `Geist Mono` (variable, weights 100–900) → `--font-geist-mono`
- `Material Symbols Outlined` (Google Fonts CDN) — declared but used 0x in `/dashboard` (lucide-react = 72 imports is canonical)

**Vietnamese support:** Geist Sans/Mono — full Latin Extended, diacritical marks render correctly (verified by `text-*-foreground` Vietnamese strings in `admin/migrations/migrations-client.tsx`, `settings/crypto-compliance-tab.tsx`).

**Mono usage:** 15 occurrences across data tables, hashes, key prefixes, code blocks (`admin/api-key-usage/page.tsx:131,144,145,149,150`, `admin/tenant-lookup/page.tsx:94,114`). Correct semantic usage.

**Recommendation:** **KEEP Geist Sans/Mono**. Do NOT swap to Fira. Rationale:
- Geist = Vercel's purpose-built UI font, optimal for dashboards
- Already loaded via `next/font/local` (zero CDN cost, no FOUT)
- Material Symbols Outlined link in `<head>` is dead weight — remove (saves 1 HTTP req + ~30KB)

**Issue:** no heading scale tokens. `text-2xl font-bold` repeated 30+ times for h1, `text-sm font-medium` for h2 — no `--text-h1`, `--text-h2` defined. Tailwind utilities are the de-facto scale.

---

## §5 Spacing Findings

**Vertical rhythm:** `space-y-6` canonical in admin/* (page.tsx:133, cost:53, audit-log:71) ✅; `space-y-8` drift in settings/* (page.tsx:53, branding-form-client.tsx:73).

**Card padding variance (admin/* tallied):** `p-4` 41x (modals/badges), `p-5` 13x (primary tiles e.g. admin/page.tsx:268), `p-6` 7x (settings forms), `p-3` 1x, `p-8` empty-states. **Recommend** `p-4` compact / `p-6` form / deprecate `p-5`.

**Border radius:** `rounded-lg` default vs `rounded-xl` in settings/branding — 2 conventions. **Gap rhythm:** `gap-2/3/4` consistent across button/icon/grid.

---

## §6 Iconography Findings

- **lucide-react:** 72 imports — canonical ✅
- **Material Symbols Outlined:** declared globals.css:339–353 + loaded `[locale]/layout.tsx:127` — 0 dashboard usages, dead asset
- **Semantic emoji literals as UI icons (should be lucide):** `⚠️` trial-banner.tsx:49; `🎬 📋 📖` dashboard-first-campaign-cta.tsx:18,24,30; `🚀` onboarding-welcome-banner.tsx:52; `❌` orders/order-card.tsx:109; `✓ ✗` orders/order-timeline.tsx:110; `✓ ▶ ○` videos/new/components/render-progress.tsx:149
- **Decorative (acceptable):** `✦` layout.tsx:132 + `🎉` email-outbox/webhook-deliveries (aria-hidden empty states)

**Verdict:** ~10 semantic emojis should swap to lucide for theme + a11y consistency.

---

## §7 Ranked Top 5 Issues

| # | Issue | Severity | Est. fix LOC |
|---|---|---|---|
| 1 | **Status badge color drift** (red-200..500, amber-200..500, emerald-300..500, green-400..700) — no canonical `<StatusBadge variant>` component. Inconsistent UI, ~40 files affected. | **critical** | ~150 LOC (new component + grep-replace across 36 files) |
| 2 | **Brand violet drift** — `text-violet-400` hardcoded 17x in `dashboard/layout.tsx` sidebar instead of `text-[var(--neon-purple)]`. Mixing tokens with literals defeats theme tokenization. | **high** | ~25 LOC (sed replace + new `--neon-purple-soft` token for hover) |
| 3 | **Chart palette monochromatic on dark** — `--chart-1..5` all in violet hue family `#22005c..#0f005d`, 1.05–1.4:1 contrast between adjacent series. Data viz unreadable. | **high** | ~10 LOC (rewrite 5 vars in globals.css `.dark`) |
| 4 | **`--card` == `--background`** — no elevation contrast in either theme. Cards rely on border only; doesn't match "data-dense dashboard" pattern that needs visual hierarchy. | **medium** | ~4 LOC (dark `--card: #0b1220` lift 4–6% L*) |
| 5 | **Semantic emoji literals** — `⚠️ 🎬 📋 📖 🚀 ❌` used as UI icons instead of lucide. Theme-inconsistent (emoji ignores dark mode color), a11y inconsistent. | **medium** | ~30 LOC (swap 10 occurrences to lucide) |

---

## §8 Three Refactor Proposals

### Proposal 1 — Status badge tokens (fixes Issue #1)

**File:** `src/app/globals.css` (add to `:root` and `.dark` blocks; lives in seed-layer token).

Before (de-facto, scattered):
```tsx
// admin/api-key-usage/page.tsx:138
isHighError ? 'bg-red-500/15 text-red-300 border-red-500/30' : ...
// admin/email-outbox/page.tsx:27-29
sent:    'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
pending: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
failed:  'bg-red-500/15 text-red-300 border-red-500/30',
```

After (canonical):
```css
/* globals.css .dark */
--badge-success-bg: rgb(16 185 129 / 0.15);
--badge-success-fg: #6ee7b7;
--badge-success-border: rgb(16 185 129 / 0.30);
--badge-warn-bg: rgb(245 158 11 / 0.15);
--badge-warn-fg: #fcd34d;
--badge-warn-border: rgb(245 158 11 / 0.30);
--badge-error-bg: rgb(239 68 68 / 0.15);
--badge-error-fg: #fca5a5;
--badge-error-border: rgb(239 68 68 / 0.30);
```
Then 1 component `<StatusBadge variant="success|warn|error">` consumed everywhere.

### Proposal 2 — Dashboard sidebar nav uses brand token (fixes Issue #2)

**File:** `src/app/[locale]/dashboard/layout.tsx:285–390`.

Before (16 lines repeat):
```tsx
className="flex items-center gap-3 px-4 py-3 text-violet-400 hover:text-violet-300 rounded-lg hover:bg-violet-950/30 transition-colors"
```

After (extract once, swap to token):
```tsx
const navLinkClass = "flex items-center gap-3 px-4 py-3 text-[var(--neon-purple-soft)] hover:text-[var(--neon-purple)] rounded-lg hover:bg-[var(--neon-purple)]/10 transition-colors";
// add to globals.css .dark: --neon-purple-soft: #a78bfa;
```

### Proposal 3 — Chart palette diversification (fixes Issue #3)

**File:** `src/app/globals.css:94–99` (`.dark` block).

Before:
```css
--chart-1: #22005c;  --chart-2: #190041;  --chart-3: #3f0097;
--chart-4: #21005d;  --chart-5: #0f005d;
```

After (cool-blue + warm + neutral, data-dense pattern):
```css
--chart-1: #00f0ff;  /* neon-cyan (brand primary series) */
--chart-2: #a78bfa;  /* violet-soft */
--chart-3: #f59e0b;  /* amber-500 warm CTA */
--chart-4: #10b981;  /* emerald-500 success */
--chart-5: #94a3b8;  /* slate-400 neutral baseline */
```
Each pair AA contrast on `#020817`: 14.6, 7.21, 9.78, 6.73, 6.78.

---

## §9 Unresolved Questions

1. Does Sophia have a brand book locking neon-cyan/purple/pink, or are these inherited from the legacy proposal-app theme? If the latter, can chart palette adopt cool-blue + warm CTA per data-dense dashboard pattern, or must it stay in violet family?
2. `--card` lift (Proposal 4 deferred) — acceptable to introduce 4-tier elevation (`--card`, `--card-elevated`, `--popover`, `--dialog`) or is single surface sufficient?
3. Material Symbols Outlined CDN link in `[locale]/layout.tsx:127` — confirmed unused in `/dashboard`. Safe to remove, or used by marketing pages outside scope?
4. `analytics/components/charts.tsx:20` hex array — is `recharts` capable of consuming CSS vars via `fill="var(--chart-1)"`, or does it require resolved hex at render? (Affects whether Proposal 3 cascades to charts automatically.)
5. Should `--accent` be redefined (currently duplicates `--secondary`) or deprecated entirely (no shadcn component in dashboard relies on accent)?
