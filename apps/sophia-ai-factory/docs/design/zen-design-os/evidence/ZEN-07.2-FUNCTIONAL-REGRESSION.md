# ZEN-07.2 — Functional Workflow Regression Report (G5)

**Repository:** `github.com/minhlongs/sophia-ai-factory`
**Branch:** `design/sophia-zen-design-os-v1`
**Verified HEAD:** `4d23ddb386f499b7627f2c828a1b80c81c6a3382` + P0/P1 remediations
**Baseline (`main`):** `673ec911be317233c7e6cb961bdca9d2097e210f`

---

## 1. Protected Flows & G5 Workflow Matrix (9/9 Verified)

All checks ran against the real local Next.js 16.4.2 application (`http://localhost:3000`) with `NEXT_PUBLIC_MOCK_AI_SERVICES="true"` and isolated local SQLite/D1 state. **Zero real payments, zero external paid AI calls, and zero external publishing were executed.**

| # | Workflow / Contract | Verdict | Evidence & Exact `file:line` |
|:--|:--:|:--:|:--|
| 1 | **Better Auth Session** | **PASS** | Sign-up/sign-in via `POST /api/auth/sign-up/email` and `POST /api/auth/sign-in/email` (`zen-07-2@sophia.test`) returned HTTP 200 and established valid session cookies across all 12 `/vi/*` and `/en/*` pilot routes (`g1-route-logs.json`). Canonical session helper `getCurrentUser` in `src/seed/auth/better-auth-session.ts` untouched. |
| 2 | **Setup Wizard & BYOK** | **PASS (after P0 fix)** | **P0 Defect Discovered & Fixed:** `src/middleware/api-handler.ts:71` previously routed `/api/user/byok` into the 10 req/min `auth` rate-limit bucket shared with `/api/auth/*`, causing the Setup Wizard's initial status + verification requests to fail with **HTTP 429 Too Many Requests**. Remediated at `src/middleware/api-handler.ts:71` by routing `/api/user/byok` alongside `/api/admin` to `RATE_LIMITS.admin` (50 req/min). Verified by 5 unit tests in `src/middleware/__tests__/api-handler-rate-limit-buckets.test.ts` and live Playwright BYOK flow (`GET /api/user/byok` → 200, `POST /api/user/byok` → 200). |
| 3 | **Credential Verification Feedback** | **PASS** | In `/vi/setup` (`src/app/[locale]/setup/page.tsx`), saving a deterministic test key updates the provider pill and step readiness indicator without console errors or rate-limit drops (`targeted/t04-setup-wizard-step-state-vi.png`). |
| 4 | **Dashboard Navigation (Desktop & Mobile)** | **PASS** | Desktop docked sidebar (`1440w`) and mobile responsive drawer (`375w`, `targeted/t01-mobile-nav-drawer-vi-dark-375w.png`) navigate cleanly between `/vi/dashboard`, `/vi/dashboard/niche-studio`, and `/vi/setup` while preserving active route styling and selected theme (`g2-audit.json`). |
| 5 | **AI Video Studio Controls (`Niche Studio`)** | **PASS (after P1 fix)** | Verified `SophiaArtifactCanvas` (`src/components/niche-studio/sophia-artifact-canvas.tsx:66-274`): 3 aspect-ratio artboards (`9:16`, `16:9`, `1:1`), live OKLCH contrast badge (`data-testid="baoyu-oklch-badge"`), accent color selector buttons, Archivo width range slider (`100`–`112%`), compliance pill checkbox toggle, and pin-comment resolve/reopen actions. Restored `aria-label` on product URL and social proof inputs in `src/components/niche-studio/niche-form-product-inputs.tsx:102,118`. |
| 6 | **Loading / Empty / Error States** | **PASS** | Verified `VideoCompliancePreviewPlayer` empty state (`src/components/niche-studio/video-compliance-preview-player.tsx:55-68`) and `NicheGate1ReadinessCard` warning/pending states (`src/components/niche-studio/niche-gate1-readiness-card.tsx:20-56`) in both Dark and Light themes. |
| 7 | **Approval & Review Actions** | **PASS** | Pin comment resolve/reopen state machine (`toggleCommentResolved` in `src/components/niche-studio/sophia-artifact-canvas.tsx:57-63`) toggles `resolved` state, line-through styling, and button label (`baoyuCanvas.resolveBtn` ↔ `baoyuCanvas.reopenBtn`). |
| 8 | **Bilingual i18n (`vi` & `en`)** | **PASS** | `npm run i18n:validate` passed with **0 missing translation keys** across `messages/vi.json` and `messages/en.json`. Long Vietnamese diacritics verified at 375px, 768px, and 1440px (`targeted/t02-niche-studio-long-vi-text-dark-1440w.png`, `targeted/t03-niche-studio-long-vi-text-light-1440w.png`). |
| 9 | **Responsive Interactive Controls** | **PASS** | All interactive controls remain operable without horizontal overflow at 320px, 375px, 768px, and 1440px (`g4-manual-a11y.json`). |

---

## 2. Automated Quality Gates & Test Suite Results

| Gate Command | Result | Details |
|:--|:--:|:--|
| `npm run type-check` | **PASS (0 errors)** | Full TypeScript compilation across `src/` and Next.js App Router types. |
| `npm run lint` | **PASS (0 errors)** | ESLint clean across all modified and baseline files. |
| `bash scripts/check-layer-boundaries.sh` | **PASS (0 violations)** | 4-layer architecture (`seed → tree → forest → land`) intact. |
| `npm run i18n:validate` | **PASS (0 missing keys)** | Complete parity between `messages/vi.json` and `messages/en.json`. |
| `npm run check:color-tokens` | **PASS (exit 0)** | `1046` hardcoded hex occurrences vs `1080` baseline (`-34` net improvement; 0 files above baseline after remediating `sophia-artifact-canvas.tsx`). |
| `npx vitest related ... --run` | **PASS (39 files / 294 tests)** | 100% green across all design-system, CSP, motion, dashboard, setup-wizard, niche-studio, and BYOK rate-limit test suites. |
