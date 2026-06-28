# Admin Operations GAP — Sophia AI Factory

**Date:** 2026-05-13  
**Scope:** Admin ops, handover, support, compliance tracking, workflow automation  
**Project:** `/Users/macbook/sophia-ai-factory`  
**Skill:** `admin-operations`  
**Verdict:** Product is heavily documented, but business operations still have several owner/procedure gaps before first customer and handoff.

---

## Executive Summary

Sophia has strong technical and handover coverage: production live, activation runbook, DR plan, secret rotation, observability runbook, bilingual customer handover pack, postmortem templates, and a reconciled 8-phase GAP plan.

Main admin-ops problem is not missing code. It is operational consistency:

1. Payment/pricing docs conflict across files.
2. Support workflow is documented but not operationalized into a ticket system.
3. Customer-facing SLA tiers are not finalized.
4. Human owner/action tracking is spread across `.mekong/tasks`, GAP phase files, runbooks, and handover docs.
5. Activation tasks require founder actions but lack one canonical checklist with evidence fields.

## Implemented 2026-05-13

- Aligned `docs/client-handover-sop.md` with current Sophia pricing and NOWPayments/PayOS billing.
- Replaced stale Vercel/Polar support references in `docs/support-escalation.md`.
- Marked `docs/webhook-configuration-guide.md` as legacy for Stripe/Polar and pointed customer billing to NOWPayments/PayOS.
- Added admin-ops source-of-truth docs under `docs/admin-ops/` for pricing/payment, activation, support tickets, vendors, compliance, and first-customer close.
- Aligned customer-facing support contact across app UI, outbound email templates, and root docs to `support@mekongmind.com`.
- Updated customer-facing billing guidance in `docs/user-flow.md` and `docs/troubleshooting.md` from legacy Polar/credit-card wording to NOWPayments + PayOS flows.
- Updated app build scripts to use `next build --webpack`; default Next 16/Turbopack build was timing out locally, while webpack build passes.
- Ran `npm audit fix`; high/critical advisories are cleared. Two moderate `next`/nested `postcss` advisories remain because npm only offers `npm audit fix --force`, which downgrades Next to 9.3.3.
- Verified local green pipeline with `npm run verify:green`: i18n pass, type-check pass, 203/204 test files pass, 2055 tests pass, critical audit pass, production build pass.
- Verified current production: HTTP/2 200 and `/api/health` healthy, sha `8d525481b1eb4b0b17f5f7791a248de2bdce90c9`.
- Ran standalone `npm run lint` after moving ignores into `eslint.config.mjs` and increasing Node heap. It no longer OOMs, but still surfaces a pre-existing lint backlog: 300 errors and 189 warnings (489 total problems). `verify.sh` still skips lint, so this is a quality blocker outside the current green pipeline.

Remaining launch blockers are operational evidence items, not known documentation contradictions.

---

## Evidence Read

- `README.md`
- `CLAUDE.md`
- `.mekong/company.json`
- `.mekong/tasks/*.md`
- `docs/client-handover-sop.md`
- `docs/sophia-activation-runbook.md`
- `docs/observability-runbook.md`
- `docs/secret-rotation-runbook.md`
- `docs/disaster-recovery.md`
- `docs/support-escalation.md`
- `docs/handover/README.md`
- `/Users/macbook/plans/260510-0603-sophia-gap-plan/plan.md`
- `/Users/macbook/plans/260510-0603-sophia-gap-plan/phase-08-team-process.md`
- `/Users/macbook/plans/260510-0603-sophia-gap-plan/HANDOFF-RECONCILIATION-260512.md`

---

## GAP Matrix

| ID | Area | Current State | Gap | Severity | Owner |
|---|---|---|---|---|---|
| ADM-01 | Payment docs | README and `.mekong/company.json` say NOWPayments + PayOS; some handover/support docs still mention Polar/Vercel/Supabase | Customer/operator confusion during billing/support | P0 | Founder + Ops |
| ADM-02 | Pricing docs | README says BASIC $199, PREMIUM $399, ENTERPRISE $799, MASTER $4,999; `docs/client-handover-sop.md` says Starter $49/Growth $149/Premium $499/Master $999 and Polar | Sales/handover quote mismatch | P0 | Founder |
| ADM-03 | Support workflow | `docs/support-escalation.md` exists; Phase 08 says provider still not chosen | No real ticket queue, SLA tracking, or handoff owner | P1 | Ops |
| ADM-04 | SLA tiers | Support doc has generic SLA; Phase 08 asks for customer-visible tier SLAs | Paid tier promise unclear | P1 | Ops + Sales |
| ADM-05 | Activation checklist | Activation runbook has phases/secrets; GAP reconciliation has pickup steps | No single operator checklist with status, date, evidence link | P1 | Ops |
| ADM-06 | Compliance tracking | Legal handover docs exist; Stripe/Polar legacy docs still present | Compliance source of truth ambiguous | P1 | Legal/Ops |
| ADM-07 | Vendor management | Vendors listed across docs: Cloudflare, NOWPayments, PayOS, Resend, HeyGen, ElevenLabs, MuAPI, OpenRouter, Better Stack, PostHog, Sentry | No vendor owner, renewal, risk, status, credential rotation table in one place | P1 | Ops |
| ADM-08 | First customer workflow | `.mekong/tasks/01-first-paying-customer.md` ready; handover pack ready | No CRM/ticket stage tracker for lead → demo → payment → BYOK → first video | P1 | Sales/Ops |
| ADM-09 | Audit trail | Postmortem and audit logs exist technically | Business actions like support provider choice, partner outreach, launch execution lack audit trail template | P2 | Ops |
| ADM-10 | Bus factor | Phase 08 says solo founder + docs; contractor hire deferred | Support agent JD/provider not done | P2 | Founder |

