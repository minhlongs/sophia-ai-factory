# ZEN-07.2 — Performance, Cloudflare Compatibility & Design Truth (G6 & G7)

**Repository:** `github.com/minhlongs/sophia-ai-factory`
**Branch:** `design/sophia-zen-design-os-v1`
**Verified HEAD (code & evidence):** `cd068bd39917e560f8857d490e04790fc6b0a7bf` (`BUILD_ID`: `i-DT5CkjJEXfOYAyJSbOO`)
**Baseline (`main`):** `673ec911be317233c7e6cb961bdca9d2097e210f` (`BUILD_ID`: `yYKZRZ2DV0-uYPRbmC_9f`)
**Machine Evidence:** [`g6/g6-runtime-perf.json`](./g6/g6-runtime-perf.json), [`g6/g6-runtime-perf.mjs`](./g6/g6-runtime-perf.mjs)

> **Important Measurement Caveat:** All runtime timings below are **local lab measurements** captured against localhost (`next dev` / local Chromium via Playwright) and **must not** be confused with production Cloudflare edge Core Web Vitals field data (CrUX / RUM).

---

## 1. Next.js Production Build Comparison (`main` vs `design/sophia-zen-design-os-v1`)

Both worktrees were built locally with `npm run build` (Next.js 16.4.2) and measured across all emitted files in `.next/static/chunks` and `.next/static/css`:

| Metric | Baseline `main` (`673ec911b`) | Design branch tip at build time (`4d23ddb38` + acceptance fixes) | Delta | % Impact |
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
- **Loading mechanism (measured):** `src/app/layout.tsx:34` emits a single Google Fonts
  css2 `<link>` — `family=Archivo:wdth,wght@100..112,400..800&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap`
  — with `preconnect` hints to `fonts.googleapis.com` / `fonts.gstatic.com` at
  `src/app/layout.tsx:30-31`. The project does **not** use `next/font`; there is no
  `next/font/google` import in the root layout.
- **Token authority (measured):** `src/app/globals.css:386` declares
  `--font-sans: 'Inter', system-ui, …` and `:387` declares
  `--font-mono: 'JetBrains Mono', ui-monospace, …`. A third family is scoped, not
  global: `src/styles/v3-core.css:28` declares `--font-display: 'Archivo', 'Inter', …`
  inside `.v3-core` only.
- **Alignment with `DESIGN.md`:** `DESIGN.md:88` (UI & body = Inter), `:91`
  (telemetry & code = JetBrains Mono), `:96` (Archivo scoped to `.v3-core`, "never an
  authority for UI text") and `:98` ("**Explicitly not in this release:** `Satoshi` and
  `Instrument Serif` are not adopted anywhere") already state this contract. There is no
  Satoshi/Instrument Serif divergence to record.
- **Measurement caveat:** `document.fonts.check('16px Satoshi')` in Chromium returns
  `true` for uninstalled family names by specification, so `document.fonts.check` is not
  evidence of use. Computed `fontFamily` and the declared tokens above are the
  authoritative runtime truth.

---

## 4. G7 — Design Truth Classification

Every promised Zen Design OS deliverable was audited against source files, tests, and real browser rendering:

| Deliverable | Path | Classification | Verification Evidence |
|:--|:--|:--:|:--|
| Canonical `DESIGN.md` | `DESIGN.md` (repo root, 336 lines) | **DOCUMENTED & ALIGNED** | Dual-theme specification exists and its typography section now matches the implementation: `:88` UI & body = Inter, `:91` telemetry & code = JetBrains Mono, `:96` Archivo scoped to `.v3-core` only ("never an authority for UI text"), `:98` "**Explicitly not in this release:** `Satoshi` and `Instrument Serif` are not adopted anywhere". Verified against `src/app/globals.css:386-387`, `src/styles/v3-core.css:28` and the single Google Fonts `<link>` at `src/app/layout.tsx:34`. Remaining divergence is confined to legacy `--surface-void` prose, which `src/app/globals.css` supersedes per `.claude/rules/sophia-design-authority.md`. |
| DTCG JSON Tokens | `src/seed/design-tokens/zen-design-tokens.dtcg.json` | **IMPLEMENTED** | Valid W3C DTCG `$value`/`$type` schema covering primitive palette, Dark/Light semantic roles, typography, spacing, radius, and motion tokens; exported via `src/seed/design-tokens/index.ts`. |
| Token Parity Checks | `src/seed/design-tokens/__tests__/zen-design-tokens.test.ts` | **TESTED ONLY** | 7/7 unit tests pass verifying DTCG parity and semantic getters; also guarded by `scripts/check-hardcoded-color.mjs` (`npm run check:color-tokens` → exit 0, 1045 vs 1080 baseline). |
| Light / Dark Semantic Roles | `src/app/globals.css:14-305`, `src/forest/theme/zen-theme-provider.tsx` | **VISUALLY VERIFIED** | Verified in real Chrome across 36 base screenshots + `g2-audit.json` after remediating 4 Light/Dark contrast & token defects. |
| Motion Policy & Primitives | `src/app/globals.css:19-27,980-1005`, `src/seed/components/ui/{fade-in-view,scroll-reveal,page-transition,animated-counter-with-framer-motion}.tsx` | **IMPLEMENTED & TESTED** | Zero new animation dependencies (no GSAP/Lenis/React Bits); 4/4 unit tests pass in `zen-motion-reduced-motion.test.tsx` + verified under Playwright `reducedMotion: 'reduce'`. |
| Three Pilot Screens (`/vi/setup-wizard`, `/vi/dashboard`, `/vi/dashboard/niche-studio` + `/en/*`) | `src/app/[locale]/setup/page.tsx`, `src/app/[locale]/dashboard/page.tsx`, `src/app/[locale]/dashboard/niche-studio/page.tsx` | **VISUALLY VERIFIED** | All 36 locale × theme × viewport PNGs rendered in real Chrome and visually inspected (`ZEN-07.2-VISUAL-EVIDENCE.md`). |
| A/B/C Design-Direction Comparison | `docs/design/zen-design-os/01-OFFICIAL-RESEARCH-LEDGER.md` & `03-ZEN-DESIGN-OS-ARCHITECTURE.md` (repo root) | **DOCUMENTED ONLY** | Architectural direction comparison (Dark-Only vs Dual-Theme Director's Control Deck / Executive Studio Ivory vs Warm Editorial) documented in the numbered Zen Design OS specification ledger at repo root. |
| Reusable Design Documentation | `docs/design/zen-design-os/00-EXECUTIVE-SUMMARY.md` … `12-ROLLBACK-AND-RECOVERY.md` + `ZEN-MOTION-ADOPTION-MATRIX.md` (repo root, 14 files) | **DOCUMENTED ONLY** | Complete 14-document architecture & governance suite at repo root plus the 7 independent verification reports in `apps/sophia-ai-factory/docs/design/zen-design-os/evidence/`. |
