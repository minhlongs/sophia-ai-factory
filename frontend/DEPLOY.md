# Vercel Deployment Guide

## Quick Deploy

```bash
cd mekong-landing
vercel --prod
```

## Configuration

Create `vercel.json` (optional):

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "framework": "nextjs",
  "regions": ["sin1"]
}
```

## Environment Variables (Vercel Dashboard)

Add these in Vercel project settings:

```
# Polar.sh (payments)
POLAR_ACCESS_TOKEN=polar_at_xxxxx
POLAR_ORGANIZATION_ID=xxxxx
POLAR_WEBHOOK_SECRET=whsec_xxxxx

# Analytics (optional)
NEXT_PUBLIC_GA_TRACKING_ID=G-XXXXXXXXXX
```

## Custom Domain Setup

1. Go to Vercel Dashboard → Project → Settings → Domains
2. Add custom domain
3. Update DNS records (provided by Vercel):
   ```
   Type: A
   Name: @
   Value: 76.76.21.21

   Type: CNAME
   Name: www
   Value: cname.vercel-dns.com
   ```

## Post-Deployment Checklist

- [ ] Test all pages (/, /dashboard, /settings)
- [ ] Verify mobile responsiveness
- [ ] Check Lighthouse scores
- [ ] Set up Google Analytics
- [ ] Enable HTTPS (auto by Vercel)
- [ ] Test Polar.sh checkout flow

## Rollback (if needed)

```bash
vercel rollback
```
