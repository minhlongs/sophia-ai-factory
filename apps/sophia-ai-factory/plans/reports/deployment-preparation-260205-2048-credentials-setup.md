# Deployment Preparation - Credentials Setup Guide

**Date**: 2026-02-05 20:48
**Phase**: Phase 62-65 - Go-Live Production Deployment
**Status**: Ready for Manual Credential Setup

---

## 🎯 Current Situation

The interactive setup wizard (`npm run setup:production`) requires manual terminal input and cannot run in this automated environment. Therefore, we'll proceed with **manual deployment setup**.

---

## 📋 Step-by-Step Deployment Process

### Step 1: Obtain All Required Credentials

#### 1.1 Polar.sh (Payment Processing)
```bash
# Visit: https://polar.sh
# Actions needed:
1. Sign up / Log in
2. Navigate to Settings → API Keys
3. Create new API key with permissions:
   - products:write
   - checkouts:write
   - webhooks:write
4. Copy the Organization ID from dashboard URL
5. Generate webhook secret: openssl rand -hex 32

# You'll get:
POLAR_ACCESS_TOKEN=polar_pat_...
POLAR_ORGANIZATION_ID=your-org-id
POLAR_WEBHOOK_SECRET=generated-hex-string
```

#### 1.2 Supabase (Database & Auth)
```bash
# Visit: https://supabase.com
# Actions needed:
1. Create new project (or use existing)
2. Navigate to Project Settings → API
3. Copy these values:

NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Run migrations:
cd apps/sophia-ai-factory
npx supabase link --project-ref your-project-id
npx supabase db push
```

#### 1.3 Telegram Bot
```bash
# In Telegram app:
1. Search for @BotFather
2. Send: /newbot
3. Follow prompts to create bot
4. Copy bot token

# Generate webhook secret:
openssl rand -hex 32

# You'll get:
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_WEBHOOK_SECRET=generated-hex-string
```

#### 1.4 HeyGen (AI Video Generation)
```bash
# Visit: https://heygen.com
# Actions needed:
1. Sign up / Log in
2. Navigate to Settings → API
3. Create API key

HEYGEN_API_KEY=your-heygen-api-key
```

#### 1.5 ElevenLabs (AI Voice)
```bash
# Visit: https://elevenlabs.io
# Actions needed:
1. Sign up / Log in
2. Navigate to Profile → API Keys
3. Create API key

ELEVENLABS_API_KEY=your-elevenlabs-api-key
```

---

### Step 2: Update Local Environment File

Create or update `.env.local` with all credentials:

```bash
# Copy template
cp .env.local .env.local.backup

# Edit .env.local with all credentials
cat > .env.local << 'EOF'
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Polar Payment Configuration
POLAR_ACCESS_TOKEN=polar_pat_xxxxx
POLAR_ORGANIZATION_ID=your-org-id
POLAR_WEBHOOK_SECRET=your-webhook-secret

# Polar Product IDs (will be set after creating products)
NEXT_PUBLIC_POLAR_PRODUCT_STARTER=
NEXT_PUBLIC_POLAR_PRODUCT_GROWTH=
NEXT_PUBLIC_POLAR_PRODUCT_PREMIUM=

# Telegram Bot
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_WEBHOOK_SECRET=your-webhook-secret

# AI Services
HEYGEN_API_KEY=your-heygen-api-key
ELEVENLABS_API_KEY=your-elevenlabs-api-key

# Security (keep existing or generate new)
API_ENCRYPTION_KEY=73c6d1e0e30ed2013141389c5a1346c7e13dea194ef57bcbd3730d5e7e306bb8

# App URL (will be set after first deploy)
NEXT_PUBLIC_APP_URL=
EOF
```

---

### Step 3: Create Polar Products

Use Polar dashboard or API to create 3 products:

#### Product 1: Starter Plan
```
Name: Sophia AI Factory - Starter
Price: $500 (one-time)
Features:
- 1 YouTube Channel
- 5 Templates
- Basic Analytics
```

