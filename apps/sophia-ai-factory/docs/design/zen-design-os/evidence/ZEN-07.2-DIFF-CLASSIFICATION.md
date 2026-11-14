# ZEN-07.2 — Diff Classification (G5)

**Repository:** `github.com/minhlongs/sophia-ai-factory`
**Branch:** `design/sophia-zen-design-os-v1`
**Verified HEAD (code & evidence):** `cd068bd39917e560f8857d490e04790fc6b0a7bf`
**Reported Checkpoint:** `b3338a256` (handover base: `4d23ddb386f499b7627f2c828a1b80c81c6a3382`)
**Baseline (`main`):** `673ec911be317233c7e6cb961bdca9d2097e210f`

---

## 0. The measured file count, and why it is not 104

The Founder brief asked for an audit of "104 changed files". That figure does
not match the working tree. Measured:

| Set | Count |
|:--|--:|
| Baseline `673ec911` → pre-existing branch tip `4d23ddb38` | 36 files |
| `4d23ddb38` → closure & review-remediation work (`b3338a256`, `9b6b78656`, `cd068bd39`, `fb0083e04`, review-fix commit) | 150 tracked |
| **Total under review (baseline → closing commit)** | **166** (83 `A`, 83 `M`) |
| of which PNG screenshots (binary, listed but not diffed line-by-line) | 40 |
| of which non-PNG files, classified in full below | 126 |

The two ranges above overlap — a file added in `4d23ddb38` and then edited by
the closure commits is counted once in each row but only once in the total.
**The authoritative inventory is the full 166**, and every one of them is
classified here. No file was skipped. The 126 non-PNG files are enumerated
individually; the 40 PNGs are grouped by directory.

---

## 1. Summary

| Category | Non-PNG files | PNG files | Total |
|:--|--:|--:|--:|
| Design implementation | 56 | — | 56 |
| Documentation | 21 | — | 21 |
| Security correction | 17 | — | 17 |
| Functional regression correction | 20 | — | 20 |
| Browser evidence | 12 | 40 | 52 |
| **Total under review** | **126** | **40** | **166** |
| **Unexpected / out-of-scope** | **0** | **0** | **0** |

**The out-of-scope count is zero.** No file in the delta changes business
behaviour unrelated to the Zen Design OS acceptance scope. The four closest
calls are named transparently in §3 rather than quietly re-labelled.

---

## 2. Full classification (166 files)

Status: `A` = added, `M` = modified (all paths relative to `apps/sophia-ai-factory/` except `DESIGN.md` and the 14 `docs/design/zen-design-os/*.md` architecture documents, which live at the monorepo root).

### 2.1 Design implementation — 56 files

