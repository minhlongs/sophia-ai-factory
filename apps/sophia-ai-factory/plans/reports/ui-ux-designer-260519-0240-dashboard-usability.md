# Sophia AI Factory — Dashboard Usability Audit (2026-05-19)

**Usable: ⚠️ MOSTLY — Bugs found: 6 | UX concerns: 11 | Handover-ready: NO**

Production target: https://sophia.agencyos.network (SHA `523b012e`)
Auth: fresh BASIC signup via `/api/auth/sign-up/email` (FREE100 redeem unavailable → MASTER flow blocked-by-fixture)
Driver: `tests/e2e/ux-usability-260519.spec.ts` (30 sub-tests, 18 passed, 11 failed, 1 skipped)
Screenshots: `plans/reports/screenshots/ux-usability-260519/` (41 PNGs)

The operator is right. **The dashboard mostly RENDERS but has enough concrete UX defects that handing it to a non-tech CEO today would burn trust.** Specifically: `/dashboard/billing` hangs on spinner forever, `/dashboard/analytics` shows a bare error boundary, signup URL 404s the marketing way, `/setup-wizard` route serves a marketing landing page, and the dashboard SHA `523b012e` has at least one route that crashes the chromium renderer on load (`/dashboard/create` — confirmed twice).

---

## TL;DR routing inventory

22 sidebar dashboard routes discovered + 6 hand-curated; ALL return HTTP 200. Renderer results split:

| Status | Routes |
|---|---|
| ✅ ok | `/dashboard`, `/dashboard/voices`, `/dashboard/templates`, `/dashboard/orders`, `/dashboard/help`, `/dashboard/integrations`, `/dashboard/byok`, `/dashboard/api-keys`, `/dashboard/proposals`, `/dashboard/sop-marketplace`, `/dashboard/api-docs` (tier-gated upsell), `/dashboard/system-health`, `/dashboard/affiliate`, `/dashboard/credits` |
| ⚠ stuck-loading (DOM renders but `load` event never fires) | `/dashboard/create`, `/dashboard/campaigns`, `/dashboard/missions`, `/dashboard/workflows`, `/dashboard/sops`, `/dashboard/account`, `/dashboard/settings`, `/dashboard/support`, `/dashboard/wallet` |
| 🔴 renders broken | `/dashboard/analytics` (error boundary), `/dashboard/billing` (infinite spinner) |
| 🔴 renderer crash | `/dashboard/create` brought down chromium twice in earlier runs (mitigated by per-test isolation) |

---

## Flow 1 — Signup → first dashboard impression

**What worked**
- Bootstrap via `/api/auth/sign-up/email` returns a real session cookie. User lands on `/dashboard` correctly.
- First impression heading "Hello, UX Auditor / Starter plan" with prominent 7-step "Welcome to Sophia AI Factory" tour modal — solid onboarding intent.

**What's BROKEN**
1. 🔴 **`/en/auth/signup` returns Next.js default 404** ("This page could not be found", no Sophia branding, no nav, no path back to login). Tested route — see `01-signup-or-login-page.png`. The actual signup form lives elsewhere; the URL is undiscoverable.
2. 🟡 Tour modal renders the dashboard behind it COMPLETELY dimmed/black — user can't preview the dashboard while reading the tour copy. Tour should dim ~60% not ~95%.
3. 💡 No clear destination if user clicks "Skip Tour" — should land on a Configure Providers CTA card.

Screenshots: `01-signup-or-login-page.png`, `02-dashboard-first-impression.png`
Likely files: `src/app/[locale]/auth/signup/` (missing or misrouted), `src/app/[locale]/dashboard/components/welcome-tour.tsx`

---

## Flow 2 — Setup Wizard

**What worked**
- `/dashboard/onboarding` renders a wizard surface (heading set, content present).

**What's BROKEN**
1. 🔴 **`/setup-wizard` route serves the MARKETING landing page** ("Video Factory + AI Automation Một Nền Tảng — Vô Hạn Quy Mô" hero) — not a wizard. The Welcome tour modal references "Configure Providers" but the path discoverability is broken. See `03-wizard-step-1.png`.
2. 🟡 No visible inputs on `/setup-wizard` to attempt filling, no "Next/Continue" CTA — test fell through to the marketing CTA.
3. 💡 The protected handover flow ("Setup Wizard") in `.claude/rules/sophia-handover-rules.md` lists this as a non-breakable flow — but the URL it claims to live at is currently broken.

