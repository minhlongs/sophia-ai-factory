# ZEN-07.2 — Functional Workflow Regression Report (G5)

**Repository:** `github.com/minhlongs/sophia-ai-factory`
**Branch:** `design/sophia-zen-design-os-v1`
**Verified Code & Test HEAD:** `f9220c3a2315bb1971c452d20da392a9ecb6ad0c`
**Browser-Evidence Capture Tree:** `cd068bd39917e560f8857d490e04790fc6b0a7bf`
**Baseline (`main`):** `673ec911be317233c7e6cb961bdca9d2097e210f`

---

## 1. Protected Flows & G5 Workflow Matrix (10/10 Verified)

All checks ran against the real local Next.js 16.4.2 application (`http://localhost:3000`) with `NEXT_PUBLIC_MOCK_AI_SERVICES="true"` and isolated local SQLite/D1 state. **Zero real payments, zero external paid AI calls, and zero external publishing were executed.**

| # | Workflow / Contract | Verdict | Evidence & Exact `file:line` |
|:--|:--:|:--:|:--|
| 1 | **Better Auth Session** | **PASS** | Sign-up/sign-in via `POST /api/auth/sign-up/email` and `POST /api/auth/sign-in/email` (`zen-07-2@sophia.test`) returned HTTP 200 and established valid session cookies across all 12 `/vi/*` and `/en/*` pilot routes (`g1-route-logs.json`). Canonical session helper `getCurrentUser` in `src/seed/auth/better-auth-session.ts` untouched. |
| 2 | **Setup Wizard & BYOK** | **PASS (after P0 fix)** | **P0 Defect Discovered & Fixed:** `/api/user/byok` previously inherited the 10 req/min `auth` rate-limit bucket shared with `/api/auth/*`, causing the Setup Wizard's initial status + verification requests to fail with **HTTP 429 Too Many Requests**. Remediated by declaring a dedicated D1-backed global bucket — `byok: { maxRequests: 40, windowSeconds: 60 }` at `src/seed/security/sql-rate-limiter-queries.ts:32` — and routing `/api/user/byok`, `/api/setup-wizard`, and `/api/setup/verify` to it at `src/middleware/api-handler.ts:71-80` (enforced across all Cloudflare Worker isolates via D1 `rate_limit_entries`, paired with per-isolate in-memory `TokenBucketStore` action/user/IP caps in `globalRateLimiter.checkLimit` and isolated `probeProviderApiKey` probing without shared circuit-breaker poisoning). The bucket is deliberately neither `auth` nor `admin`, so onboarding traffic cannot exhaust the login budget and stays bounded against IP-level provider probing. Verified by 17 unit tests across `src/middleware/__tests__/api-handler-rate-limit-buckets.test.ts` (6), `src/app/api/user/byok/__tests__/byok-rate-limit-security.test.ts` (6), and `src/app/api/setup/verify/__tests__/verify-rate-limit-security.test.ts` (5), plus a live Playwright BYOK flow (`GET /api/user/byok` → 200, `POST /api/user/byok` → 200). |
| 3 | **Credential Verification Feedback** | **PASS** | In `/vi/setup` (`src/app/[locale]/setup/page.tsx`), saving a deterministic test key updates the provider pill and step readiness indicator without console errors or rate-limit drops (`targeted/t04-setup-wizard-step-state-vi.png`). |
| 4 | **Dashboard Navigation (Desktop & Mobile)** | **PASS** | Desktop docked sidebar (`1440w`) and mobile responsive drawer (`375w`, `targeted/t01-mobile-nav-drawer-vi-dark-375w.png`) navigate cleanly between `/vi/dashboard`, `/vi/dashboard/niche-studio`, and `/vi/setup` while preserving active route styling and selected theme (`g2-audit.json`). |
| 5 | **AI Video Studio Controls (`Niche Studio`)** | **PASS (after P1 fix)** | Verified `SophiaArtifactCanvas` (`src/components/niche-studio/sophia-artifact-canvas.tsx:66-171` + `sophia-artifact-canvas-inspector.tsx:27-155`): 3 aspect-ratio artboards (`9:16`, `16:9`, `1:1`), live OKLCH contrast badge (`data-testid="baoyu-oklch-badge"`), accent color selector buttons, Archivo width range slider (`100`–`112%`), compliance pill checkbox toggle, and pin-comment resolve/reopen actions. Restored `aria-label` on `commissionTerms` and `maxRenderCostCents` inputs in `src/components/niche-studio/niche-form-product-inputs.tsx:102,118`, and upgraded `StoryboardPreviewCard`, `NicheCampaignForm`, and `NicheGate1ChannelInlineForm` to dual-theme AA tokens. |
| 6 | **Loading / Empty / Error States** | **PASS** | Verified `VideoCompliancePreviewPlayer` empty and post-dispatch states (`src/components/niche-studio/video-compliance-preview-player.tsx:28-38,94-103`) and `NicheGate1ReadinessCard` warning/pending states (`src/components/niche-studio/niche-gate1-readiness-card.tsx:78-175`) in both Dark and Light themes. |
| 7 | **Approval & Review Actions** | **PASS** | Pin comment resolve/reopen state machine (`toggleCommentResolved` in `src/components/niche-studio/sophia-artifact-canvas.tsx:58-64`) toggles `resolved` state, line-through styling, and button label (`baoyuCanvas.resolveBtn` ↔ `baoyuCanvas.reopenBtn`). |
| 8 | **Bilingual i18n (`vi` & `en`)** | **PASS** | `npm run i18n:validate` passed with **0 missing translation keys** across `messages/vi.json` and `messages/en.json`. Long Vietnamese diacritics verified at 375px, 768px, and 1440px (`targeted/t02-niche-studio-long-vi-text-dark-1440w.png`, `targeted/t03-niche-studio-long-vi-text-light-1440w.png`). |
| 9 | **Responsive Interactive Controls** | **PASS** | All interactive controls remain operable without horizontal overflow at 320px, 375px, 768px, and 1440px (`g4-manual-a11y.json`; 320px `scrollWidth === clientWidth` on all three pilot routes). |
| 10 | **Modal Dialog Keyboard Contract** | **PASS** | Three real dialogs opened by genuine interaction on the running dev server — trigger click (harness `Dialog`), production button (`ByokRotationView`), `Meta+k` (`CmdKPalette`) — across `vi`/`en` × `dark`/`light`, 12 measurements. Initial focus, Tab/Shift+Tab containment, `Escape` close, focus return, non-empty accessible name/description and background inertness all measured (`dialog-a11y-report.json`, `tests/e2e/dialog-a11y/dialog-accessibility.spec.ts`). |

