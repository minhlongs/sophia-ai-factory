# Open-Core Company Blueprint — Tasks

**Synced:** 2026-10-21 · Head `338321052` · Branch `fix/consent-resolver-missing-import`
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
- [x] **9. Content pillars & self-hosting docs** — 🟡 `docs/SELF_HOSTING.md` unverified this session.
- [x] **10. Dual entrypoint narrative** — ✅ `CommercialUpgradeModal` + `/pricing` + `README.md`.
- [ ] **11. Creative testing** — ⬜ MAB exists (`tree/monetization/paywall-mab-engine.ts`) but has no customer traffic to optimize.
- [x] **12. Case-study governance** — ✅ rules recorded; no case study may be published before a paying customer exists.

## Phase 4 — Revenue & Conversion Engine (Steps 13–15)

- [ ] **13. Lifecycle sequences** — ⬜ Resend wired; sequences not verified this session.
- [x] **14. PLG portability & protected flows** — ✅ `/api/open-core/portability` + `/ref/[code]` + 3 protected flows intact.
- [ ] **15. Bullseye GTM & affiliate engine** — 🟡 engine built for the operator; **Partner-Resell Kit re-points it at the customer** (active bet).

## Phase 5 — Operations, Security & Readiness (Steps 16–21)

- [ ] **16. AARRR + version beacon** — 🟡 `/api/version` live; GitHub star count unverifiable from this sandbox (`api.github.com` denied).
- [ ] **17. VC narrative** — ⬜ stage must stay disclosed as Zero → PSF.
- [ ] **18. Dual-license IP & secret hygiene** — 🟡 CI secret gates present; **edition gate NOT enforced at routes** (only auditor + status route call `evaluateFeatureGate`).
- [ ] **19. Solo-founder org** — ✅ as designed.
- [ ] **20. Open-core benchmarks** — ⬜ external benchmarking pending researcher report.
- [ ] **21. Data room** — ⬜ evidence exists in `plans/evidence/`.

## Phase 6 — Execution & Governance (Steps 22–25)

- [ ] **22. Quarterly OKRs** — 3 paid pilots / 500+ stars / 5 portability migrations. **Baseline: 0 of each.**
- [ ] **23. Founder operating review** — ⬜ cadence to be scheduled.
- [ ] **24. Responsible AI & PDPD** — ✅ consent resolver verified present (`decodeConsentCookie` exported).
- [x] **25. Crisis rollback & SHA parity** — ✅ doctrine documented; live SHA check must run in CI (sandbox blocked `sophia.agencyos.network` here).

---

## Active Bet — Partner-Resell Kit (cross-cutting, Steps 6/7/11/14/15/22)

- [ ] Enforce edition feature gates at the routes the manifest names (**blocker 1**).
- [ ] Parameterize `affiliate_links` / `click_events` / `conversion_events` by real `tenant_id` (remove `/ref`'s hardcoded `'default'`).
- [ ] **Migration: add `tenant_id` to `affiliate_commissions`, `affiliate_payouts`, `affiliate_referrals`** — none carry it (migration `0452` gives them only `partner_id` / `referral_id` / `payout_id`). Backfill existing rows as `'default'`; back up D1 first. Without this, a customer's commission ledger is inseparable from Sophia's own and cross-tenant sweeps pay out wrong.
- [ ] Customer-facing partner management surface inside the workspace (Cloud-gated).
- [ ] Dual-rail payout orchestration behind the gate (Cloud-gated).
- [ ] **Founder decision:** affiliate payout rail — Stripe Connect vs PayOS/VietQR for VN operators (**blocker 2**).
- [ ] Fix manifest defect: `/dashboard/social-publisher` → `dashboard/publish`.
- [ ] Refresh README SHA badge (`d86659bf` stale vs head `338321052`).

**Not done / not verified in this session:** live SHA parity, public repo star count, `docs/SELF_HOSTING.md`, lifecycle email sequences, and the two inbound external-research reports (open-core PLG wedge, VN affiliate channel).
