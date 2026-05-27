# Go-Live Deployment Checklist

## Pre-Deployment
- [ ] **Env Vars**: All secrets set in Cloudflare Workers (`npx wrangler secret list`)
  - `BETTER_AUTH_SECRET`, `NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET`
  - `HEYGEN_API_KEY`, `ELEVENLABS_API_KEY`, `OPENROUTER_API_KEY`
  - `TELEGRAM_BOT_TOKEN`, `CRON_SECRET`, `RESEND_API_KEY`
  - `SENTRY_AUTH_TOKEN`, `INTERNAL_API_SECRET`
  - `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET` (Phase 1: Facebook publisher)
  - `TWITTER_CLIENT_ID`, `TWITTER_CLIENT_SECRET` (Phase 1: X/Twitter publisher)
  - `NEXT_PUBLIC_SENTRY_DSN` (Phase 1: Sentry client initialization), optionally `SENTRY_DSN` (server-side)
- [ ] **D1 Migrations**: Run `npx wrangler d1 migrations apply sophia-raas-db` against production
- [ ] **Build**: `npm run build` — 0 TypeScript errors
- [ ] **Tests**: `npm test` — all 1,798 tests pass
- [ ] **Production E2E user**: `E2E_TEST_USER_PASSWORD` available in operator shell/secret manager

## Deployment
- [ ] **Deploy**: `npm run deploy:full` (build + wrangler deploy + go-live user E2E)
- [ ] **Verify SHA**: `curl -s https://sophia.agencyos.network/api/version` matches `git rev-parse HEAD | cut -c1-8`

## Post-Deployment Verification
- [ ] All routes 200: `/`, `/login`, `/pricing`, `/blog`, `/guide`
- [ ] Auth gate 307: `/dashboard` → `/login`
- [ ] Signup redirect 301: `/signup` → `/login`
- [ ] NOWPayments IPN webhook configured and tested
- [ ] HeyGen webhook configured and tested
- [ ] Telegram bot `/start` responds
- [ ] Checkout flow: click tier on /pricing → NOWPayments redirect OK
- [ ] Go-live user E2E passed: auth session, dashboard, video creation, account, billing
- [ ] Sentry receiving production errors/events
- [ ] OG image previews work (no localhost:3000 in meta tags)
- [ ] **Phase 1 (Facebook + X)**: Verify OAuth flows
  - Facebook: `curl -s "https://sophia.agencyos.network/api/oauth/facebook/connect?state=test" | head -5` → redirect to FB login
  - Twitter: `curl -s "https://sophia.agencyos.network/api/oauth/twitter/connect?state=test" | head -5` → redirect to X login
  - Callback routes exist + handle auth code → token exchange
- [ ] **Phase 1 (Sentry)**: Verify smoke route (admin-only)
  - `curl -s "https://sophia.agencyos.network/api/dev/sentry-test?token=<admin-token>" | jq .` → `{status: "test_event_sent"}`
  - Check Sentry dashboard → new event visible with correct DSN
- [ ] **Phase 1 (Publishers)**: Verify both publishers registered
  - Dashboard publishing UI shows facebook + twitter/X in provider list
  - `/api/publishers/list` includes both (verify via API call)
