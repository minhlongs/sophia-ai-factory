# Open-Core Company Blueprint — Tasks

**Synced:** 2026-10-22 · Head `73796ebd8` · Branch `feat/open-core-25-steps-binh-phap-accuracy`

## Status legend / Cách đọc trạng thái

The previous `✅ verified in repo` mark conflated two different facts — "a file exists" and "a claim is verified". The legend below separates them.

| Mark | Meaning |
|---|---|
| 📄 **Có mã nguồn** / Code exists | A module is present at the cited path. Says nothing about correctness. |
| 🧪 **Đã kiểm thử** / Tested | Covered by a passing automated test at the cited path. |
| ✅ **Đã xác minh production** / Production-verified | Confirmed against the live edge or a green CI run on a named commit. |
| 💰 **Được khách trả tiền kiểm chứng** / Customer-payment-validated | A real customer paid and used it. |
| ❓ **Chưa xác minh** / Unverified | None of the above; carries an owner and the evidence that would verify it. |

Completion marks: `[x]` done · `[ ]` outstanding.

**Reading note:** an item marked 📄 only is **not** verified. Existence is the weakest possible state and must not be reported as done.

## Phase 1 — Foundation (Steps 1–5)

- [x] **1. Master Open-Core framework** — 📄 `open-core-manifest.ts` (11 features), `edition-config.ts` resolver, 4-layer layout present. Code exists; behavior not separately verified here.
- [x] **2. Truthful 2026 plan refresh** — ✅ `company.json` records $0 MRR / 0 paying customers (2026-10-17); `$1M ARR` worded as directional, not forecast. Confirmed by `verify:open-core` on 2026-10-22.
- [x] **3. Least-privilege Agentic OS** — 📄 agent roles defined in `company.json`; no agent may touch pricing/billing/licensing without founder approval. ❓ enforcement not separately tested.
- [x] **4. Merkle audit baseline** — 📄 `src/tree/finance/merkle` exists; Enterprise-gated.
- [ ] **5. Gap report & first paid pilot roadmap** — 📄 `pilot-onboarding-tracker.ts` exists. **Gap: 0 paying customers.** Founder-owned: first paid pilot.

## Phase 2 — Business Model (Steps 6–7)

- [x] **6. Unit economics** — 🟡 hypotheses recorded (85–95% margin target); **unvalidated** — no revenue to measure.
- [ ] **7. Personas** — 🟡 ICP recorded; **reseller job-to-be-done not yet validated** with a real agency.

## Phase 3 — Brand, Community & Content (Steps 8–12)

- [x] **8. Positioning** — 📄 bilingual copy present in `messages/vi.json` + `messages/en.json`. Copy exists; no customer response measured.
- [x] **9. Content pillars & self-hosting docs** — 🟡 `docs/SELF_HOSTING.md` unverified this session.
- [x] **10. Dual entrypoint narrative** — 📄 `CommercialUpgradeModal` + `/pricing` + `README.md` exist. Both entrypoints present; conversion not measured.
- [ ] **11. Creative testing** — ⬜ MAB exists (`tree/monetization/paywall-mab-engine.ts`) but has no customer traffic to optimize.
- [x] **12. Case-study governance** — 📄 rules recorded; no case study may be published before a paying customer exists. Rule exists; not yet exercised (0 paying customers).

## Phase 4 — Revenue & Conversion Engine (Steps 13–15)

- [ ] **13. Lifecycle sequences** — ⬜ Resend wired; sequences not verified this session.
- [x] **14. PLG portability & protected flows** — 🧪 `/api/open-core/portability` + `/ref/[code]` + 3 protected flows verified by `scripts/verify-blueprint-protected-flows.mjs` (existence + export contracts; it does not execute the flows). Portability **timing is ❓ unverified — no measured duration exists**, so no seconds figure is claimed.
- [ ] **15. Bullseye GTM & affiliate engine** — 🟡 engine built for the operator; **Partner-Resell Kit re-points it at the customer** (active bet).

## Phase 5 — Operations, Security & Readiness (Steps 16–21)

- [ ] **16. AARRR + version beacon** — 🟡 `/api/version` live; GitHub star count unverifiable from this sandbox (`api.github.com` denied).
- [ ] **17. VC narrative** — ⬜ stage must stay disclosed as Zero → PSF.
- [ ] **18. Dual-license IP & secret hygiene** — 🟡 CI secret gates present; **edition gate NOT enforced at routes** (only auditor + status route call `evaluateFeatureGate`).
- [ ] **19. Solo-founder org** — 📄 as designed.
- [ ] **20. Open-core benchmarks** — ⬜ external benchmarking pending researcher report.
- [ ] **21. Data room** — ⬜ evidence exists in `plans/evidence/`.

## Phase 6 — Execution & Governance (Steps 22–25)

- [ ] **22. Quarterly OKRs** — 3 paid pilots / 500+ stars / 5 portability migrations. **Baseline 2026-10-17: 0 of each ❓.** Superseded as the operating plan by the three-stream 30/90/180 roadmap below; where they differ, the roadmap leads. Any reported number must state its baseline and measurement date.
- [ ] **23. Founder operating review** — ⬜ cadence to be scheduled.
- [ ] **24. Responsible AI & PDPD** — 🧪 consent resolver verified present (`decodeConsentCookie` exported); PDPD compliance not audited ❓.
- [x] **25. Crisis rollback & SHA parity** — 🧪 doctrine documented (`docs/deployment-guide.md`); **live SHA parity ❓ unverified** — a deploy counts as verified only when `/api/version` `shortSha` matches the deployed commit bit-for-bit.

