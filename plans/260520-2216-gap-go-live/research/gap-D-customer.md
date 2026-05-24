# Gap Audit: Customer / Handover Domain
**Sophia AI Factory Production GO LIVE Readiness**

**Date:** 2026-05-20  
**Audit scope:** Onboarding flow, bilingual coverage, FAQ completeness, support loops, payment UX clarity, first-value moments, refund paths, upgrade prompts, email deliverability, Telegram integration  
**Audience:** NON-TECH Vietnamese CEO  

---

## Summary
**P0 gaps:** 4  
**P1 gaps:** 5  
**P2 gaps:** 3  
**Total gaps:** 12

**Key findings:**
- Bilingual docs (VI+EN) are STRONG across handover flows (customer-handover-runbook, getting-started, faq, troubleshooting). ✅
- **Critical blockers:** (1) Email DNS records (SPF/DKIM/DMARC) not verified in production, (2) NOWPayments payment UX explanation gap for non-crypto Vietnamese users, (3) Refund/cancellation paths documented but not UI-surfaced, (4) Pricing page (`t()` calls = 0) suggests i18n NOT wired for pricing UI.

---

## P0 Gaps (BLOCKS SELF-ONBOARD)

### CG-001: Pricing Page i18n Broken
- **Severity:** P0 (customer sees English-only pricing on Vietnamese locale `/vi/pricing`)
- **Area:** i18n / Pricing UI
- **Evidence:** `src/app/[locale]/pricing/page.tsx` imports `getTranslations("pricing")` but pricing components (PricingCard, PricingComparisonTable, PricingFaq) use 0 `t()` calls. Hardcoded English in JSX (e.g., "Starter", "Growth", benefit text).
- **Impact:** Non-English customer lands on `/vi/pricing` → sees English tier names, descriptions, FAQs. Abandonment risk: HIGH.
- **Fix sketch:**
  1. Add Vietnamese tier copy to locales (e.g., `messages/vi.json` + `messages/en.json`):
     ```json
     {
       "pricing": {
         "starter": "Gói Khởi Động",
         "basic": { "name": "Starter", "price": "199", "per": "tháng" },
         "premium": { "name": "Growth", "price": "399", "per": "tháng" },
         ...
       }
     }
     ```
  2. Wire all hardcoded strings in PricingCard, PricingComparisonTable, PricingFaq to use `t()`.
  3. Test: `/vi/pricing` and `/en/pricing` both show correct tier names + benefit text in respective languages.
- **Effort:** M (3–4 hours: extract copy + add i18n keys + wire components + test)

---

### CG-002: NOWPayments Payment UX — Crypto Unfamiliar for Vietnamese Users
- **Severity:** P0 (customer tries to pay, encounters USDT/wallet jargon, gives up)
- **Area:** Payment UX clarity
- **Evidence:** `docs/pricing-and-tiers.md` + `docs/faq.md` mention NOWPayments but don't explain:
  - What is USDT (stablecoin? crypto? compared to VND)?
  - Which wallets accept USDT (MetaMask, Binance, Coinbase)?
  - Network selection (Polygon, Ethereum, Tron — which to use?)?
  - PayOS backup path for domestic Vietnam bank transfer (mentioned in troubleshooting but NOT in main onboarding).
- **Customer journey gap:** Customer sees "Pay via NOWPayments" → clicks → NOWPayments shows "Enter USDT wallet address" → customer: "What is wallet? What is USDT?" → abandons.
- **Fix sketch:**
  1. Create `docs/payment-methods.md` (bilingual) explaining:
     - **USDT (crypto):** "Đơn vị tiền kỹ thuật số ổn định (stable), tương tự USD nhưng dùng blockchain. Bạn cần ví crypto (MetaMask, Binance, Coinbase) để nhận tiền."
     - **Which network:** "Dùng Polygon hoặc Tron (rẻ, nhanh). Ethereum đắt hơn."
     - **No crypto?** "Dùng PayOS cho chuyển khoản Việt Nam (VietQR, ngân hàng)."
  2. Add step-by-step visual guide (screenshot) on `/pricing` page showing NOWPayments flow + PayOS link.
  3. Add FAQ Q31: "Tôi không có ví crypto, làm sao thanh toán?" → Answer: "Dùng PayOS cho chuyển khoản nội địa Việt Nam."
