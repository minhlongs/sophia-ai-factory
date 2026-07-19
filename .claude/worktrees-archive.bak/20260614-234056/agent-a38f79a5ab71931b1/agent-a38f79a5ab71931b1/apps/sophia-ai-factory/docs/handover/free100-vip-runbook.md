# FREE100 — VIP Customer Handover Runbook

**Audience:** ops/admin distributing the FREE100 promo (100% off MASTER tier, $4,999 value).
**Last updated:** 2026-05-03

---

## 1. What FREE100 does

| Field | Value |
|------|-------|
| Code | `FREE100` |
| Discount | 100% off MASTER tier (one-shot) |
| Max uses | 10 (configurable in `promo_codes` row) |
| Tier granted | MASTER |
| Expiry | 90 days from seed (see `0068-seed-free100-master.sql`) |
| Value | ~$4,999 lifetime |

When a customer redeems, the system:

1. Auto-creates user (no signup form needed) — `/api/promo/redeem-free`
2. Inserts a `customer_handovers` row with tier=MASTER, source=`auto_signup`
3. Pre-installs starter SOPs based on `agencyType`
4. Sends a welcome email with a magic link `/{locale}/welcome/<token>`
5. Magic link consume → signs Better Auth session cookie → redirects to `/setup-wizard`

---

## 2. Distribution checklist (per VIP)

1. Confirm partner identity (email, full name, agency name).
2. Decide tier target — for FREE100 it is always MASTER.
3. Send the email below (replace `{{name}}`, `{{email}}`).
4. Track redemption via `/admin/handover` UI or the daily report script.
5. Day +2 if no first login → resend magic link (see §4).

### Email template (vi + en)

```text
Subject: Sophia AI Factory — Quà tặng MASTER tier (FREE100)

Chào {{name}},

Cảm ơn anh/chị đã tin tưởng. Bên em gửi tặng anh/chị mã FREE100
— 100% off MASTER tier (giá trị $4,999), đầy đủ tính năng, không
trial, không tự động gia hạn.

Cách kích hoạt (3 bước):
1. Truy cập: https://sophia.agencyos.network/redeem
2. Nhập email: {{email}}
3. Nhập mã:    FREE100

Hệ thống sẽ tự tạo tài khoản và gửi link đăng nhập về email.

Hỗ trợ: support@agencyos.network — phản hồi trong 4h ngày làm việc.

— Sophia AI Factory team
```

---

## 3. Verifying redemption

```bash
# 1. Aggregate counts
curl -s -H "Cookie: $ADMIN_SESSION" \
  https://sophia.agencyos.network/api/admin/handover/list?stats=1 | jq

# 2. Recent handovers (joined with user email/name)
curl -s -H "Cookie: $ADMIN_SESSION" \
  "https://sophia.agencyos.network/api/admin/handover/list?limit=20" | jq

# 3. Specific customer status
curl -s -H "Cookie: $ADMIN_SESSION" \
  "https://sophia.agencyos.network/api/admin/handover/customer-status?email=foo@bar.com" | jq
```

Status meaning:

| Status | Meaning | Action |
|--------|---------|--------|
| `pending` | Created, no first login | Wait 24h → if still pending, regen magic link |
| `active`  | First login + at least one workflow run | Healthy |
| `at_risk` | First login but no run for 7 days | Reach out personally |
| `churned` | Inactive 30 days | Mark for follow-up campaign |

---

## 4. Regenerate magic link (when customer lost the email)

```bash
# 1. Find the handover id
HANDOVER_ID=$(curl -s -H "Cookie: $ADMIN_SESSION" \
  "https://sophia.agencyos.network/api/admin/handover/list?limit=200" \
  | jq -r '.handovers[] | select(.email=="foo@bar.com") | .id')

# 2. Resend
curl -sX POST -H "Cookie: $ADMIN_SESSION" \
  "https://sophia.agencyos.network/api/admin/handover/$HANDOVER_ID/resend-welcome" | jq
```

The endpoint:

* generates a **fresh** magic link token (old one is invalidated)
* re-sends the welcome email
* updates `welcome_email_sent_at`
* writes audit log `customer_handover_resent`

If email delivery itself failed (Resend bounce), the response includes `emailSent: false` — fall back to copying `magicLinkUrl` from the response and sending manually via Telegram/Zalo.

---

## 5. Daily ops report

```bash
# Local invocation
ADMIN_SESSION_COOKIE='__Secure-better-auth.session_token=…' \
  node scripts/handover-daily-report.mjs

# With Telegram delivery
TELEGRAM_BOT_TOKEN=… TELEGRAM_OPS_CHAT_ID=… \
ADMIN_SESSION_COOKIE='…' \
  node scripts/handover-daily-report.mjs
```

Output covers: aggregate counts, drop-off (email-sent-no-login, login-no-run),
last 10 handovers, and a stuck list (>24h with no login).

---

## 6. Known failure modes

| Symptom | Root cause | Fix |
|--------|-----------|-----|
| `user_not_found` on /redeem form | Endpoint didn't auto-create — fixed in commit `0947fe83` | Already deployed |
| Magic link → 404 | URL missing locale — fixed in commit `866dab1b` | Already deployed |
| After magic link → bounce to /login | Session cookie unsigned/wrong-name — fixed in `3b7f7780` + `08305050` | Already deployed |
| /setup-wizard 404 for new user | i18n config threw notFound — fixed in `3d266c65` | Already deployed |
| Customer says "no email" | Resend may have throttled / bounced | Run §4 regen, monitor `welcome_email_sent_at` |

---

## 7. Off-boarding (revoke FREE100)

Only when partner abuses or refunds requested:

```sql
-- Mark redemption void (does not delete user data)
UPDATE promo_code_redemptions
   SET status = 'revoked'
 WHERE user_id = (SELECT id FROM user WHERE email='foo@bar.com')
   AND code = 'FREE100';

-- Downgrade tier
UPDATE user_tiers SET tier='BASIC'
 WHERE user_id = (SELECT id FROM user WHERE email='foo@bar.com');
```

Always log the rationale in `audit_log` (`actionType='customer_handover_revoked'`).

---

## Unresolved questions

- Should we auto-mark `at_risk` after N days no-run? Currently a manual SQL update.
- Do we want a self-service "resend magic link" page for customers (no admin needed)?
