# Migration Guide: Vercel → Cloudflare Pages

## Why Cloudflare Pages?

- **Free tier**: 100k requests/day, unlimited bandwidth
- **Edge Functions**: Global deployment
- **Faster**: Cloudflare CDN (275+ locations)
- **No vendor lock-in**: Open standard

---

## Setup Steps

### 1. Install Wrangler CLI

```bash
npm install -g wrangler
```

### 2. Login to Cloudflare

```bash
wrangler login
```

### 3. Create Project

```bash
# Via CLI
wrangler pages project create sophia-proposal

# Or via Dashboard:
# 1. Go to https://dash.cloudflare.com/?to=/:account/pages
# 2. Click "Create a project"
# 3. Connect GitHub repo: longtho638-jpg/mekong-cli
# 4. Set build config:
#    - Build command: pnpm build
#    - Build output directory: .next
#    - Root directory: apps/sophia-proposal
```

### 4. Configure Environment Variables

```bash
# In Cloudflare Dashboard → Pages → sophia-proposal → Settings → Environment Variables

LLM_BASE_URL=http://localhost:11434/v1
LLM_MODEL=llama3.2:3b
```

### 5. Deploy

```bash
# Manual deploy
cd apps/sophia-proposal
pnpm build
pnpm deploy:cf

# Or auto-deploy via GitHub:
# Connect repo in Cloudflare Dashboard → auto-deploy on push
```

---

## Custom Domain

```bash
# In Cloudflare Dashboard → Pages → sophia-proposal → Custom Domains
# Add: sophia-proposal.agencyos.network
```

---

## Migration Checklist

- [ ] Install wrangler CLI
- [ ] Login to Cloudflare
- [ ] Create Pages project
- [ ] Connect GitHub repo
- [ ] Configure build settings
- [ ] Add environment variables
- [ ] Test dev locally: `pnpm dev:cf`
- [ ] Deploy staging
- [ ] Update DNS (if custom domain)
- [ ] Switch production
- [ ] Verify all pages
- [ ] Remove Vercel integration

---

## Commands Reference

```bash
# Local dev
pnpm dev:cf

# Deploy to production
pnpm deploy:cf

# Check deployment status
wrangler pages deployment list

# Rollback
wrangler pages deployment rollback
```

---

## Differences: Vercel vs Cloudflare

| Feature | Vercel | Cloudflare Pages |
|---------|--------|------------------|
| Edge Functions | ✅ | ✅ |
| Serverless | ✅ | ✅ |
| Custom Domain | ✅ | ✅ |
| Auto Deploy | ✅ | ✅ |
| Preview Deploy | ✅ | ✅ |
| Analytics | Paid | Free |
| Bandwidth | Limited | Unlimited |
| Price (Free) | Good | Better |

---

## Troubleshooting

### Build Fails

```bash
# Clear cache
rm -rf .next
pnpm build
```

### API Routes Not Working

Ensure `next.config.ts` has:

```typescript
const nextConfig = {
  output: 'export',
  images: { unoptimized: true }
}
```

### Environment Variables

```bash
# Check env vars
wrangler pages deployment tail
```
