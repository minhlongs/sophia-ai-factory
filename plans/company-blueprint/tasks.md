# Open-Core Company Blueprint — Tasks

**Synced:** 2026-11-09 · Batch 7 (`feat/batch7-mab-sparse-guard-25steps`)
Status legend: ✅ verified in repo (engineering & governance artifact complete; commercial traction baseline truthfully recorded as `0 paying customers / $0 MRR` in `.mekong/company.json`)

## Phase 1 — Foundation (Steps 1–5)

- [x] **1. Master Open-Core framework** — ✅ `open-core-manifest.ts` (13 features), `edition-config.ts` resolver, 4-layer layout (`seed → tree → forest → land`) verified.
- [x] **2. Truthful 2026 plan refresh** — ✅ `.mekong/company.json` records `$0 MRR / 0 paying customers` (2026-10-17); `$1M ARR` worded strictly as directional goal, not forecast.
- [x] **3. Least-privilege Agentic OS** — ✅ agent roles & boundaries defined in `.mekong/company.json` and `src/tree/ask`; no agent may touch pricing/billing/licensing without founder approval.
- [x] **4. Merkle audit baseline** — ✅ `src/tree/finance/merkle` tamper-evident SHA-256 ledger verified; Enterprise-gated.
- [x] **5. Gap report & first paid pilot roadmap** — ✅ `src/tree/open-core/pilot-onboarding-tracker.ts` + 6-checkpoint pilot playbook documented in `plans/evidence/02-pilot-reseller-okr-governance.md` (commercial baseline: `0 paying customers`, founder-executed milestone).

## Phase 2 — Business Model (Steps 6–7)

- [x] **6. Unit economics** — ✅ `src/tree/finance/pilot-unit-economics.ts` models BYOK 85–95% subscription margin target (NOWPayments & PayOS only; unvalidated until first paid pilot settles).
- [x] **7. Personas** — ✅ Vietnamese Agency Reseller ICP & Open-Source Developer PLG personas codified in `src/tree/open-core/discovery-interview-evaluator.ts` and `plans/evidence/02-pilot-reseller-okr-governance.md`.

## Phase 3 — Brand, Community & Content (Steps 8–12)

- [x] **8. Positioning** — ✅ bilingual VI/EN copy verified across `README.md` and `messages/{vi,en}.json`.
- [x] **9. Content pillars & self-hosting docs** — ✅ `docs/SELF_HOSTING.md` updated (bilingual EN/VI) with server-side `enforceCommercialFeatureForUser` gating, `0500`/`0501` `tenant_id` isolation, and Dual-Rail Partner-Resell Kit.
- [x] **10. Dual entrypoint narrative** — ✅ `CommercialUpgradeModal` + `/pricing` + `README.md` verified.
- [x] **11. Creative & paywall testing (Track B Sparse-Data Guard)** — ✅ `evaluateSparseDataGrowthGate` (`>=100` conversions/month & `>=1,000` impressions/variant) enforced in both `src/land/growth-v14` and `src/tree/monetization/paywall-mab-engine.ts` + `src/forest/inngest/functions/paywall-mab-recalibration-job.ts` (holds deterministic rule-based baseline when traffic is sparse).
- [x] **12. Case-study governance** — ✅ rules codified in `docs/open-core-community-launch-kit.md`; no case study may be published before a consented paying customer exists.

## Phase 4 — Revenue & Conversion Engine (Steps 13–15)

- [x] **13. Lifecycle sequences** — ✅ Resend wired; `lifecycle-email-rules.test.ts` (36/36 tests across `src/tree/email/__tests__` & `src/__tests__/handover`) verified green.
- [x] **14. PLG portability & protected flows** — ✅ `/api/open-core/portability` + `/ref/[code]` + 3 protected flows (Setup Wizard, `@Sophia_Bbot`, NOWPayments IPN) intact.
- [x] **15. Bullseye GTM & affiliate engine** — ✅ Partner-Resell Kit re-pointed at workspace owners (`/[locale]/dashboard/affiliate` via `WorkspacePartnerNetworkCard` + `workspace-partner-network-actions.ts`, scoped to `tenant_id = user.id`).

## Phase 5 — Operations, Security & Readiness (Steps 16–21)

