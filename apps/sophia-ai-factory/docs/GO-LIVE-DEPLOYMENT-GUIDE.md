# Sophia AI Factory — Go-Live Deployment Guide

**Platform:** Cloudflare Workers (via OpenNext)
**Production:** https://sophia.agencyos.network
**Repo:** longtho638-jpg/sophia-ai-factory

---

## Phase 1: Pre-Deployment Verification

```bash
cd apps/sophia-ai-factory
npm run build      # 0 TypeScript errors required
npm test           # 1,798 tests pass
npm run lint       # 0 ESLint errors
```

---

## Phase 2: Environment Variables

Set CF Worker secrets:

```bash
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put CRON_SECRET
npx wrangler secret put NOWPAYMENTS_API_KEY
npx wrangler secret put NOWPAYMENTS_IPN_SECRET
npx wrangler secret put HEYGEN_API_KEY
npx wrangler secret put ELEVENLABS_API_KEY
npx wrangler secret put OPENROUTER_API_KEY
npx wrangler secret put INNGEST_EVENT_KEY
npx wrangler secret put INNGEST_SIGNING_KEY
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put SENTRY_AUTH_TOKEN
npx wrangler secret put INTERNAL_API_SECRET
```

Set CF Worker vars (public):
```bash
echo "NEXT_PUBLIC_APP_URL = \"https://sophia.agencyos.network\"" >> .dev.vars
```

---

## Phase 3: Build & Deploy

```bash
npm run deploy:build    # next build + OpenNext bundle
npx wrangler deploy     # Push to Cloudflare Workers
```

Or single command:
```bash
npm run deploy
```

---

## Phase 4: Verify Production

```bash
# Deploy SHA must match HEAD
curl -s https://sophia.agencyos.network/api/version | jq .shortSha
git rev-parse HEAD | cut -c1-8

# Health check
curl -s https://sophia.agencyos.network/api/health

# Routes
curl -sI https://sophia.agencyos.network/          # 200
curl -sI https://sophia.agencyos.network/login      # 200
curl -sI https://sophia.agencyos.network/pricing    # 200
curl -sI https://sophia.agencyos.network/dashboard  # 307 → /login
curl -sI https://sophia.agencyos.network/signup     # 301 → /login
```

---

## Phase 5: Webhook Configuration

### 5.1 NOWPayments IPN
1. Dashboard → Settings → IPN
2. URL: `https://sophia.agencyos.network/api/webhooks/nowpayments-subscription`
3. Events: `payment_finished`, `payment_failed`, `payment_expired`
4. Secret: match `NOWPAYMENTS_IPN_SECRET`

### 5.2 Telegram Bot
```bash
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://sophia.agencyos.network/api/webhooks/telegram"}'
```

### 5.3 HeyGen Callback
1. HeyGen API Settings → Webhook
2. URL: `https://sophia.agencyos.network/api/webhooks/heygen`
3. Events: `video.completed`

---

## Phase 6: E2E Verification

1. Open https://sophia.agencyos.network/pricing
2. Click checkout on any tier → verify redirect to NOWPayments
3. Complete test payment → verify IPN processed
4. Sign up via `/login` (Sign Up tab)
5. Complete setup wizard
6. Create campaign from dashboard

---

## Phase 7: CI/CD

GitHub Actions workflow: `.github/workflows/tests-and-deploy.yml`

Manual deploy if CI is disabled:
```bash
npx wrangler deploy
```

---

## Troubleshooting

### Build fails: `instrumentation.js does not exist`
```bash
node scripts/fix-instrumentation-standalone.mjs
npm run deploy:build
```

### Worker returns 404 on all routes
- Verify `wrangler.toml` has correct `D1_DATABASE_ID` and `ASSETS` binding
- Check `open-next.config.ts` has `mode: "cloudflare"

### Webhook not receiving events
- Verify URL is publicly accessible: `curl -sI https://sophia.agencyos.network/api/webhooks/heygen`
- Check `CRON_SECRET` is set for cron endpoints

### Database issues
- D1 is the primary database. Check bindings in wrangler.toml
- Run migrations: `npx wrangler d1 migrations apply sophia-raas-db`

---

## Post-Deployment

- [ ] All CF secrets set (`npx wrangler secret list`)
- [ ] Webhooks configured and verified
- [ ] Checkout flow tested end-to-end
- [ ] Campaign generation tested
- [ ] Telegram bot responding
- [ ] Sentry receiving errors
- [ ] D1 migrations applied to production

---

## Support

- **Documentation:** `docs/` directory
- **Issues:** https://github.com/longtho638-jpg/sophia-ai-factory/issues
- **Production:** https://sophia.agencyos.network
