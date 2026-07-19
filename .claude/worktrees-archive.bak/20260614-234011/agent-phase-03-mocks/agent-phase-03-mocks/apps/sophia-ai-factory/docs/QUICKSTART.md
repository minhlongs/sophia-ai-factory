# Sophia AI Factory — Quick Start

Get local dev running in 5 minutes. Deploy to production in 10.

## Prerequisites

- **Node**: 18+ (check `package.json`, no `.nvmrc` present)
- **pnpm** or npm (project uses pnpm)
- **Cloudflare account** (for production deploy only)
- **wrangler CLI**: `npm install -g wrangler`

## Local Setup (5 min)

```bash
# 1. Clone & install
git clone <repo>
cd apps/sophia-ai-factory
pnpm install

# 2. Environment file
cp .env.example .env.local

# Edit .env.local with mock values (dev uses SQLite in-memory)
# For full testing: add real API keys (OpenRouter, ElevenLabs, D-ID, Telegram)

# 3. Run dev server
pnpm run dev

# 4. Open http://localhost:3000
# Mock AI services enabled by default (NEXT_PUBLIC_MOCK_AI_SERVICES=true)
```

## Local Dev Mode Behavior

- **Database**: SQLite in-memory (no persistence between restarts)
- **AI Services**: Mocked (fast, no API calls) unless you add real keys to `.env.local`
- **Crons**: Disabled (Inngest/scheduled jobs don't run)
- **Telegram Bot**: Offline (webhook to @Sophia_Bbot unavailable locally)
- **R2/KV Cache**: Disabled (in-memory only)

To test with real services: add keys to `.env.local`, set `NEXT_PUBLIC_MOCK_AI_SERVICES=false`.

## First Deploy (10 min)

**Before push:** ensure build + tests pass locally.

```bash
# 1. Typecheck + build
pnpm run type-check
pnpm run build

# 2. Run tests (4700+ tests, ~40s)
pnpm run ci:test

# 3. Push to git
git push origin main

# 4. Deploy to Cloudflare
pnpm run deploy:full

# 5. Verify SHA match (CRITICAL — proves new code is live)
LOCAL_SHA=$(git rev-parse HEAD | cut -c1-8)
LIVE_SHA=$(curl -s https://sophia.agencyos.network/api/version | jq -r .shortSha)
echo "Local: $LOCAL_SHA  Live: $LIVE_SHA"
[ "$LOCAL_SHA" = "$LIVE_SHA" ] && echo "✅ DEPLOYED" || echo "❌ STALE"

# 6. Check migrations (if migrations/* changed)
pnpm run deploy:migrations
```

## Pre-Push Gates (Local CI)

The pre-push hook enforces 5 gates (see `.husky/pre-push`):

| Gate | Command | Must Pass |
|---|---|---|
| G1 | `npm run ci:typecheck` (tsc --noEmit) | YES |
| G2 | `npm run ci:lint` (eslint, 341 warnings baseline) | YES |
| G3 | `npm run ci:test` (vitest run, 4702 tests) | YES |
| G4 | `npm run ci:secrets` (secretlint) | YES |
| G5 | `npm audit --audit-level=high` | WARNING only |

**If G1/G2/G3 fail:** fix the issue, re-commit, push again. Pre-push guard blocks you.

## Key Gate: G0.5 — Typecheck

Added since 2026-05-20 (Phase 01): GitHub Actions `.github/workflows/test.yml.disabled` was replaced by CF-direct doctrine + pre-push enforcement. Typecheck runs first; blocks if TS errors present.

```bash
# Check your code before commit
pnpm run type-check

# Check with biome (auto-formatted on save)
pnpm run lint -- --fix
```

## Manual D1 Migrations

If `migrations/` directory has new `.sql` files:

```bash
pnpm run deploy:migrations
# or manually:
npx wrangler d1 execute sophia-raas-db --file=migrations/NNNN_name.sql --remote
```

## Common Gotchas

1. **Build fails on `turbopack`**: Ensure Node 18+. Use `NODE_OPTIONS=--max-old-space-size=14336 pnpm run build`.
2. **Tests timeout**: Run `pnpm run ci:test` directly (pre-push hook may time out on slow machines).
3. **SHA doesn't match after deploy**: Verify you pushed to origin BEFORE running `deploy:full`. Script rejects if `git log origin/main..HEAD` non-empty.
4. **Telegram bot offline locally**: Expected. Add `TELEGRAM_BOT_TOKEN` + set webhook manually for testing.
5. **E2E tests fail with mock services**: Tests assume mock mode. Run with `NEXT_PUBLIC_MOCK_AI_SERVICES=true` (default).

## Deployed Stack (Production)

- **Workers**: CF-direct (Cloudflare Workers, OpenNext adapter)
- **Database**: D1 `sophia-raas-db`
- **Cache**: R2 `sophia-ai-factory-opennext-cache`
- **KV**: Supabase (auth sessions, feature flags)
- **Crons**: Inngest (scheduled jobs for video generation, billing, quota enforcement)
- **Monitoring**: Sentry (error tracking; source maps optional)

## Next Steps

1. **Architecture deep dive**: [docs/system-architecture.md](./system-architecture.md) — layer boundaries, request flow
2. **Deployment troubleshooting**: `.claude/rules/sophia-deploy-verify.md` — SHA verification, rollback
3. **Code standards**: [docs/code-standards.md](./code-standards.md) — imports, tier config, DB client pattern
4. **Runbooks**: [docs/](./docs/) folder — incident response, migrations, security

## Support

- **Local dev issues**: Check `.env.local` has mock API keys or real ones (pick one consistently)
- **Deploy issues**: Run `pnpm run deploy:verify` post-deploy for health check
- **Test failures**: Run `pnpm run ci:test -- --reporter=verbose` to see full output
- **Audit issues**: Phase 01 reports at `plans/260521-2342-go-live-100-audit/` document known gaps + fixes
