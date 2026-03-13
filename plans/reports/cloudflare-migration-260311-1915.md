# Cloudflare Migration Report

**Date:** 2026-03-11 19:15
**Status:** ✅ READY TO DEPLOY

---

## Build Status

```
✓ Compiled successfully
✓ Generating static pages (7/7)
✓ Exporting (3/3)

Route (app)                              Size     First Load JS
┌ ○ /                                    23 kB           171 kB
├ ○ /_not-found                          980 B           106 kB
├ ƒ /api/generate                        136 B           105 kB
└ ○ /chat                                1.92 kB         150 kB
```

**Static Export:** Compatible with Cloudflare Pages

---

## Files Created

| File | Purpose |
|------|---------|
| `cloudflare.toml` | Cloudflare Pages config |
| `wrangler.json` | Wrangler CLI config |
| `docs/MIGRATION_CLOUDFLARE.md` | Migration guide |
| `next.config.ts` | Updated for static export |
| `package.json` | Added deploy:cf script |

---

## Migration Steps

### 1. Install Wrangler

```bash
npm install -g wrangler
```

### 2. Login

```bash
wrangler login
```

### 3. Create Project (Via Dashboard)

1. Go to https://dash.cloudflare.com/?to=/:account/pages
2. Click "Create a project"
3. Connect GitHub: `longtho638-jpg/mekong-cli`
4. Root directory: `apps/sophia-proposal`
5. Build command: `pnpm build`
6. Build output: `.next`

### 4. Configure Environment Variables

In Dashboard → Pages → sophia-proposal → Settings:

```
LLM_BASE_URL=http://localhost:11434/v1
LLM_MODEL=llama3.2:3b
```

### 5. Deploy

```bash
# Manual
cd apps/sophia-proposal
pnpm deploy:cf

# Auto-deploy via GitHub (recommended)
# Connect repo in Dashboard → push to main
```

---

## Custom Domain

**Recommended:** `sophia.agencyos.network`

1. Dashboard → Pages → sophia-proposal → Custom Domains
2. Add domain
3. Update DNS records

---

## Post-Migration Checklist

- [ ] Install wrangler
- [ ] Login to Cloudflare
- [ ] Create Pages project
- [ ] Connect GitHub
- [ ] Add env vars
- [ ] Test deployment
- [ ] Update custom domain DNS
- [ ] Remove Vercel integration

---

**Next:** Run `pnpm deploy:cf` or connect GitHub to Cloudflare