#### Product 2: Growth Plan
```
Name: Sophia AI Factory - Growth
Price: $1,200 setup + $100/month
Features:
- 3 YouTube Channels
- Unlimited Templates
- Advanced Analytics
- Priority Support
```

#### Product 3: Premium Plan
```
Name: Sophia AI Factory - Premium
Price: $3,500 setup + $300/month
Features:
- Unlimited Channels
- Custom Templates
- White-labeling
- Dedicated Account Manager
- API Access
```

After creating products, copy their IDs to `.env.local`:
```bash
NEXT_PUBLIC_POLAR_PRODUCT_STARTER=prod_xxxxx
NEXT_PUBLIC_POLAR_PRODUCT_GROWTH=prod_yyyyy
NEXT_PUBLIC_POLAR_PRODUCT_PREMIUM=prod_zzzzz
```

---

### Step 4: Test Locally

```bash
# Load environment variables
source .env.local

# Run build
npm run build

# Run tests
npm test

# Start dev server to verify integrations
npm run dev

# Test in browser:
# - http://localhost:3000/pricing - Check Polar checkout
# - http://localhost:3000/dashboard - Check dashboard loads
# - http://localhost:3000/settings - Check settings page
```

---

### Step 5: Deploy to Vercel

#### 5.1 Install Vercel CLI
```bash
npm i -g vercel
vercel login
```

#### 5.2 Add Environment Variables to Vercel
```bash
# Supabase
vercel env add NEXT_PUBLIC_SUPABASE_URL production
# Paste: https://xxxxx.supabase.co

vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
# Paste: your-anon-key

vercel env add SUPABASE_SERVICE_ROLE_KEY production
# Paste: your-service-role-key

# Polar
vercel env add POLAR_ACCESS_TOKEN production
# Paste: polar_pat_xxxxx

vercel env add POLAR_ORGANIZATION_ID production
# Paste: your-org-id

vercel env add POLAR_WEBHOOK_SECRET production
# Paste: your-webhook-secret

vercel env add NEXT_PUBLIC_POLAR_PRODUCT_STARTER production
# Paste: prod_xxxxx

vercel env add NEXT_PUBLIC_POLAR_PRODUCT_GROWTH production
# Paste: prod_yyyyy

vercel env add NEXT_PUBLIC_POLAR_PRODUCT_PREMIUM production
# Paste: prod_zzzzz

# Telegram
vercel env add TELEGRAM_BOT_TOKEN production
# Paste: your-bot-token

vercel env add TELEGRAM_WEBHOOK_SECRET production
# Paste: your-webhook-secret

# AI Services
vercel env add HEYGEN_API_KEY production
# Paste: your-heygen-api-key

vercel env add ELEVENLABS_API_KEY production
# Paste: your-elevenlabs-api-key

# Security
vercel env add API_ENCRYPTION_KEY production
# Paste: 73c6d1e0e30ed2013141389c5a1346c7e13dea194ef57bcbd3730d5e7e306bb8
```

#### 5.3 Deploy
```bash
vercel --prod
```

**Save the deployment URL** (e.g., `https://sophia-ai-factory.vercel.app`)

#### 5.4 Update App URL
```bash
vercel env add NEXT_PUBLIC_APP_URL production
# Paste: https://your-deployment-url.vercel.app
```

---

### Step 6: Configure Webhooks

#### 6.1 Polar Webhook
```bash
# Go to: https://polar.sh/dashboard/webhooks
# Click: Add Endpoint
# URL: https://your-deployment-url.vercel.app/api/webhooks/polar
# Events: Select all checkout and subscription events
# Secret: Use your POLAR_WEBHOOK_SECRET
# Save
```

#### 6.2 Telegram Webhook
```bash
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"https://your-deployment-url.vercel.app/api/webhooks/telegram\",
    \"secret_token\": \"${TELEGRAM_WEBHOOK_SECRET}\"
  }"

# Expected response: {"ok":true,"result":true}
```

---

### Step 7: E2E Verification

