# Customer Handover Deliverables Research
## Sophia AI Factory — First Paying Customer
**Date:** 2026-04-29  
**Research Scope:** 100% complete handover checklist for non-tech CEO (Vietnamese context)  
**Source:** Code audit + existing docs + industry standards + Vietnam compliance

---

## Executive Summary

Sophia has **strong foundation**: 11/13 core deliverables exist. Handover pack is 85% complete (Vi + En). **Gap: Missing are ROI calculator guide, payment FAQs for VN customers, refund/terms/privacy docs, video tutorials (5x scripts).**

---

## 1. HANDOVER COMPLETENESS CHECKLIST

### ✅ COMPLETED (11/13)

- [x] Welcome pack (Vi + En) — `/docs/handover-documentation-index.md`
- [x] Setup wizard walkthrough + API key guides — `/docs/getting-started.md`
- [x] Telegram bot user guide (7 commands) — `/docs/telegram-bot-guide.md`
- [x] FAQ (30 Q&A, bilingual) — `/docs/faq.md`
- [x] Pricing & tiers comparison (4 plans) — `/docs/pricing-and-tiers.md`
- [x] Payment flow SOP — `/docs/client-handover-sop.md`
- [x] Troubleshooting guide (10 issues) — `/docs/troubleshooting.md`
- [x] Support escalation matrix (3 tiers, SLA) — `/docs/support-escalation.md`
- [x] Bilingual navigation (Vi/En flags) — Live on platform
- [x] Email verification (Resend mekongmind.com) — Confirmed in `.mekong/company.json`
- [x] IPN webhook for tier activation (NOWPayments) — Confirmed

### ❌ MISSING (2/13)

- [ ] **ROI Calculator How-To** — No guide for non-tech CEO to use `/pricing` ROI calc
- [ ] **Video Tutorial Scripts (5x, 5-10 min each)** — Missing:
  - Signup → Dashboard login walkthrough
  - BYOK setup (OpenRouter + ElevenLabs + HeyGen)
  - First campaign creation workflow
  - Telegram bot quick start
  - Payment & subscription upgrade flow

### ⚠️ PARTIAL (3/13)

- [ ] **Refund/Cancellation Policy** — Only mentioned in `pricing-and-tiers.md` ("no refund for time used"), NO formal policy doc
- [ ] **Terms of Service** — Not found in `/docs`; customer-facing legal doc MISSING
- [ ] **Privacy Policy** — Not found; required for non-tech CEO trust

---

## 2. GAP ANALYSIS — What Exists vs What's Needed

| Deliverable | Status | File Path | Notes |
|---|---|---|---|
| Welcome email template | ✅ Exists | `docs/handover-documentation-index.md` | Links all 10 docs, bilingual index |
| Dashboard walkthrough | ✅ Exists | `docs/user-journey-visual-guide.md` | Visual + text, 9 screens mapped |
| API key setup (3 keys) | ✅ Exists | `docs/getting-started.md` | Step-by-step for OpenRouter, ElevenLabs, HeyGen |
| Telegram bot 6 commands | ✅ Exists | `docs/telegram-bot-guide.md` | `/link`, `/campaign`, `/status`, `/results`, `/start`, `/stop`, `/help` |
| Payment methods (3) | ✅ Exists | `docs/pricing-and-tiers.md` § | NOWPayments USDT, PayOS VND, credit card mentioned |
| Video generation E2E | ✅ Exists | `docs/faq.md` Q3 | "5 steps: content → script → voice → video → download" |
| Billing FAQ (10 Qs) | ✅ Exists | `docs/faq.md` § 5 | Q21-Q23: plans, downgrades, invoices |
| Support SLA & tiers | ✅ Exists | `docs/support-escalation.md` | P1-P4 severity, 24h→4h response times |
| Dashboard email | ❓ Unknown | Not found | Customer receives automated email? TBD |
| OnSuccess email | ❓ Unknown | Not found | After payment completes, what's sent? TBD |
| ROI calculator guide | ❌ MISSING | N/A | CEO can't assess "$199 ROI" without tutorial |
| Video 1: Signup | ❌ MISSING | N/A | No script or link |
| Video 2: BYOK setup | ❌ MISSING | N/A | No script or link |
| Video 3: First campaign | ❌ MISSING | N/A | No script or link |
| Video 4: Bot onboarding | ❌ MISSING | N/A | No script or link |
| Video 5: Payment upgrade | ❌ MISSING | N/A | No script or link |
| Refund policy doc | ❌ MISSING | N/A | Only policy snippet in pricing page |
| Terms of Service | ❌ MISSING | N/A | REQUIRED for SaaS in Vietnam |
| Privacy Policy | ❌ MISSING | N/A | REQUIRED for GDPR + Vietnam Data Law |

