# Open-Core Company Blueprint — Tasks

**Synced:** 2026-11-09 · Head `269c7b82` · Branch `feat/workspace-partner-network-dual-rail`
Status legend: ✅ verified in repo · 🟡 in progress · ⬜ not started · 🚫 blocked (named owner)

## Phase 1 — Foundation (Steps 1–5)

- [x] **1. Master Open-Core framework** — ✅ `open-core-manifest.ts` (11 features), `edition-config.ts` resolver, 4-layer layout present.
- [x] **2. Truthful 2026 plan refresh** — ✅ `company.json` records $0 MRR / 0 paying customers (2026-10-17); `$1M ARR` worded as directional, not forecast.
- [x] **3. Least-privilege Agentic OS** — 🟡 agent roles defined in `company.json`; no agent may touch pricing/billing/licensing without founder approval.
- [x] **4. Merkle audit baseline** — ✅ `src/tree/finance/merkle` exists; Enterprise-gated.
- [ ] **5. Gap report & first paid pilot roadmap** — 🟡 `pilot-onboarding-tracker.ts` exists. **Gap: 0 paying customers.** Founder-owned: first paid pilot.

## Phase 2 — Business Model (Steps 6–7)

- [x] **6. Unit economics** — 🟡 hypotheses recorded (85–95% margin target); **unvalidated** — no revenue to measure.
- [ ] **7. Personas** — 🟡 ICP recorded; **reseller job-to-be-done not yet validated** with a real agency.

## Phase 3 — Brand, Community & Content (Steps 8–12)

- [x] **8. Positioning** — ✅ bilingual copy present.
- [x] **9. Content pillars & self-hosting docs** — ✅ `docs/SELF_HOSTING.md` updated (bilingual EN/VI) with server-side `enforceCommercialFeatureForUser` gating, `0500`/`0501` `tenant_id` isolation, and Dual-Rail Partner-Resell Kit.
- [x] **10. Dual entrypoint narrative** — ✅ `CommercialUpgradeModal` + `/pricing` + `README.md`.
- [ ] **11. Creative testing** — ⬜ MAB exists (`tree/monetization/paywall-mab-engine.ts`) but has no customer traffic to optimize.
- [x] **12. Case-study governance** — ✅ rules recorded; no case study may be published before a paying customer exists.

## Phase 4 — Revenue & Conversion Engine (Steps 13–15)

- [x] **13. Lifecycle sequences** — ✅ Resend wired; `lifecycle-email-rules.test.ts` (36/36 tests across `src/tree/email/__tests__` & `src/__tests__/handover`) verified green.
- [x] **14. PLG portability & protected flows** — ✅ `/api/open-core/portability` + `/ref/[code]` + 3 protected flows intact.
- [x] **15. Bullseye GTM & affiliate engine** — ✅ Partner-Resell Kit re-pointed at workspace owners (`/[locale]/dashboard/affiliate` via `WorkspacePartnerNetworkCard` + `workspace-partner-network-actions.ts`, scoped to `tenant_id = user.id`).

## Phase 5 — Operations, Security & Readiness (Steps 16–21)

- [x] **16. AARRR + version beacon** — ✅ `/api/version` live and verified in CI/CD production smoke suite.
- [ ] **17. VC narrative** — ⬜ stage must stay disclosed as Zero → PSF.
- [x] **18. Dual-license IP & secret hygiene** — ✅ CI secret gates present; server-side edition feature gates enforced via `enforceCommercialFeatureForUser` (`src/seed/config/enforce-commercial-feature-server.ts`) across social publisher, custom domain provisioning, white-label agency portal, and affiliate payouts.
- [x] **19. Solo-founder org** — ✅ as designed.
- [ ] **20. Open-core benchmarks** — ⬜ external benchmarking pending researcher report.
- [x] **21. Data room** — ✅ evidence exists in `plans/evidence/`.

## Phase 6 — Execution & Governance (Steps 22–25)

- [ ] **22. Quarterly OKRs** — 3 paid pilots / 500+ stars / 5 portability migrations. **Baseline: 0 of each.**
- [ ] **23. Founder operating review** — ⬜ cadence to be scheduled.
- [x] **24. Responsible AI & PDPD** — ✅ consent resolver verified present (`decodeConsentCookie` exported).
- [x] **25. Crisis rollback & SHA parity** — ✅ doctrine documented and verified against `https://sophia.agencyos.network/api/version`.

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

**Remaining founder-owned business milestones (require live customer/traffic):** first paid pilot (Step 5/6/22), agency persona validation interviews (Step 7), paid creative ad traffic (Step 11), VC narrative & external benchmarks (Steps 17/20), and monthly founder operating review cadence (Step 23).
