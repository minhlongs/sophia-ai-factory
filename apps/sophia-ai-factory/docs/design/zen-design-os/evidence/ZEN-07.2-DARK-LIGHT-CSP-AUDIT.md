# ZEN-07.2 — Dark/Light & CSP Acceptance Audit (G2)

**Repository:** `github.com/minhlongs/sophia-ai-factory`
**Branch:** `design/sophia-zen-design-os-v1`
**Verified HEAD (code & evidence):** `cd068bd39917e560f8857d490e04790fc6b0a7bf`
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
| `ZenThemeProvider` (`next-themes` wrapper) | `src/forest/theme/zen-theme-provider.tsx:41-60` | `attribute="class"`, `defaultTheme="dark"` (first-time visitors still land on Dark), `themes={['dark', 'light']}`, `enableSystem` (`true` — persists explicit `'system'` selection across all routes), `disableTransitionOnChange` (`true`), `storageKey="sophia-zen-theme"`, `nonce={nonce}`, `scriptProps={{ 'data-cfasync': 'false' }}`. |
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

Rocket Loader is a Cloudflare zone-level proxy transformation that rewrites every
`<script>` tag it sees to `type="text/rocketscript"`, deferring execution to its
own `rocket-loader.min.js` bootstrapper, unless the tag opts out with
`data-cfasync="false"`. It conflicts with this design system in two independent
ways, so both the measurement and the opt-out are recorded here.

### 3.1 Is it actually enabled on `sophia.agencyos.network`? — measured, not assumed

A single unauthenticated `GET https://sophia.agencyos.network/vi/login` was
served from the edge on 2026-11-12 (HTTP/2 200). Rocket Loader leaves four
unmistakable signatures in the returned HTML, and none of them is present:

| Signature | Occurrences in production HTML |
|:--|--:|
| `type="text/rocketscript"` | **0** |
| `rocket-loader` | **0** |
| `data-cf-settings` | **0** |
| `/cdn-cgi/` (any injected asset) | **0** |

The opt-out attribute this repo ships is therefore also absent from production
output (`data-cfasync` → 0 occurrences), which is expected: no Rocket Loader
means nothing to opt out of in the response Cloudflare builds today.

The live CSP on the same response, captured verbatim:

```
script-src 'self' 'nonce-1ef0127e8288a4ad76a21ace86487c42'
```

No `'unsafe-inline'` for scripts; `frame-ancestors 'none'`, `object-src 'none'`,
`report-uri /api/csp-report` all intact. The document contained **22 `<script>`
elements and all 22 carried the per-request nonce** (24 nonce attributes in
total; the other 2 are the nonced stylesheet `<link>` and script `<link
rel="preload">` that Next emits).

**Conclusion: Rocket Loader is not transforming Sophia's responses today.** No
Cloudflare setting needs to be changed for the current deployment to be correct.
The remaining work is governance — preventing a future zone-level toggle from
regressing it — which is §3.4.

### 3.2 The repo-side opt-out that keeps it safe either way

`src/forest/theme/zen-theme-provider.tsx:38` ships a page-level opt-out, so the
theme bootstrap stays correct even if Rocket Loader is ever switched on:

```ts
const ROCKET_LOADER_OPT_OUT = { 'data-cfasync': 'false' } as const;
```

passed as `scriptProps` to `next-themes` (`zen-theme-provider.tsx:54`).

The comment in that file claims the opt-out **cannot** displace the CSP nonce.
That claim was verified against the installed package rather than taken on
trust — `next-themes@0.4.6`, resolved from `node_modules`, whose `ThemeScript`
builds its element as:

```js
createElement("script", { ...w, suppressHydrationWarning: !0,
  nonce: typeof window == "undefined" ? d : "",
  dangerouslySetInnerHTML: { __html: … } })
```

`w` is `scriptProps`. It is spread **first**, and `nonce` is assigned **after**
it, so `data-cfasync` can never overwrite the per-request nonce. `index.d.ts`
confirms `scriptProps?: ScriptProps` where `ScriptProps` extends
`React.ScriptHTMLAttributes<HTMLScriptElement>` and re-declares `nonce?: string`.
This is why adding the opt-out does **not** weaken `script-src`; the CSP stays
nonce-strict in both the Rocket Loader on and off states.

### 3.3 Theme initialisation under the production runtime

Theme initialisation runs in the browser, not in the Worker: the Worker's only
role is to render `<html class="dark">` and emit the nonced inline restore script
that `next-themes` injects. That script was exercised end-to-end on the local dev
server (matrix rows 1–7, 11–12 of §2: default dark, switch to light, reload
persistence, navigation persistence, no flash at `DOMContentLoaded`, distinct
nonce per request).

**Honest limit:** production HTML carries **0** occurrences of the
`sophia-zen-theme` storage key and **0** of `data-cfasync`, against **1** and
**1** on the local dev server. That is not a defect — this branch is undeployed
(deployment is prohibited for this review), so the live edge is serving the base
commit without the Zen theme provider at all. The claim recorded here is
therefore: verified on the local dev server plus verified against the OpenNext
Worker build artifact (`.open-next/worker.js` present, `main` in `wrangler.toml`,
`compatibility_date = "2026-03-17"`, `nodejs_compat`), **not** verified on edge.

### 3.4 Smallest safe configuration change — hostname-scoped, pending approval

Rocket Loader is a zone-wide toggle, but Cloudflare **Configuration Rules** can
override it for exactly one hostname. That is the smallest change that satisfies
the Founder policy: it does not touch the zone default, so every other hostname
in the zone keeps whatever behaviour the owner chose.

Owner-facing steps (**not executed — this review is prohibited from modifying
live Cloudflare settings; leave pending approval**):

1. 🖥️ Open the Cloudflare dashboard → select the `agencyos.network` zone.
2. 🧭 Go to **Rules → Overview → Create rule → Configuration Rule**.
3. 🎯 Rule name: `Sophia — Rocket Loader off`.
4. 🔍 Under **If incoming requests match…**, choose **Custom filter expression**
   and enter: `http.host eq "sophia.agencyos.network"`.
5. ⚙️ Under **Then the settings are…**, add **Rocket Loader → Off**.
6. 🚀 **Deploy**. Confirm the rule appears as the highest-priority
   Configuration Rule; a later rule could otherwise re-enable it.

Two caveats for the owner:

- Creating a host rule on a hostname can prompt Cloudflare to add or confirm a
  proxied DNS record for it. Sophia is already proxied, so this should be a
  no-op confirmation — do not accept an offer to change the record to
  DNS-only, which would bypass the Worker entirely.
- If a Configuration Rule cannot be created (plan restriction), the fallback is
  the zone-level **Speed → Optimization → Rocket Loader = Off**. It is a wider
  change than the policy prefers, so it is the second choice, not the first.

**Verified alternative:** the page-level `data-cfasync="false"` in §3.2 already
protects the one script that matters, so no change is strictly required for
correctness. The Configuration Rule is defence in depth against future scripts
this repo does not control.

**What was deliberately not done:** no CSP relaxation. `script-src` remains
nonce-strict with no `'unsafe-inline'`, in either state, because the opt-out
attribute and the nonce are independent mechanisms (§3.2).