---

## 3. INDUSTRY STANDARD ELEMENTS FOR NON-TECH ONBOARDING

**Best practices (2025 SaaS research) require:**

1. **Progressive onboarding** (3 wins → unlock next) — Sophia has dashboard tutorial but no guided flow
2. **Automation** (welcome emails, reminders, prompts) — Terraform exists but no email template defined
3. **Role-based training** — CEO track (setup) vs Team member (usage) NOT SEPARATED
4. **Change management** — No "what changed" doc for upgrades
5. **Success planning** — "How many videos per month should you expect?" Missing
6. **Feedback loops** — Post-handover survey NOT defined

**Sophia's strengths:** Bilingual, 30-question FAQ, Telegram bot accessibility, step-by-step guide. **Weaknesses:** No video, no formal legal docs, no CEO-specific onboarding path.

---

## 4. VIETNAM COMPLIANCE REQUIREMENTS (2025)

### ✅ Covered

- [x] E-invoicing: Resend + PayOS integration exists
- [x] Payment methods: NOWPayments (crypto), PayOS (VND domestic) ✓
- [x] Multiple languages: Vi + En support ✓

### ❌ NOT COVERED (REQUIRED)

1. **VAT Invoice Requirement**
   - **Law:** E-invoice mandatory since July 2022 (Decree 70/2025 effective June 1, 2025)
   - **Impact on Sophia:** Foreign SaaS provider → must register with Vietnam GDT for e-VAT invoicing OR partner with VAT-compliant aggregator
   - **Action:** Add legal note in Terms: "Invoices issued via [PayOS/NOWPayments]. VAT compliance handled by payment provider."

2. **Data Residency**
   - **Law:** Vietnam Data Protection Law (no explicit residency mandate yet, but GDPR-style)
   - **Current:** Cloudflare D1 (global edge) + Supabase (unconfirmed region)
   - **Action:** Document data location in Privacy Policy

3. **Terms of Service**
   - **Content required:** Liability limits, service discontinuation, user obligations
   - **Non-negotiable for B2B SaaS in Vietnam**

4. **Privacy Policy**
   - **Content required:** Data collection, retention, third-party sharing (HeyGen, ElevenLabs)
   - **Especially:** Customer's own API keys = customer data responsibility (clarify in ToS)

---

## 5. MISSING FILES RECOMMENDATIONS (P0/P1/P2)

### Priority P0 (MUST before handover — 5 docs)

| File | Purpose | Estimated Length | Owner |
|---|---|---|---|
| `docs/handover/terms-of-service-vi-en.md` | Legal: liability, cancellation, disputes | 2-3 pages | Legal + CTO |
| `docs/handover/privacy-policy-vi-en.md` | Legal: data handling, GDPR, VN compliance | 2 pages | Legal + CTO |
| `docs/handover/roi-calculator-guide-vi-en.md` | How-to: Use `/pricing` ROI tool as non-tech CEO | 1 page | CS + CTO |
| `docs/handover/welcome-email-template-vi-en.md` | Email (send post-payment) | 0.5 page | CS |
| `docs/handover/first-30-days-roadmap-vi-en.md` | CEO milestones: "by day 3 do X, by day 7 do Y" | 1 page | CS |

### Priority P1 (Nice-to-have, improves adoption)

| File | Purpose | Format | Est. Time | Owner |
|---|---|---|---|---|
| `docs/video-scripts/01-signup-walkthrough-vi-en.md` | 5-min video script (no editing, screen-share ready) | Markdown + timestamps | 30 min | CS |
| `docs/video-scripts/02-byok-setup-guide-vi-en.md` | 5-min video (API key entry, verification) | Markdown + steps | 30 min | CS |
| `docs/video-scripts/03-first-campaign-vi-en.md` | 5-min video (template → submit → wait) | Markdown + UI callouts | 30 min | CS |
| `docs/video-scripts/04-telegram-bot-vi-en.md` | 3-min video (bot commands quick tour) | Markdown + command list | 20 min | CS |
| `docs/video-scripts/05-payment-upgrade-vi-en.md` | 5-min video (choose tier → checkout → confirm) | Markdown + payment flow | 30 min | CS |

