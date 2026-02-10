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

### 2. Vercel (Hosting)

- [ ] Invite client vao Vercel project (viewer hoac admin)
- [ ] Invite client to Vercel project (viewer or admin)
- [ ] Vercel project: `sophia-ai-factory`
- [ ] Auto-deploy tu `main` branch hoat dong / Auto-deploy from `main` branch working

### 3. Supabase (Database & Auth)

- [ ] Invite client vao Supabase project
- [ ] Invite client to Supabase project
- [ ] Project name: _______________
- [ ] Region: _______________
- [ ] Auth (Magic Link) hoat dong / Auth (Magic Link) working
- [ ] RLS policies configured

### 4. Polar.sh (Payments)

- [ ] Chuyen quyen Polar merchant account / Transfer Polar merchant account ownership
- [ ] Hoac invite client vao organization / Or invite client to organization
- [ ] 4 san pham da cau hinh / 4 products configured:
  - [ ] Starter ($199/mo)
  - [ ] Growth ($399/mo)
  - [ ] Premium ($799/mo)
  - [ ] Master ($4,999 one-time)
- [ ] Webhook URL: `https://sophia.agencyos.network/api/webhooks/polar`

### 5. Telegram Bot

- [ ] Chuyen quyen bot @Sophia_Bbot / Transfer bot @Sophia_Bbot ownership
- [ ] Bot token duoc luu trong Vercel env vars / Bot token stored in Vercel env vars
- [ ] Webhook URL: `https://sophia.agencyos.network/api/webhooks/telegram`

### 6. GitHub Repository

- [ ] Invite client vao repo (collaborator) / Invite client to repo
- [ ] Repo: `longtho638-jpg/sophia-ai-factory`
- [ ] Branch `main` = production
- [ ] Branch protection rules configured

### 7. Inngest (Background Jobs)

- [ ] Invite client vao Inngest dashboard / Invite client to Inngest dashboard
- [ ] Signing key trong Vercel env vars / Signing key in Vercel env vars

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
