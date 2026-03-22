# Production Deployment Checklist

**Project:** Sophia AI Factory
**Target:** Q2 2026 Gate 1 ($5K MRR, 10 pilots)
**Date:** 2026-03-20

---

## Pre-Production Requirements

### Infrastructure

- [ ] **Cloudflare Pages** project created
- [ ] **Custom domain** configured (sophia.agencyos.network)
- [ ] **SSL certificate** active (auto via Cloudflare)
- [ ] **Environment variables** set in Cloudflare dashboard

### Database

- [ ] **Supabase project** created (Singapore region)
- [ ] **Migrations deployed:**
  ```bash
  npx supabase db push
  ```
- [ ] **RLS policies** enabled
- [ ] **Database backup** configured (daily)

### Authentication

- [ ] **Supabase Auth** configured
- [ ] **Email provider** (Resend) configured
- [ ] **Magic link** templates customized
- [ ] **Password policy** enforced

### Payments (Polar.sh)

- [ ] **Polar account** approved
- [ ] **4 products** created (Starter/Growth/Premium/Master)
- [ ] **MCU allowances** configured (500/2000/10000/25000)
- [ ] **Webhook endpoint** added
- [ ] **Webhook secret** configured

### AI Services

- [ ] **Anthropic API** key configured
- [ ] **HeyGen API** key configured
- [ ] **HeyGen webhook** URL set
- [ ] **HubSpot OAuth** app created

### Monitoring

- [ ] **Sentry** project created
- [ ] **Sentry DSN** configured
- [ ] **Error alerts** configured (Slack/Email)
- [ ] **Uptime monitoring** enabled

---

## Environment Variables

### Required (Core)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Polar.sh
POLAR_API_KEY=pk_test_...
POLAR_WEBHOOK_SECRET=whsec_...

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...
```

### Required (Features)

```bash
# HeyGen (Video)
HEYGEN_API_KEY=...
HEYGEN_WEBHOOK_SECRET=...

# HubSpot (CRM)
HUBSPOT_CLIENT_ID=...
HUBSPOT_CLIENT_SECRET=...
HUBSPOT_REDIRECT_URI=https://sophia.agencyos.network/api/crm/callback

# Sentry (Monitoring)
NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx
```

### Optional

```bash
# Resend (Email)
RESEND_API_KEY=re_...

# Analytics
NEXT_PUBLIC_VERCEL_ANALYTICS_ID=...
```

---

## Testing Checklist

### Core Flows

- [ ] **Signup flow** — Email/password + Magic link
- [ ] **Onboarding** — Org creation
- [ ] **Proposal generation** — AI text generation
- [ ] **Video generation** — HeyGen integration
- [ ] **CRM sync** — HubSpot OAuth + sync
- [ ] **Payment flow** — Polar checkout → MCU credit
- [ ] **Usage tracking** — MCU deduction

### API Endpoints

```bash
# Test authentication
curl -X POST https://sophia.agencyos.network/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"secure123"}'

# Test proposal generation
curl -X POST https://sophia.agencyos.network/api/proposals/generate \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"clientInfo":{...}}'

# Test webhook (Polar)
curl -X POST https://sophia.agencyos.network/api/webhooks/polar \
  -H "Content-Type: application/json" \
  -H "X-Polar-Signature: test" \
  -d @test-payload.json
```

---

## Go/No-Go Criteria (Gate 1)

| Metric | Target | Current | Decision |
|--------|--------|---------|----------|
| Paid Pilots | 10 @ $499/mo | 0 | ⏳ Pending |
| MRR | $5K+ | $0 | ⏳ Pending |
| NPS Score | >30 | N/A | ⏳ Pending |
| Retention (7-day) | >70% | N/A | ⏳ Pending |
| Proposal Quality | >80% | N/A | ⏳ Pending |

**Decision Logic:**
- ≥10 pilots + ≥$5K MRR → **GO Phase 2**
- 5-9 pilots → **EXTEND** pilot 2 weeks
- <5 pilots → **PIVOT** (pricing/ICP)
- 0 pilots → **STOP** (PMF failure)

---

## Rollback Plan

### If Production Issues:

1. **Immediate:** Revert to last known good commit
   ```bash
   git revert HEAD
   git push origin main
   ```

2. **Database:** Run rollback migration
   ```bash
   npx supabase db reset
   ```

3. **Communicate:** Status page update + email to pilots

### Emergency Contacts:

| Role | Name | Contact |
|------|------|---------|
| CTO | OpenClaw | cto@sophia.agencyos.network |
| CEO | [Pending] | ceo@sophia.agencyos.network |
| On-call | [Pending] | oncall@sophia.agencyos.network |

---

## Post-Deploy Verification

### Immediately After Deploy:

```bash
# 1. Homepage loads
curl -I https://sophia.agencyos.network

# 2. Auth pages accessible
curl -I https://sophia.agencyos.network/signup

# 3. API responds
curl https://sophia.agencyos.network/api/health

# 4. Check Sentry dashboard
open https://sentry.io/organizations/sophia-ai-factory/

# 5. Check Cloudflare analytics
open https://pages.cloudflare.com/
```

### Day 1-7:

- [ ] Monitor error rate (<1%)
- [ ] Check Sentry dashboard daily
- [ ] Review usage logs
- [ ] Collect pilot feedback
- [ ] Daily standup on metrics

---

**Owner:** CTO Agent
**Deploy Date:** TBD (pending manual steps)
**Gate 1 Deadline:** 2026-06-30
