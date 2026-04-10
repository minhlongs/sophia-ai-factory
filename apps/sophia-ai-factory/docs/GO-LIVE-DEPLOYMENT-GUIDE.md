# Sophia AI Factory - Go-Live Deployment Guide

## 🚀 Production Deployment Checklist

This guide walks you through deploying Sophia AI Factory to production on Vercel.

---

## Phase 1: Pre-Deployment Verification

### 1.1 Verify Clean Build
```bash
npm run build
```
**Expected:** Build completes with 0 errors

### 1.2 Run Tests
```bash
npm test
```
**Expected:** All tests pass (154/154)

### 1.3 Lint Check
```bash
npm run lint
```
**Expected:** 0 errors

---

## Phase 2: Credentials Setup

### Required API Keys and Credentials

#### 2.1 NOWPayments (Payment Processing)
1. Sign up at https://nowpayments.io
2. Navigate to Settings → API Keys
3. Create API key for production
4. Save as `NOWPAYMENTS_API_KEY`
5. Generate IPN Secret for webhook verification
6. Save as `NOWPAYMENTS_IPN_SECRET`
7. Pre-create invoices in dashboard for each tier (BASIC, PREMIUM, ENTERPRISE, MASTER)

#### 2.2 Supabase (Database & Auth)
1. Create project at https://supabase.com
2. Navigate to Project Settings → API
3. Copy these values:
   - `NEXT_PUBLIC_SUPABASE_URL`: Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Public anon key
   - `SUPABASE_SERVICE_ROLE_KEY`: Service role key (secret)

#### 2.3 Telegram Bot
1. Open Telegram and search for `@BotFather`
2. Send `/newbot` and follow prompts
3. Save `TELEGRAM_BOT_TOKEN` from response
4. Generate webhook secret: `openssl rand -hex 32`
5. Save as `TELEGRAM_WEBHOOK_SECRET`

#### 2.4 HeyGen (AI Video Generation)
1. Sign up at https://heygen.com
2. Navigate to Settings → API
3. Create API key
4. Save as `HEYGEN_API_KEY`

#### 2.5 ElevenLabs (AI Voice)
1. Sign up at https://elevenlabs.io
2. Navigate to Profile → API Keys
3. Create API key
4. Save as `ELEVENLABS_API_KEY`

---

## Phase 3: Production Setup Wizard

Run the interactive setup wizard to validate configuration:

```bash
npm run setup:production
```

The wizard will:
1. ✅ Validate environment variables
2. ✅ Verify NOWPayments API connectivity
3. ✅ Verify Supabase connection and tables
4. ✅ Configure Telegram webhook
5. ✅ Verify IPN webhook endpoint (NOWPayments)
6. ✅ Run E2E verification tests
7. ✅ Generate setup report

**Follow the prompts and provide credentials when requested.**

---

## Phase 4: Vercel Deployment

### 4.1 Install Vercel CLI
```bash
npm i -g vercel
```

### 4.2 Login to Vercel
```bash
vercel login
```

### 4.3 Configure Environment Variables

Add all environment variables to Vercel:

```bash
# Supabase
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production

# NOWPayments
vercel env add NOWPAYMENTS_API_KEY production
vercel env add NOWPAYMENTS_IPN_SECRET production

# PayOS (Backup for Vietnam domestic)
vercel env add PAYOS_MERCHANT_ID production
vercel env add PAYOS_API_KEY production
vercel env add PAYOS_CHECKSUM_KEY production

# Telegram
vercel env add TELEGRAM_BOT_TOKEN production
vercel env add TELEGRAM_WEBHOOK_SECRET production

# AI Services
vercel env add HEYGEN_API_KEY production
vercel env add ELEVENLABS_API_KEY production
vercel env add OPENROUTER_API_KEY production
vercel env add ELEVENLABS_API_KEY production

# App URL (will be set after first deploy)
vercel env add NEXT_PUBLIC_APP_URL production
```

### 4.4 Deploy to Production
```bash
vercel --prod
```

**Save the deployment URL** (e.g., `https://sophia-ai-factory.vercel.app`)

### 4.5 Update App URL
```bash
vercel env add NEXT_PUBLIC_APP_URL production
# Enter: https://your-deployment-url.vercel.app
```

