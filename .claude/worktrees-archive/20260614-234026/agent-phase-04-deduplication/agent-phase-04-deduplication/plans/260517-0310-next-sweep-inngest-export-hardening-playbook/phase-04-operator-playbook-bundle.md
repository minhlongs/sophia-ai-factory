# Phase 04 — Operator Playbook Bundle (DOCS ONLY)

## Context Links

- Existing runbook: `apps/sophia-ai-factory/plans/.../phase-05-smoke-test.md` (operator smoke-test reference)
- `apps/sophia-ai-factory/CLAUDE.md` — BYOK + no-tech doctrine
- `apps/sophia-ai-factory/.claude/rules/sophia-handover-rules.md` — bilingual + non-tech CEO audience
- `apps/sophia-ai-factory/.claude/rules/sophia-no-tech-doctrine.md` — positioning
- Brand voice: TBD — operator hasn't formally documented, infer from existing marketing pages under `src/app/[locale]/(marketing)/`

## Overview

- **Priority:** P2 (operator enablement; revenue-adjacent)
- **Status:** pending
- **Effort:** S (~4-6h documentation)
- **Description:** Ship 4 operator-facing docs to enable Phase 05 (smoke test) execution + Phase 06 (paid launch) prep. NO CODE.

## Key Insights

1. **Audience: non-tech CEO operator** — bilingual (Vietnamese + English) per `sophia-handover-rules.md`. Step-by-step with emoji for clarity. Zero developer jargon in any client-facing portion.
2. **Phase 05 smoke walkthrough exists** as runbook (`phase-05-smoke-test.md`) but operator needs narrative version with screenshots-referenced + expected-error-scenarios. The runbook is "what to do"; the walkthrough is "what you'll experience".
3. **Pricing trial decision is hot** — operator asked between free-7d-trial vs $1-paid-trial; this matrix unblocks the Hero CTA copy choice for paid launch.
4. **Phase 06 prep checklist** must specify what data signals Phase 05 must EMIT before Phase 06 is unblocked. Without this, Phase 06 launches blind.
5. **Blog content brief** — 10 articles for SEO/content-marketing wedge. Operator owns publishing; planner provides skeleton.

## Requirements

### Functional

- F-01: 4 docs created under `docs/operator-playbook/`:
  - `smoke-test-walkthrough.md`
  - `blog-content-brief-10-articles.md`
  - `pricing-trial-decision-matrix.md`
  - `phase-06-prep-checklist.md`
- F-02: All client-facing portions bilingual (Vietnamese + English), per handover rules.
- F-03: Skeletons + TOC + section structure complete; operator fills in tactical details (account creds, budget specifics, brand-voice copy).
- F-04: Cross-links between docs where relevant (e.g., smoke walkthrough → phase-06 prep checklist).

### Non-functional

- NF-01: No technical jargon in customer-facing portions.
- NF-02: Each doc <500 lines; well-structured with TOC + section anchors.
- NF-03: Emoji for non-tech clarity (per rules).

## Architecture (Doc Bundle Layout)

```
docs/operator-playbook/
├── README.md                                    ← (optional 1-pager index linking all 4)
├── smoke-test-walkthrough.md                   ← narrative, screenshots-referenced
├── blog-content-brief-10-articles.md           ← title+hook+outline×10
├── pricing-trial-decision-matrix.md            ← free-7d vs $1-paid comparison
└── phase-06-prep-checklist.md                  ← data signals required pre-Phase-06
```

## Related Code Files

None. Docs only.

### Create

- `apps/sophia-ai-factory/docs/operator-playbook/smoke-test-walkthrough.md`
- `apps/sophia-ai-factory/docs/operator-playbook/blog-content-brief-10-articles.md`
- `apps/sophia-ai-factory/docs/operator-playbook/pricing-trial-decision-matrix.md`
- `apps/sophia-ai-factory/docs/operator-playbook/phase-06-prep-checklist.md`
- (optional) `apps/sophia-ai-factory/docs/operator-playbook/README.md` — index

### Do NOT touch

- Any source code.
- Existing runbook `phase-05-smoke-test.md` — referenced, not modified.

## Implementation Steps

### Step 1: `smoke-test-walkthrough.md`

**TOC skeleton:**
- Section 1: Mục tiêu / Purpose (bilingual, 1 paragraph each)
- Section 2: Trước khi bắt đầu / Before You Start
  - Required: Cloudflare access (operator already has), email for NOWPayments staging signup
  - Time: 60-90 minutes hands-on
  - Budget: $30 / $60 / $100 tier comparison table (see Section 6)
- Section 3: NOWPayments Staging Account Setup
  - Step 1: Sign up at sandbox.nowpayments.io
  - Step 2: Create test API key
  - Step 3: Note IPN secret (you will need this in Sophia env)
  - Step 4: Add staging USDT-TRC20 address (NOWPayments provides test wallet)
