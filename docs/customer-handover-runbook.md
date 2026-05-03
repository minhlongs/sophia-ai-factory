# Customer Handover Runbook

> **Audience:** CEO (Anh) — Non-technical, bilingual  
> **Goal:** Onboard new paying customers in 30 minutes from contract signed  
> **Last Updated:** 2026-05-02

---

## Pre-Handover Platform Checklist (Do Once)

Run these before your first ever handover. After that, skip to Per-Customer Handover.

- [ ] Run Zero-GAP audit at `/dashboard/admin/zero-gap-audit` — target score ≥ 90
- [ ] Apply migration 0064 to D1 (local + remote): `npx wrangler d1 execute sophia-raas-db --remote --file=migrations/0064-customer-handovers.sql`
- [ ] Verify `RESEND_API_KEY` is set in wrangler secrets
- [ ] Verify `NEXT_PUBLIC_APP_URL` points to production URL
- [ ] Register HeyGen webhook at `/dashboard/admin/heygen-webhooks`
- [ ] Run E2E smoke test at `/dashboard/admin/e2e-smoke`
- [ ] Test the handover wizard yourself with a dummy email

---

## Per-Customer Handover (Do for Each New Customer)

### Step 1 — Get Payment Confirmed

Before onboarding, confirm:
- Contract signed (DocuSign or physical)
- First payment received via NOWPayments
- Customer email and full name confirmed

### Step 2 — Open Handover Wizard

1. Go to: `https://sophia.agencyos.network/dashboard/admin/handover`
2. Fill **Step 1 — Customer Info**:
   - Agency name, owner email, owner full name
   - Agency type (B2B SaaS / E-com / Content Creator / Service / Other)
   - Tier matching their contract (BASIC / PREMIUM / ENTERPRISE / MASTER)
   - Phone, locale (Vi/En), timezone if known
3. Review **Step 2 — Starter Pack**:
   - SOPs are auto-suggested based on agency type + tier
   - Uncheck any not relevant, check any you want to add
4. Review **Step 3 — Configuration**:
   - Verify agency name, email, tier, SOP count
5. Click **"Create & Send Email"**
6. Copy the magic link (backup in case email fails)
7. Click **"Download Handover Document"** — save the `.md` file

### Step 3 — Verify Customer Side

