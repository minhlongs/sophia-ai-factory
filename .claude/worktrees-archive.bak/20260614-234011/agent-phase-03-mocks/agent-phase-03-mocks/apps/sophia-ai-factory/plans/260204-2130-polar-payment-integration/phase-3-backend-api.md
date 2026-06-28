# Phase 3: Backend Implementation

## Context
Core backend logic for processing payments and fulfilling orders.

## Overview
Implement API routes for initiating checkouts and receiving webhook notifications from Polar.

## Architecture
- `POST /api/checkout`: Receives `productId`, returns `url` for redirect.
- `POST /api/webhooks/polar`: Validates signature, parses event, triggers fulfillment (logging for now).

## Requirements
- Secure webhook verification using `standard-webhooks`
- Handle `checkout.session.completed`
- Handle `order.created` (if applicable for one-time)
- Secure Checkout API (optional: require auth if app has users)

## Implementation Steps
1.  **Checkout API**
    - Create `src/app/api/checkout/route.ts`
    - Validate `productId` body param
    - Call `polar.checkouts.create`
    - Return `{ url: string }`

2.  **Webhook Handler**
    - Create `src/app/api/webhooks/polar/route.ts`
    - Get raw body text (critical for `standard-webhooks`)
    - Get `webhook-signature` header
    - Verify signature using `Webhook` class
    - Switch on event type
    - Log success/failure

## Todo
- [ ] Implement `src/app/api/checkout/route.ts`
- [ ] Implement `src/app/api/webhooks/polar/route.ts`
- [ ] Ensure raw body handling for webhooks

## Success Criteria
- `/api/checkout` returns valid Polar URL
- `/api/webhooks/polar` returns 200 for valid signatures
- `/api/webhooks/polar` returns 400 for invalid signatures
