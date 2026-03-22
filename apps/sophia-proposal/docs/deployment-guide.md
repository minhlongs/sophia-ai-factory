# Sophia AI Factory — Deployment Guide

**Version:** 2.0.0 (Sprint 3)
**Last Updated:** 2026-03-20

---

## Prerequisites

- Node.js 20+
- pnpm 9+
- Supabase account + project
- Polar.sh account (for billing)
- Anthropic API key (for AI features)
- Vercel account (for deployment)

---

## Environment Variables

### Required Variables

Create `.env` locally and configure in Vercel dashboard:

```bash
# ===========================================
# ANTHROPIC (AI Proposal Generation)
# ===========================================
ANTHROPIC_API_KEY=sk-ant-...
# Get from: https://console.anthropic.com/settings/keys

# ===========================================
# SUPABASE (Database + Auth)
# ===========================================
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
# Get from: https://supabase.com/dashboard/project/_/settings/api

# ===========================================
# POLAR.SH (Billing)
# ===========================================
POLAR_API_URL=https://api.polar.sh
POLAR_API_KEY=<YOUR_POLAR_API_KEY>
POLAR_WEBHOOK_SECRET=<YOUR_WEBHOOK_SECRET>
# Get from: https://polar.sh/dashboard/settings/api
```

### Variable Reference

| Variable | Type | Description | Required |
|----------|------|-------------|----------|
| `ANTHROPIC_API_KEY` | Secret | Anthropic API key | Yes (for AI features) |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Supabase anonymous key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret | Supabase service role key | Yes |
| `POLAR_API_URL` | Public | Polar API base URL | Yes |
| `POLAR_API_KEY` | Secret | Polar API key | Yes (for billing) |
| `POLAR_WEBHOOK_SECRET` | Secret | Polar webhook signing secret | Yes (for billing) |

---

## Database Setup

### 1. Create Supabase Project

1. Go to https://supabase.com
2. Click "New Project"
3. Fill in project details
4. Save project ref (e.g., `your-project-ref`)

### 2. Run Migrations

Execute SQL migrations in order:

```bash
# Copy migration files to Supabase SQL Editor
# https://supabase.com/dashboard/project/_/sql/new

# 1. Run 004_billing_tables.sql
# Creates: subscriptions, usage_logs, org_balances, billing_settings, customer_feedback
# Also creates: RLS policies, indexes, utility functions
```

### 3. Verify Tables

Run verification queries:

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('subscriptions', 'usage_logs', 'org_balances', 'billing_settings', 'customer_feedback');

-- Check functions exist
SELECT proname FROM pg_proc
WHERE proname IN ('credit_mcu_balance', 'deduct_mcu_balance');

-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('subscriptions', 'usage_logs', 'org_balances', 'billing_settings', 'customer_feedback');
```

---

## Polar.sh Configuration

### 1. Create Products

Create 4 subscription products in Polar dashboard:

| Product Name | Price | Type |
|--------------|-------|------|
| Sophia Starter | $49/month | Subscription |
| Sophia Growth | $149/month | Subscription |
| Sophia Premium | $499/month | Subscription |
| Sophia Master | $999/month | Subscription |

### 2. Get Product IDs

After creating products, copy product IDs:

```bash
# Product ID is in URL: https://polar.sh/dashboard/products/{product_id}
# Update lib/billing/polar-client.ts POLAR_TIERS:
export const POLAR_TIERS = {
  starter: {
    // ...
    polarProductId: 'prod_your_starter_product_id',
  },
  // ... repeat for other tiers
}
```

### 3. Configure Webhook

1. Go to https://polar.sh/dashboard/settings/webhooks
2. Click "Add Endpoint"
3. Configure:

| Setting | Value |
|---------|-------|
| URL | `https://sophia.agencyos.network/api/webhooks/polar` |
| Events | `subscription.created`, `subscription.updated`, `subscription.deleted`, `order.paid`, `order.refunded` |
| Secret | Auto-generated (copy this!) |

4. Copy webhook secret to `.env`:
   ```
   POLAR_WEBHOOK_SECRET=whsec_...
   ```

### 4. Test Webhook

1. Click "Send Test Event" in Polar dashboard
2. Check application logs for webhook receipt
3. Verify no signature errors

---

## Local Development

### 1. Clone Repository

```bash
git clone <repository-url>
cd sophia-proposal
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env and add your API keys
```

### 4. Run Development Server

```bash
pnpm dev
# Opens http://localhost:3000
```

### 5. Run Tests

```bash
pnpm test
```

### 6. Build for Production

```bash
pnpm build
# Output: ./out directory (static export)
```

---

## Vercel Deployment

### 1. Connect to GitHub

1. Push code to GitHub repository
2. Go to https://vercel.com/new
3. Import GitHub repository

### 2. Configure Project

**Build Settings:**

| Setting | Value |
|---------|-------|
| Framework | Next.js |
| Root Directory | `./` (or package directory in monorepo) |
| Build Command | `pnpm build` |
| Output Directory | `out` |
| Install Command | `pnpm install` |

### 3. Add Environment Variables

In Vercel dashboard → Project Settings → Environment Variables:

| Variable | Value |
|----------|-------|
| `ANTHROPIC_API_KEY` | Your Anthropic key |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service key |
| `POLAR_API_KEY` | Your Polar API key |
| `POLAR_WEBHOOK_SECRET` | Your Polar webhook secret |

**IMPORTANT:** Set for all environments (Production, Preview, Development)

