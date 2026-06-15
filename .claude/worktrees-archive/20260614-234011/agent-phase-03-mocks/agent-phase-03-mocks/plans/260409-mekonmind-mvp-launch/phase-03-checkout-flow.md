## Phase 3: Checkout Flow

### Context Links
- Polar SDK checkout: https://docs.polar.sh/api-reference/checkouts
- Revenue router: `~/mekong-cli/src/raas/revenue_router.py`
- Landing page: `~/mekong-cli/sites/mekonmind/index.html`

### Overview
- **Priority:** P0 — connects landing to payment
- **Status:** pending
- **Description:** Wire "Subscribe" buttons to Polar checkout, handle success/failure redirects

### Key Insights
- Polar checkout flow: button click -> GET /checkout/{product_id} (our endpoint) -> redirect to Polar hosted checkout -> Polar redirects to success_url
- Alternative: direct link to `https://polar.sh/longtho638-jpg/products/{product_id}/checkout` (simpler, no backend needed)
- Success page must display: "Payment confirmed. Your API key will be delivered shortly."

### Requirements
**Functional:**
- "Subscribe" buttons redirect to Polar checkout
- Success page confirms purchase
- Failure page offers retry

**Non-functional:**
- No client-side JS needed for checkout redirect (just `<a href>`)
- Success page fetches API key via query params or polling

### Architecture
```
User clicks "Subscribe"
  → href="https://polar.sh/.../checkout?success_url=https://mekonmind.pages.dev/success.html"
  → Polar hosted checkout (payment form)
  → Polar redirects to success.html?checkout_id=xxx
  → success.html shows confirmation message
  
Meanwhile (async):
  → Polar fires webhook to /webhook/polar
  → polar_webhook_handler provisions credits
  → Tenant + API key created
```

### Related Code Files
- **Modify:** `~/mekong-cli/sites/mekonmind/index.html` — update button hrefs with Polar checkout URLs
- **Create:** `~/mekong-cli/sites/mekonmind/success.html` — post-checkout success page
- **Create:** `~/mekong-cli/sites/mekonmind/error.html` — checkout error/cancel page
- **Modify:** `~/mekong-cli/src/raas/revenue_router.py` — add GET /checkout/:tier endpoint (optional, for dynamic checkout creation)

### Implementation Steps

#### Approach A: Direct Polar Links (fastest, recommended for MVP)

1. **Get checkout URLs from Polar dashboard** after Phase 1:
   - Each product has a checkout URL: `https://buy.polar.sh/polar_cl_xxx`
   - Or construct: `https://polar.sh/longtho638-jpg/checkout?products=PRODUCT_ID&success_url=URL`

2. **Update `index.html` pricing buttons:**
   ```html
   <!-- Starter -->
   <a href="https://buy.polar.sh/polar_cl_STARTER_ID?success_url=https://mekonmind.pages.dev/success.html"
      class="...">Subscribe — $49/mo</a>
   
   <!-- Growth -->
   <a href="https://buy.polar.sh/polar_cl_GROWTH_ID?success_url=https://mekonmind.pages.dev/success.html"
      class="...">Subscribe — $149/mo</a>
   
   <!-- Pro -->
   <a href="https://buy.polar.sh/polar_cl_PRO_ID?success_url=https://mekonmind.pages.dev/success.html"
      class="...">Subscribe — $499/mo</a>
   ```

3. **Create `success.html`:**
   ```html
   <h1>Payment Confirmed!</h1>
   <p>Your MekongMind account is being provisioned.</p>
   <p>You will receive your API key via email within 2 minutes.</p>
   <p>Or check your dashboard: <a href="/dashboard.html">View Dashboard</a></p>
   ```

4. **Create `error.html`:**
   ```html
   <h1>Checkout Cancelled</h1>
   <p>No charges were made. <a href="/">Try again</a></p>
   ```

#### Approach B: Backend Checkout Endpoint (better UX, Phase 2 upgrade)

1. **Add endpoint to `revenue_router.py`:**
   ```python
   @router.get("/checkout/{tier}")
   async def create_checkout(tier: str):
       """Create Polar checkout session and redirect."""
       from polar_sdk import Polar
       client = Polar(access_token=os.environ["POLAR_ACCESS_TOKEN"])
       
       product_map = {
           "starter": os.environ["POLAR_PRODUCT_STARTER"],
           "growth": os.environ["POLAR_PRODUCT_GROWTH"],
           "pro": os.environ["POLAR_PRODUCT_PRO"],
       }
       product_id = product_map.get(tier)
       if not product_id:
           raise HTTPException(404, f"Unknown tier: {tier}")
       
       checkout = client.checkouts.create(
           product_id=product_id,
           success_url=f"{os.environ['SITE_URL']}/success.html",
       )
       return RedirectResponse(checkout.url)
   ```

2. Update landing page buttons to point to `/checkout/starter`, etc.

**Recommendation:** Use Approach A for MVP. Zero backend changes needed.

### Todo List
- [ ] Get product checkout URLs from Polar (after Phase 1)
- [ ] Update index.html pricing buttons with checkout URLs
- [ ] Create success.html
- [ ] Create error.html
- [ ] Test checkout flow end-to-end (use Polar test mode if available)

### Success Criteria
- Clicking "Subscribe" opens Polar checkout
- Successful payment redirects to success.html
- Cancelled payment redirects to error.html

### Risk Assessment
- **Polar test mode:** Verify if Polar has sandbox/test mode to avoid real charges during testing
- **Email delivery:** Success page tells user to check email. Must ensure webhook fires and provisions quickly.

### Security Considerations
- Checkout URLs are public (anyone can access) — this is by design (Polar handles auth)
- Success page does NOT display API key directly (security). Key delivered via email or dashboard.

### Next Steps
- Phase 4 handles the actual credit provisioning and API key delivery
