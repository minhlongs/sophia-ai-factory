# Sophia AI Factory

> AI Video Factory — SaaS platform for automated AI video creation
> Binh Phap Venture Studio 2026

## Quick Start

```bash
cd apps/sophia-ai-factory
npm install
npm run dev
```

## Structure

- `apps/sophia-ai-factory/` - Next.js 16 App Router (main application)
- `docs/` - Project documentation
- `plans/` - Implementation plans & reports
- `.mekong/` - BizPlan OS (company.json + CTO missions)

## Tech Stack

- **Framework**: Next.js 16 (App Router, React 19, TypeScript)
- **Database**: Cloudflare D1 (SQLite) + Supabase (Postgres)
- **Payments**: NOWPayments (USDT crypto) + PayOS (Vietnam domestic)
- **Email**: Resend (mekongmind.com verified domain)
- **Bot**: Telegram (@Sophia_Bbot)
- **AI Services**: HeyGen, ElevenLabs, MuAPI (100+ models), OpenRouter
- **Auth**: Better Auth v1.6.2 with D1 Kysely adapter (email/password + magic link + org plugin)
- **Deployment**: Cloudflare Workers via GitHub Actions
- **Background Jobs**: Inngest
- **i18n**: next-intl (Vietnamese + English)
- **Styling**: Tailwind CSS 4

## Revenue Stack

- NOWPayments subscription management (BASIC $199 / PREMIUM $399 / ENTERPRISE $799 / MASTER $4,999)
- BYOK — Customers bring their own API keys (zero vendor lock-in)
- Telegram bot for user onboarding & commands
- Automated subscription lifecycle notifications

## Production

- **URL**: https://sophia.agencyos.network
- **CI/CD**: GitHub Actions → Cloudflare Workers auto-deploy
- **Tests**: 863 passing (Vitest)
