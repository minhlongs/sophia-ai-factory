# Phase 4: Frontend Integration

## Context
Updating the UI to allow users to purchase the products.

## Overview
Modify the existing Pricing component to initiate the checkout flow when a user selects a plan.

## Requirements
- Update `src/app/components/sections/pricing.tsx`
- Map "Buy Now" buttons to `/api/checkout`
- Handle loading states
- Handle error states (toast notification)

## Implementation Steps
1.  **Update Component**
    - Add `useTransition` or `useState` for loading
    - Create `handlePurchase(productId)` function
    - Perform `fetch('/api/checkout', ...)`
    - Redirect to returned URL

2.  **Product ID Mapping**
    - Map plan names (Starter, Growth, Premium) to Product IDs (hardcoded or from env/config)

3.  **UX Improvements**
    - Disable button during loading
    - Show spinner text

## Todo
- [ ] Update `pricing.tsx` with checkout logic
- [ ] Map Plans to Product IDs
- [ ] Add loading feedback

## Success Criteria
- Clicking "Buy Now" redirects to Polar Checkout
- User returns to success URL after payment (configure success URL in API)