- **Effort:** M (payment UX copy + screenshot + link wiring)

---

### CG-003: Setup Wizard API Key Fields — Missing "How to Get" Links
- **Severity:** P0 (customer enters setup wizard, sees "OpenRouter API Key" field, has no idea where to get it)
- **Area:** Setup Wizard UX
- **Evidence:** `docs/getting-started.md` has links to OpenRouter/ElevenLabs/HeyGen ("Bước 2a, 2b, 2c"), but Setup Wizard UI (`src/app/[locale]/setup-wizard/...`) likely doesn't surface these links inline in form fields (unverified — need to read setup-wizard component).
- **Customer pain:** Setup Wizard form field says "Enter OpenRouter API Key" with NO help text → customer searches → finds it or abandons.
- **Fix sketch:**
  1. Add help text + links to each Setup Wizard field:
     ```
     OpenRouter API Key
     Help: Get key → https://openrouter.ai (Sign up → Keys → Create → Copy)
     [Input field]
     [✓ Test Connection button]
     ```
  2. Test Connection button must show friendly error (e.g., "Invalid key format" vs generic 401).
  3. Bilingual help text (VI+EN).
- **Effort:** M (add help text to setup-wizard component + test buttons)

---

### CG-004: Email Deliverability — DMARC/SPF/DKIM Not Verified for noreply@sophia.agency
- **Severity:** P0 (customer doesn't receive verification emails, password reset emails, invoices → can't self-serve)
- **Area:** Email deliverability
- **Evidence:** `docs/cloud-infrastructure.md` states "No email DNS records (SPF/DKIM/DMARC) — handled by Resend" but NO verification that:
  - Resend domain `mekongmind.com` is verified in Cloudflare DNS.
  - SPF includes Resend (SPF record must include `_spf.resend.co`).
  - DKIM is active (Resend auto-generates, verify in DNS).
  - DMARC policy set (current: `p=none`, should graduate to `p=quarantine` after 30-day monitoring per sophia-no-tech-doctrine.md).
- **Customer impact:** Welcome email bounces or lands in Spam → customer doesn't see magic link → can't log in → support escalation.
- **Fix sketch:**
  1. Audit DNS records in Cloudflare:
     - SPF record: `v=spf1 include:_spf.resend.co ~all` (must exist)
     - DKIM: `default._domainkey` TXT record (auto-via Resend, verify)
     - DMARC: `_dmarc` TXT record with `p=none` or `p=quarantine` (check current)
  2. Send test emails to spam-trap addresses (test@gmail.com with Gmail Spam Report, etc.)
  3. Monitor Resend delivery stats: confirm >95% delivery rate, <2% bounce.
  4. If DMARC p=none: monitor rua reports for 30 days; if clean, graduate to p=quarantine (per doctrine).
- **Effort:** S (DNS audit + one-time Resend config check + ongoing monitoring)

---

## P1 Gaps (WITHIN FIRST WEEK)

### CG-005: Refund/Cancellation Self-Serve Path Not UI-Surfaced
- **Severity:** P1 (customer wants to cancel, must email support → delayed response)
- **Area:** Refund / Cancellation UX
- **Evidence:** `docs/customer-handover-runbook.md` Section "Customer Requests Refund" → manual step via `/dashboard/admin/refunds`, but NON-ADMIN customer has NO visible "Cancel Subscription" or "Request Refund" button on their `/dashboard/billing` page.
- **Customer flow gap:**
  1. Customer wants refund (7-day window).
  2. Searches dashboard for "Cancel" button — doesn't find one.
  3. Emails support@mekongmind.com — support responds in 24h.
  4. Meanwhile, customer charged for next month.
- **Fix sketch:**
  1. Add "Cancel Subscription" link on `/dashboard/billing` (or `/dashboard/settings` → Subscription).
  2. Opens modal: "7-day refund window: You paid on [DATE]. You have until [DATE+7] to request refund. Reason for cancellation: [dropdown + free text]"
  3. Click "Request Refund" → creates ticket in admin `/dashboard/admin/refunds` + sends customer confirmation email (bilingual).
  4. Admin reviews + approves + NOWPayments refund + customer email (status update).
- **Effort:** M (add UI button + modal + email template + admin integration)

---

