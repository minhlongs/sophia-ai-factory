# ZEN-07.2 — Dark/Light & CSP Acceptance Audit (G2)

**Repository:** `github.com/minhlongs/sophia-ai-factory`
**Branch:** `design/sophia-zen-design-os-v1`
**Verified HEAD:** `4d23ddb386f499b7627f2c828a1b80c81c6a3382` + P0/P1 remediations
**Baseline (`main`):** `673ec911be317233c7e6cb961bdca9d2097e210f`
**Machine Evidence:** [`g2-audit.json`](./g2-audit.json)

---

## 1. Source Architecture & Exact `file:line` Evidence

| Component / Responsibility | Exact File & Line | Verified Implementation |
|:--|:--|:--|
| Per-request CSP nonce generation | `src/middleware.ts:55-57` | `const nonce = generateNonce(); requestHeaders.set(CSP_NONCE_HEADER, nonce);` |
| CSP & HSTS header injection | `src/middleware/middleware-shared-config.ts:35-44` | `response.headers.set('Content-Security-Policy', buildCSPHeader(nonce)); response.headers.set(CSP_NONCE_HEADER, nonce);` |
| Nonce-strict `script-src` policy | `src/seed/security/content-security-policy-configuration.ts:57-60` | When `nonce` is supplied, `script-src` adds `'nonce-${nonce}'` and **omits** `'unsafe-inline'`. |
| Server-side nonce reader | `src/seed/security/get-csp-nonce.ts:10-20` | Reads `x-csp-nonce` from Next.js `await headers()` on every dynamic request. |
| Root layout SSR Dark default & nonce wiring | `src/app/layout.tsx:25-39` | `const nonce = await getCspNonce();` → `<html lang="vi" ... className="dark" suppressHydrationWarning>` → `<ZenThemeProvider defaultTheme="dark" nonce={nonce}>`. |
| `ZenThemeProvider` (`next-themes` wrapper) | `src/forest/theme/zen-theme-provider.tsx:26-44` | `attribute="class"`, `defaultTheme="dark"`, `themes={['dark', 'light']}`, `enableSystem={false}`, `disableTransitionOnChange={false}`, `storageKey="sophia-zen-theme"`, `nonce={nonce}`. |
| Dual-theme semantic CSS variables | `src/app/globals.css:14-185` (`:root` Light) & `187-305` (`.dark` Dark) | `:root` defines Executive Studio Ivory (`--background: #F8F9FC`, `--card: #FFFFFF`, `--primary: #4338CA`); `.dark` defines Director's Control Deck (`--background: #090A10`, `--card: #11131F`, `--primary: #6366F1`). |

---

## 2. G2 Acceptance Matrix (13/13 Requirements Verified)

