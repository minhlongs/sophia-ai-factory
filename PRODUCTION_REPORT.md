# Sophia AI Video Factory - Cloudflare Deployment Report

**Date:** 2026-03-16
**Status:** READY TO DEPLOY

---

## Deployment Target

**Platform:** Cloudflare Pages (All-in-One)
**URL:** https://sophia-ai-factory.pages.dev

---

## Deploy Steps

### 1. Connect to Cloudflare Pages

```bash
cd /Users/macbookprom1/mekong-cli/apps/sophia-proposal

# Login to Cloudflare
npx wrangler login

# Create Pages project (one-time)
npx wrangler pages project create sophia-ai-factory
```

### 2. Build & Deploy

```bash
# Build production
pnpm run build

# Deploy to Cloudflare Pages
pnpm run deploy:cf
```

### 3. Git Integration (Recommended)

```bash
# Push to trigger auto-deploy
git add .
git commit -m "feat: cloudflare deployment ready"
git push origin main
```

---

## Environment Variables

Set in Cloudflare Pages Dashboard → Settings → Environment Variables:

```bash
# Production
SHOTSTACK_API_KEY=your_key
SHOTSTACK_ENV=production
POLAR_WEBHOOK_SECRET=whsec_xxx
```

---

## Verification

```bash
# Homepage
curl -I https://sophia-ai-factory.pages.dev

# API endpoint
curl -X POST https://sophia-ai-factory.pages.dev/api/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "test"}'
```

---

## Rollback

Use Cloudflare Pages Dashboard → Deployments → Click previous version → "Rollback to this version"

---

**Cloudflare-First Deployment** ✅
