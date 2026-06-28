# Zalo Official Account Publisher

## Overview

The Zalo publisher enables posting video content to a Zalo Official Account (OA) timeline. Zalo is a messaging and social platform dominant in Vietnam with ~74M monthly active users.

**Important:** Unlike Western platforms, Zalo OA requires Vietnamese business verification before any API access is granted.

---

## Vietnamese Business Verification (REQUIRED FIRST)

### Step 1: Create a Zalo Official Account

1. Go to [https://oa.zalo.me/manage/oa](https://oa.zalo.me/manage/oa)
2. Click **"Tạo OA"** (Create OA)
3. Select account type:
   - **Enterprise OA** (Tài khoản doanh nghiệp) — for registered businesses
   - **Personal OA** (Tài khoản cá nhân) — limited API access

### Step 2: Business Verification Documents

For Enterprise OA, prepare:
- Business registration certificate (Giấy chứng nhận đăng ký kinh doanh)
- Tax identification number (Mã số thuế)
- Representative's national ID (CCCD/CMND)
- Business logo and cover image

Submit at: [https://oa.zalo.me/manage/oa](https://oa.zalo.me/manage/oa) → Xác minh tài khoản

Verification takes 2–5 business days.

### Step 3: Register Developer Application

1. Go to [https://developers.zalo.me/app](https://developers.zalo.me/app)
2. Create a new app linked to your OA
3. Enable **"Official Account"** product
4. Add OAuth redirect URIs (e.g., `https://your-domain.com/api/oauth/zalo/callback`)
5. Note your `App ID` and `Secret Key`

---

## Environment Variables

```env
ZALO_APP_ID=your_zalo_app_id
ZALO_APP_SECRET=your_zalo_app_secret_key
ZALO_REDIRECT_URI=https://your-domain.com/api/oauth/zalo/callback
# Set after completing OAuth flow:
ZALO_OA_ACCESS_TOKEN=the_oa_access_token  # optional override for direct use
```

---

## OAuth Flow

```
User → GET /api/oauth/zalo
     → Redirect to https://oauth.zaloapp.com/v4/oa/permission
     → User grants permission on Zalo
     → GET /api/oauth/zalo/callback?code=XXX&oa_id=YYY
     → Exchange code → access_token + refresh_token (1hr / 30days)
     → Stored encrypted in D1 publishing_channels
```

**Token lifetimes:**
- Access token: 1 hour
- Refresh token: 30 days
- The token refresher in `oauth-token-refresher.ts` auto-refreshes 1 hour before expiry.

---

## Error: ZaloVerificationRequiredError

If `ZALO_APP_ID` is not set, the publisher throws:

```
ZaloVerificationRequiredError: Zalo OA credentials not configured.
Your business must be verified on Zalo Official Account before using this publisher.
Please complete business verification at https://oa.zalo.me/manage/oa
```

This is intentional — without OA verification, API calls will be rejected by Zalo's servers.

---

## API Rate Limits

- **Posts (broadcasts):** 20 per day per OA
- **Video upload:** 200MB max per file, 1080p resolution
- **Quota tracked in:** `channel_quotas` D1 table (20/day enforced via `per-channel-quota.ts`)

---

## Upload Flow Details

```
1. Fetch video binary from R2 URL
2. POST /v3/oa/message/video/upload  → video_id
3. POST /v3/oa/message/broadcast     → broadcast_id
```

**Caption limit:** 1000 characters (Vietnamese characters count as 1 each).

---

## References

- Zalo OA Docs: [https://developers.zalo.me/docs/official-account](https://developers.zalo.me/docs/official-account)
- OA Management: [https://oa.zalo.me/manage/oa](https://oa.zalo.me/manage/oa)
- OA API v3: [https://developers.zalo.me/docs/official-account/oa-open-api-v3](https://developers.zalo.me/docs/official-account/oa-open-api-v3)
