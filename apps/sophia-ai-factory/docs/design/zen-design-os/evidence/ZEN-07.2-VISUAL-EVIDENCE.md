# ZEN-07.2 — Visual Evidence

**Repository:** `github.com/minhlongs/sophia-ai-factory`
**Branch:** `design/sophia-zen-design-os-v1`
**Verified Code & Test HEAD:** `d8a0275396392a7fc2691eb5da1ef6b7bf2c5430`
**Browser-Evidence Capture Tree:** `cd068bd39917e560f8857d490e04790fc6b0a7bf`
**Baseline (main):** `673ec911be317233c7e6cb961bdca9d2097e210f`
**Worktree:** `/Users/macbook/.gemini/antigravity/scratch/sophia-zen-design-os-v1/apps/sophia-ai-factory`
**Date:** 2026-11-12 (screenshots captured on `cd068bd39`; unit & regression suites re-verified on `d8a027539` on 2026-11-14)
**Mode:** Isolated local verification; PRODUCTION NOT TOUCHED (no merge, no deploy, no live Cloudflare edits).

---

## 1. Environment

| Item | Value |
|:--|:--|
| Next.js | 16.4.2 (App Router, Turbopack dev) |
| Playwright browser channel | system Google Chrome (`channel: 'chrome'`) |
| App URL | `http://localhost:3000` |
| Locales verified | `vi` (default) and `en` |
| Themes verified | `dark` (default) and `light` |
| Widths | 375 / 768 / 1440 px |
| Isolated test account | `zen-07-2@sophia.test` (sign-up/sign-in via `/api/auth/sign-in/email`, HTTP 200) |
| AI provider mocks | `NEXT_PUBLIC_MOCK_AI_SERVICES=true` |

Dev-server command (env vars kept in shell, never in git):

```bash
BETTER_AUTH_SECRET='<32+ chars>'          \
JWT_SECRET='<32+ chars>'                  \
ENCRYPTION_KEY='<64 hex>'                 \
NEXT_PUBLIC_MOCK_AI_SERVICES=true         \
BETTER_AUTH_URL=http://localhost:3000     \
NEXT_PUBLIC_APP_URL=http://localhost:3000 \
npm run dev
```

---

## 2. Routes render cleanly (G1)

12 route/theme combinations loaded over the real dev server.
All HTTP 200, zero console errors, zero hydration warnings, zero unhandled
page errors, zero failed assets. Canonical redirect:
`/vi/setup-wizard` → `/vi/setup` (already the live route name).

Machine record: [`g1-route-logs.json`](./g1-route-logs.json)

| Route | vi/dark | vi/light | en/dark | en/light |
|:--|:--:|:--:|:--:|:--:|
| `/vi/setup-wizard` → `/vi/setup` | 200 | 200 | 200 | 200 |
| `/vi/dashboard` | 200 | 200 | 200 | 200 |
| `/vi/dashboard/niche-studio` | 200 | 200 | 200 | 200 |

Console errors: 0/12 · Hydration warnings: 0/12 · Page errors: 0/12 · Failed assets: 0/12.

---

## 3. Visual acceptance matrix (G3)

36 reproducible screenshots — 3 screens × 2 locales × 2 themes × 3 widths.
Playwright `page.screenshot({ animations: 'disabled' })`, deterministic
`localStorage['sophia-zen-theme']` seeding, no `toHaveScreenshot()` baselines
auto-approved (every image below was opened and inspected by eye).

Machine record: [`g3-manifest.json`](./g3-manifest.json)
Images: [`screenshots/`](./screenshots/)

Naming: `{screen}__{locale}__{theme}__{width}w.png`

| Screen | vi | en |
|:--|:--|:--|
| setup-wizard | 6 | 6 |
| dashboard | 6 | 6 |
| niche-studio | 6 | 6 |

### 3.1 What was inspected (all 36)

| Check | Result |
|:--|:--|
| Alignment / spacing grid | PASS — `gap-4`/`gap-5` grid held at all three widths |
| Component density | PASS — no collisions at 375 px; sidebar drawer collapses |
| Text wrapping / clipping | PASS — long Vietnamese strings wrap inside cards, no `overflow:hidden` truncation of body copy |
| Typography hierarchy | PASS — eyebrow → h1 → h2 → body ordering readable in both themes |
| Contrast / readability | PASS — see [`ZEN-07.2-WCAG-AND-MOTION-EVIDENCE.md`](./ZEN-07.2-WCAG-AND-MOTION-EVIDENCE.md) (12/12 axe-clean incl. colour-contrast) |
| Responsive navigation | PASS — mobile drawer opens at 375 px, docked sidebar at ≥1024 px |
| Card & dialog composition | PASS — `rounded-xl` cards with consistent 1px `--border` at both themes |
| Input / button states | PASS — focus ring visible; `bg-primary text-primary-foreground dark:bg-primary-600 dark:text-white` fixes AA in both themes |
| Brand consistency | PASS — amber/indigo from `src/app/globals.css` only; no off-token colours introduced |
| Dark / Light equivalence | PASS — same component tree, only semantic tokens swap |

### 3.2 Targeted states (beyond the base 36)

| File | State |
|:--|:--|
| `targeted/t01-mobile-nav-drawer-vi-dark-375w.png` | Mobile navigation drawer open |
| `targeted/t02-niche-studio-long-vi-text-dark-1440w.png` | Long Vietnamese copy, dark |
| `targeted/t03-niche-studio-long-vi-text-light-1440w.png` | Long Vietnamese copy, light |
| `targeted/t04-setup-wizard-step-state-vi.png` | Setup Wizard mid-flow step state |