---

## Active Bet — Partner-Resell Kit (cross-cutting, Steps 6/7/11/14/15/22)

- [ ] Enforce edition feature gates at the routes the manifest names (**blocker 1**).
- [ ] Parameterize `affiliate_links` / `click_events` / `conversion_events` by real `tenant_id` (remove `/ref`'s hardcoded `'default'`).
- [ ] **Migration: add `tenant_id` to `affiliate_commissions`, `affiliate_payouts`, `affiliate_referrals`** — none carry it (migration `0452` gives them only `partner_id` / `referral_id` / `payout_id`). Backfill existing rows as `'default'`; back up D1 first. Without this, a customer's commission ledger is inseparable from Sophia's own and cross-tenant sweeps pay out wrong.
- [ ] Customer-facing partner management surface inside the workspace (Cloud-gated).
- [ ] Dual-rail payout orchestration behind the gate (Cloud-gated).
- [ ] **Founder decision:** affiliate payout rail — Stripe Connect vs PayOS/VietQR for VN operators (**blocker 2**).
- [ ] Fix manifest defect: `/dashboard/social-publisher` → `dashboard/publish`.
- [ ] Refresh README SHA badge (`d86659bf` stale vs head `73796ebd8`). *(README is outside this document set; recorded here as backlog only.)*

**Not done / not verified in this session:** live SHA parity, public repo star count, `docs/SELF_HOSTING.md`, lifecycle email sequences, and the two inbound external-research reports (open-core PLG wedge, VN affiliate channel).

---

## Three-stream strategy tasks (Cloud · Master · Community)

Targets are **targets, not forecasts**. Baseline 2026-10-17: **0 paying customers / $0 MRR**.
Master ($4,999 one-time) is **never** counted toward MRR.

| Stream | Owner | Target 30 days | Status |
|---|---|---|---|
| Cloud | Founder / CSO | 1 paying customer who activates and successfully produces a video | ❓ not started |
| Master | Founder / CSO | 1 deal at $4,999 meeting handover scope and passing acceptance | ❓ not started |
| Community | CMO | 5 non-founders who self-deploy and produce output | ❓ not started |

**Capacity — 25 founder hours/week:** 12 sales & demo · 7 technical verification & Master · 4 Community · 2 operations.

**Cash ceiling — $1,000 / 30 days:** $350 API & demo · $200 infrastructure & tools · $150 payment verification & fees · $300 reserve.
This is a ceiling, not a spend plan. No paid advertising before conversion is measured.

### Milestones / Mốc thực thi

- [ ] **Week 1** — standardize evidence; prepare the three bilingual (VI/EN) messages; build a 40-prospect list (20 Cloud, 10 Master, 10 Community).
- [ ] **Week 2** — 12 discovery calls and 6 demos; record current process, total cost, problem to solve, and willingness to pay for each.
- [ ] **Weeks 3–4** — run qualified pilots; support Community; record results per stream.
- [ ] **Day 90** — check Cloud renewal, Master support cost, Community → Cloud conversion.
- [ ] **Day 180** — scale only streams with usage, retention, and positive contribution evidence.

**Five priorities / Năm ưu tiên:**
1. **CEO / CTO** — standardize the three-stream strategy.
2. **Founder / CSO** — validate Cloud and Master.
3. **CMO** — validate Community.
4. **CTO** — close the technical gap blocking the Partner-Resell Kit.
5. **COO / CFO** — reconcile cash, cost, and acceptance.

---

## Payout & Partner-Resell acceptance conditions (backlog, not yet built)

**Status: technical goal / mục tiêu kỹ thuật — not operationally verified.** Automated VND + USDT payout is ❓ unverified. These are **backlog requirements for the payout implementation batch**; nothing below is enabled by this document update.

- [ ] **Tenant isolation** for partner, commission, ledger, credential, and withdrawal permission.
- [ ] **Commercial gate enforced on the money-sending path** — not only on the auditor and the status route.
- [ ] **VND uses a real payout API.** A CSV export or VietQR string is **not** proof that money moved. (payOS documents single and bulk payout APIs, but a customer account's payout permission is ❓ unconfirmed.)
- [ ] **USDT uses the customer's own NOWPayments account** with payout authentication retained. Remove the simulated-success branch and the fallback to system-wide credentials.
- [ ] **Automation enables only after the customer configures rules and limits.** `under_review` **holds** money; the workspace owner may act, and the reason and audit trail are stored. `suspended` is always blocked.
- [ ] **Retry reconciles an unknown-status transaction before re-sending**; confirm paid only on settlement evidence.
- [ ] **Master acceptance** requires explicit handover scope, a valid license, a successful customer deploy, and a completed operations and handover checklist.

**Blocker evidence (cited to tracked source):** `apps/sophia-ai-factory/src/tree/affiliates/ledger/payout-disbursement.ts:34,38` — `under_review` is advisory and only `suspended` stops money. `apps/sophia-ai-factory/src/tree/affiliates/risk-scorer.ts:192-199` — `resolvePartnerStatusAfterRisk` never returns to `active`, so a flagged partner has no automatic recovery path and a false positive blocks payment until a human intervenes.

**Cost caveat:** the customer's total cost includes Sophia fees **and** separate third-party API fees. HeyGen confirms its API is billed separately from the web plan.
