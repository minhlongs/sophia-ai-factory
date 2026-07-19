---
title: "Sophia AI Factory — Handover Package"
version: "1.0"
date: 2026-07-18
status: FINAL
---

# Sophia AI Factory — Handover Package

## 🎯 What This Package Is

Bàn giao toàn bộ Sophia AI Factory platform — production-ready SaaS cho AI video generation.

**Production URL:** `https://sophia.agencyos.network`
**Repository:** `git@github.com:agency-os/sophia-ai-factory.git`

---

## 📦 What's Included

| # | Component | Description |
|---|-----------|-------------|
| 1 | **Next.js 16 App** | SSR + Edge runtime, deploy trên Cloudflare Workers |
| 2 | **Better Auth** | Email/password + MFA + tier enforcement |
| 3 | **BYOK System** | Customer quản lý API keys riêng (OpenRouter, ElevenLabs, D-ID) |
| 4 | **Video Pipeline** | AI video generation → HeyGen / ElevenLabs / D-ID |
| 5 | **Telegram Bot** | @Sophia_Bbot — commands: /start, /campaign, /status, /results |
| 6 | **Payment System** | NOWPayments (crypto) + PayOS (Vietnam) → tier activation |
| 7 | **Dashboard** | Admin + user dashboard, 20+ modules |
| 8 | **Billing Engine** | MCU metering, overage billing, dunning workflow |
| 9 | **White-label** | Agency mode — custom branding per org |
| 10 | **Inngest** | Background workflows: video gen, email, analytics sync |
| 11 | **i18n** | Vietnamese + English (next-intl) |

---

## ⚡ Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | v20+ | Runtime |
| pnpm | v8+ | Package manager |
| Wrangler CLI | Latest | CF Workers deploy |
| Git | Latest | Version control |
| wrangler login | — | Cloudflare auth |

---

## 🚀 Quick Start (30 min)

### 1. Clone Repository
```bash
git clone git@github.com:agency-os/sophia-ai-factory.git
cd sophia-ai-factory
```

### 2. Install Dependencies
```bash
cd apps/sophia-ai-factory
pnpm install
```

### 3. Environment Setup
```bash
cp .env.example .env
# Edit .env with your credentials (see env guide below)
```

### 4. Local Database (D1)
```bash
npx wrangler d1 migrations apply DB --local
```

### 5. Run Dev Server
```bash
pnpm run dev
# Open http://localhost:3000
```

---

## 🔑 Environment Variables

### Required (Production)
| Variable | Purpose | Where to Get |
|----------|---------|-------------|
| `BETTER_AUTH_SECRET` | Auth signing key | `openssl rand -hex 32` |
| `BETTER_AUTH_URL` | Auth callback URL | Your production domain |
| `DATABASE_URL` | D1 binding | Cloudflare dashboard |
| `OPENROUTER_API_KEY` | LLM routing | openrouter.ai |
| `INNGEST_EVENT_KEY` | Workflow queue | inngest.com |
| `INNGEST_SIGNING_KEY` | Webhook signing | inngest.com |
| `NEXT_PUBLIC_APP_URL` | Frontend URL | Your production domain |

### Optional (Enhanced Features)
| Variable | Purpose |
|----------|---------|
| `POSTHOG_API_KEY` | Analytics |
| `SENTRY_DSN` | Error tracking |
| `HONEYCOMB_API_KEY` | Observability |
| `TELEGRAM_BOT_TOKEN` | Telegram bot |
| `NOWPAYMENTS_API_KEY` | Crypto payments |
| `PAYOS_CLIENT_ID` | Vietnam payments |

Full list: `apps/sophia-ai-factory/.env.example`

---

## 🚢 Deploy to Production (15 min)

```bash
# Step 1: Push nếu có local changes
git push origin main

# Step 2: Build + Deploy
cd apps/sophia-ai-factory
pnpm run deploy:full

# Step 3: Verify deploy
pnpm run deploy:verify
```

