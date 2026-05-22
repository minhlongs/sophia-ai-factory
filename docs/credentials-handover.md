# Credentials & Access Handover / Thong Tin Dang Nhap & Quyen Truy Cap

> Checklist ban giao tai khoan va quyen truy cap
> Account and access handover checklist

**Date / Ngay:** _______________

---

## What We Deliver / Chung Toi Ban Giao

### 1. Production Website / Trang Web Chinh Thuc

- [ ] **URL:** `https://sophia.agencyos.network`
- [ ] Website hoat dong binh thuong / Website running normally
- [ ] SSL certificate hop le / SSL certificate valid

### 2. Cloudflare Workers (Hosting - 2026-04-10 Update)

- [ ] Invite client vao Cloudflare account
- [ ] Invite client to Cloudflare account
- [ ] Cloudflare project: `sophia-ai-factory`
- [ ] Workers domain: `sophia.agencyos.network`
- [ ] CF-direct deploy access verified / Quyen deploy CF-direct da duoc kiem tra (`npm run deploy:full`)
- [ ] D1 database access configured: `sophia-raas-db`

**Note:** Migrated from Vercel to Cloudflare Workers 2026-03-24. See `cloud-infrastructure.md` for complete setup.

### 3. D1 Database (Cloudflare SQLite - 2026-04-10 Update)

- [ ] D1 database access cau hinh / D1 database access configured
- [ ] Database name: `sophia-raas-db`
- [ ] Daily automated backups enabled
- [ ] Auth (Better Auth + D1 session cookies) hoat dong / Better Auth working
- [ ] RLS policies not applicable (D1 = server-side, JWT-based permission model)

### 4. Payment Providers (2026-04-10 Update)

**NOWPayments (Primary) — Global Credit Card + USDT**
- [ ] Chuyen quyen NOWPayments merchant account / Transfer NOWPayments merchant account ownership
- [ ] Hoac invite client vao organization / Or invite client to organization
- [ ] IPN Webhook URL: `https://sophia.agencyos.network/api/webhooks/nowpayments`

**PayOS (Backup) — Vietnam Domestic (VietQR, Bank Transfer)**
- [ ] Chuyen quyen PayOS merchant account / Transfer PayOS merchant account ownership
- [ ] Test va production API keys cau hinh / Configure test and production API keys
- [ ] IPN Webhook URL: `https://sophia.agencyos.network/api/webhooks/payos`

**Note:** Polar.sh merchant account removed 2026-04-10 (account flagged for product description). See `project-changelog.md` for details.

### 5. Telegram Bot

- [ ] Chuyen quyen bot @Sophia_Bbot / Transfer bot @Sophia_Bbot ownership
- [ ] Bot token duoc luu trong Cloudflare Workers env vars / Bot token stored in Cloudflare Workers secrets
- [ ] Webhook URL: `https://sophia.agencyos.network/api/webhooks/telegram`

### 6. GitHub Repository

- [ ] Invite client vao repo (collaborator) / Invite client to repo
- [ ] Repo: `longtho638-jpg/sophia-ai-factory`
- [ ] Branch `main` = production
- [ ] Branch protection rules configured

### 7. Inngest (Background Jobs)

- [ ] Invite client vao Inngest dashboard / Invite client to Inngest dashboard
- [ ] Signing key trong Cloudflare Workers secrets / Signing key in Cloudflare Workers secrets

---

## What Client Provides / Khach Hang Cung Cap

### API Keys Can Thiet / Required API Keys

| Service | Purpose / Muc Dich | Where to Get / Lay O Dau |
|---|---|---|
| **OpenRouter** | AI script generation / Tao noi dung video | https://openrouter.ai/keys |
| **ElevenLabs** | AI voice generation / Tao giong noi | https://elevenlabs.io/app/settings/api-keys |
| **HeyGen** | AI video generation / Tao video | https://app.heygen.com/settings |

### Cach Nhap API Keys / How to Enter API Keys

1. Truy cap / Visit: `https://sophia.agencyos.network/setup-wizard`
2. Buoc 1: System Check (tu dong / automatic)
3. Buoc 2: Nhap API Keys / Enter API Keys
4. Buoc 3: Kiem tra Database / Database Check
5. Buoc 4: Hoan Tat / Complete

### Thong Tin Khac / Other Information

- [ ] **Admin email** cho Magic Link login / for Magic Link login: _______________
- [ ] **Telegram chat ID** cua admin / Admin's Telegram chat ID: _______________

---

## Security Notes / Ghi Chu Bao Mat

- **KHONG** chia se API keys qua email thuong / **DO NOT** share API keys via regular email
- Su dung kenh an toan nhu 1Password, Signal, hoac mat doi mat
- Use secure channels like 1Password, Signal, or in-person
- Doi mat khau Supabase sau khi ban giao / Change Supabase password after handover
- Xoay (rotate) service role key sau khi ban giao / Rotate service role key after handover

---

## Sign-Off / Xac Nhan Ban Giao

| | Agency | Client |
|---|---|---|
| **Ten / Name** | _______________ | _______________ |
| **Chu Ky / Signature** | _______________ | _______________ |
| **Ngay / Date** | _______________ | _______________ |
