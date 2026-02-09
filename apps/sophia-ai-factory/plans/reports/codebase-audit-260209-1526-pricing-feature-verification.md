# Codebase Audit: Pricing Feature Verification

**Date:** 2026-02-09 | **Scope:** Sophia AI Factory | **Auditors:** 3 parallel agents

---

## Executive Summary

**18 features audited across 4 pricing tiers. Result: 5 IMPLEMENTED, 3 PARTIAL, 8 STUB, 2 MISSING.**

Only ~28% of advertised features have real working code. The codebase has solid infrastructure for templates, discovery, payments, and tier-gating — but most premium/enterprise features are label-only strings with zero implementation.

---

## 1. FEATURE VERIFICATION TABLE

### STARTER ($199/mo → maps to BASIC tier)

| Feature | Status | File | Evidence |
|---------|--------|------|----------|
| 5 Video Templates | **IMPLEMENTED** | `src/config/tiers.ts:22`, `src/lib/templates/campaign-templates.ts`, `src/lib/services/template-service.ts`, `src/app/actions/templates.ts` | 5 predefined templates, Supabase CRUD, tier-gated creation via `tierGuard.checkLimit()` |
| Auto-Discovery Engine | **IMPLEMENTED** | `src/lib/inngest/functions/auto-discover-affiliates.ts`, `src/lib/discovery/affiliate-ai-scorer.ts`, `src/components/discovery/dashboard.tsx` | Daily cron, AI scoring, search/filter UI. **BUT** feature flag requires PREMIUM tier — contradicts pricing page listing it under Starter |
| Basic Analytics | **PARTIAL** | `src/app/[locale]/dashboard/analytics/page.tsx`, `src/app/[locale]/dashboard/analytics/components/analytics-view.tsx` | Stats cards + Recharts charts exist. **No tier differentiation** — all users see same analytics. "Basic" vs "Advanced" is label-only |
| Email Support | **STUB** | `src/components/pricing-section.tsx:16` | String only. No support ticket system, contact form, or email routing. `types/index.ts:47` has unused `support` type |

### GROWTH ($399/mo → maps to PREMIUM tier)

| Feature | Status | File | Evidence |
|---------|--------|------|----------|
| Unlimited Templates | **IMPLEMENTED** | `src/config/tiers.ts:40` (limit: 999), `src/app/actions/templates.ts` | Tier-gated check via `tierGuard.checkLimit()` enforces 999 limit |
| Advanced Analytics | **STUB** | Same as Basic Analytics | Identical dashboard for all tiers. No additional charts/data for higher tiers |
| ROI Calculator | **IMPLEMENTED** | `src/app/components/sections/roi-calculator.tsx` | Full interactive component: sliders, CPM + affiliate revenue calc, Recharts display. **BUT** rendered publicly — no tier gate |
| Priority Support | **STUB** | `src/components/pricing-section.tsx:28` | String only. No priority queue, SLA, or routing logic |
| Custom Branding | **MISSING** | `src/components/pricing-section.tsx:29` | String only. No branding settings, logo upload, or color customization UI |

### PREMIUM ($799/mo → maps to ENTERPRISE tier)

| Feature | Status | File | Evidence |
|---------|--------|------|----------|
| Custom Templates | **IMPLEMENTED** | `src/lib/tier-guard.ts:118-121` `checkCustomTemplateAccess()` | Gates to ENTERPRISE+ only. Same template system with unlimited slots |
| White-labeling | **STUB** | `src/components/pricing-section.tsx:40`, `src/lib/subscription.ts:19` | Strings only. No tenant isolation, domain mapping, or brand override system |
| Dedicated Account Manager | **STUB** | `src/components/pricing-section.tsx:41` | String only. No CRM integration, assignment, or contact routing |
| API Access | **STUB** | `src/config/flags.ts:41-45` (flag disabled), `src/lib/tier-guard.ts:84-88` | Feature flag infrastructure exists. `check-access` API can verify. **BUT** no customer-facing API endpoints, no API key issuance, no docs |
| SLA Guarantee | **MISSING** | `src/components/pricing-section.tsx:43` | String only. No SLA monitoring, uptime tracking, or enforcement |

### MASTER ($4,999 one-time)

| Feature | Status | File | Evidence |
|---------|--------|------|----------|
| Everything in Premium | **IMPLEMENTED** | `src/lib/tier-guard.ts:37-44` | MASTER bypasses all limits with `allowed: true, limit: Infinity` |
| Lifetime Access | **IMPLEMENTED** | `src/lib/subscription.ts:70-72`, `src/lib/polar-config.ts:52-61` | MASTER never expires. `billingType: 'one-time'` |
| Unlimited Training Sessions | **STUB** | `src/config/tiers.ts:87` | Config value `trainingSessions: 999`. `LimitType` declared in `tier-guard.ts:9` but **no case handler** in `checkLimit()`. No training content or booking system |
| VIP Priority Support | **STUB** | `src/config/tiers.ts:88` | Config value `supportMonths: 999`. No support system |
| Custom Automation Scripts | **PARTIAL** | `src/app/actions/automation.ts`, `src/config/tiers.ts:89` | Campaign pipeline + n8n webhook exists. **BUT** not user-customizable — no script editor or custom workflow builder |
| Monthly Strategy Calls | **STUB** | `src/config/tiers.ts:92` | Boolean in config. No booking/scheduling/Calendly integration |
| White-label License | **STUB** | `src/components/pricing-section.tsx:61` | Same as Enterprise white-labeling — zero implementation |
| Early Access to Features | **STUB** | `src/components/pricing-section.tsx:62`, `src/lib/subscription.ts:24` | Strings only. No beta feature gating or opt-in mechanism |

