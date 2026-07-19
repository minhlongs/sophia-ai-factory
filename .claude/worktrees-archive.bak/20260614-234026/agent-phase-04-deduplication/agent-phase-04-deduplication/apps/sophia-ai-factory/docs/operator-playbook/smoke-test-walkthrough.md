# Smoke Test Walkthrough

## Mục tiêu / Purpose

**VN:** Bạn sẽ thực hiện một test end-to-end đầy đủ của Sophia trước khi mở bán. Sẽ mất 60-90 phút, nhưng bạn sẽ kiểm chứng rằng tất cả chìa khóa API hoạt động, thanh toán hoạt động, và bot Telegram phản hồi như dự kiến.

**EN:** You'll run a complete end-to-end test of Sophia before launching paid. Takes 60-90 min, but you'll verify all API keys work, payments flow, and Telegram bot responds as expected.

---

## Trước khi bắt đầu / Before You Start

### Yêu cầu / Requirements
- 🔑 Cloudflare account (you already have)
- 📧 Email address (for NOWPayments staging account)
- 💰 Budget: $30–$100 for test credits (see Section 6)
- ⏱️ Time: 60–90 minutes (uninterrupted)

### What This Test Covers
✅ NOWPayments staging payment flow  
✅ Setup Wizard API key entry (OpenRouter, ElevenLabs, D-ID)  
✅ Video campaign trigger via Telegram bot  
✅ End-to-end video generation + publishing  
✅ Error handling + recovery  

---

## Phần 1: NOWPayments Staging Account Setup

### Step 1: Sign Up for Sandbox
1. Visit **https://sandbox.nowpayments.io/auth/sign-up**
2. Enter email + password
3. Verify email (check spam folder)
4. Login

