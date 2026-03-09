# Phase 6 Production Deployment Checklist

## Pre-Deployment

### 1. Environment Variables

Verify all environment variables are set in production:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# RaaS Gateway
RAAS_API_KEY_SECRET=...
API_KEY_SECRET=...

# Stripe/Polar
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_METER_ID=mt_...
POLAR_WEBHOOK_SECRET=whsec_...

# Cron Security
CRON_SECRET=...
CLOUDFLARE_QUEUE_SECRET=...

# Email
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=billing@sophia.agencyos.network
```

### 2. Database Migrations

Run all pending migrations:

```bash
# Deploy violations table
npx supabase db push --db-url "$SUPABASE_CONNECTION_STRING"

# Verify tables created
psql "$SUPABASE_CONNECTION_STRING" -c "\dt violations"
psql "$SUPABASE_CONNECTION_STRING" -c "\di violations_*"
```

### 3. Verify RLS Policies

```sql
-- Check violations table RLS
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'violations';

-- Expected: violations_admin_select, violations_user_select, violations_admin_update
```

---

## Deployment Steps

### Step 1: Deploy Code

```bash
git pull origin main
npm install
npm run build
```

### Step 2: Deploy to Vercel

```bash
# Production deployment
git push origin main

# Verify deployment
curl -I https://sophia-ai-factory.vercel.app
```

### Step 3: Verify CI/CD

```bash
# Check GitHub Actions status
gh run list -L 1 --json status,conclusion

# Expected: {"conclusion":"success","status":"completed"}
```

### Step 4: Health Checks

```bash
# API Health
curl https://sophia-ai-factory.vercel.app/api/health

# Violations API (authenticated)
curl -H "Authorization: Bearer $JWT_TOKEN" \
  https://sophia-ai-factory.vercel.app/api/violations

# Expected: 200 OK with JSON response
```

---

## Post-Deployment Verification

### 1. License Enforcement

```bash
# Test with valid license
curl -H "X-API-Key: mk_valid_key" \
  https://raas.agencyos.network/api/v1/usage

# Expected: 200 OK

# Test with expired license
curl -H "X-API-Key: mk_expired_key" \
  https://raas.agencyos.network/api/v1/usage

# Expected: 403 Forbidden
```

### 2. Usage Metering

```bash
# Submit usage event
curl -X POST https://sophia-ai-factory.vercel.app/api/v1/usage \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT" \
  -d '{"records": [...]}'

# Expected: 200 OK with ingestion result
```

### 3. Webhooks

Test webhook endpoints:

```bash
# Stripe webhook (use Stripe CLI for local testing)
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Polar webhook (use Polar CLI or ngrok)
ngrok http 3000
```

### 4. Cron Jobs

Verify cron endpoints:

```bash
# Daily overage billing (2 AM UTC)
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://sophia-ai-factory.vercel.app/api/cron/overage-billing

# Expected: 200 OK with reconciliation result
```

### 5. Analytics Dashboard

Check real-time sync:

1. Open https://agencyos.network/dashboard
2. Navigate to Analytics → Usage
3. Verify data updates in real-time

---

## Rollback Plan

If deployment fails:

### Step 1: Rollback Code

```bash
# Revert to previous commit
git revert HEAD
git push origin main
```

### Step 2: Disable Webhooks

```bash
# Pause Stripe webhooks
stripe webhook disable

# Pause Polar webhooks (via Polar dashboard)
```

### Step 3: Database Rollback

```sql
-- Drop violations table if needed
DROP TABLE IF EXISTS violations CASCADE;
```

---

## Success Criteria

- [ ] All API endpoints respond with 200 OK
- [ ] License enforcement working (expired/revoked blocked)
- [ ] Usage events tracked correctly
- [ ] Webhooks processed without errors
- [ ] Cron jobs run successfully
- [ ] Analytics dashboard shows real-time data
- [ ] No console errors in browser
- [ ] CI/CD pipeline green

---

## Monitoring

### Logs to Watch

```bash
# Vercel logs
vercel logs --prod

# Supabase logs
npx supabase logs
```

### Alerts to Configure

1. **API Error Rate** > 5% in 5 minutes
2. **Webhook Failures** > 10 in 1 hour
3. **Cron Job Failures** - any failure
4. **Database Errors** - any error
5. **Rate Limit Hits** - spike detection

---

## Contact

- **Tech Lead:** [Your Name]
- **On-Call:** [On-Call Person]
- **Slack Channel:** #sophia-production