- Section 4: BYOK Key Entry UX Walkthrough
  - Where: Setup Wizard at `https://sophia.agencyos.network/onboarding`
  - Sub-step 4.1: Enter OpenRouter key (screenshot ref: `wizard-step-1.png`)
  - Sub-step 4.2: Enter ElevenLabs key (screenshot ref: `wizard-step-2.png`)
  - Sub-step 4.3: Enter D-ID / HeyGen key (screenshot ref: `wizard-step-3.png`)
  - Sub-step 4.4: Enter NOWPayments key (use staging key from Section 3)
  - Validation: "Verify Setup" button → all 4 keys show green check
- Section 5: Run a Test Campaign
  - Trigger: `/campaign` in Telegram bot OR Mission "video:create" in dashboard
  - Expected duration: 3-5 min for HeyGen video
  - Expected output: Telegram bot DM with video link
- Section 6: Budget Tier Comparison Table
  - $30 tier: 5 test videos, 10 leads, 1 paid trial completed end-to-end
  - $60 tier: 10 test videos, 30 leads, 3 paid trials
  - $100 tier: 20 test videos, 100 leads, 10 paid trials + 1 email blast (Resend test)
- Section 7: Expected Error Scenarios + Recovery
  - "Invalid API key" → re-enter in wizard
  - "NOWPayments IPN timeout" → check IPN secret + retry
  - "HeyGen quota exceeded" → check tier or wait
  - "Telegram bot not responding" → re-bind via /start
- Section 8: Post-Test Key Revocation Checklist
  - Revoke OpenRouter test key in OpenRouter dashboard
  - Revoke ElevenLabs / D-ID / HeyGen keys
  - Revoke NOWPayments staging key
  - Clear BYOK store via Settings → Reset Keys

### Step 2: `blog-content-brief-10-articles.md`

**TOC skeleton:**
- Intro: 1 paragraph on operator brand voice (placeholder for operator to define)
- 10 article briefs in table:

| # | Title | 1-line Hook | 3-bullet Outline | Target Keyword | Journey Stage |
|---|---|---|---|---|---|
| 1 | "Faceless YouTube ROI in 2026: AI vs Hand-Edit" | What if a $0.10 AI video out-earns your $200 freelance edit? | • Cost comparison<br>• Velocity comparison<br>• Case study placeholder | "faceless youtube AI" | TOFU |
| 2 | "Why I Stopped Outsourcing My Affiliate Videos" | Story-driven; founder voice. | • The $5k/mo VA bill<br>• Switching to AI factory<br>• Results month 1 | "automate affiliate videos" | TOFU |
| 3 | "5 Affiliate Niches With 30%+ Margins in 2026" | Data-driven listicle. | • Niche 1-5 with margin %<br>• Why each works<br>• How Sophia detects them | "best affiliate niches 2026" | TOFU |
| 4 | "BYOK vs Managed: Why Sophia Doesn't Hold Your Keys" | Trust-building, no-tech doctrine positioning. | • Industry default = managed<br>• Sophia's BYOK model<br>• Customer control argument | "byok ai platform" | MOFU |
| 5 | "Setting Up Your First Sophia Campaign in 15 Minutes" | How-to. | • Wizard walkthrough<br>• First campaign trigger<br>• Reading results | "sophia ai factory tutorial" | MOFU |
| 6 | "USDT Payments for SaaS: Why Crypto Beats Stripe for Faceless" | Founder POV on payment rails. | • Stripe holds on suspicion<br>• USDT-TRC20 instant<br>• NOWPayments tradeoffs | "crypto payment saas" | MOFU |
| 7 | "From $0 to $1k MRR With One Affiliate URL: A Sophia Walkthrough" | Case study format. | • Starting point<br>• Sophia execution<br>• Month-by-month MRR | "url to revenue automation" | BOFU |
| 8 | "Comparing Sophia to Jasper / Synthesia / HeyGen" | Honest comparison page. | • Each tool's sweet spot<br>• Sophia's wedge<br>• Pricing math | "sophia vs synthesia" | BOFU |
| 9 | "10 Mistakes New Faceless Channel Operators Make" | Listicle for engagement. | • Top mistakes<br>• Fixes per mistake<br>• How Sophia prevents each | "faceless channel mistakes" | TOFU |
| 10 | "Behind the Scenes: How Sophia Picks Your Next Video Topic" | Transparency / product depth. | • Trend detection<br>• Niche-fit algo<br>• Override controls | "ai content topic selection" | MOFU |

- Footer: instructions for operator to fill in actual outlines + CTA per stage.

### Step 3: `pricing-trial-decision-matrix.md`

**TOC skeleton:**
- Section 1: TL;DR — operator's pick (placeholder)
- Section 2: Free 7-day Trial — model details
- Section 3: $1 Paid Trial — model details
- Section 4: Decision Matrix Table

| Criterion | Free 7d | $1 Paid |
|---|---|---|
| Conversion lift to paid (assumed) | baseline | +20-40% per published studies (placeholder cite) |
| CAC payback (months) | 3-4 (longer free funnel) | 1-2 (immediate cash) |
| Refund-rate risk | LOW (no cash collected) | MED (chargeback surface, esp. crypto) |
| Fraud surface | MED (free-tier abuse) | LOW (any payment = signal of intent) |
| Churn risk at trial end | HIGH (forgot-to-cancel) | LOW (already on file) |
| Onboarding pressure | LOW (try in own time) | MED (must extract value in 7d) |
| Brand perception | "Generous" | "Confident in value" |