Loading, empty, error, pending-approval and disabled-control states were
exercised through the live request paths recorded in
[`ZEN-07.2-FUNCTIONAL-REGRESSION.md`](./ZEN-07.2-FUNCTIONAL-REGRESSION.md)
(BYOK verification pending, rate-limit 429 removal, refresh-loop errors) rather
than only as static screenshots.

### 3.2.1 Dialogs (open state, not screenshot-only)

Three real dialogs were driven through genuine user interaction in the same
browser and both themes/locales: the harness `Dialog` (form modal with two
focusable fields), the shipping `ByokRotationView` rotation dialog, and the
shipping `CmdKPalette`. Focus placement, Tab/Shift+Tab containment,
`Escape`-to-close, focus return targets, accessible name/description and
background inertness were measured — not eyeballed — and are recorded in
[`ZEN-07.2-WCAG-AND-MOTION-EVIDENCE.md`](./ZEN-07.2-WCAG-AND-MOTION-EVIDENCE.md)
§2.1 and [`dialog-a11y-report.json`](./dialog-a11y-report.json).

### 3.3 Verdict

**VISUALLY VERIFIED** — every one of the three pilot screens was opened as a
real browser-rendered PNG, in both themes, at all three widths, and inspected.
No route is promoted to "visually verified" on the strength of unit tests alone.

---

## 4. Defects found and remediated in this pass

| # | Severity | File:line | Defect | Fix |
|:--|:--|:--|:--|:--|
| V1 | P1 | `src/components/niche-studio/niche-gate1-readiness-card.tsx:78-175` | Translucent dark surfaces (`bg-zinc-900/70`) blended into the ivory `#F8F9FC` light background into mid-grey — failed AA for both light and dark text | `bg-card dark:bg-zinc-900/70`, `text-foreground dark:text-white`, `text-muted-foreground`, `text-amber-800 dark:text-amber-300` |
| V2 | P1 | `src/components/niche-studio/video-compliance-preview-player.tsx:28-38,94-103` | `bg-zinc-900/40` empty state and post-dispatch banner rendered mid-grey / pale emerald in Light mode | `bg-card dark:bg-zinc-900/40`, `text-foreground dark:text-zinc-300`, `text-emerald-800 dark:text-emerald-300` |
| V3 | P1 | `src/components/stitch/ui/button-styles.ts:14`, `src/seed/components/ui/button.tsx:11-24` | Dark-mode primary button used `#6366F1` with white text → 4.47:1 (below AA) | `bg-primary text-primary-foreground dark:bg-primary-600 dark:text-white` → 8.76:1 dark (`#2E19E6` / `#FFFFFF`), 7.90:1 light (`#4338CA` / `#FFFFFF`) |
| V4 | P1 | `src/components/niche-studio/sophia-artifact-canvas.tsx:139-146` | 5 hardcoded `#rrggbb` literals regressed `npm run check:color-tokens` (baseline ratchet guard failed, exit 1) | `'var(--primary-600)'`, `'var(--primary-foreground)'`, `DARK_CANVAS_BG`, `DEFAULT_ACCENT_HEX` — identical rendering, 0 literals |
| V5 | P1 | `src/forest/dashboard/dashboard-user-card.tsx:24` | `dark:text-violet-200` broke the PRO badge contract (test expected `violet-300`) and reduced contrast | restored `dark:text-violet-300` (~8.5:1 on `bg-violet-500/20`) |
| V6 | P0 | `src/middleware/api-handler.ts:71-80` | `/api/user/byok` shared the 10 req/min `auth` bucket with `/api/auth/*` → Setup Wizard BYOK refresh loop hit **429 Too Many Requests** | dedicated `byok` bucket (40 req/min) declared at `src/seed/security/sql-rate-limiter-queries.ts:32`, applied to `/api/user/byok`, `/api/setup-wizard`, and `/api/setup/verify`; `/api/admin` separately restored to its pre-declared 50 req/min bucket; 20-test security, rate-limit & circuit-breaker isolation suite added |
| V7 | P1 | `src/components/niche-studio/niche-form-product-inputs.tsx:102,118` | `<label htmlFor>` added while `aria-label` was removed on `commissionTerms` and `maxRenderCostCents` → accessible names lost (`niche-studio-readiness-ui.test.tsx:49` red) | restored both `aria-label` attributes |

Every fix was followed by the narrowest test first, then the full sweep:
`npm test` measured **2101 test files / 19,710 tests passing** (34 skipped,
10 todo; exit 0) on the closing code tree (`d8a027539`), and `npm run build` completed with
exit 0 across 636 routes. Per-gate numbers live in
[`ZEN-07.2-FUNCTIONAL-REGRESSION.md`](./ZEN-07.2-FUNCTIONAL-REGRESSION.md) §2.

---

## 5. Reproduce

```bash
# 1. dev server on :3000 (see §1 env)
# 2. route load log
node docs/design/zen-design-os/evidence/g6/g6-runtime-perf.mjs   # also re-verifies G6 numbers
# 3. colour-token ratchet guard (must exit 0)
npm run check:color-tokens        # → "✔ no new hardcoded colors" (1045 vs baseline 1080)
```
