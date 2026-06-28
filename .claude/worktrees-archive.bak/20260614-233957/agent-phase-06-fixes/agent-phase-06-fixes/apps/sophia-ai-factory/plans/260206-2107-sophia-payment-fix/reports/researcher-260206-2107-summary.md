# Payment Fix Research Summary

## 1. Key Findings

### A. Infrastructure Blocker (Critical)
The "Payments are currently unavailable" error and "created" status are primarily due to **incomplete Stripe Connect onboarding** (`details_submitted_at = null`).
*   **Root Cause**: Vietnam is **NOT** a supported country for Stripe Express accounts used by Polar.sh.
*   **Implication**: The "PingPong -> ACB" workaround fails because the initial identity verification requires a supported country selection.
*   **Resolution**: Must form a US/SG entity (Stripe Atlas) or switch to a merchant-of-record that supports Vietnam directly (e.g., Lemon Squeezy, Gumroad).

### B. Technical Issues
Codebase analysis identified immediate technical errors obscuring the root cause:
1.  **500 Error in `/api/checkout`**: Likely caused by missing or invalid `POLAR_ACCESS_TOKEN` in the server environment. The SDK defaults to a dummy token if the env var is missing, causing authentication failure.
2.  **Code Duplication**: Two competing pricing components exist (`src/components/pricing-section.tsx` vs `src/app/components/sections/pricing.tsx`), creating maintenance risk.
3.  **Missing Configuration**: `NEXT_PUBLIC_POLAR_PRODUCT_*` variables must be verified in Vercel.

## 2. Strategic Recommendations

### Phase 1: Fix Technical Foundation (Immediate)
1.  **Verify Environment**: Ensure `POLAR_ACCESS_TOKEN` and Product IDs are set in Vercel.
2.  **Harden Code**: Add error logging to `/api/checkout` to expose the specific Polar API error.
3.  **Cleanup**: Consolidate pricing logic to a single component.

### Phase 2: Solve Gateway Blocker (Strategic)
1.  **Short-term**: Confirm if Polar support can enable manual payouts or if a different payout method exists.
2.  **Long-term**: Form a US LLC via Stripe Atlas to unblock Stripe Connect, OR migrate payment provider to one supporting Vietnam.

## 3. Unresolved Questions
*   User decision required: Proceed with US entity formation or switch payment providers?

## 4. Next Steps
*   Proceed to **Planning Phase** to implement the technical fixes (Phase 1).
*   User to decide on Phase 2 strategy.
