# Codebase Analysis: Payment Implementation

## 1. Overview
The payment system uses **Polar.sh** for checkout and subscription management. It is integrated into the Next.js App Router via:
- **Frontend**: Pricing components (`src/components/pricing-section.tsx` and `src/app/components/sections/pricing.tsx`) that initiate checkout.
- **Backend**: `/api/checkout` route that creates checkout sessions using the Polar SDK.
- **Webhooks**: `/api/polar/webhook` for handling order fulfillment and subscription updates.

## 2. Issues Identified

### A. 500 Error in `/api/checkout`
**Root Cause Analysis:**
The `src/app/api/checkout/route.ts` wraps the checkout creation in a try-catch block. A 500 error indicates an exception thrown within the `try` block.

**Likely Cause: Invalid/Missing API Token**
In `src/lib/polar.ts`:
```typescript
export const polar = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN || 'dummy_token_for_build',
  server: process.env.NODE_ENV === 'development' ? 'sandbox' : 'production',
})
```
If `POLAR_ACCESS_TOKEN` is missing in the server environment, the SDK initializes with `'dummy_token_for_build'`. Any API call made with this token (like `polar.checkouts.create`) will fail authentication, throwing an error that results in a 500 response.

**Secondary Cause: Missing Product IDs**
The system relies on environment variables for product mapping:
- `NEXT_PUBLIC_POLAR_PRODUCT_STARTER`
- `NEXT_PUBLIC_POLAR_PRODUCT_GROWTH`
- `NEXT_PUBLIC_POLAR_PRODUCT_PREMIUM`

If these are missing, the checkout request might fail validation either on the client (alerting the user) or on the server (if passed but invalid).

### B. "Payments are currently unavailable"
This specific string does not exist in the codebase. It is likely:
1.  **A generic error message** displayed by the browser or a UI component when the 500 error occurs (though the code alerts "Failed to start checkout").
2.  **A message from the Polar Checkout page** itself if the user is redirected to a malformed or invalid checkout URL.
3.  **Confusion with the "Processing..." state** or a similar UI state.

### C. Logic Duplication
There are two pricing components:
1.  `src/components/pricing-section.tsx`: Uses `TIER_CONFIGS` and sends `productId` directly.
2.  `src/app/components/sections/pricing.tsx`: Uses `POLAR_PRODUCTS` and sends `tier` (relying on server-side mapping).

This inconsistency can lead to bugs if one is updated and the other isn't. The active one seems to be `src/components/pricing-section.tsx` based on the more modern UI code.

### D. Webhook Handling
The webhook handler (`src/app/api/polar/webhook/route.ts`) correctly maps Polar events (`order.paid`, `subscription.active`) to Supabase `user_profiles` updates. It uses the same environment variables for mapping Product IDs to Tiers.

## 3. Recommendations

1.  **Environment Variables**: Verify `POLAR_ACCESS_TOKEN` and `NEXT_PUBLIC_POLAR_PRODUCT_*` variables are correctly set in the deployment environment (Vercel).
2.  **Error Handling**: Improve `/api/checkout` to log the specific error message from Polar to aid debugging.
3.  **Consolidation**: Deprecate one of the pricing components (likely `src/app/components/sections/pricing.tsx`) to reduce maintenance burden.
4.  **Token Validation**: Add a check in `src/lib/polar.ts` to throw a clearer error if the token is missing in a non-build environment.

## 4. Next Steps
1.  Check Vercel/System environment variables.
2.  Add debug logging to `/api/checkout` to confirm the exact error.
3.  Create a plan to fix the environment configuration and consolidate the pricing logic.