#### 7.1 Test Checkout Flow
1. Navigate to `https://your-deployment-url.vercel.app/pricing`
2. Click "Get Started" on Growth plan
3. Complete checkout with Polar test card
4. Verify redirect to dashboard
5. Check user tier updated in Supabase

#### 7.2 Test Telegram Bot
1. Find your bot in Telegram: `@YourBotName`
2. Send `/start`
3. Link account: `/email your@email.com`
4. Create campaign: `/campaign AI productivity tools`
5. Check status: `/status`
6. Verify notifications received

#### 7.3 Test Campaign Generation
1. Go to `https://your-deployment-url.vercel.app/dashboard/create`
2. Create new campaign
3. Monitor progress in dashboard
4. Verify Telegram notifications
5. Check video preview when complete

---

### Step 8: Generate Certification Report

After all verifications pass, document the deployment:

```bash
# Create certification report
cat > plans/reports/production-certification-260205.md << 'EOF'
# Production Certification Report

**Date**: 2026-02-05
**Status**: PRODUCTION READY ✅

## Deployment Details
- URL: https://your-deployment-url.vercel.app
- Vercel Project: sophia-ai-factory
- Environment: Production

## Verification Results
- ✅ Build passes (0 errors)
- ✅ Tests pass (154/154)
- ✅ Checkout flow verified
- ✅ Campaign generation verified
- ✅ Telegram bot verified
- ✅ Webhooks configured
- ✅ Database connected

## Performance Metrics
- Build time: X seconds
- Bundle size: X MB
- LCP: X seconds

## Security Checklist
- ✅ All secrets in Vercel environment
- ✅ RLS enabled on Supabase
- ✅ Webhook signatures verified
- ✅ API keys encrypted at rest
- ✅ HTTPS enforced
- ✅ CSP headers configured

## Production Readiness Score: 100/100

Certified by: [Your Name]
Date: 2026-02-05
EOF

# Commit certification
git add plans/reports/production-certification-260205.md
git commit -m "docs: production deployment certification"
git push origin master
```

---

## 📊 Checklist Summary

### Pre-Deployment
- [ ] Polar.sh account created, API key obtained
- [ ] Supabase project created, credentials copied
- [ ] Telegram bot created via @BotFather
- [ ] HeyGen account created, API key obtained
- [ ] ElevenLabs account created, API key obtained
- [ ] All credentials added to `.env.local`
- [ ] Polar products created (Starter, Growth, Premium)
- [ ] Local testing completed

### Deployment
- [ ] Vercel CLI installed and logged in
- [ ] All environment variables added to Vercel
- [ ] Deployed to production (`vercel --prod`)
- [ ] Deployment URL saved
- [ ] `NEXT_PUBLIC_APP_URL` updated in Vercel

### Post-Deployment
- [ ] Polar webhook configured
- [ ] Telegram webhook configured
- [ ] Checkout flow tested E2E
- [ ] Campaign generation tested E2E
- [ ] Telegram bot tested E2E
- [ ] Certification report generated
- [ ] Changes committed and pushed

---

## 🚨 Common Issues & Solutions

### Issue: Build fails with "Module not found"
**Solution**: Run `npm ci` to ensure all dependencies installed

### Issue: Webhook not receiving events
**Solution**:
- Verify webhook URL is publicly accessible
- Check webhook secret matches environment variable
- Review Vercel function logs

### Issue: Database connection fails
**Solution**:
- Verify Supabase project is not paused
- Check service role key has admin permissions
- Test connection from Vercel deployment

### Issue: Payment fails
**Solution**:
- Verify Polar products are active
- Check product IDs match environment variables
- Test with Polar sandbox mode first

---

## 📞 Support

If you encounter issues:
1. Check Vercel function logs: `vercel logs`
2. Check Supabase logs in dashboard
3. Review Polar webhook logs
4. Verify Telegram webhook: `curl https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`

---

**Next Action**: Obtain credentials from each service, then follow steps 1-8 above.

**Estimated Time**: 1.5-2 hours total
