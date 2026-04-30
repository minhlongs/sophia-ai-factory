# Go-Live Deployment Checklist

## Pre-Deployment
- [ ] **Env Vars**: All secrets set in Cloudflare Workers (`npx wrangler secret list`)
  - `BETTER_AUTH_SECRET`, `NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET`
  - `HEYGEN_API_KEY`, `ELEVENLABS_API_KEY`, `OPENROUTER_API_KEY`
  - `TELEGRAM_BOT_TOKEN`, `CRON_SECRET`, `RESEND_API_KEY`
  - `SENTRY_AUTH_TOKEN`, `INTERNAL_API_SECRET`
- [ ] **D1 Migrations**: Run `npx wrangler d1 migrations apply sophia-raas-db` against production
- [ ] **Build**: `npm run build` — 0 TypeScript errors
- [ ] **Tests**: `npm test` — all 1,798 tests pass

## Deployment
- [ ] **OpenNext build**: `npm run deploy:build`
- [ ] **Deploy**: `npx wrangler deploy`
- [ ] **Verify SHA**: `curl -s https://sophia.agencyos.network/api/version` matches `git rev-parse HEAD | cut -c1-8`

## Post-Deployment Verification
- [ ] All routes 200: `/`, `/login`, `/pricing`, `/blog`, `/guide`
- [ ] Auth gate 307: `/dashboard` → `/login`
- [ ] Signup redirect 301: `/signup` → `/login`
- [ ] NOWPayments IPN webhook configured and tested
- [ ] HeyGen webhook configured and tested
- [ ] Telegram bot `/start` responds
- [ ] Checkout flow: click tier on /pricing → NOWPayments redirect OK
- [ ] Sentry receiving production errors/events
- [ ] OG image previews work (no localhost:3000 in meta tags)
