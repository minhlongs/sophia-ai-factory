## Phase 5: Deploy + Smoke Test

### Context Links
- CF Pages deploy: `mekong/infra/templates/cf-pages/`
- Gateway: `~/mekong-cli/src/gateway.py`
- Cloudflare Tunnel docs: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/

### Overview
- **Priority:** P0 — prove money flows end-to-end
- **Status:** pending
- **Description:** Deploy landing to CF Pages, expose gateway via CF Tunnel, run full E2E payment test

### Key Insights
- Landing page (static HTML) deploys to CF Pages via `wrangler pages deploy`
- Gateway (FastAPI) runs on M1 Max, exposed via Cloudflare Tunnel to public URL
- Must test: landing -> checkout -> webhook -> credits -> dashboard

### Requirements
**Functional:**
- Landing page accessible at `https://mekonmind.pages.dev`
- Gateway API accessible at `https://api-mekonmind.<tunnel-domain>`
- End-to-end payment flow works

**Non-functional:**
- HTTPS enforced on both landing and API
- Health check passing on gateway

### Architecture
```
Internet
  │
  ├── CF Pages: mekonmind.pages.dev
  │   └── index.html, success.html, dashboard.html
  │
  └── CF Tunnel: api.mekonmind.pages.dev (or custom subdomain)
      └── M1 Max: uvicorn src.gateway:app --host 0.0.0.0 --port 8000
```

### Implementation Steps

#### Step 1: Deploy Landing to CF Pages
```bash
# On M1 Max, from ~/mekong-cli
cd ~/mekong-cli

# Deploy to CF Pages
npx wrangler pages project create mekonmind --production-branch main 2>/dev/null || true
npx wrangler pages deploy sites/mekonmind --project-name mekonmind

# Verify
curl -sI https://mekonmind.pages.dev | head -5
# Should return HTTP/2 200
```

#### Step 2: Start Gateway on M1 Max
```bash
# Ensure env vars are set
export POLAR_WEBHOOK_SECRET="whsec_..."
export CORS_ALLOWED_ORIGINS="https://mekonmind.pages.dev,http://localhost:3000"

# Start gateway
cd ~/mekong-cli
uvicorn src.gateway:app --host 0.0.0.0 --port 8000 &

# Verify health
curl http://localhost:8000/health
# Should return {"status": "ok"}
```

#### Step 3: Expose Gateway via Cloudflare Tunnel
```bash
# If cloudflared not installed:
brew install cloudflared

# Quick tunnel (no config needed):
cloudflared tunnel --url http://localhost:8000

# Or named tunnel (persistent):
cloudflared tunnel create mekonmind-api
cloudflared tunnel route dns mekonmind-api api-mekonmind.agencyos.network
cloudflared tunnel run mekonmind-api

# Record the public URL (e.g., https://xxx-xxx.trycloudflare.com or custom domain)
```

#### Step 4: Update Landing Page with API URL
```bash
# Update dashboard.html API_URL to point to tunnel URL
# Update CORS_ALLOWED_ORIGINS to include tunnel URL
# Re-deploy to CF Pages
npx wrangler pages deploy sites/mekonmind --project-name mekonmind
```

#### Step 5: Configure Polar Webhook URL
- Go to Polar dashboard -> Webhooks
- Set URL to: `https://<tunnel-url>/webhook/polar`
- Ensure events: `order.created`, `subscription.active`, `subscription.cancelled`

#### Step 6: End-to-End Smoke Test
```bash
# 1. Landing page loads
curl -s https://mekonmind.pages.dev | grep -c "MekongMind"
# Expected: > 0

# 2. Pricing section renders
curl -s https://mekonmind.pages.dev | grep -c '$49'
# Expected: > 0

# 3. Gateway health check
curl -s https://<tunnel-url>/health
# Expected: {"status": "ok"}

# 4. Pricing endpoint
curl -s https://<tunnel-url>/v1/pricing
# Expected: JSON with 3 tiers

# 5. Onboard endpoint (test free tier)
curl -X POST https://<tunnel-url>/v1/onboard \
  -H "Content-Type: application/json" \
  -d '{"name": "Test User", "email": "test@example.com"}'
# Expected: {"tenant_id": "...", "api_key": "mk_...", "credits": 50}

# 6. Dashboard endpoint
curl -s "https://<tunnel-url>/dashboard/summary?token=mk_<key_from_step_5>"
# Expected: balance, tier info

# 7. Webhook simulation (test without real payment)
curl -X POST https://<tunnel-url>/webhook/polar \
  -H "Content-Type: application/json" \
  -d '{
    "type": "order.created",
    "data": {
      "product_id": "mekonmind-starter",
      "customer": {"email": "test@example.com"}
    }
  }'
# Expected: {"status": "ok"} + credits added (200)

# 8. Verify credits increased
curl -s "https://<tunnel-url>/dashboard/summary?token=mk_<key>"
# Expected: balance = 250 (50 free + 200 starter)
```

#### Step 7: Real Payment Test (optional)
- Use a real card on Polar checkout (Starter tier, $49)
- Verify webhook fires
- Verify credits provisioned
- Verify dashboard shows correct balance
- Refund via Polar dashboard if needed

### Todo List
- [ ] Deploy landing to CF Pages
- [ ] Start gateway on M1 Max
- [ ] Expose gateway via CF Tunnel
- [ ] Update landing with API URL
- [ ] Configure Polar webhook with tunnel URL
- [ ] Run smoke test steps 1-8
- [ ] (Optional) Run real payment test
- [ ] Record all URLs in project docs

### Success Criteria
- Landing page loads at CF Pages URL
- Gateway responds to health check via CF Tunnel
- Free onboard flow works E2E
- Webhook simulation provisions credits correctly
- Dashboard shows correct balance
- **ULTIMATE:** Real $ in Polar account after test purchase

### Risk Assessment
- **CF Tunnel stability:** Quick tunnels get random URLs that change on restart. Use named tunnel for persistence.
- **Webhook timing:** Polar may take seconds to fire webhook. Dashboard should handle "not found yet" gracefully.
- **CORS:** Ensure tunnel domain is in CORS_ALLOWED_ORIGINS or dashboard fetch will fail.

### Verification Report Template
```
## MekongMind MVP Launch Verification
- Landing: [status] https://mekonmind.pages.dev
- Gateway: [status] https://<tunnel-url>/health
- Onboard: [status] POST /v1/onboard
- Webhook: [status] POST /webhook/polar
- Dashboard: [status] GET /dashboard/summary
- E2E Payment: [status] Real $ received: [yes/no]
- Timestamp: [ISO-8601]
```
