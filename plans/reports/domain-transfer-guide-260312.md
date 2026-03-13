# Sophia Domain Transfer Guide

**Date:** 2026-03-12 12:25
**Domain:** sophia.agencyos.network

---

## Quick Transfer Steps

### Step 1: Find Current Project

1. Go to https://vercel.com/dashboard
2. Search for domain `sophia.agencyos.network` in domain list
3. Note which project it's assigned to

### Step 2: Transfer Domain

**Option A: Transfer from existing project**
1. Open the project that currently has `sophia.agencyos.network`
2. Go to **Settings** → **Domains**
3. Find `sophia.agencyos.network` in the list
4. Click **⋮** (three dots) → **Transfer**
5. Select project: **sophia-proposal**
6. Confirm transfer

**Option B: Remove and re-add**
1. Remove domain from current project
2. Run in terminal:
   ```bash
   npx vercel domains add sophia.agencyos.network
   ```

### Step 3: Verify

```bash
# List domains in current project
npx vercel domains ls

# Should show sophia.agencyos.network assigned to sophia-proposal
```

---

## DNS Configuration (If Needed)

If you want to keep using Cloudflare:

### Cloudflare Settings:
- **Type:** CNAME
- **Name:** sophia
- **Target:** cname.vercel-dns.com
- **Proxy:** Enabled (orange cloud)

Or use Vercel nameservers:
- ns1.vercel-dns.com
- ns2.vercel-dns.com

---

## Expected Result

After transfer completes:
- ✅ Domain assigned to sophia-proposal
- ✅ SSL certificate auto-generated (5-10 min)
- ✅ https://sophia.agencyos.network → production app

---

## Current Production URLs

| URL | Status |
|-----|--------|
| https://sophia-proposal.vercel.app | ✅ Live |
| https://sophia.agencyos.network | ⏳ Pending transfer |

---

## Troubleshooting

**"Domain already assigned" error:**
- Domain must be removed from old project first
- Or use transfer feature

**SSL certificate pending:**
- Takes 5-10 minutes to auto-generate
- Check Vercel dashboard for status

**DNS not propagating:**
- Wait up to 24 hours
- Or flush DNS: `sudo dscacheutil -flushcache`