---

## 2. SCORING SUMMARY

| Status | Count | Features |
|--------|-------|----------|
| **IMPLEMENTED** | 5 | Video Templates, Auto-Discovery, ROI Calculator, Lifetime Access, Everything-in-Premium gate |
| **PARTIAL** | 3 | Analytics (no tier diff), Automation Scripts (pipeline only, not custom), Auto-Discovery (tier conflict) |
| **STUB** | 8 | All Support tiers, Training Sessions, Monthly Strategy Calls, White-labeling (x2), API Access, Early Access, Advanced Analytics |
| **MISSING** | 2 | Custom Branding, SLA Guarantee |

---

## 3. NAVIGATION ROUTES VERIFICATION

### Navbar Links

| Nav Label | href | Page Exists | Status |
|-----------|------|-------------|--------|
| Features | `/#features` | Anchor on landing page | **BROKEN** — `<section>` in `features.tsx:57` missing `id="features"` |
| Pricing | `/#pricing` | Anchor on landing page | **OK** — `pricing-section.tsx:180` has `id="pricing"` |
| Guide | `/guide` | `src/app/[locale]/guide/page.tsx` | **OK** — full bilingual guide |
| Affiliate Programs | `/affiliate-discovery` | `src/app/[locale]/affiliate-discovery/page.tsx` | **OK** — renders `<DiscoveryDashboard />` |
| FAQ | `/#faq` | Anchor on landing page | **BROKEN** — `<section>` in `faq.tsx:57` missing `id="faq"` |
| Login | `/login` | `src/app/[locale]/login/page.tsx` | **OK** — Supabase Magic Link form |
| Dashboard | `/dashboard` | `src/app/[locale]/dashboard/page.tsx` | **OK** — real SSR dashboard |

### Dashboard Sidebar Links

| Nav Label | href | Status |
|-----------|------|--------|
| Overview | `/dashboard` | **OK** |
| New Project | `/dashboard/create` | **OK** |
| Campaigns | `/dashboard/campaigns` | **OK** |
| Analytics | `/dashboard/analytics` | **OK** |
| **My Videos** | `/dashboard/videos` | **BROKEN — 404** (no `page.tsx` exists) |
| Settings | `/dashboard/settings` | **OK** |

### Other Broken Links

| Source | Link | Target | Status |
|--------|------|--------|--------|
| 404 page (`not-found.tsx:63`) | `/contact` | No page exists | **BROKEN — 404 loop** |
| Footer | `/#features` | Missing id | **BROKEN** |
| Footer | `/#faq` | Missing id | **BROKEN** |

---

## 4. TIER ENFORCEMENT (Actual Blocking Points)

Only **3 real enforcement points** exist in the entire codebase:

| Enforcement | Location | Blocks What |
|-------------|----------|-------------|
| Multi-channel campaign | `campaigns.ts:76` | BASIC users blocked from >1 platform |
| Template creation limit | `templates.ts:67` | Enforces tier template limit |
| Telegram `/discover` | `telegram-command-handlers.ts:144` | Requires PREMIUM |

**AI quality differentiation** (not blocking, but tier-aware):
- Script generator: ENTERPRISE gets Claude 3.5 Sonnet, others get GPT-4o-mini
- TTS: Higher tiers get better voices, models, settings

**NOT enforced:**
- Dashboard pages — any logged-in user can access all pages
- Analytics — same view for all tiers
- Admin dashboard — uses hardcoded mock ENTERPRISE user
- Feature flags admin page — "visual simulation only"
- `subscription-gate-middleware.ts` — exists but not used in any API route

---

## 5. CRITICAL ISSUES

### A. Data Inconsistencies

1. **Pricing discrepancy**: `tiers.ts` shows $1,200/$2,000/$3,000 (setup fees) vs `polar-config.ts` shows $199/$399/$799/mo (subscriptions). UI shows monthly.
2. **DB tier type mismatch**: Supabase type union lacks `'master'` but code writes `'master'` via `TIER_DB_MAPPING`
3. **`campaigns.ts` inline mapping** (lines 96-97) skips `'premium'` and `'master'` DB values — users with these tiers default to BASIC in campaign creation
4. **`trainingSessions` LimitType** declared but has no case handler in `checkLimit()` switch

### B. Security/UX Gaps

5. **No dashboard-level tier gating** — once logged in, any user accesses all pages
6. **ROI Calculator public** — available to all visitors despite being Growth+ feature
7. **Auto-Discovery tier conflict** — listed under Starter but feature flag requires PREMIUM
8. **Admin invite excludes MASTER** — dropdown only offers BASIC/PREMIUM/ENTERPRISE
9. **PPP pricing calculator unused** — `polar-pricing-calculator.ts` exists but not wired to checkout

---

## 6. UNRESOLVED QUESTIONS

1. Are the `tiers.ts` prices ($1,200/$2,000/$3,000) for a different sales channel (agency setup fees) vs the `polar-config.ts` subscription prices ($199/$399/$799/mo)?
2. Should Auto-Discovery be available to Starter/BASIC or gated to PREMIUM as the feature flag defines?
3. Is `/dashboard/videos` a planned feature or should the sidebar link be removed?
4. Should the `/contact` link on the 404 page point to an email address instead?
5. Is the "visual simulation only" admin feature flags page intentionally non-functional?
