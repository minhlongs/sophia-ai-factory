# Cloudflare Deploy Guide

**Date:** 2026-03-11
**Project:** Sophia AI Factory

---

## Quick Deploy (Recommended: Auto-Deploy via GitHub)

### Step 1: Connect to Cloudflare

1. Go to https://dash.cloudflare.com/?to=/:account/pages
2. Click **"Create a project"**
3. Select **"Direct Upload"** or **"Git provider"**

### Step 2: Git Provider Setup

**For GitHub:**
1. Click **"Connect to Git"**
2. Select repository: `longtho638-jpg/mekong-cli`
3. Configure:
   - **Root directory:** `apps/sophia-proposal`
   - **Build command:** `pnpm build`
   - **Build output directory:** `.next`
4. Click **"Save and Deploy"**

### Step 3: Environment Variables

In Cloudflare Dashboard → Pages → sophia-proposal → Settings:

```
LLM_BASE_URL=http://localhost:11434/v1
LLM_MODEL=llama3.2:3b
```

### Step 4: Custom Domain (Optional)

1. Dashboard → Pages → sophia-proposal → Custom Domains
2. Add: `sophia.agencyos.network`
3. Update DNS records (auto-configured by Cloudflare)

---

## Manual Deploy (Alternative)

```bash
# 1. Install Wrangler
npm install -g wrangler

# 2. Login
wrangler login

# 3. Create project (first time only)
wrangler pages project create sophia-proposal

# 4. Deploy
cd apps/sophia-proposal
pnpm build
pnpm deploy:cf
```

---

## Verification Checklist

- [ ] Homepage: `https://sophia-proposal.pages.dev`
- [ ] Chat: `https://sophia-proposal.pages.dev/chat`
- [ ] API: Test `/api/generate` endpoint
- [ ] Assets loaded correctly
- [ ] Mobile responsive

---

## URLs

| Environment | URL |
|-------------|-----|
| Production | `https://sophia-proposal.pages.dev` |
| Custom Domain | `https://sophia.agencyos.network` |

---

**Deploy complete when all pages accessible.**
