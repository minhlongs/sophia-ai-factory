# Sophia AI Factory Rules

- Core stack: Next.js 16 + D1 (Cloudflare) + Better Auth + NOWPayments (crypto/USDT)
- DB: `createServerClient()` from `@/lib/db/client` (sync, NOT async)
- Auth: `getCurrentUser()` from `@/lib/better-auth-session`
- Tier config: `@/config/tiers` (single source of truth)
- Render video (Remotion) must not block Cloudflare Workers edge functions
- Payment: NOWPayments IPN webhooks for tier activation
- Polar.sh REJECTED this product — DO NOT use Polar for Sophia
- PayOS is backup for Vietnam domestic payments
- App code lives in `apps/sophia-ai-factory/` — run build/test from there
- **Deploy doctrine:** CF-direct via `npm run deploy:full` (wrangler CLI). GitHub Actions disabled by design since 2026-05-03. See `apps/sophia-ai-factory/CLAUDE.md` for canonical flow.