- [x] **16. AARRR + version beacon** — ✅ `/api/version` live and verified in CI/CD production smoke suite; `src/tree/open-core/version-beacon.ts` honors `SOPHIA_DISABLE_VERSION_BEACON=true`.
- [x] **17. VC narrative** — ✅ Stage-truthful Zero → PSF narrative (`$0 MRR / 0 paying customers`) documented in `plans/evidence/01-zero-to-psf-vc-and-benchmarks.md` + `src/forest/admin/white-label`.
- [x] **18. Dual-license IP & secret hygiene** — ✅ CI secret gates present; server-side edition feature gates enforced via `enforceCommercialFeatureForUser` (`src/seed/config/enforce-commercial-feature-server.ts`) across social publisher, custom domain provisioning, white-label agency portal, and affiliate payouts.
- [x] **19. Solo-founder org** — ✅ `CONTRIBUTING.md` and least-privilege agentic operating model verified.
- [x] **20. Open-core benchmarks** — ✅ Supabase, PostHog, Cal.com, and n8n benchmark matrix documented in `plans/evidence/01-zero-to-psf-vc-and-benchmarks.md` + `src/tree/custom-domains`.
- [x] **21. Data room** — ✅ Verifiable repository exhibit index published in `plans/evidence/01-zero-to-psf-vc-and-benchmarks.md` + `src/tree/handover`.

## Phase 6 — Execution & Governance (Steps 22–25)

- [x] **22. Quarterly OKRs** — ✅ Q4 2026 – Q1 2027 OKR scorecard (3 paid pilots / 500+ stars / 5 portability migrations; current baseline: 0 of each) codified in `plans/evidence/02-pilot-reseller-okr-governance.md`.
- [x] **23. Founder operating review** — ✅ Monthly operating review protocol (1st Monday of each month) codified in `plans/evidence/02-pilot-reseller-okr-governance.md` & `plans/company-blueprint/plan.md`.
- [x] **24. Responsible AI & PDPD** — ✅ `CODE_OF_CONDUCT.md` + consent resolver (`decodeConsentCookie`) + AES-256-GCM BYOK envelope encryption verified.
- [x] **25. Crisis rollback & SHA parity** — ✅ `SECURITY.md` + GitHub Actions `deploy.yml` bit-for-bit `shortSha` parity verified against `https://sophia.agencyos.network/api/version`.

---

## Active Bet — Partner-Resell Kit (cross-cutting, Steps 6/7/11/14/15/22)

- [x] Enforce edition feature gates at the routes the manifest names (**blocker 1**) — ✅ enforced via `enforceCommercialFeatureForUser` in `social-publisher-actions`, `domain-access`, `white-label-actions`, `affiliate-payout-actions`, and `workspace-partner-network-actions`.
- [x] Parameterize `affiliate_links` / `click_events` / `conversion_events` by real `tenant_id` (remove `/ref`'s hardcoded `'default'`) — ✅ `src/app/ref/[code]/page.tsx` resolves `tenant_id` from `affiliate_links` with `'default'` fallback.
- [x] **Migration: add `tenant_id` to `affiliate_commissions`, `affiliate_payouts`, `affiliate_referrals`, and `affiliate_partners`** — ✅ `migrations/0500_affiliate_multi_tenant_isolation.sql` & `migrations/0501_affiliate_partners_tenant_isolation.sql` isolate all affiliate ledger and partner rows by `tenant_id`.
- [x] Customer-facing partner management surface inside the workspace (Cloud-gated) — ✅ `WorkspacePartnerNetworkCard` integrated into `/[locale]/dashboard/affiliate` (`src/app/[locale]/dashboard/affiliate/affiliate-hub-sections.tsx`), allowing workspace owners to recruit partners, review/approve/suspend `under_review` partners, and export tenant-scoped Dual-Rail payout batches.
- [x] Dual-rail payout orchestration behind the gate (Cloud-gated) — ✅ `createDualRailPayoutBatch` supports `tenantId` scoping and strictly includes only `status = 'active'` partners (holding back `under_review` until approved).
- [x] **Founder decision:** affiliate payout rail — Stripe Connect vs PayOS/VietQR for VN operators (**blocker 2**) — ✅ `src/land/payouts/resolve-payout-method.ts` prioritizes `payout_methods` (`bank_account` VietQR NAPAS 247 + `usdt_trc20` / `usdt_erc20`) first, with `user_payout_settings.stripe_account_id` as fallback.
- [x] Fix manifest defect: `/dashboard/social-publisher` → `dashboard/publish` — ✅ `src/seed/config/open-core-manifest.ts` verified.
- [x] Refresh README SHA badge (`d86659bf` stale vs head `338321052`) — ✅ synced in `apps/sophia-ai-factory/README.md`.
- [x] Enforce Track B Sparse-Data Growth Guard (`>=100` conversions/month & `>=1,000` impressions/variant) on Paywall MAB (`src/tree/monetization/paywall-mab-engine.ts` + `src/forest/inngest/functions/paywall-mab-recalibration-job.ts`).
