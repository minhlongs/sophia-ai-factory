# Operator Guide — Solo Company Media

> **Mục đích / Purpose**
> VN: Hướng dẫn toàn diện cho Solo Company Media vận hành Sophia AI Factory.
> EN: Comprehensive guide for Solo Company Media operating Sophia AI Factory.

## Platform Overview

**Sophia AI Factory** là nền tảng SaaS cho phép CEO tạo video AI tự động (faceless YouTube, affiliate content) — không cần kỹ thuật.

**What it does:**
- Nhận API key từ khách hàng (OpenRouter, ElevenLabs, D-ID, HeyGen) qua Setup Wizard
- Tự động tạo video campaign theo SOP (Standard Operating Procedure)
- Quản lý thanh toán + subscription (NOWPayments USDT / PayOS VND)
- Gửi kết quả qua Telegram bot (@Sophia_Bbot)

---

## Customer Journey

```
Signup → Setup Wizard → First Video → Subscription → Scale
```

| Step | Action | System |
|------|--------|--------|
| 1 | Đăng ký tài khoản | Better Auth |
| 2 | Nhập API keys | Setup Wizard (BYOK) |
| 3 | Chọn tier | Pricing page |
| 4 | Thanh toán | NOWPayments / PayOS / Cash |
| 5 | Nhận magic link | Email |
| 6. | Tạo campaign | Telegram bot hoặc Dashboard |

---

## Revenue Model

| Tier | Price | MCU Limit | SOPs |
|------|-------|-----------|------|
| BASIC | $199 | 1,000 | 3 |
| PREMIUM | $399 | 5,000 | 8 |
| ENTERPRISE | $799 | 20,000 | 15 |
| MASTER | $4,999 | 100,000 | 25 |

**Payment providers:**
- **NOWPayments** (USDT) — primary, global
- **PayOS** (VND bank transfer) — Vietnam domestic
- **Cash/Offline** — manual approval (first customer)

---

## Protected Flows (DO NOT BREAK)

1. **Setup Wizard** — BYOK API key onboarding (OpenRouter, ElevenLabs, D-ID, HeyGen)
2. **Telegram Bot** — @Sophia_Bbot commands (`/campaign`, `/status`, `/results`)
3. **Payment Flow** — NOWPayments IPN webhook → tier activation

Any change touching these requires manual testing before deploy.

---

## Key Commands

```bash
# Dev server
npm run dev                    # :3000

# Quality gates
npm run build                  # Production build (0 TS errors)
npm test                       # All tests (6694+)
npm run lint                   # ESLint

# Deploy
npm run deploy:full            # CF-direct deploy + SHA verify

# Database
bash scripts/apply-migrations.sh   # Apply new migrations
npx wrangler d1 execute sophia-raas-db --remote   # Run SQL

# Monitoring
npx wrangler tail --format pretty   # Live logs
```

---

## Layer Architecture (Quick Reference)

| Layer | Purpose | Example |
|-------|---------|---------|
| **seed** | Foundational (auth, DB, config, types) | `@/seed/auth/better-auth-session` |
| **tree** | Domain logic (BYOK, handover, telegram) | `@/tree/byok/`, `@/tree/telegram/` |
| **forest** | Infrastructure (Inngest, quota, metering) | `@/forest/inngest/`, `@/forest/quota/` |
| **land** | Business workflows (billing, payouts) | `@/land/billing/`, `@/land/payouts/` |

**Rule:** seed → tree → forest → land (no reverse imports)

---

## i18n

All customer-facing content is bilingual (Vietnamese + English).
- Default locale: `vi`
- Messages: `messages/vi.json`, `messages/en.json`
- Use `useTranslations()` (client) or `getTranslations()` (server)

---

## No-Tech Doctrine

- **Customer** self-inputs everything (API keys, payments)
- **Operator** manages platform only (deploy, monitoring, billing)
- No operator third-party credentials required for production go-live
- No external cron registrations (Upstash QStash) — route exists for ad-hoc use

---

## Emergency Contacts

| Who | Contact |
|-----|---------|
| CEO (Long Tho) | [Operator contact] |
| Cloudflare Support | https://dash.cloudflare.com/support |
| NOWPayments Support | https://nowpayments.io/support |
| Telegram Bot API | https://core.telegram.org/bots/api |