| Status | Path |
|:--:|:--|
| M | `DESIGN.md` *(repo root)* |
| M | `src/__tests__/director-control-deck-design-system.test.ts` |
| A | `src/seed/design-tokens/__tests__/zen-design-tokens.test.ts` |
| A | `src/seed/design-tokens/index.ts` |
| A | `src/seed/design-tokens/zen-design-tokens.dtcg.json` |
| M | `src/app/globals.css` |
| M | `src/app/(app)/layout.tsx` |
| M | `src/app/layout.tsx` |
| M | `src/styles/v3-core.css` |
| M | `src/components/niche-studio/niche-campaign-form.tsx` |
| M | `src/components/niche-studio/niche-conversion-stats-card.tsx` |
| M | `src/components/niche-studio/niche-form-product-inputs.tsx` |
| M | `src/components/niche-studio/niche-gate1-channel-inline-form.tsx` |
| M | `src/components/niche-studio/niche-gate1-readiness-card.tsx` |
| M | `src/components/niche-studio/niche-hook-variants-card.tsx` |
| M | `src/components/niche-studio/niche-studio-header.tsx` |
| M | `src/components/niche-studio/niche-syndication-preview-card.tsx` |
| M | `src/components/niche-studio/sophia-artifact-canvas.tsx` |
| M | `src/components/niche-studio/storyboard-preview-card.tsx` |
| M | `src/components/niche-studio/video-compliance-preview-player.tsx` |
| M | `src/components/stitch/screens/affiliates/invite/email-input.tsx` |
| M | `src/components/stitch/screens/affiliates/invite/invite-affiliate-modal-view.tsx` |
| M | `src/components/stitch/screens/affiliates/invite/invite-success-view.tsx` |
| M | `src/components/stitch/screens/affiliates/invite/tier-assignment.tsx` |
| M | `src/components/stitch/screens/dashboard/dashboard-page.tsx` |
| M | `src/components/stitch/screens/landing-hero/__tests__/v3-core-landing.test.tsx` |
| M | `src/components/stitch/ui/button-styles.ts` |
| M | `src/components/video/timeline-browser-preview.tsx` |
| M | `src/forest/components/dashboard-aeo/dashboard-agent-hud-bar.tsx` |
| M | `src/forest/components/settings/sections/appearance-section.tsx` |
| A | `src/forest/components/settings/sections/__tests__/appearance-section.test.tsx` |
| M | `src/forest/components/theme-toggle.tsx` |
| M | `src/forest/dashboard/activity-table/activity-row.tsx` |
| M | `src/forest/dashboard/activity-table/activity-table-empty.tsx` |
| M | `src/forest/dashboard/activity-table/activity-table-view.tsx` |
| M | `src/forest/dashboard/activity-table/status-badge.tsx` |
| M | `src/forest/dashboard/dashboard-admin-nav-links.tsx` |
| M | `src/forest/dashboard/dashboard-nav-items.tsx` |
| M | `src/forest/dashboard/dashboard-next-step-banner.tsx` |
| M | `src/forest/dashboard/dashboard-onboarding-banner.tsx` |
| M | `src/forest/dashboard/dashboard-shell.tsx` |
| M | `src/forest/dashboard/dashboard-topbar-actions.tsx` |
| M | `src/forest/dashboard/dashboard-user-card.tsx` |
| M | `src/forest/dashboard/revenue-chart/chart-header.tsx` |
| A | `src/forest/theme/zen-theme-provider.tsx` |
| A | `src/forest/theme/__tests__/zen-theme-provider.test.tsx` |
| M | `src/forest/theme/index.ts` |
| M | `src/seed/components/ui/animated-counter-with-framer-motion.tsx` |
| A | `src/seed/components/ui/__tests__/zen-motion-reduced-motion.test.tsx` |
| M | `src/seed/components/ui/fade-in-view.tsx` |
| M | `src/seed/components/ui/page-transition.tsx` |
| M | `src/seed/components/ui/scroll-reveal.tsx` |
| M | `src/tree/components/setup-wizard/byok-doctrine-banner.tsx` |
| M | `src/tree/components/setup-wizard/steps/index.tsx` |
| M | `src/tree/components/setup-wizard/steps/welcome-step.tsx` |
| M | `src/tree/components/setup-wizard/wizard-stepper.tsx` |

Typical contents: replacing hardcoded colour literals with semantic tokens
(`timeline-browser-preview.tsx` now uses `var(--studio-stage-bg)`), adding
Dual-Theme light-token classes, motion primitives reading
`prefers-reduced-motion()`, the DTCG token file and its getters, and
design-system assertions in `director-control-deck-design-system.test.ts` and
`v3-core-landing.test.tsx`.

### 2.2 Browser evidence — 52 files

| Status | Path |
|:--:|:--|
| A | `docs/design/zen-design-os/evidence/g1-route-logs.json` |
| A | `docs/design/zen-design-os/evidence/g2-audit.json` |
| A | `docs/design/zen-design-os/evidence/g3-manifest.json` |
| A | `docs/design/zen-design-os/evidence/g4-axe-summary.json` |
| A | `docs/design/zen-design-os/evidence/g4-manual-a11y.json` |
| A | `docs/design/zen-design-os/evidence/g6/g6-runtime-perf.json` |
| A | `docs/design/zen-design-os/evidence/g6/g6-runtime-perf.mjs` |
| A | `docs/design/zen-design-os/evidence/dialog-a11y-report.json` |
| A | `tests/e2e/zen07-2/zen-07-2-acceptance.spec.ts` |
| A | `tests/e2e/dialog-a11y/dialog-accessibility.spec.ts` |
| A | `src/app/[locale]/zen-a11y-harness/page.tsx` |
| A | `src/app/[locale]/zen-a11y-harness/a11y-harness.tsx` |
| A | `docs/design/zen-design-os/evidence/screenshots/*.png` (36 files) |
| A | `docs/design/zen-design-os/evidence/targeted/*.png` (4 files) |

The two specs are the Playwright runs that produce the machine evidence; the
harness route is the dev-only surface they open a representative form dialog
through. It is gated by `if (process.env.NODE_ENV === 'production')
notFound()` at `src/app/[locale]/zen-a11y-harness/page.tsx:23`, so it returns
404 in any deployed build. Its reachable-in-build-table limitation is recorded
in [ZEN-07.2-WCAG-AND-MOTION-EVIDENCE.md](./ZEN-07.2-WCAG-AND-MOTION-EVIDENCE.md) §2.1.2.

