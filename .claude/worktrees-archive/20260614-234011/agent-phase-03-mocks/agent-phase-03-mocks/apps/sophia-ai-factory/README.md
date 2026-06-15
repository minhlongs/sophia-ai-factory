# Sophia AI Factory

No-code RaaS for non-technical CEOs running faceless YouTube + affiliate empires.  
Automated video production with BYOK (bring your own AI keys).

## Production

| Item | Value |
|---|---|
| **URL** | https://sophia.agencyos.network |
| **Current SHA** | `d86659bf` (verify: `curl -s https://sophia.agencyos.network/api/version \| jq .shortSha`) |
| **Status** | Production (next.js 16 + D1 + R2 + Better Auth + NOWPayments) |

## Stack

- **Runtime**: Next.js 16 (App Router, React 19, TypeScript strict)
- **Database**: Cloudflare D1 (SQLite) — primary; Supabase (Postgres) exceptions for OAuth
- **Auth**: Better Auth v1.6.2 (email/password, magic link, org plugin)
- **Payments**: NOWPayments (USDT) + PayOS (Vietnam domestic)
- **Video**: ElevenLabs (voice) + HeyGen/D-ID (avatars) + MuAPI (100+ models)
- **Background**: Inngest (job orchestration)
- **i18n**: next-intl (Vietnamese + English)
- **Deploy**: Cloudflare Workers (CF-direct: `npm run deploy:full`)

## Tier Model

| Tier | Label | Price |
|---|---|---|
| BASIC | Starter | $199/mo |
| PREMIUM | Growth | $399/mo |
| ENTERPRISE | Premium | $799/mo |
| MASTER | Master | $4,999/mo |

All tiers BYOK: customers provide OpenRouter, ElevenLabs, HeyGen keys via Setup Wizard. Platform handles tier activation (NOWPayments IPN webhook) and usage enforcement.

## Development

- **Node**: check package.json
- **Quick start**: see [QUICKSTART.md](./docs/QUICKSTART.md)
- **Architecture**: [docs/system-architecture.md](./docs/system-architecture.md) (seed → tree → forest → land 4-layer model)
- **Deploy doctrine**: CF-direct via `npm run deploy:full` (GitHub Actions disabled by design 2026-05-03; see `.claude/rules/sophia-deploy-verify.md` for verification sequence)
- **Code standards**: [docs/code-standards.md](./docs/code-standards.md) (zero `:any`, Zod validation, Server Actions for mutations)

## Key Docs

1. **Setup**: [docs/QUICKSTART.md](./docs/QUICKSTART.md) — 5-minute local dev + first deploy
2. **Architecture**: [docs/system-architecture.md](./docs/system-architecture.md) — request flow, layer boundaries, Inngest/crons
3. **Deployment**: `.claude/rules/sophia-deploy-verify.md` — CF-direct verify sequence, SHA match check
4. **Runbooks**: [docs/](./docs/) — incident response, migration tracking, security protocols
5. **Status**: [plans/260521-2342-go-live-100-audit/](../../../plans/260521-2342-go-live-100-audit/) — Phase 1 synthesis + research reports

## Protected Flows (Do Not Break)

1. Setup Wizard → API key onboarding
2. Telegram Bot (@Sophia_Bbot) → `/campaign`, `/status`, `/results`
3. Payment → NOWPayments IPN webhook → tier activation