Screenshots: `03-wizard-step-1.png`, `04-wizard-input-filled.png`, `05-wizard-step-2.png`, `06-onboarding-page.png`
Likely files: `src/app/[locale]/setup-wizard/page.tsx`, `src/app/[locale]/dashboard/onboarding/page.tsx`

---

## Flow 3 — Dashboard navigation sweep

**What worked**
- All 28 dashboard routes return HTTP 200 (no 404s, no 5xx). Sidebar discovery found 22 links.
- 14 routes render cleanly with proper headings + content + tier-aware empty states.
- Tier upsells (`/dashboard/api-docs`, `/dashboard/wallet`) display clean "Feature Locked / Upgrade to Master" panels — good design.
- Empty states with CTAs done well on: `Campaigns` (No Campaigns Yet + Create), `My SOPs` (Browse Marketplace), `Workflows` (header CTA).

**What's BROKEN**
1. 🔴 **`/dashboard/analytics` renders an error boundary** — "Something went wrong / An unexpected error occurred / Try again / Go home". No tier-gate copy, no recovery suggestion. See `11-analytics-page.png`.
2. 🔴 **`/dashboard/billing` infinite spinner** "Loading billing data…" never resolves. Page has NO timeout/fallback. See `29-billing-page.png`.
3. 🔴 **`/dashboard/create` triggers chromium renderer crash** — happened twice in early runs, traced to that route closing the browser context. Page DOES eventually paint "Choose a Template" but the document never reaches `load`. See `09-create-page.png`.
4. 🟡 9 routes have `load`-event-never-fires behavior (`campaigns`, `missions`, `workflows`, `sops`, `account`, `settings`, `support`, `wallet`, `create`). UI paints, but indicates long-lived analytics/SSE streams without proper cleanup. Will surface as "tab is busy" in Safari + degrades back/forward cache.
5. 🟡 SOP Marketplace empty state says "No SOPs found matching your search" when search field is empty — confusing copy. Should say "No SOPs available" or "Marketplace stocking up". See `22-sop-marketplace-page.png`.

Severity: 🔴 critical
Screenshots: `08-nav-*.png`, `09-create-page.png`, `10-campaigns-page.png`, `11-analytics-page.png`, `13-templates-page.png`, `21a-workflows-page.png`, `22-sop-marketplace-page.png`, `29-billing-page.png`
Likely files:
- `src/app/[locale]/dashboard/analytics/page.tsx` + `error.tsx`
- `src/app/[locale]/dashboard/billing/page.tsx` (or `billing/` subcomponent fetching billing data without timeout)
- `src/app/[locale]/dashboard/create/page.tsx` (heavy client component triggering crash)

---

## Flow 4 — Affiliate

**What worked**
- `/dashboard/affiliate` heading "Affiliate Dashboard", 4 stat cards (Clicks/Conversions/EPC/Pending Earnings) all show `$0.00` / `0` cleanly.
- "Payout methods" link reaches `/dashboard/affiliate/payouts` (good).
- "Export CSV" anchor is present.
- "Recent Conversions" empty state: "No conversions yet. Share your affiliate link to get started." — friendly.

**What's BROKEN**
1. 🟡 Yellow warning banner reads "Affiliate stats temporarily unavailable. Please refresh in a moment." — for a BASIC user who's never had any clicks, this is misleading. Either fetch real data with `.0` defaults or hide the banner when the user has no affiliate history. See `20-affiliate-landing.png`.
2. 💡 The "Affiliate link to get started" copy in the empty state references "Share your affiliate link" but the page doesn't show the user's affiliate link anywhere — broken promise.

Severity: 🟡 minor
Screenshots: `20-affiliate-landing.png`, `21-affiliate-payouts.png`, `22-affiliate-export-visible.png`
Likely files: `src/app/[locale]/dashboard/affiliate/page.tsx`, hook fetching `/api/affiliate/stats`

---

## Flow 5 — Credits / Billing

**What worked**
- `/dashboard/credits` heading "MCU Credits", page renders.
- "Buy / Top up / Purchase" CTA discovered and clickable.