### 4. Deploy

```bash
# Push to main branch triggers auto-deploy
git push origin main
```

### 5. Configure Production URL

After first deploy, update Polar webhook URL:

```
# Replace with your actual Vercel production URL
https://your-project.vercel.app/api/webhooks/polar
```

---

## Alternative Deployment Platforms

### Cloudflare Pages

```bash
# Build command
pnpm build

# Output directory
out

# Deploy
wrangler pages deploy out --project-name=sophia-proposal
```

### Netlify

```bash
# netlify.toml
[build]
  command = "pnpm build"
  publish = "out"

# Deploy
netlify deploy --prod
```

### Static Hosting (S3, etc.)

```bash
pnpm build
# Upload ./out to S3 bucket or static host
# Configure bucket for SPA routing (redirect all to index.html)
```

---

## Post-Deployment Verification

### 1. Health Checks

```bash
# Check homepage loads
curl -I https://sophia.agencyos.network

# Check API responds
curl -I https://sophia.agencyos.network/api/health

# Expected: HTTP 200
```

### 2. Test Authentication

1. Navigate to https://sophia.agencyos.network
2. Click "Sign Up"
3. Create new account
4. Verify redirect to dashboard

### 3. Test Billing Flow

1. Navigate to /billing
2. Click "Upgrade" on a tier
3. Verify redirect to Polar checkout
4. Complete test payment
5. Verify redirect to /billing/success
6. Check subscription appears in dashboard
7. Verify MCU credits added

### 4. Test AI Proposal Generation

1. Navigate to /proposals/new
2. Fill in proposal form
3. Generate proposal
4. Verify output
5. Check usage dashboard reflects MCU deduction

### 5. Test Webhook

1. Make a test payment in Polar dashboard
2. Check webhook delivery in Polar logs
3. Verify MCU credited in application
4. Check database:
   ```sql
   SELECT * FROM org_balances WHERE balance > 0;
   SELECT * FROM subscriptions WHERE status = 'active';
   ```

---

## Monitoring & Debugging

### Application Logs

**Vercel Logs:**
```bash
# View logs in Vercel dashboard
vercel logs <deployment-url>
```

**Supabase Logs:**
- Go to https://supabase.com/dashboard/project/_/logs
- Filter by function calls, errors

### Database Queries

```sql
-- Check subscription status
SELECT s.tier_name, s.status, o.name
FROM subscriptions s
JOIN organizations o ON s.org_id = o.id
ORDER BY s.created_at DESC;

-- Check MCU consumption
SELECT org_id, feature, SUM(mcu_cost) as total_mcu, COUNT(*) as usage_count
FROM usage_logs
GROUP BY org_id, feature
ORDER BY total_mcu DESC
LIMIT 10;

-- Check NPS scores
SELECT
  AVG(nps_score) as avg_score,
  COUNT(*) as total_responses,
  COUNT(CASE WHEN nps_score >= 9 THEN 1 END) as promoters,
  COUNT(CASE WHEN nps_score <= 6 THEN 1 END) as detractors
FROM customer_feedback
WHERE survey_type = 'nps';
```

### Common Issues

#### Issue: Webhook signature verification fails

**Cause:** Incorrect webhook secret or clock skew

**Fix:**
1. Verify `POLAR_WEBHOOK_SECRET` matches Polar dashboard
2. Check server time is synchronized
3. Increase timestamp window in `polar-client.ts` (default: 5 minutes)

#### Issue: MCU not credited after payment

**Cause:** Webhook not delivered or handler error

**Fix:**
1. Check Polar webhook delivery logs
2. Check application logs for handler errors
3. Verify `polar_customer_id` matches billing_settings record
4. Manually credit MCU as fallback:
   ```sql
   SELECT credit_mcu_balance('org-uuid', 500, 'manual_credit');
   ```

#### Issue: HTTP 402 on proposal generation

**Cause:** Insufficient MCU balance

**Fix:**
1. User needs to upgrade subscription
2. Or admin can manually credit:
   ```sql
   SELECT credit_mcu_balance('org-uuid', 100, 'support_credit');
   ```

---

## Scaling Considerations

### Current Limitations (Pilot Phase)

| Component | Limit | Notes |
|-----------|-------|-------|
| Webhook deduplication | In-memory map | 24h window, lost on restart |
| Rate limiting | None | Add in production |
| Email sending | Console.log | Integrate Resend/SendGrid |
| NPS scheduling | scheduled_tasks table | Requires cron job processor |

### Production Recommendations

1. **Webhook Deduplication:** Move to Redis or database-backed store
2. **Rate Limiting:** Add middleware with Vercel KV or Upstash
3. **Email Integration:** Use Resend API for welcome emails
4. **Cron Jobs:** Use Vercel Cron or GitHub Actions for scheduled tasks
5. **Error Tracking:** Add Sentry or similar for error monitoring

---

## Security Checklist

- [ ] All API keys in environment variables (not codebase)
- [ ] `.env` file in `.gitignore`
- [ ] RLS enabled on all billing tables
- [ ] Webhook signature verification enabled
- [ ] HTTPS enforced (Vercel default)
- [ ] No secrets in client-side code
- [ ] Input validation on all API endpoints
- [ ] Error messages don't leak sensitive data

---

## Related Documentation

- [System Architecture](./system-architecture.md)
- [API Documentation](./api-docs.md)
- [Code Standards](./code-standards.md)
- [Setup Guide](./SETUP.md)
