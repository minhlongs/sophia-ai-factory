---
title: "Sophia AI Factory Phase 2 Go-Live Plan"
description: "Deployment, Telegram Bot, and Customer Onboarding for Go-Live"
status: pending
priority: P1
effort: 3d
branch: master
tags: [deployment, telegram, onboarding, supabase]
created: 2026-02-05
---

# Sophia AI Factory Phase 2 Go-Live Plan

**Goal**: Deploy Phase 2 Auto-Discovery Engine to production with Telegram integration and secure customer onboarding.

## 1. Infrastructure Setup (Supabase + Vercel)
**Objective**: Production-ready database and deployment.

- **Supabase**:
  - Create Project: `sophia-prod`
  - Run Migrations: `001_create_sophia_index.sql` + `002_api_security.sql`
  - **NEW**: Add `003_user_integrations.sql` for secure key storage.
- **Vercel**:
  - Configure Environment Variables (Supabase, Polar, Telegram, AI Keys).
  - Deploy to `sophia.ai` (or staging URL).

## 2. Telegram Bot Integration
**Objective**: Allow users to trigger discovery and get scripts via Telegram.

- **Tech**: Webhook-based bot using Next.js API route (`/api/webhooks/telegram`).
- **Features**:
  - `/start`: Link Telegram account to Sophia user.
  - `/discover [niche]`: Trigger top 5 products search.
  - `/script [url]`: Generate script for a product.
- **Integration**: Connects to `src/lib/intelligence` and `src/app/api/intelligence`.

## 3. Customer Onboarding & Security
**Objective**: Secure UI for users to add their affiliate network keys.

- **UI**: Add "Integrations" tab to `src/app/(admin)/admin/settings`.
- **Backend**:
  - Securely store API keys (ClickBank/ShareASale) in `user_integrations` table.
  - Use RLS to ensure users only access their own keys.
  - Encryption at rest (pgcrypto or app-level encryption).

## 4. Payment & Access Flow
**Objective**: Automate access grant upon purchase.

- **Polar Webhook**: Update `src/app/api/webhooks/polar/route.ts` to handle `subscription.created` and `order.created`.
- **Database**: Update user `tier` in `users` table (auth schema) upon payment.

## 5. End-to-End Verification
**Objective**: Validated Go-Live.

- **Test Plan**:
  1. User signs up → Connects Telegram.
  2. User buys "Pro" plan via Polar → Account upgraded.
  3. User inputs ClickBank keys in Settings.
  4. User types `/discover health` in Telegram.
  5. Sophia replies with Top 5 products + Scripts.

---

## Detailed Phases

- [Phase 1: Infrastructure](./phase-01-infrastructure.md)
- [Phase 2: Telegram Bot](./phase-02-telegram-bot.md)
- [Phase 3: Customer Onboarding](./phase-03-onboarding.md)
- [Phase 4: Testing](./phase-04-testing.md)

## Environment Variables

```bash
# Core
NEXT_PUBLIC_APP_URL=https://sophia-ai.com

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Polar (Payments)
POLAR_ACCESS_TOKEN=
POLAR_WEBHOOK_SECRET=

# Telegram
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=

# Affiliate Networks (System Default - fallback)
CLICKBANK_API_KEY=
SHAREASALE_API_KEY=

# AI Services
OPENROUTER_API_KEY=
ELEVENLABS_API_KEY=
DID_API_KEY=
```