**Expected output:**
- `deploy-with-sha.sh` exits 0
- `/api/version` `shortSha` matches local commit
- HTTP 200 on `https://sophia.agencyos.network`

---

## ✅ Smoke Test Checklist

Sau khi deploy xong, verify các protected flows:

| # | Flow | Check | Expected |
|---|------|-------|----------|
| 1 | **Setup Wizard** | Sign up → add API keys → see dashboard | Keys encrypted, dashboard loads |
| 2 | **Telegram Bot** | Send `/start` to @Sophia_Bbot | Bot responds within 5s |
| 3 | **Payment** | Trigger NOWPayments IPN | Tier activates within 60s |
| 4 | **API Version** | GET `/api/version` | Returns `shortSha` matching deploy |
| 5 | **Health Check** | GET `/api/health/detail` | HTTP 401 (auth gate working) |

---

## 📁 Project Structure

```
apps/sophia-ai-factory/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── [locale]/           # i18n routes
│   │   ├── (app)/              # Protected app routes
│   │   └── (auth)/             # Auth pages (login/register)
│   ├── seed/                   # Foundational primitives (auth, DB, config)
│   ├── tree/                   # Domain logic (BYOK, Telegram, email)
│   ├── forest/                 # Infrastructure (Inngest, webhooks, onboarding)
│   └── land/                   # Business workflows (billing, payouts)
├── migrations/                 # D1 database migrations (0001→0020)
├── docs/                       # Internal documentation
├── .claude/                    # Claude Code config + rules
├── wrangler.toml               # Cloudflare Workers config
├── next.config.ts              # Next.js config
└── package.json                # Dependencies
```

**Layer Rules (MANDATORY):**
- `seed` → importable by ALL layers
- `tree` → imports `seed` only
- `forest` → imports `seed`, `tree` (may CALL `land`)
- `land` → imports `seed`, `tree`, `forest`
- **FORBIDDEN:** Reverse imports, circular dependencies

---

## 📋 v1.0 Scope

### ✅ Delivered
- Next.js 16 + Cloudflare Workers deployment
- Better Auth + MFA + tier enforcement
- AI video generation (HeyGen/ElevenLabs/D-ID BYOK)
- Telegram bot (@Sophia_Bbot)
- NOWPayments + PayOS payment integration
- MCU metering + overage billing + dunning
- Admin + user dashboard (20+ modules)
- White-label agency mode
- Bilingual VN+EN i18n
- Inngest background workflows

### 📝 Known Limitations (V2 Backlog)
See `V2_BACKLOG.md` for complete list.

---

## 📞 Support & Escalation

| Issue Type | Escalation Path |
|------------|----------------|
| Platform bug | GitHub Issues → `agency-os/sophia-ai-factory` |
| Payment issue | support@mekongmind.com |
| Telegram bot issue | @Sophia_Bbot → /help |
| Infrastructure | Cloudflare dashboard → Workers → Logs |

---

## 📄 Related Documents

- [Activation Runbook](../docs/sophia-activation-runbook.md) — Step-by-step deploy activation
- [Development Guide](../docs/go-live-readiness/DEVELOPMENT_GUIDE.md) — Local setup + testing
- [V2 Backlog](./V2_BACKLOG.md) — Post-handover improvements
- [Operator Runbook](./OPERATOR_RUNBOOK.md) — Daily ops checklist
- [Architecture Overview](../docs/system-architecture.md) — System design

---

## ✓ Handover Sign-Off

| Party | Name | Signature | Date |
|-------|------|-----------|------|
| **Developer** | Sophia AI Factory Team | ________________ | 2026-07-18 |
| **Customer** | _____________________ | ________________ | ___________ |

---

**Handover Version:** 1.0
**Production Status:** ✅ Live at sophia.agencyos.network
**Build Status:** ✅ 0 TS errors | 7177/7357 tests pass
**Last Gate Audit:** 2026-07-18