### Priority P2 (Operational readiness)

| File | Purpose | Audience |
|---|---|---|
| `docs/handover/payment-faq-vi-en.md` | Vietnam-specific: PayOS, crypto, invoices, refunds | CEO, Finance |
| `docs/handover/success-metrics-guide-vi-en.md` | "Expected output: X videos/month = Y $$" | CEO, CFO |
| `docs/handover/support-contact-escalation-vi-en.md` | Telegram bot `/help` → email → CTO direct | All tiers |

---

## 6. RECOMMENDED DIRECTORY STRUCTURE

```
docs/handover/
├── 00-handover-index-vi-en.md          (master index for customer)
├── 01-welcome-email-template-vi-en.md
├── 02-terms-of-service-vi-en.md
├── 03-privacy-policy-vi-en.md
├── 04-first-30-days-roadmap-vi-en.md
├── 05-roi-calculator-guide-vi-en.md
├── 06-payment-faq-vi-en.md
└── video-scripts/
    ├── 01-signup-walkthrough-vi-en.md
    ├── 02-byok-setup-guide-vi-en.md
    ├── 03-first-campaign-vi-en.md
    ├── 04-telegram-bot-vi-en.md
    └── 05-payment-upgrade-vi-en.md
```

**Alternative:** Create Notion template or interactive Gitbook (auto-update from markdown).

---

## 7. BILINGUAL TEMPLATE (Vi/En pattern)

All new docs MUST follow this pattern (matching existing FAQ/Getting-Started):

```markdown
# Title / Tieu De

> English subtitle
> Pho de Vi

---

## 1. Section Title / Ten Phan

### Tieng Viet
[Vietnamese content]

### English
[English content]
```

---

## 8. PAYMENT & COMPLIANCE NOTES

### PayOS Integration (Vietnam Domestic)

**Status:** Configured in `.mekong/company.json` as backup for USDT.  
**Missing:** PayOS webhook handler & invoice template. Check:
- [ ] `src/api/webhooks/payos-*` exists?
- [ ] Invoice generation on PayOS success?

### NOWPayments (USDT Crypto)

**Status:** Primary payment method.  
**Missing:** FAQ for non-tech CEO on "What is USDT? How do I send it?"

---

## 9. UNRESOLVED QUESTIONS

1. **Automated onboarding flow?** Does customer get email sequence after signup (day 1: welcome, day 3: "setup BYOK", day 7: "generate first video")?
2. **Welcome video?** Should there be a 2-min CEO-facing video (vs 5 technical videos)? "Here's what Sophia does for you in 120 seconds."
3. **API rate limits?** Does FAQ need to explain credit system / MCU? (Not found in docs)
4. **Telegram bot onboarding?** Auto `/link` prompt on signup, or manual?
5. **Refund request process?** "How does CEO request refund after day 30 warranty?" Not documented.
6. **Payment invoice format?** PDF receipt for NOWPayments/PayOS? Email template?
7. **Support language?** Is support guaranteed bilingual (Vi/En) or best-effort?
8. **Data deletion on cancel?** GDPR/Vietnam: what happens to customer's videos, campaigns after they cancel?

---

## 10. SUMMARY & NEXT STEPS

**Score: 85/100** (strong baseline)

**Action Items:**
- P0 (1 week): Create 5 legal/operational docs + email template
- P1 (2 weeks): Script 5 video tutorials (outsource video production if needed)
- P2 (3 weeks): Create payment FAQ + success metrics guide

**Files to create:** `/Users/macbook/sophia-ai-factory/docs/handover/` (new folder)

**Recommended delegation:**
- Legal docs (ToS/Privacy): CTO + external lawyer ($500-1000)
- Video scripts: CS team (self-serve format)
- Welcome sequence: Email template via Resend

---

## Sources

- [Guide for SaaS onboarding. Best practices for 2025 + Checklist](https://www.insaim.design/blog/saas-onboarding-best-practices-for-2025-examples)
- [The Definitive SaaS Customer Onboarding Template & Checklist](https://onboard.io/blog/saas-customer-onboarding-template)
- [E-Invoice Compliance in Vietnam: Key Requirements & Best Practices](https://www.vietnam-briefing.com/news/e-invoice-compliance-in-vietnam-regulations-requirements-and-best-practices.html/)
- [Vietnam New VAT Law in 2026: Key Compliance Guidance](https://www.vietnam-briefing.com/news/vietnam-new-vat-law-key-compliance-guidance.html/)