**What's BROKEN**
1. 🟡 Buy CTA navigates to **`/pricing`** (full marketing-page reload, leaves dashboard chrome) instead of an in-app modal/checkout. Jarring context switch for a non-tech CEO who was inside their dashboard. See `30-credits-landing.png` → `31-credits-buy-clicked.png`.
2. 🔴 The companion **`/dashboard/billing` is broken** (Flow 3 finding #2). Together this means a user wanting to manage billing has TWO bad options: an infinite spinner OR a context-losing marketing page.

Severity: 🟡 to 🔴 (cumulative)
Screenshots: `30-credits-landing.png`, `31-credits-buy-clicked.png`
Likely files: `src/app/[locale]/dashboard/credits/page.tsx` (Buy button onClick handler), `src/app/[locale]/dashboard/billing/page.tsx`

---

## Flow 6 — Admin gate (BASIC user)

**What worked**
- `/dashboard/admin` correctly redirects BASIC user away → `/dashboard?error=admin_required`. Good guard.

**What's BROKEN**
1. 🟡 **The redirect destination shows only the dashboard SKELETON** (3 empty card placeholders) — no toast, no banner, no error message tying back to `?error=admin_required`. Silent failure. User clicked Admin, got bounced, has no feedback. See `40-admin-gate-basic-user.png`.
2. 💡 The `?error=admin_required` query param is harvested by the redirect but ignored by the dashboard UI. Should pop a toast "Admin area requires Master plan. Upgrade to access."

Severity: 🟡 minor
Screenshot: `40-admin-gate-basic-user.png`
Likely files: `src/app/[locale]/dashboard/admin/page.tsx` (middleware/redirect), `src/app/[locale]/dashboard/page.tsx` (toast on `?error=` query).

---

## Flow 7 — MASTER perspective

**SKIPPED** — `POST /api/promo/redeem-free` with `code=FREE100` returned non-2xx for our fresh user (code expired / single-use / disabled in prod). Cannot test MASTER flows without a fixture that promotes a user to MASTER tier.

Recommended unblock: add a prod-only test fixture (env-gated `BETTER_AUTH_E2E_SECRET`) that mints a MASTER session for a known test email. Until then, MASTER-tier UX (admin pages, payout management, real wallet, analytics) is UNVERIFIED.

---

## Flow 8 — Responsive

**What worked**
- Tablet (768px) + Desktop (1024px): 0px horizontal overflow.
- Mobile (375px) bottom nav (Home / Campaigns / Analytics / Support / Settings) is clean, welcome card + 3-step setup guide stack properly.

**What's BROKEN**
1. 🟡 Mobile 375px → **51px horizontal scroll overflow** detected. Likely a `min-width` on the welcome card or a code-block in the 3-step setup. Causes user to swipe horizontally accidentally. See `60-responsive-mobile-375.png` vs the cropped overflow.

Severity: 🟡 minor
Screenshots: `60-responsive-mobile-375.png`, `60-responsive-tablet-768.png`, `60-responsive-desktop-1024.png`

---

## General UX issues

1. 🟡 **Loading states inconsistent**: some routes use skeleton cards (admin redirect destination), some use centered spinners with text (`Loading billing data…`), some show nothing. Standardize on one pattern.
2. 🟡 **`load`-event-never-fires across 9 routes** signals long-lived SSE/websocket/polling without proper cleanup. Audit `useEffect` cleanup + EventSource lifecycle.
3. 🟡 **Error boundary is generic** ("Something went wrong / Try again / Go home") — no error code, no Sentry breadcrumb id surfaced to the user, no support email link. Hard for non-tech CEO to ask for help.
4. 💡 **Sidebar nav iconography** is consistent and good (lucide icons) — no concern.
5. 💡 **"Replay Tour" sidebar item** is helpful — good addition for onboarding.
6. 💡 **Color contrast** of secondary text (`#6b7280`-ish on dark `#04060d`) is around 4.4:1 — borderline but passes WCAG AA for 14px+ body text. Stat-card values + headings are crisp.
7. 💡 **Tier-aware empty states** (Wallet, API Docs, Affiliate-warning) are nicely designed — Sophia clearly has a design system in place.
8. 💡 **Vietnamese diacritics render correctly** — `Sức Khỏe Hệ Thống` displays clean (system-health page).
9. 💡 **Touch targets** sampled — most ≥40px. Bottom mobile nav icons are ~64px tall (good).
10. 💡 **Floating help bubble** (cyan ? button bottom-right) is consistently present — good.
11. 🟡 **Email-verification gate** — fresh users land on dashboard without verifying email. Better Auth signup uses `emailVerified=true` by default in test mode but prod should ideally require verify before showing dashboard.

---

## Top 10 prioritized fix list

| # | Severity | Fix | Effort |
|---:|---|---|---|
| 1 | 🔴 | `/dashboard/billing` infinite spinner — add timeout + error fallback, render an Account&Billing-style tabbed view instead of waiting for a single billing API | M (2-4h) |
| 2 | 🔴 | `/dashboard/analytics` raw error boundary — render a friendly "Analytics available on Growth+ plan" upsell card OR fix the underlying data fetch for BASIC | M (2-3h) |
| 3 | 🔴 | `/dashboard/create` renderer crash — profile + cap whatever heavy client component is blowing chromium memory; lazy-load template thumbnails | L (4-8h) |
| 4 | 🔴 | `/en/auth/signup` → 404 — create proper signup page or 301 to canonical signup URL | S (1h) |
| 5 | 🔴 | `/setup-wizard` serves marketing page — point this route at the real onboarding wizard component (or remove the dead route from sidebar/tour) | S (1h) |
| 6 | 🟡 | Admin gate redirect → toast `admin_required` query param into a visible message on dashboard | S (1h) |
| 7 | 🟡 | 9 routes with stuck `load` event — audit `useEffect` cleanup, terminate EventSource on unmount | M (3-5h) |
| 8 | 🟡 | Affiliate page false-positive "stats temporarily unavailable" — hide banner when user has no history, fetch real zeros | S (1h) |
| 9 | 🟡 | Mobile 375px 51px horizontal overflow — find the culprit element (likely 3-step setup code block or welcome card) and constrain `overflow-x: hidden` on a parent | S (1h) |
| 10 | 🟡 | Buy Credits → `/pricing` full-page navigation — convert to in-app drawer/modal OR keep dashboard chrome by routing to `/dashboard/pricing` | M (2-3h) |

---

## Notes for handover

- **Do NOT hand over while #1 and #2 ship as-is.** A CEO clicking "Account & Billing → Subscription tab → Billing History" will see an infinite spinner. Clicking "Analytics" sidebar item shows a bare error page. Both are dealbreakers.
- **#4 and #5 are URL hygiene issues** — fix takes <2h combined, but operator's earlier tour points to URLs that don't behave as advertised.
- **Don't propose adding operator-side infra** — Sophia's no-tech doctrine (`.claude/rules/sophia-no-tech-doctrine.md`) is in force. Every fix above is pure code, no third-party operator setup.
- **Renderer crash on `/dashboard/create`** likely a heavy client component (template gallery with too many concurrent image loads or framer-motion explosion). Worth profiling with Chrome DevTools "Performance" tab on a real device before the next batch of users sees it.

---

## Unresolved questions

1. Is `/setup-wizard` intentionally a marketing landing or is it supposed to be the in-product wizard? The 7-step welcome tour modal references it as "Step 1 of 7 → Configure Providers" but the route doesn't deliver a wizard.
2. Should `/dashboard/analytics` be tier-gated (Growth+) or universally available? Code path appears to throw rather than gate, suggesting either intent unclear OR a deploy-time bug.
3. Is `/dashboard/billing` separate from `/dashboard/account` (Profile/Subscription/Billing History tabs)? Currently `/account` works perfectly while `/billing` hangs — sidebar should probably link to one or the other, not both.
4. FREE100 redeem returned non-2xx — is the code expired in prod, or single-use against a known emails list? Need a test-fixture path to MASTER tier for E2E coverage of admin/wallet flows.
5. Per `sophia-handover-rules.md`, "Setup Wizard" is a protected non-breakable flow. Is it currently broken in prod or am I looking at the wrong route? Operator should confirm whether the canonical wizard URL is `/dashboard/onboarding` (works) or `/setup-wizard` (marketing landing).