1. Open an incognito/private browser window
2. Paste the magic link URL
3. Verify welcome page loads with correct agency name
4. Confirm 5-step onboarding shows correctly
5. Do NOT click "Get Started" (that's for the customer)

### Step 4 — Schedule Onboarding Call (Recommended)

- Send customer a Calendly link for 30-min call
- Goal: walk them through adding HeyGen key + enabling first SOP
- Prepare: have the handover doc open to reference

### Step 5 — Share Handover Document

Send the `.md` handover document to customer via:
- Email attachment (Outlook / Gmail)
- Telegram direct message
- WhatsApp (copy-paste the magic link section)

Customer needs to know:
1. Their magic link (in the email + doc)
2. They need to get a HeyGen API key
3. Support email: support@mekongmind.com

### Step 6 — Mark Handover Active

After customer first logs in and enables their first SOP:
1. Go to `/dashboard/admin/handover/list`
2. Find the customer row
3. Click their row to expand
4. Change status from `pending` → `active`

---

## 30-Day Customer Success Checklist

| Day | Check | Action If Not Done |
|-----|-------|-------------------|
| Day 1 | First login milestone shows timestamp | Resend magic link |
| Day 1 | First SOP installed | Schedule support call |
| Day 3 | First successful SOP run | Proactive outreach |
| Day 7 | MCU usage > 50% of monthly | Good sign! No action |
| Day 14 | At least 3 SOP runs | If 0 runs → mark `at_risk` |
| Day 30 | Renewal conversation | Send upgrade options |

### Monitoring at `/dashboard/admin/handover/list`

Check this page weekly. Look for customers with:
- All 4 milestones blank → needs intervention
- `at_risk` status → contact within 24h
- No first_run after 7 days → proactive support call

---

## Escalation Flow

### Customer Can't Log In
1. Go to `/dashboard/admin/handover/list`
2. Find customer → click "Resend" button
3. New magic link generated + email sent automatically
4. If email still fails: share magic link directly via WhatsApp/Telegram

### Customer's SOP Fails
1. Ask customer to go to `/dashboard/sops` → find failed SOP
2. Check error message — usually missing API key
3. Direct them to `/setup-wizard` to add the missing key
4. After key added: click "Run Now" to retry

### Customer Requests Refund
1. Go to `/dashboard/admin/refunds`
2. Review request details
3. Policy: 7-day refund window from first payment
4. If approved: use NOWPayments dashboard to process
5. Update handover status to `churned`

### Platform Outage
1. Check `/dashboard/admin/zero-gap-audit`
2. Check Cloudflare dashboard for Workers errors
3. Check GitHub Actions for failed deploy
4. Contact support@mekongmind.com if can't resolve in 30 min

---

## Support Email Templates

### Template 1 — Welcome (magic link resend)
```
Chủ đề: Chào mừng đến Sophia AI — Link truy cập mới

Xin chào [Tên],

Dưới đây là link truy cập mới vào tài khoản Sophia AI của bạn:
[MAGIC_LINK]

Link có hiệu lực trong 24 giờ.

Sau khi đăng nhập, hãy làm theo các bước trong Handover Document đã gửi kèm.

Nếu cần hỗ trợ: support@mekongmind.com hoặc Telegram: @Sophia_Bbot

Trân trọng,
Team Sophia AI
```

### Template 2 — How to Add HeyGen API Key
```
Chủ đề: Hướng dẫn thêm HeyGen API Key

Xin chào [Tên],

Để bắt đầu tạo video, bạn cần thêm HeyGen API Key:

1. Đăng ký tại: https://heygen.com
2. Vào Settings → API → Create API Key
3. Copy key
4. Trong Sophia: Settings → API Keys → HeyGen → Paste key → Save
5. Click "Test Connection" — sẽ thấy ✅ Connected

Sau đó, vào Dashboard → SOPs để bắt đầu chạy automation.

Hỗ trợ: support@mekongmind.com

Trân trọng,
Team Sophia AI
```

### Template 3 — SOP Failed
```
Chủ đề: SOP của bạn cần được cấu hình thêm

Xin chào [Tên],

SOP [TÊN SOP] chưa thể chạy vì thiếu API key.

Vui lòng:
1. Vào https://sophia.agencyos.network/setup-wizard
2. Thêm API key còn thiếu (thường là HeyGen)
3. Quay lại SOPs → Click "Run Now"

Nếu vẫn gặp lỗi, gửi screenshot error cho support@mekongmind.com

Trân trọng,
Team Sophia AI
```

### Template 4 — Refund Request Received
```
Chủ đề: Xác nhận yêu cầu hoàn tiền

Xin chào [Tên],

Chúng tôi đã nhận được yêu cầu hoàn tiền của bạn.

Thời gian xử lý: 3-5 ngày làm việc.
Chính sách: Hoàn tiền trong 7 ngày đầu tiên kể từ ngày thanh toán.

Chúng tôi sẽ liên hệ lại khi xử lý xong.

Trân trọng,
Team Sophia AI
```

---

## Quick Reference

| Task | URL |
|------|-----|
| Create new handover | `/dashboard/admin/handover` |
| View all handovers | `/dashboard/admin/handover/list` |
| Resend magic link | `/dashboard/admin/handover/list` → Resend button |
| Zero-GAP audit | `/dashboard/admin/zero-gap-audit` |
| Refund management | `/dashboard/admin/refunds` |
| User management | `/dashboard/admin/users` |
| Support email | support@mekongmind.com |
| Telegram bot | @Sophia_Bbot |

---

*Last updated: 2026-05-02 | Sophia AI Factory v2.0*