### Step 2: Generate Test API Key
1. Go to Settings → API keys
2. Click "Create API key"
3. Name: `sophia-smoke-test`
4. Copy **API Key** → save to text file (you'll need it in Section 4)

### Step 3: Note IPN Secret
1. In Settings → IPN Secret, you'll see a secret (or create one)
2. Copy **IPN Secret** → save to text file
3. This secret is used to verify webhook integrity

### Step 4: Add Test Wallet Address
1. In Settings → Wallets, click "Add Wallet"
2. Network: **TRC20 (USDT on Tron)**
3. Address: NOWPayments provides a test address
4. Copy and save this address

---

## Phần 2: BYOK Key Entry UX Walkthrough

### Where to Enter Keys
- **URL:** `https://sophia.agencyos.network/onboarding`
- This is the Setup Wizard — customer enters ALL API keys here

### Sub-step 2.1: Enter OpenRouter Key
1. First screen: "API Key for AI Video Scripts"
2. Click field → paste your OpenRouter API key (starts with `sk-or-`)
3. Expected: Green checkmark ✅
4. If red ❌ → key invalid, retry or create new key at openrouter.ai

### Sub-step 2.2: Enter ElevenLabs Key
1. Second screen: "Voice Generation API"
2. Paste ElevenLabs API key (from elevenlabs.io dashboard)
3. Expected: Green checkmark ✅
4. If red ❌ → recheck key prefix `xi-`

### Sub-step 2.3: Enter D-ID / HeyGen Key
1. Third screen: "Video Generation Provider"
2. Paste D-ID OR HeyGen key (choose one)
3. Expected: Green checkmark ✅

### Sub-step 2.4: Enter NOWPayments Key
1. Fourth screen: "Payment API"
2. Paste your NOWPayments sandbox API key from Section 1
3. Expected: Green checkmark ✅
4. Note: This key starts with your NOWPayments account ID

### Step 5: Verify Setup
- Click "Complete Setup" button
- All 4 keys show green checks in summary
- You see: "✅ Setup Complete — Ready to Run Campaigns"

---

## Phần 3: Run a Test Campaign

### Option A: Via Telegram Bot
1. Open Telegram, find **@Sophia_Bbot**
2. Type `/campaign`
3. Bot replies with options (e.g., "video:create")
4. Choose an option and confirm
5. Wait 3–5 minutes for video generation
6. Bot sends you video link + metrics

### Option B: Via Dashboard
1. Go to `https://sophia.agencyos.network/dashboard`
2. Click "New Mission" → select "video:create"
3. Enter niche/topic
4. Click "Launch"
5. Wait for video in output section

### Expected Duration
- Script generation: 30 sec
- Voice synthesis: 60 sec
- Video rendering: 120–180 sec (depends on HeyGen/D-ID queue)
- **Total: 3–5 minutes**

### Expected Output
- ✅ Video file generated
- ✅ Published to social platform (or link provided)
- ✅ Tracking URL generated
- ✅ Metrics logged (views, clicks, conversions)

---

## Phần 4: Budget Tier Comparison

| Tier | Price | Video Credits | Lead Slots | Paid Trial Count | Best For |
|---|---|---|---|---|---|
| **Starter** | $30 | 5 | 10 | 1 | Proof-of-concept |
| **Growth** | $60 | 10 | 30 | 3 | Active testing |
| **Premium** | $100 | 20 | 100 | 10 | Full smoke test |

**Tier Logic:**
- Each video generation costs 1 credit
- Each lead import costs 0.1 credits
- Overage: auto-charge next tier if available

**Smoke Test Budget:**
- Recommend **$60–$100 tier** to run 10+ test campaigns
- Use staging keys so real charges don't occur

---

## Phần 5: Expected Error Scenarios + Recovery

### Error: "Invalid API Key"
- **Where:** Setup Wizard key verification
- **Fix:** 
  1. Copy fresh key from OpenRouter/ElevenLabs dashboard
  2. Paste into wizard field
  3. Wait 2 sec for validation
  4. If still red, create NEW key (old one may be revoked)

### Error: "ElevenLabs 401 Unauthorized"
- **Cause:** API key missing or expired
- **Fix:** 
  1. Login to elevenlabs.io
  2. Go to API keys section
  3. Copy active key (not old/revoked)
  4. Re-enter in wizard

### Error: "NOWPayments IPN Timeout"
- **Cause:** Payment webhook didn't reach Sophia
- **Fix:**
  1. In NOWPayments dashboard, verify IPN URL is set to:  
     `https://sophia.agencyos.network/api/payments/nowpayments/ipn`
  2. Check IPN secret matches your `.env`
  3. Retry payment

### Error: "HeyGen Quota Exceeded"
- **Cause:** Free/trial tier ran out of video minutes
- **Fix:**
  1. Upgrade HeyGen account (or use D-ID if available)
  2. Retry campaign

### Error: "Telegram Bot Not Responding"
- **Cause:** Bot token stale or webhook not configured
- **Fix:**
  1. In Telegram, type `/start` to re-bind bot
  2. Verify bot token in Sophia dashboard (Settings → Integrations)
  3. If stale, create new bot via @BotFather

---

## Phần 6: Post-Test Key Revocation Checklist

**Before going live, REVOKE all test keys:**

- [ ] OpenRouter: Dashboard → API Keys → Delete `smoke-test` key
- [ ] ElevenLabs: Dashboard → API Keys → Revoke staging key
- [ ] D-ID / HeyGen: Dashboard → API Keys → Revoke staging key
- [ ] NOWPayments: Dashboard → API Keys → Delete `sophia-smoke-test` key
- [ ] Telegram: @BotFather → `/delete` old bot (if created new one for prod)
- [ ] Sophia Settings: "Reset Keys" to clear BYOK cache

**Why?** Staging keys can leak in logs. Always revoke after testing.

---

## Phần 7: Production Key Migration (Phase 06 Prep)

### When You're Ready to Launch
1. Sign up for production accounts (not sandbox):
   - NOWPayments.io (real account)
   - HeyGen / D-ID (production workspace)
   - ElevenLabs (production account)
   - OpenRouter (production workspace)

2. Generate PRODUCTION API keys from each service

3. Update Sophia environment:
   - Replace test keys with production keys
   - Verify NOWPayments IPN secret matches production

4. Test ONE campaign with production key before full launch

---

## Bilingual Checklist / Danh sách Kiểm tra

**VN:**
- [ ] Tài khoản NOWPayments sandbox tạo xong
- [ ] API keys của OpenRouter, ElevenLabs, D-ID sẵn sàng
- [ ] Wizard load từ onboarding page
- [ ] 4 keys green checkmark ✅
- [ ] Campaign chạy thành công (video sinh ra)
- [ ] Telegram bot phản hồi
- [ ] Test keys revoked sau test

**EN:**
- [ ] NOWPayments sandbox account created
- [ ] API keys from OpenRouter, ElevenLabs, D-ID ready
- [ ] Wizard loads from onboarding page
- [ ] All 4 keys show green checkmarks ✅
- [ ] Campaign runs successfully (video generated)
- [ ] Telegram bot responds
- [ ] Test keys revoked after test

---

## Troubleshooting Summary

| Issue | Try This |
|---|---|
| Wizard doesn't load | Clear browser cache, try incognito mode |
| Key validation hangs | Refresh page, check internet connection |
| Video takes >10 min | Check HeyGen/D-ID queue; may be busy |
| Payment fails | Verify NOWPayments account has USD balance for test |
| Bot doesn't respond | Ensure `/start` was run; check Telegram webhook logs |

---

**Timeline:** Expect this walkthrough to take 1.5–2 hours including setup.  
**Next:** After smoke test passes, move to Phase 06 Paid Launch (see `phase-06-prep-checklist.md`).
