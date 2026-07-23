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

- `apps/sophia-ai-factory/` - canonical production app deployed to Cloudflare Workers.
- `apps/84tea/` - secondary Next.js app; not part of Sophia production deploy.
- `services/` - optional sidecar service blueprints (`coqui-tts`, `moviepy-render`, `runpod-hunyuan`). These are external workers, not loaded by the main Next runtime.
- `scripts/` - root automation and verification helpers. App deploy helpers live under `apps/sophia-ai-factory/scripts/`.
- `supabase/` - legacy/shared migration artifacts; Sophia production persistence is Cloudflare D1 from the app package.
- `docs/` - operator and cross-project documentation.
- `apps/sophia-ai-factory/docs/` - engineering-internal Sophia runbooks, migrations, and launch notes.
- `plans/` - implementation plans and audit reports.
- `.claude/`, `.opencode/`, `.agent/`, `.sophia-factory/`, `.mekong/` - agent/tooling instructions and generated operational context.
- `.github/workflows/`, `.gitlab-ci.yml` - auxiliary automation. GitHub deploy workflow is intentionally disabled; production deploy is CF-direct from the app package.

There is no active root `packages/` workspace. Treat the root package as orchestration/tooling context and treat `apps/sophia-ai-factory/package.json` as the canonical Sophia app package.

## Tech Stack

- **Framework**: Next.js 16 (App Router, React 19, TypeScript)
- **Database**: Cloudflare D1 (SQLite) + Supabase (Postgres)
- **Payments**: NOWPayments (USDT crypto) + PayOS (Vietnam domestic)
- **Email**: Resend (mekongmind.com verified domain)
- **Bot**: Telegram (@Sophia_Bbot)
- **AI Services**: HeyGen, ElevenLabs, MuAPI (100+ models), OpenRouter
- **Auth**: Better Auth v1.6.2 with D1 Kysely adapter (email/password + magic link + org plugin)
- **Deployment**: Cloudflare Workers via CF-direct `npm run deploy:full` from `apps/sophia-ai-factory`
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
- **Deploy doctrine**: GitHub Actions deploy is disabled by design; push first, run `npm run deploy:full` from `apps/sophia-ai-factory`, then verify `/api/version` SHA.
- **Validation**: `npm run type-check`, `npm run build`, `npm run ci:test`, and Playwright smoke suites live in the app package.
- **Pre-deploy gate**: Runs automatically before deploy via `scripts/pre-deploy-gate.mjs` — checks git clean, tests, typecheck, secrets, migrations.
- **Post-deploy smoke**: Basic health checks run after deploy (`scripts/post-deploy-smoke.mjs`). Full E2E smoke can be enabled with `RUN_POSTDEPLOY_E2E=1`.
- **Runbooks**: Incident response procedures in `apps/sophia-ai-factory/docs/runbooks/`.
- **Order review queue**: Admin can review pending checkout orders at `/dashboard/admin/checkout-review` to resolve payment mismatches and manual activation cases.

## Canonical Runtime Paths

- Auth session: `@/seed/auth/better-auth-session`
- Better Auth server: `@/seed/auth/better-auth-server`
- D1 client: `@/seed/db/client`
- Tier lookup: `@/seed/db/get-user-tier`
- Tier config: `@/seed/config/tiers`
- NOWPayments client: `@/tree/clients/nowpayments-client`
- Mission dispatcher: `@/forest/missions/dispatcher`
- Billing workflows: `@/land/billing`

## Onboarding Reading Order

1. `docs/codebase-summary.md` - repo map, ownership boundaries, runtime entrypoints, risk register.
2. `docs/system-architecture.md` - request/data flow, deployment topology, cron/Inngest/payment/video architecture.
3. `docs/deployment-guide.md` - local setup, secrets, CF-direct deploy, post-deploy verification.
4. `docs/code-standards.md` - canonical imports, type-safety rules, DB patterns.
5. `docs/troubleshooting.md` and `apps/sophia-ai-factory/docs/testing-guide.md` - operational debugging and test execution.