### 1.1 Measured baseline delta (`main` `673ec911` → this branch)

`/api/auth` 10→10 req/min (unchanged); `/api/user/byok` 10→40;
`/api/setup-wizard` 100→40 (tighter); `/api/admin` 10→50. The last one restores
intent rather than adding headroom: `admin: { maxRequests: 50 }` was already
declared in the baseline `RATE_LIMITS` object but the baseline router sent
`/api/admin` into the `auth` branch, so scope and config disagreed. Every touched
route is now at or below its baseline exposure except `byok` (40/min), which
remains bounded by the route-level caps documented in
[`ZEN-07.2-OWNER-SIGNOFF.md`](./ZEN-07.2-OWNER-SIGNOFF.md) §4.

---

## 2. Automated Quality Gates & Test Suite Results

| Gate Command | Result | Details |
|:--|:--:|:--|
| `npm run type-check` | **PASS (0 errors)** | Full TypeScript compilation across `src/` and Next.js App Router types. Measured after the `inert` type correction in `mobile-nav-drawer.tsx:44` (`boolean \| undefined`, not `''`); before that fix the gate reported one TS2322. |
| `npm run lint` | **PASS (0 errors, 244 warnings)** | ESLint measured on the closing tree: `✖ 244 problems (0 errors, 244 warnings)`, exit code 0. All 244 are pre-existing `sonarjs/cognitive-complexity` and related warnings outside the design-system surface, well inside the `ci:lint` `--max-warnings=525` budget. |
| `bash scripts/check-layer-boundaries.sh` | **PASS (0 violations)** | 4-layer architecture (`seed → tree → forest → land`) intact. |
| `npm run i18n:validate` | **PASS (0 missing keys)** | 5,702 `t()` calls, 0 missing static keys, 0 empty static values across `messages/vi.json` and `messages/en.json` (+ 12-locale parity). |
| `npm run check:color-tokens` | **PASS (exit 0)** | `hardcoded color literals: 1045 (baseline 1080)` — `-35` net, `✔ no new hardcoded colors`. Eight files improved and none regressed: `invite-affiliate-modal-view` 1→0, `appearance-section` 3→0, `dashboard-shell` 3→0, `dashboard-topbar-actions` 2→0, `byok-doctrine-banner` 15→9, `steps/index` 3→0, `welcome-step` 22→16, `wizard-stepper` 11→0. |
| `npm run build` | **PASS (exit 0)** | Next.js 16.4.2 production build completed across 636 routes. The build-time route table lists `/[locale]/zen-a11y-harness` as dynamic (`ƒ`); its production protection is therefore the runtime `notFound()` in `page.tsx:23`, not build-time exclusion (see ZEN-07.2-WCAG-AND-MOTION-EVIDENCE.md §2.1.2). |
| `npm test` | **PASS (2100 files / 19,707 tests)** | Full Vitest suite on the closing tree (`f9220c3a2`): 2100 test files passed, 1 skipped (2101 total); 19,707 tests passed, 34 skipped, 10 todo (19,751 total); exit code 0. Includes unit suites locking 12-locale `RootLayout` + `(app)/layout.tsx` `lang`/`dir` resolution, `mergeIntlResponseHeaders` preserving `x-csp-nonce` & `x-tenant-*` inside `x-middleware-override-headers` (`src/middleware/__tests__/pipeline-header-forwarding.test.ts`), 12-locale middleware prefix stripping + early-redirect security headers + localized `(app)`-only dashboard route rewrites (`src/middleware/__tests__/redirect.test.ts`), `/api/setup/verify` auth + BYOK rate limits + circuit-breaker isolation (`src/app/api/setup/verify/__tests__/verify-rate-limit-security.test.ts`), live 3-mode `'light' \| 'dark' \| 'system'` selector in `SettingsPage` + `localStorage['sophia-zen-theme']` preservation in `AppearanceSection`, dual-theme WCAG AA contrast across shared `seed/components/ui/button.tsx` + `TimelineBrowserPreview` + `Niche Studio` states, SSR-safe `renderToString` + `hydrateRoot` + mid-animation `matchMedia` `'change'` cancellation across all 4 Zen motion primitives (`FadeInView`, `ScrollReveal`, `PageTransition`, `AnimatedCounter`), and 29-role CSS ↔ DTCG semantic parity. |
