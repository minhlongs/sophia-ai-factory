## Phase 1: Create Polar Products

### Context Links
- Polar SDK docs: https://docs.polar.sh
- Existing webhook handler: `~/mekong-cli/src/raas/polar_webhook_handler.py`
- Revenue router: `~/mekong-cli/src/raas/revenue_router.py`
- COMPLIANCE: No health/wellness/medical terms (memory: reference_polar_acceptable_use.md)

### Overview
- **Priority:** P0 — blocks checkout flow
- **Status:** pending
- **Description:** Create 3 subscription products on Polar.sh that map to existing CREDIT_MAP tiers

### Key Insights
- `PRODUCT_CREDITS` in `polar_webhook_handler.py` maps product_id substrings: `starter->200`, `growth->1000`, `pro->5000`
- Webhook handler uses `key in product_id.lower()` matching — product names MUST contain tier keyword
- Polar org: `longtho638-jpg` (from `revenue_router.py` checkout_url)

### Requirements
- 3 recurring subscription products on Polar.sh
- Product names must contain `starter`, `growth`, `pro` (for webhook CREDIT_MAP matching)
- Product descriptions: neutral B2B SaaS language only (Polar compliance)

### Architecture
```
Polar Dashboard/SDK
  └── Product: "MekongMind Starter" ($49/mo) → product_id contains "starter"
  └── Product: "MekongMind Growth" ($149/mo) → product_id contains "growth"  
  └── Product: "MekongMind Pro" ($499/mo) → product_id contains "pro"
```

### Related Code Files
- **Modify:** `~/mekong-cli/src/raas/revenue_router.py` — update `POLAR_CHECKOUT_URL` env default
- **Read-only:** `~/mekong-cli/src/raas/polar_webhook_handler.py` — verify PRODUCT_CREDITS map

### Implementation Steps

#### Option A: Polar Dashboard (fastest, recommended)
1. Go to https://polar.sh/longtho638-jpg/products
2. Create product "MekongMind Starter":
   - Name: `MekongMind Starter`
   - Description: `AI-powered developer operations platform. 200 compute credits per month. Automated code review, testing, and deployment orchestration for small teams.`
   - Price: $49/month (recurring)
   - Copy `product_id` from URL after creation
3. Create product "MekongMind Growth":
   - Name: `MekongMind Growth`
   - Description: `AI operations platform for scaling teams. 1,000 compute credits per month. Full automation suite with parallel execution, custom workflows, and priority processing.`
   - Price: $149/month (recurring)
   - Copy `product_id`
4. Create product "MekongMind Pro":
   - Name: `MekongMind Pro`
   - Description: `Enterprise-grade AI operations platform. 5,000 compute credits per month. Unlimited workflows, team workspaces, SSO, audit logs, and dedicated support.`
   - Price: $499/month (recurring)
   - Copy `product_id`
5. Configure webhook endpoint in Polar dashboard:
   - URL: `https://<gateway-domain>/webhook/polar`
   - Events: `order.created`, `subscription.active`, `subscription.cancelled`
   - Copy webhook secret to `POLAR_WEBHOOK_SECRET` env var

#### Option B: Polar SDK (scriptable)
```python
# Script: ~/mekong-cli/scripts/create-polar-products.py
from polar_sdk import Polar

client = Polar(access_token=os.environ["POLAR_ACCESS_TOKEN"])

tiers = [
    {"name": "MekongMind Starter", "price": 4900, "desc": "AI developer operations platform. 200 compute credits/mo."},
    {"name": "MekongMind Growth", "price": 14900, "desc": "AI operations for scaling teams. 1,000 compute credits/mo."},
    {"name": "MekongMind Pro", "price": 49900, "desc": "Enterprise AI operations. 5,000 compute credits/mo."},
]

for t in tiers:
    product = client.products.create(
        name=t["name"],
        description=t["desc"],
        prices=[{"type": "recurring", "amount": t["price"], "currency": "usd", "interval": "month"}],
    )
    print(f"Created: {product.id} — {t['name']}")
```

### Todo List
- [ ] Decide Option A vs B
- [ ] Create 3 Polar products
- [ ] Record product_ids (needed for Phase 3 checkout URLs)
- [ ] Configure webhook URL in Polar dashboard
- [ ] Set `POLAR_WEBHOOK_SECRET` in M1 Max env
- [ ] Verify product names contain tier keywords (starter/growth/pro)

### Success Criteria
- 3 products visible at https://polar.sh/longtho638-jpg/products
- Webhook endpoint configured and secret set
- Product IDs recorded for Phase 3

### Risk Assessment
- **Polar compliance:** NEVER use health/wellness terms. Use "developer operations", "compute credits", "automation platform"
- **Product naming:** MUST contain tier keyword or webhook handler won't match credits

### Next Steps
- Pass product_ids to Phase 3 for checkout URL construction