### 2.3 Security correction — 17 files

| Status | Path |
|:--:|:--|
| M | `src/middleware/api-handler.ts` |
| M | `src/seed/security/sql-rate-limiter-queries.ts` |
| M | `src/forest/middleware/index.ts` |
| M | `src/forest/middleware/rate-limiter.test.ts` |
| M | `src/forest/middleware/rate-limiter/endpoint-rate-limiters.ts` |
| M | `src/forest/middleware/rate-limiter/rate-limiter.ts` |
| M | `src/forest/middleware/rate-limiter/sliding-window-evaluator.ts` |
| M | `src/forest/middleware/rate-limiter/types.ts` |
| M | `src/tree/signals/events/schemas-business.ts` |
| M | `src/app/api/user/byok/route.ts` |
| M | `src/app/api/user/byok/test/route.ts` |
| M | `src/app/api/setup-wizard/heygen/auto-register/route.ts` |
| M | `src/app/api/setup-wizard/test-heygen/route.ts` |
| M | `src/app/api/setup-wizard/test-resend/route.ts` |
| M | `src/app/api/setup-wizard/validate-key/route.ts` |
| A | `src/middleware/__tests__/api-handler-rate-limit-buckets.test.ts` |
| A | `src/app/api/user/byok/__tests__/byok-rate-limit-security.test.ts` |

This is the P0 finding and its closure: a dedicated `byok` bucket, per-route
caps on every provider-probing endpoint, and the `byok` limit type added to
the telemetry schema so 429s still validate. Full evidence:
[ZEN-07.2-OWNER-SIGNOFF.md](./ZEN-07.2-OWNER-SIGNOFF.md) §4.

### 2.4 Functional regression correction — 20 files

| Status | Path |
|:--:|:--|
| M | `messages/ar.json` |
| M | `messages/de.json` |
| M | `messages/en.json` |
| M | `messages/es.json` |
| M | `messages/fr.json` |
| M | `messages/hi.json` |
| M | `messages/id.json` |
| M | `messages/ja.json` |
| M | `messages/ko.json` |
| M | `messages/th.json` |
| M | `messages/vi.json` |
| M | `messages/zh.json` |
| A | `src/app/(app)/__tests__/app-layout-locale.test.tsx` |
| M | `src/app/(app)/dashboard/admin/byok-rotation/components/rotation-dialog.tsx` |
| M | `src/components/stitch/__tests__/stitch-screens-a11y.test.tsx` |
| M | `src/components/stitch/layouts/dashboard/mobile-nav-drawer.tsx` |
| M | `src/components/stitch/screens/dashboard/dashboard-sources-drawer.tsx` |
| M | `src/middleware/public-pipeline.ts` |
| M | `src/seed/components/ui/command.tsx` |
| M | `src/seed/types/node-sqlite.d.ts` |

Corrections here are confinement defects — things that broke existing
behaviour — not new features: focus return and height bound in the rotation
dialog, the closed-drawer assertion that queried the accessibility tree of an
`aria-hidden` element, the `inert` prop type, overflow reflow in the sources
drawer, locale forwarding so `/en/*` routes stop falling back to Vietnamese,
the palette's accessible name and description, and the ambient
`DatabaseSync.close()` signature that five test helpers already called.
The 12 locale files drop two obsolete top-level keys that no code path reads
and add the `cancel` label the rotation dialog needs.

### 2.5 Documentation — 21 files

