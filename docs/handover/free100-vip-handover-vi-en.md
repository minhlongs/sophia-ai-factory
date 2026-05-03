# FREE100 — VIP Partner Handover Guide

**Mã FREE100 = 100% off MASTER tier — full lifetime access**
**Code FREE100 = 100% off MASTER tier — full lifetime access**

---

## Tóm Tắt / Summary

| Field | Value |
|-------|-------|
| Code | `FREE100` |
| Discount | 100% (free_full) |
| Áp dụng cho / Applies to | Tier `MASTER` (lifetime) |
| Giá trị quy đổi / Value | $4,999 USD |
| Số lượt tối đa / Max uses | 10 lifetime |
| 1 user dùng / Per user limit | 1 lần / 1 time |
| Hiệu lực / Valid | 90 ngày kể từ phát hành / 90 days from issue |
| Status | `active` (production verified 2026-05-03) |
| Campaign tag | `vip_partner` |

---

## Đối Tượng Bàn Giao / Target Recipients

**VI:** Đối tác chiến lược / Premium beta partners / Khách hàng VIP có giá trị giới thiệu cao. Mỗi mã FREE100 = $4,999 chi phí cơ hội — chỉ trao cho:
- Đối tác kênh có sẵn 100+ khách doanh nghiệp
- KOL/influencer có audience match với agency owner
- Co-founder mời gọi với revenue-share rõ ràng
- Khách hàng đầu tiên giúp build case study

**EN:** Strategic partners / premium beta testers / high-LTV referral sources. Each FREE100 = $4,999 opportunity cost — distribute only to:
- Channel partners with 100+ business contacts
- KOL/influencer audiences matching agency owner persona
- Co-founders/advisors with revenue-share agreements
- Anchor customers building case studies

---

## Quy Trình Bàn Giao / Handover Flow

### Bước 1: Gửi Mã / Send Code

**Email template (VI):**
```
Subject: 🎁 Quà VIP từ Sophia AI Factory — Mã FREE100 lifetime MASTER

Xin chào [TÊN],

Cảm ơn anh/chị đã đồng hành cùng Sophia. Chúng tôi xin trao tặng mã VIP:

  Code: FREE100
  Tier: MASTER (lifetime, $4,999 USD)
  Hết hạn: [DATE +90 days]

Cách dùng:
1. Truy cập https://sophia.agencyos.network/pricing
2. Chọn gói MASTER → Checkout
3. Nhập "FREE100" tại ô mã giảm giá
4. Thanh toán $0 → Sophia tự động kích hoạt full quyền

Toàn bộ tính năng MCU, BYOK, mission engine, 31 SOP playbooks unlock ngay.

Mọi thắc mắc: support@agencyos.network
```

**Email template (EN):**
```
Subject: 🎁 VIP Gift from Sophia AI Factory — FREE100 lifetime MASTER

Hi [NAME],

Thank you for partnering with Sophia. Please accept this VIP code:

  Code: FREE100
  Tier: MASTER (lifetime, $4,999 USD)
  Expires: [DATE +90 days]

Redemption:
1. Go to https://sophia.agencyos.network/pricing
2. Select MASTER tier → Checkout
3. Enter "FREE100" in the promo field
4. Pay $0 → Sophia auto-activates full access

All MCU, BYOK, mission engine, and 31 SOP playbooks unlock instantly.

Support: support@agencyos.network
```

### Bước 2: Customer Redeem (Tự động / Automated)

Sophia auto-handover triggers từ payment IPN với amount=$0:
1. Promo applier mark code as USED + decrement available count
2. `auto-handover.ts` orchestrator chạy:
   - `createCustomerUser` — tạo Better Auth account
   - `upsertUserTier` → `MASTER`
   - `preInstallSops` — pre-install 31 playbooks
   - `createHandoverRecord` — generate magic link token
3. Email `welcome-email-template` gửi với magic link
4. Customer click link → `/welcome/{token}` → onboarding tour → dashboard

**Zero admin action required.**

### Bước 3: Theo Dõi / Tracking

```bash
# Số mã FREE100 đã dùng
npx wrangler d1 execute sophia-raas-db --remote --command \
  "SELECT used_count, max_uses FROM promo_codes WHERE code='FREE100'"

# Danh sách user redeem FREE100
npx wrangler d1 execute sophia-raas-db --remote --command \
  "SELECT user_id, redeemed_at, order_id FROM promo_redemptions WHERE code='FREE100'"

# Auto-handover status
npx wrangler d1 execute sophia-raas-db --remote --command \
  "SELECT user_id, status, magic_link_used_at FROM handover_records ORDER BY created_at DESC LIMIT 10"
```

---

## Rủi Ro & Mitigation / Risks & Mitigation

| Risk | Mitigation |
|------|------------|
| Mã rò rỉ public | `max_uses=10` lifetime → cap loss tại $49,990 |
| 1 user redeem nhiều account | `max_uses_per_user=1` enforced |
| Free user không tạo revenue | Manual qualification trước khi gửi code |
| Customer churn sau redeem | First 30-days roadmap auto-email cadence |

---

## Verify FREE100 Live / Verify Live Endpoint

```bash
curl -X POST https://sophia.agencyos.network/api/promo/validate \
  -H "Content-Type: application/json" \
  -d '{"code":"FREE100","tier":"MASTER"}'

# Expected:
# {"valid":true,"discountType":"free_full","appliesToTier":"MASTER",...}
```

---

## Liên Quan / Related

- Pricing tiers: `docs/pricing-and-tiers.md`
- Customer handover runbook: `docs/customer-handover-runbook.md`
- Welcome email template: `docs/handover/welcome-email-template-vi-en.md`
- 30-days onboarding: `docs/handover/first-30-days-roadmap-vi-en.md`
- Promo migrations: `apps/sophia-ai-factory/migrations/0067-seed-promo-codes.sql`, `0068-seed-free100-master.sql`

---

**Last verified production:** 2026-05-03 — HTTP 200, FREE100 valid:true cho MASTER, auto-handover orchestrator live, crons firing.