- Section 5: Hero CTA Copy Variants
  - For Free 7d: "Try Sophia free for 7 days — no card required" (VI: "Dùng thử miễn phí 7 ngày — không cần thẻ")
  - For $1 Paid: "Start your $1 trial — full access for 7 days" (VI: "Bắt đầu chỉ với $1 — truy cập toàn bộ trong 7 ngày")
  - For hybrid (operator pick): "Pay $1 to skip the line — or join the free waitlist" (split test)
- Section 6: Recommendation Framework
  - If goal = volume → Free 7d
  - If goal = quality + cash flow → $1 Paid
  - If goal = data on intent → Split test 50/50 first 200 signups, decide based on conversion

### Step 4: `phase-06-prep-checklist.md`

**TOC skeleton:**
- Section 1: Phase 06 = Paid Launch Definition
- Section 2: Phase 05 Output Signals Required (gates)
  - Gate G-1: ≥3 end-to-end test campaigns completed (full chain: URL → video → publish → tracking link click)
  - Gate G-2: ≥1 NOWPayments staging payment cleared end-to-end (signup → checkout → tier upgrade)
  - Gate G-3: ≥1 Telegram bot user completed `/campaign` + received result without manual intervention
  - Gate G-4: Sentry error rate <0.5% per request over 24h smoke window
  - Gate G-5: Operator confidence: subjective "would-pay-myself" check
- Section 3: Pre-Launch Operational Checklist
  - [ ] Production NOWPayments key swapped (staging → prod)
  - [ ] IPN webhook URL pointed at `https://sophia.agencyos.network/api/payments/nowpayments/ipn`
  - [ ] Telegram bot in production mode (`@Sophia_Bbot`)
  - [ ] DMARC `p=quarantine` evaluation (per doctrine, optional)
  - [ ] Pricing page reflects chosen trial model (output from Phase 04 doc 3)
  - [ ] Blog has ≥3 articles published from content brief
  - [ ] Smoke test docs (Phase 04 doc 1) reviewed + screenshots embedded
- Section 4: Launch Day Runbook
  - T-2h: Final smoke test on prod
  - T-1h: Operator stands by Telegram + Sentry
  - T-0: Launch tweet/email blast
  - T+1h: First-hour metrics check
  - T+24h: 24-hour metrics review + go/no-go for scaling ads
- Section 5: Rollback Criteria
  - If Sentry error rate >5% in first hour → freeze sign-ups, halt ads
  - If NOWPayments IPN fail rate >10% → switch to manual tier-grant mode
  - If support volume >10/hr (operator solo bandwidth) → close signups, batch process

### Step 5: (Optional) `README.md` index

- 1-pager linking to all 4 docs with 1-line description each.

## Todo List

- [x] Create `docs/operator-playbook/` directory if missing
- [x] Write `smoke-test-walkthrough.md` (8 sections, bilingual VI+EN)
- [x] Write `blog-content-brief-10-articles.md` (10-row table)
- [x] Write `pricing-trial-decision-matrix.md` (6 sections incl. CTA variants)
- [x] Write `phase-06-prep-checklist.md` (5 sections incl. launch runbook)
- [x] Optional: write `README.md` index
- [x] Cross-link the 4 docs (smoke walkthrough → phase-06 checklist; pricing matrix → blog brief Article #4)
- [x] Verify all client-facing portions are bilingual
- [x] No source code changes; no deploy needed
- [x] Update `docs/development-roadmap.md` with Phase 04 status

## Success Criteria

- 4 docs exist under `docs/operator-playbook/`, all rendering correctly in markdown preview.
- Bilingual sections present where the rules require (smoke walkthrough customer-facing portions, CTA copy).
- Cross-links functional (relative paths).
- Operator can hand any of these 4 docs to a VA without further explanation.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Brand voice mismatch (operator hasn't formalized) | HIGH | LOW | Planner provides placeholders; operator fills tactical voice |
| Bilingual translation drift | MED | MED | Operator reviews VI sections; planner provides initial pass |
| Screenshots referenced but not captured | HIGH | LOW | Doc references screenshot filenames; operator captures during Phase 05 smoke test |
| Phase 06 gate criteria too strict → launch delayed | MED | LOW | Operator can override individual gates if signal is qualitatively clear |
| Blog brief topics overlap competitors | LOW | LOW | Operator owns final topic selection; brief is starting point |

## Security Considerations

- All docs are public-safe (no secret keys, no internal infra paths beyond what's already in CLAUDE.md).
- No PII in any doc.
- Screenshot references must NOT include screenshots showing real API keys (operator instructed to redact during capture).

## Next Steps

- Phase 04 docs unblock Phase 05 (smoke test execution by operator).
- Phase 05 results feed Phase 06 prep checklist gate evaluation.
- After Phase 06 launch, feedback may revise pricing matrix → doc 3 becomes living document.
- Blog brief Article #1 should publish before Phase 06 launch (TOFU funnel pre-warming).