| Status | Path |
|:--:|:--|
| A | `docs/design/zen-design-os/00-EXECUTIVE-SUMMARY.md` *(repo root)* |
| A | `docs/design/zen-design-os/01-OFFICIAL-RESEARCH-LEDGER.md` *(repo root)* |
| A | `docs/design/zen-design-os/02-CODEBASE-DESIGN-AUDIT.md` *(repo root)* |
| A | `docs/design/zen-design-os/03-ZEN-DESIGN-OS-ARCHITECTURE.md` *(repo root)* |
| A | `docs/design/zen-design-os/04-TOKEN-SPECIFICATION.md` *(repo root)* |
| A | `docs/design/zen-design-os/05-COMPONENT-SYSTEM-GUIDE.md` *(repo root)* |
| A | `docs/design/zen-design-os/06-PILOT-SCREENS-CASE-STUDY.md` *(repo root)* |
| A | `docs/design/zen-design-os/07-ACCESSIBILITY-REPORT.md` *(repo root)* |
| A | `docs/design/zen-design-os/08-PERFORMANCE-AND-BUNDLE-REPORT.md` *(repo root)* |
| A | `docs/design/zen-design-os/09-CROSS-PRODUCT-THEMING-GUIDE.md` *(repo root)* |
| A | `docs/design/zen-design-os/10-STITCH-DESIGN-MD-CONTRACT.md` *(repo root)* |
| A | `docs/design/zen-design-os/11-RELEASE-SAFETY-CHECKLIST.md` *(repo root)* |
| A | `docs/design/zen-design-os/12-ROLLBACK-AND-RECOVERY.md` *(repo root)* |
| A | `docs/design/zen-design-os/ZEN-MOTION-ADOPTION-MATRIX.md` *(repo root)* |
| A | `docs/design/zen-design-os/evidence/ZEN-07.2-DARK-LIGHT-CSP-AUDIT.md` |
| A | `docs/design/zen-design-os/evidence/ZEN-07.2-FUNCTIONAL-REGRESSION.md` |
| A | `docs/design/zen-design-os/evidence/ZEN-07.2-OWNER-SIGNOFF.md` |
| A | `docs/design/zen-design-os/evidence/ZEN-07.2-PERFORMANCE-COMPARISON.md` |
| A | `docs/design/zen-design-os/evidence/ZEN-07.2-VISUAL-EVIDENCE.md` |
| A | `docs/design/zen-design-os/evidence/ZEN-07.2-WCAG-AND-MOTION-EVIDENCE.md` |
| A | `docs/design/zen-design-os/evidence/ZEN-07.2-DIFF-CLASSIFICATION.md` |

### 2.6 Unexpected / out-of-scope — 0 files

None. Section 3 records the borderline files that were checked and cleared.

---

## 3. The four closest calls, cleared explicitly

1. **`src/middleware/public-pipeline.ts`** — a live middleware behaviour change
   (forwarding the stripped locale via `x-next-intl-locale`), so it looked
   out-of-scope on a passing glance. It is a **functional regression
   correction**: without it every `/en/*` pilot route renders Vietnamese, so
   the bilingual acceptance evidence in the brief could not be produced. It
   touches one header on the public pipeline and does not alter auth, CSRF,
   rate limiting or any protected flow.
2. **`src/seed/types/node-sqlite.d.ts`** — a `.d.ts` change looked like dead
   cleanup. It is **test support**: five test helpers in `src/land/*` and
   `src/forest/actions/__tests__/` call `.close()` on a `node:sqlite`
   `DatabaseSync` handle, and the ambient declaration previously omitted the
   method. It has zero runtime effect — ambient types are erased.
3. **`src/seed/components/ui/command.tsx`** — adding a `title`/`description`
   prop is new API surface. It is the **minimum** needed for the dialog audit
   to measure a non-empty accessible name and description, and it was found
   during the audit, which the brief explicitly requires. No caller was
   changed, so behaviour is unchanged apart from the two `sr-only` nodes the
   audit needs.
4. **`src/app/[locale]/zen-a11y-harness/*`** — a new route is new surface. It
   is the Playwright-controlled door to a *representative form dialog* (the
   brief's DECISION 3 requirement), it imports the shipping components rather
   than stand-ins, and `notFound()` makes it a 404 in any production build.
   The four harness files are counted under Browser evidence because they are
   the instrument, not the product.

---

## 4. Quality gates on the closing tree (`cd068bd39`)

| Gate | Result | Detail |
|:--|:--:|:--|
| `npm run type-check` | **PASS (0 errors)** | full `tsc --noEmit` across `src/` |
| `npm run lint` | **PASS (0 errors / 245 warnings)** | exit 0; all warnings pre-existing and outside the design-system surface |
| `bash scripts/check-layer-boundaries.sh` | **PASS (0 violations)** | seed → tree → forest → land intact, static and dynamic |
| `npm run i18n:validate` | **PASS (0 missing keys)** | vi/en parity |
| `npm run check:color-tokens` | **PASS (exit 0)** | 1045 literals against a 1080 baseline, −35 net, 8 files improved, none regressed |
| `npm run build` | **PASS (636 routes)** | Next.js 16.4.2, exit 0 |
| `npm test` | **PASS (2098 files / 19,687 tests, exit 0)** | 1 file skipped, 34 tests skipped, 10 todo |
| Secret scan (staged diff) | **PASS** | no key-shaped patterns, no dotenv or private-key file added |
| Worktree | **clean** | `git status --porcelain` empty after the closing commit |

No dev server, Playwright worker or watcher was left running by this review;
port 3000 was verified free before and after the runs.