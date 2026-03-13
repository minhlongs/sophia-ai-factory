# Sophia Cloudflare Migration Report

**Date:** 2026-03-12 12:48
**Status:** ⏳ **GitHub Integration Required**

---

## Issue

Wrangler CLI không deploy được do cache files > 25MB.

## Solution: GitHub Integration

### Steps:

1. **Commit & Push to GitHub**
   ```bash
   git add .
   git commit -m "feat: migrate to Cloudflare Pages"
   git push origin main
   ```

2. **Cloudflare Dashboard**
   - https://dash.cloudflare.com/?to=/:account/workers-and-pages/create
   - Chọn **Pages** → **Connect to Git**
   - Chọn repo: `mekong-cli`
   - Project path: `apps/sophia-proposal`
   - Branch: `main`

3. **Build Settings**
   - Framework preset: **Next.js**
   - Build command: `pnpm run build`
   - Build output directory: `.next`
   - Install command: `pnpm install`

4. **Domain Configuration**
   - Settings → Domains
   - Add: `sophia.agencyos.network`
   - Auto-configure DNS

---

## Files Updated

| File | Change |
|------|--------|
| `next.config.ts` | Disabled webpack cache |
| `package.json` | Added deploy:cf script |
| `.wranglerignore` | Exclude cache files |
| `wrangler.toml` | CF Pages config |

---

## Next Steps

1. **Push to GitHub**
2. **Connect Cloudflare Pages**
3. **Configure domain**
4. **Verify SSL**

---

## Unresolved Questions

- Repo đã public trên GitHub chưa?
- Cloudflare Pages project đã tạo chưa?
