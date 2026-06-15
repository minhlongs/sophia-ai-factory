# Phase 5: Verification

## Context
Ensuring the entire payment flow works securely and reliably.

## Overview
Test the full lifecycle from clicking "Buy Now" to receiving the webhook event.

## Verification Steps
1.  **Product Verification**
    - Check Polar Dashboard for correct prices and names.

2.  **Checkout Flow**
    - Click "Buy Now" on localhost.
    - Complete purchase in Polar Sandbox.
    - Verify redirect back to success page.

3.  **Webhook Testing**
    - Use `polar` CLI or `curl` to simulate webhook.
    - Verify `POST /api/webhooks/polar` returns 200.
    - Check server logs for "Payment successful" message.

4.  **Security Check**
    - Send webhook with invalid signature -> Expect 400.
    - Send webhook with valid signature -> Expect 200.

## Todo
- [ ] Verify Products
- [ ] specific End-to-End Test (Sandbox)
- [ ] Webhook Verification

## Success Criteria
- Full flow works without errors.
- Webhooks are verified and processed.