| # | Requirement | Verdict | Runtime Evidence (`g2-audit.json` & Source) |
|:--|:--:|:--:|:--|
| 1 | Default theme is Dark for a new user | **PASS** | Fresh browser context (`localStorage.getItem('sophia-zen-theme') === null`) renders `html.className = "dark"`, `colorScheme = "dark"`, `bodyBg = "rgb(9, 10, 16)"`, `--surface = "#090a10"`, `--primary = "#6366f1"`. |
| 2 | User can change to Light | **PASS** | Setting theme to `light` updates `html.className = "light"`, `colorScheme = "light"`, `localStorage['sophia-zen-theme'] = "light"`, `bodyBg = "rgb(248, 249, 252)"`, `--surface = "#f8f9fc"`, `--primary = "#4338ca"`. |
| 3 | Selected theme persists across refresh | **PASS** | After `page.reload()` in Light mode: `domContentLoadedClass = "light"`, `domContentLoadedBg = "rgb(248, 249, 252)"`, `storageValue = "light"`. |
| 4 | Navigation retains the selected theme | **PASS** | Navigating `/vi/dashboard` → `/vi/dashboard/niche-studio` → `/vi/setup` retains `htmlClass = "light"`, `bodyBg = "rgb(248, 249, 252)"`. |
| 5 | Initial render does not visibly flash the incorrect theme | **PASS** | At `DOMContentLoaded` (before React hydration completes), the synchronous nonce-authorized `next-themes` bootstrap script has already applied `html.className = "light"` and `rgb(248, 249, 252)`. |
| 6 | No hydration mismatch | **PASS** | `<html suppressHydrationWarning>` (`src/app/layout.tsx:28`) + `ZenThemeProvider`; `hydrationWarnings: []` and `consoleErrors: []` across all 12 route/theme loads (`g1-route-logs.json`). |
| 7 | No forced Dark class overriding user choice | **PASS** | `src/app/layout.tsx:28` sets initial SSR class `dark`, which `next-themes` (`attribute="class"`) cleanly replaces with `light` when `sophia-zen-theme="light"`. No nested layout forces `.dark` except the intentional `--studio-stage-*` video canvas preview frame (`src/app/globals.css:29-33`). |
| 8 | Light tokens are actually applied to all relevant elements | **PASS** | After remediating `niche-gate1-readiness-card.tsx` and `video-compliance-preview-player.tsx` (which previously used translucent `bg-zinc-900/70` and `bg-zinc-900/40` without light-mode semantic classes), all 3 pilot screens resolve semantic Light tokens (`bg-card`, `bg-background`, `text-foreground`, `border-border`) with 0 axe contrast violations. |
| 9 | Browser form controls render consistently | **PASS** | `next-themes` synchronizes `document.documentElement.style.colorScheme` to `"dark"` or `"light"`, so native `<select>`, `<input type="number">`, `<input type="range">`, and scrollbars render with matching OS/browser chrome in both themes. |
| 10 | Strict CSP remains effective | **PASS** | CSP was **never** disabled. `script-src 'self' 'unsafe-eval' 'nonce-db6523ac16b494e00d54dba9c987b575'` in dev (and `'self' 'nonce-...'` in production per `src/seed/security/content-security-policy-configuration.ts:21`). Zero `securitypolicyviolation` events (`cspViolations: []`). |
| 11 | Per-request CSP nonce matches the intended theme initialization script | **PASS** | Request 1 header `x-csp-nonce: db6523ac16b494e00d54dba9c987b575` matches `Content-Security-Policy` `'nonce-db6523ac16b494e00d54dba9c987b575'` and the DOM `<script>` element's `script.nonce` IDL property (`themeScriptNonceProp: "db6523ac16b494e00d54dba9c987b575"`). *(Note: Modern Chromium strips the raw `nonce` HTML attribute from DOM inspection after script execution as a standard anti-exfiltration defense while preserving `el.nonce`.)* |
| 12 | Cached HTML cannot cause incorrect nonce reuse across requests | **PASS** | `src/app/layout.tsx:25` calls `await getCspNonce()` (`await headers()`), opting root rendering into per-request dynamic rendering with `Cache-Control: no-store`. Consecutive requests produced distinct nonces (`db6523ac16b494e00d54dba9c987b575` vs `572952b68321ec03bea54ce2d9c0a057`, `noncesAreUniqueAcrossRequests: true`). |
| 13 | No `unsafe-inline` exception introduced to hide errors | **PASS** | `scriptSrcHasNoUnsafeInline: true` in `g2-audit.json`. `style-src` retains `'unsafe-inline'` solely for Tailwind/React inline style variables (`src/seed/security/content-security-policy-configuration.ts:24-28`). |

---

## 3. Cloudflare Rocket Loader Interaction Assessment

1. **Repository & Worker Configuration Check:**
   - Inspected `wrangler.toml`, `open-next.config.ts`, `next.config.ts`, and `src/app/layout.tsx`. Rocket Loader is a Cloudflare zone-level proxy transformation that rewrites `<script>` tags to `type="text/rocketscript"` unless opted out with `data-cfasync="false"`.
2. **Interaction with Strict Nonce CSP & Theme Initialization:**
   - If Cloudflare Rocket Loader were enabled at the zone level on `sophia.agencyos.network`, it would inject an inline/external `rocket-loader.min.js` bootstrapper without the per-request middleware nonce (causing CSP `script-src` violation) AND defer the synchronous `next-themes` inline script until after first paint (causing a Dark→Light flash on reload).
3. **Status & Operational Rule:**
   - In local verification and in the Worker-direct OpenNext architecture, Rocket Loader is **not** enabled in the repo. For production Cloudflare zone governance, Rocket Loader **must remain OFF** on `sophia.agencyos.network` whenever per-request CSP nonces are active.
