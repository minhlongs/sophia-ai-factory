# Sophia AI Factory

> AI Video Factory — SaaS platform for automated AI video creation
> Binh Pháp Venture Studio 2026

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

## Tech Stack

- **Framework**: Next.js 16 (App Router, React 19, TypeScript)
- **Database**: Supabase (Postgres + Auth + Storage)
- **Payments**: Polar.sh (subscriptions, webhooks)
- **Bot**: Telegram (Telegraf + webhook mode)
- **AI Services**: HeyGen, ElevenLabs, OpenRouter
- **Background Jobs**: Inngest
- **i18n**: next-intl
- **Styling**: Tailwind CSS 4

## Revenue Stack

- Polar.sh subscription management (Starter / Growth / Premium)
- PPP (Purchasing Power Parity) pricing
- Telegram bot for user onboarding & commands
- Automated subscription lifecycle notifications
