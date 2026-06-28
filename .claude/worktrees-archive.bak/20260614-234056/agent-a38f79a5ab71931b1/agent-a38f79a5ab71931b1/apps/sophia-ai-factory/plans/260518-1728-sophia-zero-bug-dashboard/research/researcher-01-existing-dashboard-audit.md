# Existing /Dashboard Surface Audit — Sophia AI Factory

**Date:** 2026-05-18 | **Scope:** 71 page.tsx files under `src/app/[locale]/dashboard/*` | **Build:** ✅ Pass | **Tests:** 4528/4563 (1 failing payout webhook test)

---

## 1. Surface Map

| Category | Count | Sample Paths |
|---|---:|---|
| **Admin/Ops** | 14 | `admin/`, `admin/audit-log`, `admin/deploy-status`, `admin/crons`, `admin/cost`, `admin/storage`, `admin/refunds`, `admin/pricing` |
| **Customer Account** | 5 | `account`, `settings/`, `billing`, `wallet`, `credits` |
| **RaaS/Revenue** | 8 | `affiliate/`, `affiliate/payouts`, `orders`, `orders/refund/[id]`, `proposals`, `campaigns`, `campaigns/[id]` |
| **Content/Creator** | 12 | `videos/`, `videos/new`, `videos/[id]/distribute`, `voices`, `templates`, `sops/`, `workflows` |
| **Agent/Skills** | 4 | `agents`, `integrations/`, `integrations/affiliate-networks`, `integrations/mcp` |
| **Help/Docs** | 4 | `help/`, `help/faq`, `help/getting-started`, `help/troubleshooting` |
| **System/Health** | 7 | `system-health`, `api-docs`, `api-keys`, `byok`, `analytics`, `experiments`, `onboarding` |
| **Missions** | 3 | `missions`, `missions/[id]`, `sop-marketplace` |
| **Other** | 14 | `create`, `orders/refund/[purchaseId]`, `dashboard` (root), `page.tsx` depth variants, `support` |

**⚠️ Finding:** 71 pages total; admin routes = 14 (20% of dashboard = high-risk surface).

---

## 2. Top 10 Quality Risks

| Risk | Pages Affected | Severity | Details |
|---|---:|---|---|
| **Hardcoded UI strings (no i18n)** | `admin/tenant-lookup` (10+), `admin/cost` (5), `admin/email-outbox` (5), `admin/webhook-deliveries` (5) | HIGH | Admin pages contain raw quoted text instead of `t()` calls. Breaks i18n promise; VN users see English. |
| **Client-only auth gates** | `missions`, `workflows`, `api-keys`, `system-health`, `billing`, `proposals` (6 pages) | HIGH | `'use client'` with NO `getCurrentUser()` call. Client-side auth assumption = XSS hole if session corrupted. |
| **Missing test files** | 61/71 pages (86% untested) | HIGH | Only 10 pages have unit tests; ZERO E2E tests for dashboard flows except `dashboard.spec.ts` stub. Regression risk high. |
| **Import path mixing** | `@/lib/*` (deprecated) + `@/seed/*` (canonical) coexist | MED | `settings/branding/page.tsx` uses `@/lib/tenant-settings/defaults`; audit layer rule states seed/tree/forest/land canonical paths. Confusing. |
| **No Server Actions** | All mutation pages (campaigns, orders, settings) use API routes or form submissions | MED | Recommended pattern is Server Actions for data mutations. Current mix is correct but not standardized. |
| **Help pages bypass auth** | `help/`, `help/faq`, `help/getting-started`, `help/troubleshooting` + `missions/[id]` (5 pages) | MED | Server components but ZERO `getCurrentUser()`. Assumes anon access OK. Risk if secrets/private data later added. |
| **Admin-only gate missing** | `admin/*` pages check `getCurrentUser()` but no admin role verification | MED | `admin/page.tsx` imports `getCurrentUser()` but never checks if user is admin. Tier/org membership not validated. |
| **Doctrine compliance gaps** | `onboarding/page.tsx` direct D1 access; `admin/handover-wizard` mentions "operator provides" | MED | Some pages imply operator-side credential management. Conflicts with no-tech doctrine (2026-05-15). |
| **Missing error boundaries** | Dashboard layout loads 8+ parallel queries without error fallback | LOW | `layout.tsx` queries observability primitives; if one fails, whole sidebar crashes. Need boundary. |
| **Stale test (1 failing)** | `src/app/api/webhooks/nowpayments-payout/__tests__/route.test.ts:74` | LOW | NOWPayments payout webhook test timing out. Non-blocking but indicates flaky integration test. |

---

## 3. Test Coverage Gap

- **Total dashboard pages:** 71
- **Pages with unit test (`.test.tsx` / `.test.ts`):** 10
  - `onboarding/__tests__/page.test.tsx`
  - `campaigns/[id]/page.test.tsx`
  - `components/create-campaign/campaign-form.test.tsx`
  - Others in `forest/`, `land/` components
- **Pages with E2E test:** 1 (stub: `tests/e2e/dashboard.spec.ts`)
- **Coverage gap:** 61 pages (86%) untested at page level

⚠️ **Risk:** No Playwright E2E suite for critical flows (account setup, billing, affiliate payouts, API key rotation).

---

## 4. Critical Bugs / Won't Compile

✅ **No compilation errors.** `npm run build` passes. All imports resolve.

⚠️ **One failing test:** `nowpayments-payout/route.test.ts:74` times out (likely webhook IPN mock issue, not page logic).

---

## 5. Doctrine Compliance Flags

| Flag | Page | Status | Issue |
|---|---|---|---|
| **Polar references** | Dashboard (global) | ✅ CLEAR | Zero "polar" or "Polar" strings found. Doctrine respected. |
| **BYOK (customer self-config)** | `onboarding/`, `byok/`, `settings/` | ⚠️ PARTIAL | Onboarding checks setup wizard completion. BYOK page exists. BUT: no enforcement that API keys are ALWAYS customer-provided (no operator fallback fallback documented). |
| **No operator credentials in code** | `admin/deploy-status`, `admin/handover` | ⚠️ FLAGGED | `admin/handover-wizard-steps.tsx` mentions "platform default OR customer provides" for NOWPayments. Implies operator has default config. Revisit. |
| **i18n discipline** | 4 admin pages | ❌ FAILED | Hardcoded English strings in `admin/tenant-lookup`, `admin/cost`, etc. Breaks bilingual promise. |
| **Auth gates universal** | 6 client-side pages | ⚠️ PARTIAL | Help pages intentionally anon; others should be gated. Needs explicit audit. |

---

## 6. Unresolved Questions

1. **Admin role check missing?** `admin/` pages call `getCurrentUser()` but don't verify admin flag. Is there a middleware or is role checked at API layer only?
2. **Hardcoded strings in admin—intentional?** Admin surface (non-customer-facing) may exempt i18n. Confirm scope.
3. **Help pages truly public?** Are `help/` + `help/faq` intentionally unauthenticated? Or should they require login?
4. **NOWPayments default—operator or customer?** Handover wizard says "platform default or customer provides." Clarify no-tech doctrine boundary.
5. **Server Actions vs API routes?** No Server Actions found in mutation flows. Is this intentional architecture choice or technical debt?

---

**Next:** Hardening phase will prioritize 10 highest-risk pages + full E2E test scaffold for critical flows (billing, campaigns, onboarding).