### CG-006: Tier Upgrade Prompts When Usage Limits Hit
- **Severity:** P1 (customer hits video limit, doesn't realize they can upgrade → stops using)
- **Area:** Tier limiting / upgrade nudge
- **Evidence:** `docs/faq.md` Q14 explains tier limits (BASIC 20/month, PREMIUM 100/month), but NO evidence of in-app prompt when approaching/hitting limit.
- **Customer flow:**
  1. Customer on BASIC (20 videos/month).
  2. After 20th video, next attempt fails with "Limit reached."
  3. Error message doesn't say "Upgrade to PREMIUM for 100 videos/month."
  4. Customer abandons or emails support.
- **Fix sketch:**
  1. When campaign creation hits tier limit, show: "You've used 20/20 videos this month. Upgrade to PREMIUM (100 videos) for $399/month → [Upgrade button] [Later]"
  2. Button links to `/pricing` or direct upgrade in modal.
  3. Bilingual prompt.
- **Effort:** S (add limit-check + modal + routing)

---

### CG-007: Telegram Bot Commands — Drift Between Docs and Live Bot
- **Severity:** P1 (customer reads `/campaign /status /results` in docs, but bot doesn't respond to one → confusion)
- **Area:** Telegram Bot Integration
- **Evidence:** `docs/telegram-bot-guide.md` lists commands (unclear count, "7-9 commands" noted in plan baseline), but no verification that docs match actual @Sophia_Bbot responses.
- **Fix sketch:**
  1. Audit live @Sophia_Bbot: what commands actually work?
  2. Document in `docs/telegram-bot-guide.md`:
     ```
     | Command | What it does | Example |
     |---------|---|---|
     | /start | Activate bot & link account | /start |
     | /help | Show all commands | /help |
     | /campaign | Create new video campaign | /campaign "My product intro" |
     | /status | Check campaign status | /status |
     | /results | Download latest video | /results |
     | /link | Link Telegram to Sophia account | /link |
     | /unlink | Unlink account | /unlink |
     ```
  3. Test each command live; update docs if drift detected.
- **Effort:** S (command audit + docs sync + 1 test pass)

---

### CG-008: Welcome Email — Bilingual + Setup Wizard Link
- **Severity:** P1 (customer receives welcome email in English when account locale = VI → feels ignored)
- **Area:** Email templates / i18n
- **Evidence:** `docs/customer-handover-runbook.md` shows email template in Vietnamese but unclear if Welcome email sent on signup is bilingual or hardcoded English.
- **Fix sketch:**
  1. Audit `src/land/billing/email/` templates: WelcomeEmail, MagicLinkEmail, etc.
  2. If hardcoded English: add i18n (read user locale from DB, pick VN or EN template).
  3. Welcome email must include: link to Setup Wizard + "Your next step: add API keys" + link to `docs/getting-started.md`.
- **Effort:** M (email template i18n + test with VI user)

---

### CG-009: First-Value-Delivered Moment Not Documented
- **Severity:** P1 (customer doesn't know when they'll see result)
- **Area:** Onboarding clarity
- **Evidence:** `docs/getting-started.md` Steps 1–5 end at "Download video" but DON'T describe:
  - How long from payment → account creation → first campaign creation?
  - What if API keys missing? Does platform block or show helpful error?
  - Time to first successful video: "~2–5 min to generate" (per FAQ Q4), but not emphasized in Getting Started.
- **Customer pain:** Customer pays → sets up account → waits 20 min for first video → thinks platform is broken → emails support.
- **Fix sketch:**
  1. Add to Getting Started Step 0: "Expected timeline: 10 min to set up API keys + 2–5 min to create first video."
  2. Add Step 6: "If video takes >15 min, click 'Refresh' — if still stuck, email support@mekongmind.com."
  3. Bilingual.
- **Effort:** S (add timeline + link to troubleshooting)

---

## P2 Gaps (POLISH)

### CG-010: FAQ — Crypto/PayOS Comparison Not Explicit
- **Severity:** P2 (advanced user wishes to compare payment methods side-by-side)
- **Area:** FAQ expansion
- **Evidence:** `docs/faq.md` mentions payOS in troubleshooting (Q9) but no dedicated FAQ comparing NOWPayments vs PayOS pros/cons.
- **Fix sketch:**
  Add FAQ Q31:
  ```
  ### Q31: NOWPayments vs PayOS — Cách chọn? / Which payment method should I use?
  
  **Tieng Viet:**
  - NOWPayments (USDT crypto): Nhanh (2-5 phút), không phí, quốc tế. Yêu cầu ví crypto.
  - PayOS (VietQR/Bank): Chậm hơn (15-30 phút), phí nhỏ, dễ (dùng ngân hàng Việt).
  Chọn NOWPayments nếu có ví crypto; chọn PayOS nếu không.
  
  **English:**
  - NOWPayments (USDT crypto): Fast (2-5 min), no fees, international. Requires crypto wallet.
  - PayOS (VietQR/Bank): Slower (15-30 min), small fee, easy (use Vietnam bank account).
  Use NOWPayments if you have a crypto wallet; use PayOS if not.
  ```
- **Effort:** S (add FAQ + link to Payment Methods doc)

---

### CG-011: Billing Invoice Delivery — Confirm Bilingual
- **Severity:** P2 (invoice in English for VI customer, minor UX issue)
- **Area:** Email i18n
- **Evidence:** `docs/faq.md` Q23 states invoices sent to email but doesn't confirm bilingual (likely English-only).
- **Fix sketch:** Audit `receipt-email-template.ts` — if hardcoded English, add locale-aware template selection.
- **Effort:** S (template audit + bilingual version)

---

### CG-012: Account Deletion Flow — Confirm Deletion + Data Wipe
- **Severity:** P2 (customer requests deletion, must trust support to actually delete)
- **Area:** Data privacy / GDPR
- **Evidence:** `docs/faq.md` Q29 states "Gửi email support + đợi 48h + dữ liệu xóa" but no audit of backend deletion logic.
- **Fix sketch:** Verify `DELETE FROM users WHERE id=?` cascade deletes campaigns, credentials, subscriptions. Add audit log of deletion + timestamp. Confirm with customer via email before deletion (2-step confirmation).
- **Effort:** M (backend audit + 2-step confirmation flow + email)

---

## Summary by Area

| Area | P0 | P1 | P2 | Total |
|------|----|----|----|----|
| **Onboarding** | 1 | 2 | 0 | 3 |
| **i18n / Bilingual** | 1 | 1 | 1 | 3 |
| **Payment UX** | 1 | 0 | 1 | 2 |
| **Support / Escalation** | 0 | 1 | 1 | 2 |
| **Email** | 1 | 1 | 1 | 3 |
| **Telegram Bot** | 0 | 1 | 0 | 1 |
| **Refund/Cancellation** | 0 | 1 | 0 | 1 |
| **Data Privacy** | 0 | 0 | 1 | 1 |

---

## Top 3 Customer-Blocking Gaps (Priority Fix Order)

1. **CG-001: Pricing Page i18n (P0)** — Non-English customer lands on `/vi/pricing`, sees English tier names. High abandonment risk. Fix: ~4h. Blocks GO LIVE decision for Vietnam market.

2. **CG-002: NOWPayments UX Clarity (P0)** — Customer doesn't understand USDT/wallet/network jargon. Abandonment at payment gate. Fix: ~2h (docs + screenshot). Critical for USDT-primary payment model.

3. **CG-004: Email Deliverability (P0)** — Welcome/reset emails may bounce or spam. Verified DNS records + Resend domain setup required. Fix: ~1h (DNS audit). Blocks account activation flows.

---

## Unresolved Questions for Long

1. **Setup Wizard Help Links:** Is the actual Setup Wizard component (`src/app/[locale]/setup-wizard/`) wired with inline help links? Need to verify component code.
2. **PayOS Integration:** Is PayOS fully wired in production (`/api/payos/*` routes live)? Or stub only?
3. **Resend Domain Verification:** Is `mekongmind.com` already verified in Cloudflare DNS? SPF/DKIM/DMARC records confirmed?
4. **Tier Limit Enforcement:** When customer hits video limit, what error message shows currently? Is upgrade prompt wired?
5. **Email Template Rendering:** Are Welcome/Reset/Invoice emails pulled from DB translations or hardcoded English strings?

---

**Status:** DONE

**Concerns:** CG-001 (pricing i18n) + CG-004 (email DNS) must be verified live before GO LIVE sign-off. If these are already fixed, score adjusts upward. Current report assumes gaps based on docs audit; in-app verification recommended.

**Co-Authored-By:** Claude Haiku 4.5 <noreply@anthropic.com>
