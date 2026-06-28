# Post-Migration Action Plan
**Date**: 2026-01-29
**Protocol**: Execute immediately after migration
**Time to Revenue**: 1-2 days

---

## Immediate Actions (Next 30 Minutes)

### 1. Copy Environment Variables (5 min)
```bash
# Copy .env from archive
cp ~/mekong-cli.archive/api/.env ~/mekong-cli/api/.env

# Verify credentials present
grep -E "(PAYPAL|STRIPE|GUMROAD)" ~/mekong-cli/api/.env | wc -l
# Should show: 7 (if all credentials present)
```

**Critical Secrets**:
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_WEBHOOK_ID`
- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `GUMROAD_ACCESS_TOKEN`

---

### 2. Local Testing (15 min)

**Test API Server**:
```bash
cd ~/mekong-cli/api
poetry install  # If not already done
poetry run uvicorn main:app --reload --port 8001
```

Open: http://localhost:8001/docs

**Verify Endpoints**:
- ✅ GET `/` - Health check
- ✅ GET `/docs` - Swagger UI
- ✅ POST `/api/v1/payments/paypal/create-order` - PayPal integration
- ✅ POST `/api/v1/payments/stripe/create-checkout` - Stripe integration

**Test Frontend**:
```bash
cd ~/mekong-cli/frontend
npm install  # If not already done
npm run dev
```

Open: http://localhost:3000

**Verify Pages**:
- ✅ `/` - Landing page
- ✅ `/checkout` - Payment flow
- ✅ `/thank-you` - Post-purchase

---

### 3. Git Commit (10 min)

```bash
cd ~/mekong-cli

# Review changes
git status
git diff

# Stage all changes
git add .

# Commit with conventional message
git commit -m "feat(migration): complete lean revenue architecture migration

- Reduce codebase from 13GB to 23MB (99.82% reduction)
- Reduce files from 1.45M to 229 (99.98% reduction)
- Focus on revenue-generating APIs only (16 routes)
- Add CI/CD automation (GitHub Actions)
- Add production deployment (Cloud Run)
- Prepare 8 sellable products for distribution

BREAKING CHANGE: Legacy apps removed, revenue-first architecture

Refs: #lean-migration #phase-5-7-9
Co-authored-by: Binh Pháp Strategy <strategy@binhphap.ventures>"

# Verify commit
git log -1 --stat
```

---

## Short-term Actions (Next 24 Hours)

### 4. Configure GitHub Secrets (30 min)

Navigate to: https://github.com/binh-phap-ventures/mekong-cli/settings/secrets/actions

**Required Secrets** (12 total):

**Infrastructure**:
```
GCP_SA_KEY = {
  "type": "service_account",
  "project_id": "your-project",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...",
  "client_email": "...",
  "client_id": "...",
  ...
}
```

**Payment Gateways**:
```
PAYPAL_CLIENT_ID = sb_xxxxx (from .env)
PAYPAL_CLIENT_SECRET = xxxxx (from .env)
PAYPAL_WEBHOOK_ID = xxxxx (from .env)
PAYPAL_MODE = sandbox

STRIPE_SECRET_KEY = sk_test_xxxxx (from .env)
STRIPE_PUBLISHABLE_KEY = pk_test_xxxxx (from .env)
STRIPE_WEBHOOK_SECRET = whsec_xxxxx (from .env)

GUMROAD_ACCESS_TOKEN = xxxxx (from .env)
```

**Application**:
```
LICENSE_SECRET_KEY = {generate 32-char secret}
API_BASE_URL = https://mekong-api-xxxxx-uc.a.run.app
FRONTEND_URL = https://yourdomain.com
```

**Generate LICENSE_SECRET_KEY**:
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

---

### 5. Deploy to Production (1 hour)

**Push to GitHub**:
```bash
git push origin main
```

**Monitor Deployment**:
1. Go to: https://github.com/binh-phap-ventures/mekong-cli/actions
2. Watch "Deploy to Cloud Run" workflow
3. Wait for ✅ green checkmark

**Verify Production**:
```bash
# Get Cloud Run URL from deployment logs
export API_URL="https://mekong-api-xxxxx-uc.a.run.app"

# Health check
curl $API_URL/
# Expected: {"status":"ok","service":"mekong-api"}

# API docs
open $API_URL/docs
```

---

### 6. Test Payment Flow End-to-End (30 min)

**PayPal Sandbox Testing**:
```bash
# Create test order
curl -X POST "$API_URL/api/v1/payments/paypal/create-order" \
  -H "Content-Type: application/json" \
  -d '{"amount": 10.00, "currency": "USD"}'

# Expected response:
# {
#   "id": "ORDER_ID",
#   "status": "CREATED",
#   "links": [...]
# }
```

**Stripe Test Mode**:
```bash
# Create checkout session
curl -X POST "$API_URL/api/v1/payments/stripe/create-checkout" \
  -H "Content-Type: application/json" \
  -d '{"price_id": "price_xxxxx", "quantity": 1}'

