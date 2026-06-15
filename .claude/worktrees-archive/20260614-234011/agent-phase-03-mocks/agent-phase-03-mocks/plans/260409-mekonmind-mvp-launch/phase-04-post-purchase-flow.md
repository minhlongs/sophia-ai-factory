## Phase 4: Post-Purchase Flow

### Context Links
- Webhook handler: `~/mekong-cli/src/raas/polar_webhook_handler.py`
- Revenue router: `~/mekong-cli/src/raas/revenue_router.py`
- Tenant store: `~/mekong-cli/src/raas/tenant.py`
- Credit store: `~/mekong-cli/src/raas/credits.py`
- Dashboard router: `~/mekong-cli/src/raas/dashboard.py`

### Overview
- **Priority:** P0 — this is where $ becomes provisioned service
- **Status:** pending
- **Description:** Webhook fires after Polar payment -> create tenant -> provision credits -> deliver API key to customer

### Key Insights
- `polar_webhook_handler.py` ALREADY handles `order.created` and `subscription.active` events
- It uses `workspace_id` from event metadata — but Polar checkout won't have this unless we pass it
- **GAP:** Current webhook handler expects `workspace_id` in metadata. New customers won't have one.
- **FIX:** Add fallback: extract `customer.email` from event, create tenant if not exists, use email as lookup key
- `revenue_router.py` line 87-99 already has this email-based fallback logic — good
- Need to ensure BOTH handlers don't conflict (revenue_router vs polar_webhook_handler)

### Requirements
**Functional:**
- Webhook receives Polar payment event
- System creates tenant + API key (or finds existing)
- Credits provisioned based on product tier
- Customer can retrieve API key via dashboard page

**Non-functional:**
- Idempotent — duplicate webhook events don't double-provision
- API key shown only once or retrievable via authenticated dashboard

### Architecture
```
Polar webhook fires (order.created / subscription.active)
  │
  ├──> revenue_router.py /webhook/polar
  │    ├── Verify HMAC signature
  │    ├── Extract customer_email from payload
  │    ├── Find or create tenant by email
  │    ├── Map product_id to credits (CREDIT_MAP)
  │    └── Add credits to tenant
  │
  └──> Dashboard page (customer-facing)
       ├── GET /dashboard/summary?token=mk_xxx → credit balance, usage
       └── sites/mekonmind/dashboard.html → minimal UI
```

### Related Code Files
- **Modify:** `~/mekong-cli/src/raas/revenue_router.py` — fix `hmac.new` -> `hmac.HMAC` bug (line 75), align CREDIT_MAP with Polar products
- **Modify:** `~/mekong-cli/src/gateway.py` — ensure CORS allows mekonmind.pages.dev origin
- **Create:** `~/mekong-cli/sites/mekonmind/dashboard.html` — minimal customer dashboard
- **Read-only:** `~/mekong-cli/src/raas/dashboard.py` — existing SSE dashboard endpoints

### Implementation Steps

1. **Fix bug in `revenue_router.py` line 75:**
   ```python
   # BUG: hmac.new() doesn't exist, should be hmac.HMAC() or hmac.new is Python 2
   # Current (broken):
   expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
   # Fix:
   expected = hmac.HMAC(secret.encode(), body, hashlib.sha256).hexdigest()
   ```

2. **Decide which webhook handler to use:**
   - `revenue_router.py` `/webhook/polar` — simpler, email-based tenant lookup
   - `polar_webhook_handler.py` `PolarWebhookHandler` — richer, workspace-based, idempotent
   
   **Recommendation:** Use `revenue_router.py` for MVP (simpler). It already handles the email fallback flow. The `polar_webhook_handler.py` is for workspace-level billing (future).

3. **Align CREDIT_MAP in `revenue_router.py` with Polar products:**
   ```python
   CREDIT_MAP = {
       "starter": 200,    # MekongMind Starter ($49)
       "growth": 1000,    # MekongMind Growth ($149)
       "pro": 5000,       # MekongMind Pro ($499)
   }
   ```
   Already correct. Verify product_id matching logic works with Polar product names.

4. **Add CORS origin for CF Pages domain in `gateway.py`:**
   ```python
   # In CORS_ALLOWED_ORIGINS env or hardcode for MVP:
   "https://mekonmind.pages.dev"
   ```

5. **Create minimal `dashboard.html`:**
   - Input: API key (mk_xxx)
   - On submit: fetch `GET /dashboard/summary?token=mk_xxx`
   - Display: credit balance, tier, usage history
   - Simple JS fetch, no framework
   
   ```html
   <input id="apikey" placeholder="Enter your API key (mk_...)">
   <button onclick="loadDashboard()">Load Dashboard</button>
   <div id="dashboard">
     <p>Credits: <span id="credits">—</span></p>
     <p>Tier: <span id="tier">—</span></p>
   </div>
   <script>
   async function loadDashboard() {
     const key = document.getElementById('apikey').value;
     const res = await fetch(`${API_URL}/dashboard/summary?token=${key}`);
     const data = await res.json();
     document.getElementById('credits').textContent = data.balance;
     document.getElementById('tier').textContent = data.tier;
   }
   </script>
   ```

6. **Add API key display to success flow:**
   - Option A: Email API key to customer (requires email integration — skip for MVP)
   - Option B: Success page polls `/dashboard/summary?email=xxx` endpoint (need new endpoint)
   - **Option C (MVP):** Success page says "Check dashboard with your email". Dashboard page lets user enter email, returns API key if tenant exists.

7. **Add GET /v1/retrieve-key endpoint to `revenue_router.py`:**
   ```python
   @router.get("/v1/retrieve-key")
   async def retrieve_key(email: str):
       """Retrieve API key by email (for post-purchase flow)."""
       store = TenantStore()
       tenant = store.find_by_email(email)
       if not tenant:
           raise HTTPException(404, "No account found for this email. Please wait 2 minutes after purchase.")
       return {"api_key": tenant.api_key, "tenant_id": tenant.id}
   ```
   **Security note:** This is acceptable for MVP since API key was already shown at onboard time. For production, add email verification.

### Todo List
- [ ] Fix `hmac.new` -> `hmac.HMAC` bug in revenue_router.py
- [ ] Verify CREDIT_MAP matches Polar product names
- [ ] Add mekonmind.pages.dev to CORS origins
- [ ] Create dashboard.html with API key input + balance display
- [ ] Add GET /v1/retrieve-key endpoint
- [ ] Test webhook flow: Polar event -> tenant created -> credits added
- [ ] Test dashboard: API key -> shows balance

### Success Criteria
- Polar webhook creates tenant + provisions correct credits
- Customer can retrieve API key via dashboard
- Credit balance displays correctly
- No duplicate provisioning on webhook replay

### Risk Assessment
- **hmac.new bug:** Will cause 500 on webhook. MUST fix before launch.
- **Race condition:** Customer hits dashboard before webhook fires. Dashboard should show "provisioning" message.
- **API key security:** Showing API key by email is weak. Acceptable for MVP, add email verification for v2.

### Security Considerations
- Webhook signature verification prevents spoofed events
- API keys are `mk_` prefixed, SHA-256 hashed in DB
- Dashboard requires API key to view data (no unauthenticated access)
- `/v1/retrieve-key` by email is MVP-only, needs rate limiting for production