---

## Critical Mismatches To Fix First

### ADM-01 / ADM-02 — Payment + Pricing Consistency

Canonical current state appears to be:

- Payment: NOWPayments primary, PayOS backup for Vietnam.
- Polar rejected/removed for Sophia.
- Tiers: BASIC $199, PREMIUM $399, ENTERPRISE $799, MASTER $4,999.

Conflicting docs found:

- `docs/client-handover-sop.md`: says Polar.sh and $49/$149/$499/$999.
- `docs/support-escalation.md`: mentions Vercel SLA and third-party issues from Polar/Supabase/Vercel.
- `docs/user-flow.md`, `docs/user-guide-visual.md`, `docs/webhook-configuration-guide.md`: still contain Polar/Stripe references.

Action:

- Create one canonical `docs/admin-ops/payment-pricing-source-of-truth.md`.
- Update customer-facing handover docs to NOWPayments + PayOS only.
- Move legacy Polar/Stripe docs to archive or mark deprecated at top.

### ADM-03 / ADM-04 — Support Ops Not Live

Docs define severity and response windows, but no tool/system is selected. Phase 08 already names this unresolved.

Action:

- Pick one support system for first 10 customers: Crisp is simplest, Plain is cleaner for B2B support, self-host is premature.
- Create support queues: `billing`, `byok-setup`, `video-generation`, `bug`, `feature-request`.
- Add SLA by tier:
  - BASIC: 24 business hours
  - PREMIUM: 12 business hours
  - ENTERPRISE: 4 business hours
  - MASTER: 2 business hours / priority Telegram

### ADM-05 — Activation Checklist Needs Evidence Fields

`docs/sophia-activation-runbook.md` is good, but founder tasks need completion evidence.

Action:

Create `docs/admin-ops/activation-checklist.md` with columns:

| Task | Owner | Status | Date | Evidence |
|---|---|---|---|---|
| GH secrets provisioned | Founder | TODO | | Actions link |
| CF secrets provisioned | Founder | TODO | | `wrangler secret list` screenshot or command output |
| Better Stack monitor live | Founder | TODO | | monitor URL |
| PostHog URL allowlist set | Founder | TODO | | settings screenshot |
| D1 restore drill done | Ops | TODO | | report path |
| First customer demo done | Sales | TODO | | CRM/ticket link |

---

## Recommended Admin Ops Sprint

### Day 1 — Canonical Docs

- [ ] Fix `docs/client-handover-sop.md` pricing/payment.
- [ ] Fix `docs/support-escalation.md` infrastructure/provider wording.
- [ ] Mark legacy `docs/webhook-configuration-guide.md` as deprecated or split Stripe Connect KYC from old Polar billing.
- [ ] Add `docs/admin-ops/payment-pricing-source-of-truth.md`.

### Day 2 — Support System

- [ ] Choose Crisp or Plain.
- [ ] Configure support email or widget.
- [ ] Create queue labels and severity tags.
- [ ] Publish customer-visible SLA page.

### Day 3 — Activation Control

- [ ] Add activation checklist with evidence fields.
- [ ] Run D1 restore dry-run and attach report.
- [ ] Verify Better Stack/PostHog/Sentry active status.
- [ ] Record all owner actions in one admin-ops tracker.

### Day 4 — First Customer Ops

- [ ] Convert `.mekong/tasks/01-first-paying-customer.md` into CRM stages.
- [ ] Create demo checklist: signup → BYOK → first video → payment → 7-day login.
- [ ] Create first-customer support macro pack.

### Day 5 — Vendor + Compliance Register

- [ ] Create vendor register.
- [ ] Create compliance obligation tracker.
- [ ] Assign owner + review cadence.

---

## SOPs To Create

1. `docs/admin-ops/payment-pricing-source-of-truth.md`
2. `docs/admin-ops/activation-checklist.md`
3. `docs/admin-ops/support-ticket-sop.md`
4. `docs/admin-ops/vendor-register.md`
5. `docs/admin-ops/compliance-obligation-register.md`
6. `docs/admin-ops/first-customer-close-sop.md`

---

## Decision Log Needed

| Decision | Options | Recommended |
|---|---|---|
| Support provider | Crisp / Plain / self-host | Crisp until 10 customers, Plain after B2B volume |
| Payment source of truth | NOWPayments+PayOS / Stripe / Polar | NOWPayments+PayOS for customer billing; Stripe Connect only affiliate payout/KYC if still required |
| SLA tiers | Generic / tiered | Tiered, published |
| CRM | Spreadsheet / Linear / HubSpot | Start spreadsheet or Linear labels, migrate later |
| Vendor register owner | Founder / Ops contractor | Founder now, contractor after first hire |

---

## Success Criteria

- Zero customer-facing docs mention Polar for Sophia billing.
- One canonical pricing/payment page controls all handover wording.
- Support provider chosen and linked from customer docs.
- Activation checklist has evidence for every founder action.
- First customer workflow has owner, stage, date, and next action.
- Vendor register covers all production third parties with owner and rotation cadence.

---

## Unresolved Questions

1. Support provider choice: Crisp, Plain, or self-host?
2. Should Stripe Connect remain only for affiliate payout/KYC, or be removed from Sophia docs until needed?
3. Which pricing is final for customer-facing docs: BASIC/PREMIUM/ENTERPRISE/MASTER at $199/$399/$799/$4,999?
4. Should the first customer pipeline live in Linear, a spreadsheet, or a lightweight CRM?
