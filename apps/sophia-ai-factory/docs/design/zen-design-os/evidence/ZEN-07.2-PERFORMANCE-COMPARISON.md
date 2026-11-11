# ZEN-07.2 — Performance, Cloudflare Compatibility & Design Truth (G6 & G7)

**Repository:** `github.com/minhlongs/sophia-ai-factory`
**Branch:** `design/sophia-zen-design-os-v1`
**Verified HEAD (design):** `4d23ddb386f499b7627f2c828a1b80c81c6a3382` + P0/P1 remediations (`BUILD_ID`: `i-DT5CkjJEXfOYAyJSbOO`)
**Baseline (`main`):** `673ec911be317233c7e6cb961bdca9d2097e210f` (`BUILD_ID`: `yYKZRZ2DV0-uYPRbmC_9f`)
**Machine Evidence:** [`g6/g6-runtime-perf.json`](./g6/g6-runtime-perf.json), [`g6/g6-runtime-perf.mjs`](./g6/g6-runtime-perf.mjs)

> **Important Measurement Caveat:** All runtime timings below are **local lab measurements** captured against localhost (`next dev` / local Chromium via Playwright) and **must not** be confused with production Cloudflare edge Core Web Vitals field data (CrUX / RUM).

---

## 1. Next.js Production Build Comparison (`main` vs `design/sophia-zen-design-os-v1`)

Both worktrees were built locally with `npm run build` (Next.js 16.4.2) and measured across all emitted files in `.next/static/chunks` and `.next/static/css`:

| Metric | Baseline `main` (`673ec911b`) | Design Branch (`4d23ddb38` + fixes) | Delta | % Impact |
|:--|--:|--:|--:|--:|
| JS chunk file count | 220 | 220 | 0 | 0.00% |
| Total JS (raw bytes) | 7,462,845 B | 7,477,048 B | **+14,203 B** | **+0.190%** |
| Total JS (gzip bytes) | 2,407,891 B | 2,411,846 B | **+3,955 B** | **+0.164%** |
| CSS file count | 1 | 1 | 0 | 0.00% |
| Total CSS (raw bytes) | 410,910 B | 418,763 B | **+7,853 B** | **+1.911%** |
| Total CSS (gzip bytes) | 51,414 B | 52,676 B | **+1,262 B** | **+2.455%** |

**Assessment:** The entire Zen Design OS dual-theme token layer, CSP nonce wiring, `ZenThemeProvider`, motion primitives, and `SophiaArtifactCanvas` add **+3.86 KB gzipped JS (+0.16%)** and **+1.23 KB gzipped CSS (+2.46%)** — negligible bundle impact.

---

## 2. OpenNext / Cloudflare Worker Build Compatibility

Executed the full Cloudflare Worker production build pipeline locally:

```bash
node scripts/fix-instrumentation-standalone.mjs && \
bash scripts/patch-opennext-d3-stubs.sh && \
npx @opennextjs/cloudflare build --skipNextBuild && \
node scripts/inject-scheduled-handler.mjs && \
bash scripts/check-bundle-size.sh
```

| Check | Result | Measured Value |
|:--|:--:|:--|
| `@opennextjs/cloudflare` (v1.20.12) build | **PASS** | `.open-next/worker.js` generated with 0 errors |
| Scheduled handler & route warmers (`inject-scheduled-handler.mjs`) | **PASS** | Injected 22 patterns / 39 routes |
| Worker handler raw size (`.open-next/server-functions/default/handler.mjs`) | **PASS** | `38,722,318 B` (36.93 MB raw) |
| Worker handler compressed size (`check-bundle-size.sh`) | **PASS** | **`9.46 MB` gzipped** (`9,919,179 B` — below the 9.50 MB warning threshold and 10.00 MB Cloudflare Workers hard limit) |

---

## 3. Local Lab Runtime Performance (`g6/g6-runtime-perf.json`)

Measured across 6 probes (3 pilot routes × 2 themes) at `1440×900` in system Google Chrome:

| Route | Theme | HTTP | TTFB (ms) | FCP (ms) | DOM Complete (ms) | CLS | Long Tasks (count / total ms) | Theme Swap (ms) | Screenshot Stability |
|:--|:--:|:--:|--:|--:|--:|--:|--:|--:|:--:|
| `/vi/setup` | Dark | 200 | 118.4 | 220.0 | 331.1 | **0.0000** | 0 / 0 ms | <0.1 ms | Identical (153,852 B) |
| `/vi/setup` | Light | 200 | 134.9 | 216.0 | 285.9 | **0.0000** | 0 / 0 ms | <0.1 ms | Identical (151,971 B) |
| `/vi/dashboard` | Dark | 200 | 133.0 | 180.0 | 260.6 | **0.0005** | 1 / 54 ms | <0.1 ms | Identical (205,598 B) |
| `/vi/dashboard` | Light | 200 | 137.9 | 244.0 | 332.5 | **0.0000** | 1 / 97 ms | 0.1 ms | 1-byte subpixel diff (206,029 vs 206,030 B) |
| `/vi/dashboard/niche-studio` | Dark | 200 | 89.9 | 292.0 | 274.6 | **0.0000** | 0 / 0 ms | 0.1 ms | Identical (205,068 B) |
| `/vi/dashboard/niche-studio` | Light | 200 | 90.9 | 188.0 | 205.2 | **0.0000** | 0 / 0 ms | <0.1 ms | Identical (203,471 B) |

