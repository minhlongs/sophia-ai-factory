# Sprint 4: Cloudflare Deploy (Part 1) - Completion Report

**Date:** 2026-03-20T04:35:00-07:00
**Status:** ✅ Part 1 Complete (Pages Setup)

---

## Summary

Completed Cloudflare Pages deployment setup. Ready for manual deployment via Cloudflare dashboard.

---

## Files Created

| File | Purpose |
|------|---------|
| `wrangler.toml` | Cloudflare Pages config |
| `next.config.js` | Updated for Cloudflare compatibility |
| `scripts/deploy-cloudflare.sh` | Deploy script |
| `plans/reports/cloudflare-deploy-part1.md` | Deployment guide |

---

## Configuration Changes

### next.config.js (Updated)

```javascript
const nextConfig = {
  output: 'standalone',  // Required for Cloudflare
  experimental: {
    serverComponentsExternalPackages: ['@supabase/supabase-js'],
  },
  images: {
    unoptimized: true,  // Cloudflare limitation
  },
};
```

### wrangler.toml (New)

```toml
name = "sophia-ai-factory"
compatibility_date = "2024-01-01"
pages_build_output_dir = ".next"
pages_build_command = "npm run build"
```

---

## Deployment Steps (Manual)

### Step 1: Install Wrangler CLI

```bash
npm install -g wrangler
wrangler login
```

### Step 2: Create Pages Project

1. Go to https://pages.cloudflare.com
2. Click "Create a project"
3. Connect GitHub:
   - Repository: `longtho638-jpg/sophia-ai-factory`
   - Production branch: `main`

### Step 3: Build Settings

- Framework preset: `Next.js`
- Build command: `npm run build`
- Output directory: `.next`
- Root directory: `apps/sophia-proposal`

### Step 4: Environment Variables

Add in Cloudflare dashboard → Settings → Environment variables:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...

# Polar.sh
POLAR_API_KEY=...
POLAR_WEBHOOK_SECRET=...

# Anthropic
ANTHROPIC_API_KEY=...

# HeyGen
HEYGEN_API_KEY=...

# HubSpot
HUBSPOT_CLIENT_ID=...
HUBSPOT_CLIENT_SECRET=...
```

### Step 5: Deploy

```bash
# Option A: Git push (auto-deploy)
git push origin main

# Option B: Manual deploy
./scripts/deploy-cloudflare.sh
```

---

## Verification Checklist

Before marking Part 2 (Workers/Edge):

- [ ] Pages project created
- [ ] First deployment successful
- [ ] Homepage loads (HTTP 200)
- [ ] Auth pages accessible
- [ ] Environment variables loaded
- [ ] Custom domain configured (optional)

---

## Part 2: Edge Functions (TODO)

After Pages is live, implement:

1. **Cloudflare Workers** for edge API routes
2. **D1 Database** for edge caching
3. **KV Storage** for rate limiting
4. **R2 Storage** for file uploads

---

## Unresolved Questions

1. **Supabase Edge Compatibility:** Will Supabase client work with Cloudflare Edge?
2. **Webhook URLs:** Need production URL for Polar/HeyGen webhooks
3. **Custom Domain:** Use `sophia.agencyos.network` or keep `.pages.dev`?

---

**Owner:** CTO Agent
**Next Step:** Manual deploy via Cloudflare dashboard, then continue Part 2