---

## Phase 5: Webhook Configuration

### 5.1 Configure NOWPayments IPN Webhook
1. Go to https://nowpayments.io/dashboard/settings/webhooks
2. Click "Add Endpoint"
3. URL: `https://your-deployment-url.vercel.app/api/webhooks/nowpayments`
4. Events: Select `payment_finished`, `payment_failed`, `payment_refunded`, `payment_expired`
5. Secret: Use your `NOWPAYMENTS_IPN_SECRET`
6. Save and test with NOWPayments sandbox

### 5.2 Configure Telegram Webhook
```bash
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"https://your-deployment-url.vercel.app/api/webhooks/telegram\",
    \"secret_token\": \"${TELEGRAM_WEBHOOK_SECRET}\"
  }"
```

**Expected Response:** `{"ok":true,"result":true}`

---

## Phase 6: E2E Verification

### 6.1 Test Checkout Flow
1. Navigate to `https://your-deployment-url.vercel.app/pricing`
2. Click "Get Started" on PREMIUM tier
3. Complete checkout on NOWPayments hosted page (use test invoice/amount)
4. Verify IPN webhook is received and processed
5. Check user tier updated in database (should be PREMIUM)
6. Monitor Sentry for webhook errors

### 6.2 Test Telegram Bot
1. Find your bot in Telegram: `@YourBotName`
2. Send `/start`
3. Link account: `/email your@email.com`
4. Create campaign: `/campaign AI productivity tools`
5. Check status: `/status`
6. Verify notifications are received

### 6.3 Test Campaign Generation
1. Go to `https://your-deployment-url.vercel.app/dashboard/create`
2. Create new campaign
3. Monitor progress in dashboard
4. Verify Telegram notifications
5. Check video preview when complete

---

## Phase 7: Production Health Check

Run the automated health check:

```bash
npm run verify
```

This verifies:
- ✅ All API endpoints responding
- ✅ Database connectivity
- ✅ External integrations (NOWPayments, Telegram, HeyGen)
- ✅ Webhook configurations
- ✅ Build artifacts

---

## Phase 8: Generate Certification Report

Create final go-live certification:

```bash
npm run setup:production -- --certify
```

This generates `production-certification-report.md` with:
- Deployment summary
- All verification results
- Performance metrics
- Security checklist
- Production readiness score

---

## Troubleshooting

### Build Fails
- Check all dependencies are installed: `npm ci`
- Verify Node version: `node -v` (should be 20+)
- Clear Next.js cache: `rm -rf .next`

### Webhook Not Receiving Events
- Verify webhook URL is publicly accessible
- Check webhook secret matches environment variable
- Review Vercel function logs
- Test with `curl` to webhook endpoint

### Database Connection Issues
- Verify Supabase project is not paused
- Check RLS policies are configured
- Verify service role key has admin permissions
- Test connection from Vercel deployment

### Payment Issues
- Verify Polar products are active
- Check product IDs match environment variables
- Test with Polar sandbox mode first
- Review Polar webhook logs

---

## Post-Deployment Checklist

- [ ] All environment variables set in Vercel
- [ ] Webhooks configured (Polar, Telegram)
- [ ] Checkout flow tested end-to-end
- [ ] Campaign generation tested
- [ ] Telegram bot responding
- [ ] Health check passing
- [ ] Certification report generated
- [ ] Monitoring/alerts configured (optional)
- [ ] Backup strategy in place (Supabase automatic)
- [ ] Domain configured (if custom domain)

---

## Next Steps

1. **Monitor Deployment**: Watch Vercel dashboard for errors
2. **Test User Flows**: Create test account and complete full user journey
3. **Enable Analytics**: Set up Vercel Analytics for insights
4. **Configure Alerts**: Set up error monitoring (Sentry recommended)
5. **Marketing Launch**: Announce to users once verified

---

## Support

- **Documentation**: Check `/docs` directory
- **Issues**: Report at GitHub repository
- **Community**: Join Discord/Slack channel
- **Email**: support@sophia-ai-factory.com

---

**🎉 Congratulations on going live with Sophia AI Factory!**