### Font Loading Truth Note
- `document.fonts.status` resolved to `"loaded"` (`fontFaceCount: 70`).
- `src/app/layout.tsx:2,8-18` loads `Inter` (`--font-inter`) and `JetBrains_Mono` (`--font-mono`) via `next/font/google`, while `body` (`src/app/layout.tsx:31`) uses Tailwind `font-sans` (`ui-sans-serif, system-ui, sans-serif...`).
- **Honest Discrepancy Note:** `DESIGN.md` references `Satoshi` / `Archivo` / `Instrument Serif` as narrative display fonts, whereas the actual application runtime (`src/app/layout.tsx` and `.claude/rules/sophia-design-authority.md`) governs typography via `globals.css` and `next/font/google` (`Inter` + `JetBrains Mono` + system sans). Note that `document.fonts.check('16px Satoshi')` in Chromium returns `true` for uninstalled font family names by specification, so computed `fontFamily` (`ui-sans-serif, system-ui, sans-serif`) is the authoritative runtime truth.

---

## 4. G7 — Design Truth Classification

Every promised Zen Design OS deliverable was audited against source files, tests, and real browser rendering:

| Deliverable | Path | Classification | Verification Evidence |
|:--|:--|:--:|:--|
| Canonical `DESIGN.md` | `DESIGN.md` (repo root, 336 lines) | **DOCUMENTED ONLY** | Comprehensive dual-theme specification exists, but narrative font names (`Satoshi`, `Instrument Serif`) and legacy `--surface-void` prose partially diverge from `src/app/globals.css` (which is supreme per `.claude/rules/sophia-design-authority.md`). |
| DTCG JSON Tokens | `src/seed/design-tokens/zen-design-tokens.dtcg.json` | **IMPLEMENTED** | Valid W3C DTCG `$value`/`$type` schema covering primitive palette, Dark/Light semantic roles, typography, spacing, radius, and motion tokens; exported via `src/seed/design-tokens/index.ts`. |
| Token Parity Checks | `src/seed/design-tokens/__tests__/zen-design-tokens.test.ts` | **TESTED ONLY** | 7/7 unit tests pass verifying DTCG parity and semantic getters; also guarded by `scripts/check-hardcoded-color.mjs` (`npm run check:color-tokens` → exit 0, 1046 vs 1080 baseline). |
| Light / Dark Semantic Roles | `src/app/globals.css:14-305`, `src/forest/theme/zen-theme-provider.tsx` | **VISUALLY VERIFIED** | Verified in real Chrome across 36 base screenshots + `g2-audit.json` after remediating 4 Light/Dark contrast & token defects. |
| Motion Policy & Primitives | `src/app/globals.css:19-27,980-1005`, `src/seed/components/ui/{fade-in-view,scroll-reveal,page-transition,animated-counter-with-framer-motion}.tsx` | **IMPLEMENTED & TESTED** | Zero new animation dependencies (no GSAP/Lenis/React Bits); 4/4 unit tests pass in `zen-motion-reduced-motion.test.tsx` + verified under Playwright `reducedMotion: 'reduce'`. |
| Three Pilot Screens (`/vi/setup-wizard`, `/vi/dashboard`, `/vi/dashboard/niche-studio` + `/en/*`) | `src/app/[locale]/setup/page.tsx`, `src/app/[locale]/dashboard/page.tsx`, `src/app/[locale]/dashboard/niche-studio/page.tsx` | **VISUALLY VERIFIED** | All 36 locale × theme × viewport PNGs rendered in real Chrome and visually inspected (`ZEN-07.2-VISUAL-EVIDENCE.md`). |
| A/B/C Design-Direction Comparison | `docs/design/zen-design-os/DIRECTION-COMPARISON-MATRIX.md` | **DOCUMENTED ONLY** | 88-line architectural comparison matrix (Option A Dark-Only vs Option B Dual-Theme vs Option C Warm Editorial) with weighted scorecard (Option B 9.45/10). |
| Reusable Design Documentation | `docs/design/zen-design-os/{AESTHETIC-DIRECTION,BENCHMARK-EXTRACTION,COMPONENT-INVENTORY,MOTION-AND-INTERACTION-SPEC,PILOT-SCREENS-REDESIGN-SPEC,ROLLOUT-ROADMAP,TOKEN-SPEC,VISUAL-AUDIT-REPORT,ZEN-07.1-HANDOVER}.md` | **DOCUMENTED ONLY** | Complete 10-document suite present under `docs/design/zen-design-os/` plus the 6 independent verification reports in `docs/design/zen-design-os/evidence/`. |