# Expected response:
# {
#   "id": "cs_test_xxxxx",
#   "url": "https://checkout.stripe.com/..."
# }
```

**Test Cards** (Stripe):
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- 3D Secure: `4000 0027 6000 3184`

---

## Medium-term Actions (Next 7 Days)

### 7. Fix Tech Debt (2 hours)

**Priority 1: PayPal TypeScript Types** (Low Risk)
```bash
cd ~/mekong-cli/frontend
npm install --save-dev @types/paypal__react-paypal-js@latest

# Update component type annotations
# File: landing/app/components/PayPalSmartButton.tsx:191
```

**Priority 2: MD3 Compliance** (Medium Risk)
```bash
# Convert Tailwind classes to MD3 tokens
# Example: bg-indigo-600 → bg-[var(--md-sys-color-primary)]

# Files to update:
# - frontend/pages/index.tsx
# - frontend/pages/checkout.tsx
# - frontend/pages/thank-you.tsx
```

**Priority 3: Wire Payment APIs to Frontend** (High Value)
```bash
# Update checkout.tsx to use real PayPal/Stripe APIs
# Add error handling
# Add loading states
# Add success/failure redirects
```

---

### 8. Marketing & Sales Setup (4 hours)

**Product Publishing**:
```bash
cd ~/mekong-cli
ls -lh products/

# Expected products:
# - agencyos-enterprise-v1.zip (Main offering)
# - auth-starter-kit-v1.zip
# - landing-page-kit-v1.zip
# - saas-boilerplate-v1.zip
# - admin-dashboard-pro-v1.zip
# ... 3 more products
```

**Gumroad Upload**:
1. Login to https://gumroad.com/
2. Create products for each ZIP
3. Set pricing ($395 - $995 per product)
4. Configure webhooks to `/webhooks/gumroad/`

**Landing Page Optimization**:
- Add product screenshots
- Write compelling copy
- Add customer testimonials
- Set up Google Analytics

---

### 9. Revenue Tracking Setup (1 hour)

**MRR Dashboard**:
```bash
cd ~/mekong-cli/api

# Run revenue commands (when API is running)
curl $API_URL/api/v1/analytics/revenue/mrr
# Expected: {"mrr": 0, "arr": 0, "growth_rate": 0}
```

**Set Up Alerts**:
- Slack webhook for new sales
- Email notification for payment failures
- Daily revenue report

---

## Long-term Actions (Next 30 Days)

### 10. Scale & Optimize (Ongoing)

**Performance**:
- Monitor Cloud Run metrics
- Optimize database queries
- Add Redis caching layer

**Security**:
- Enable Workload Identity Federation
- Rotate API keys monthly
- Audit access logs weekly

**Features**:
- Add subscription billing
- Implement affiliate program
- Build customer dashboard

---

## Success Metrics

### Week 1 (Days 1-7)
- [ ] $1K MRR achieved
- [ ] 3+ paying customers
- [ ] 0 critical bugs reported
- [ ] 99.9% uptime

### Month 1 (Days 1-30)
- [ ] $5K MRR achieved
- [ ] 15+ paying customers
- [ ] All tech debt resolved
- [ ] 5-star customer satisfaction

### Quarter 1 (Days 1-90)
- [ ] $20K MRR achieved
- [ ] 50+ paying customers
- [ ] Product market fit validated
- [ ] Ready for Series A fundraising

---

## Rollback Plan (Just In Case)

**If Critical Issues**:
```bash
# Stop production
gcloud run services update mekong-api --no-traffic --region us-central1

# Restore old codebase
mv ~/mekong-cli ~/mekong-cli.broken
mv ~/mekong-cli.archive ~/mekong-cli

# Redeploy old version
cd ~/mekong-cli
git reset --hard HEAD~1
git push --force origin main
```

**Backup Contacts**:
- Cloud Run support: https://cloud.google.com/support
- Payment gateway support: PayPal/Stripe dashboards
- Emergency hotline: [Your phone number]

---

## Daily Checklist (Operational Excellence)

**Morning** (9 AM):
- [ ] Check GitHub Actions status
- [ ] Review Cloud Run logs
- [ ] Check payment gateway health
- [ ] Review overnight sales

**Afternoon** (3 PM):
- [ ] Respond to customer inquiries
- [ ] Monitor error rates
- [ ] Update revenue dashboard

**Evening** (9 PM):
- [ ] Daily revenue report
- [ ] Backup database
- [ ] Plan tomorrow's tasks

---

**Status**: Ready for execution
**Next Command**: `bash /tmp/final-migration-260129.sh`
**Time to Revenue**: 1-2 days
