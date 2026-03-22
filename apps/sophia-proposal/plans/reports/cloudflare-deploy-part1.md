# Cloudflare Pages Deployment Guide

**Project:** Sophia AI Factory
**Target:** Cloudflare Pages (Frontend) + Workers (Edge API)
**Date:** 2026-03-20

---

## Prerequisites

1. Cloudflare account (free tier OK for start)
2. GitHub repository connected
3. Domain (optional for initial deploy)

---

## Step 1: Install Wrangler CLI

```bash
npm install -g wrangler
wrangler login
```

---

## Step 2: Create Cloudflare Pages Project

### Option A: Via Dashboard (Recommended)

1. Go to https://pages.cloudflare.com
2. Click "Create a project"
3. Connect GitHub:
   - Repository: `longtho638-jpg/sophia-ai-factory`
   - Production branch: `main`
4. Build settings:
   - Framework preset: `Next.js`
   - Build command: `npm run build`
   - Build output directory: `.next`
   - Root directory: `apps/sophia-proposal`

### Option B: Via Wrangler CLI

```bash
cd apps/sophia-proposal
wrangler pages project create sophia-ai-factory \
  --production-branch main \
  --build-command "npm run build" \
  --build-output-dir ".next"
```

---

## Step 3: Configure Environment Variables

Add these in Cloudflare Pages dashboard → Settings → Environment variables:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Polar.sh
POLAR_API_KEY=pk_test_...
POLAR_WEBHOOK_SECRET=whsec_...

# Anthropic (AI)
ANTHROPIC_API_KEY=sk-ant-...

# HeyGen (Video)
HEYGEN_API_KEY=...
HEYGEN_WEBHOOK_SECRET=...

# HubSpot (CRM)
HUBSPOT_CLIENT_ID=...
HUBSPOT_CLIENT_SECRET=...
HUBSPOT_REDIRECT_URI=https://sophia-ai-factory.pages.dev/api/crm/callback
```

---

## Step 4: Deploy

### Manual Deploy (Git Push)

```bash
# Push to main branch
git add .
git commit -m "feat: ready for cloudflare deploy"
git push origin main

# Cloudflare Pages auto-deploys on push
```

### Direct Deploy (wrangler)

```bash
cd apps/sophia-proposal
npm run build
wrangler pages deploy .next --project-name=sophia-ai-factory
```

---

## Step 5: Custom Domain (Optional)

1. Go to Pages dashboard → Custom domains
2. Add domain: `sophia.agencyos.network`
3. Update DNS records at your registrar:
   ```
   Type: CNAME
   Name: sophia
   Value: sophia-ai-factory.pages.dev
   ```

---

## Step 6: Webhook Configuration

### Polar.sh Webhook

1. Go to Polar dashboard → Developers → Webhooks
2. Add endpoint: `https://sophia-ai-factory.pages.dev/api/webhooks/polar`
3. Copy webhook secret to Cloudflare Pages env vars

### HeyGen Webhook

1. Go to HeyGen dashboard → Settings → Webhooks
2. Add endpoint: `https://sophia-ai-factory.pages.dev/api/video/webhook`
3. Copy webhook secret to Cloudflare Pages env vars

---

## Verification Checklist

- [ ] Deployment successful (GREEN status)
- [ ] Homepage loads (HTTP 200)
- [ ] Auth pages accessible (`/signup`, `/login`)
- [ ] API routes respond (test with curl)
- [ ] Environment variables loaded correctly
- [ ] Webhooks configured and tested

---

## Troubleshooting

### Build Fails

```bash
# Check build locally
npm run build

# Check Node version (should be 18+)
node --version

# Clear cache
rm -rf .next node_modules
npm install
npm run build
```

### Environment Variables Not Loading

- Verify variable names match exactly
- Check for typos in `.env` vs Cloudflare dashboard
- Redeploy after adding new variables

### API Routes 404

- Cloudflare Pages uses `.next` output
- Ensure `next.config.js` has correct output setting:
  ```js
  module.exports = {
    output: 'standalone',
  }
  ```

---

## Next Steps (Part 2)

After Pages deploy successful:

1. **Cloudflare Workers** (Edge API)
2. **D1 Database** (optional, for edge caching)
3. **KV Storage** (for session/rate limiting)
4. **R2 Storage** (for file uploads)

---

**Deployed By:** CTO Agent
**Deploy Date:** 2026-03-20
**Project URL:** https://sophia-ai-factory.pages.dev
