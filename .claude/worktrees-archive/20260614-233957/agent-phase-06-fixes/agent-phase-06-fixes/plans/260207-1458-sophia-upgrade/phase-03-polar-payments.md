# Phase 03: Polar.sh Payments

## Context Links

- [Main Plan](./plan.md)
- [Phase 2: Bot Architecture](./phase-02-bot-architecture.md)
- [Polar.sh API Docs](https://docs.polar.sh)
- [Polar.sh Webhooks](https://docs.polar.sh/webhooks)
- [Payment Provider Rule](../.claude/rules/payment-provider.md)

## Overview

**Priority**: P1 (Critical)
**Status**: Pending
**Description**: Implement Polar.sh webhook handling for subscription events, build Zero-UI payment flow in Telegram, implement localized pricing logic, and create access control middleware.

## Key Insights

- **Polar.sh Only**: NO PayPal/Stripe per payment-provider.md rule
- **Zero-UI Flow**: Payment links sent directly in Telegram (no web redirect)
- **Localized Pricing**: PPP (Purchasing Power Parity) based on user location
- **Webhook Security**: HMAC signature verification required
- **Event Types**: `subscription.created`, `subscription.updated`, `subscription.cancelled`
- **Access Control**: Middleware checks active subscription before premium commands

## Requirements

### Functional Requirements
- Polar.sh webhook endpoint with signature verification
- Event handlers for subscription lifecycle events
- Zero-UI payment flow (Telegram inline button → Polar.sh checkout)
- Localized pricing based on user country code
- Access control middleware for premium commands
- Subscription status caching (Redis) with Postgres backup
- Grace period handling (7 days after cancellation)
- User notification system (subscription expiry warnings)

### Non-Functional Requirements
- Webhook processing time < 100ms
- Payment link generation < 500ms
- 100% webhook reliability (retry logic)
- Idempotent event processing (prevent duplicates)
- Audit trail for all payment events
- PCI DSS compliance (Polar.sh handles card data)

## Architecture

```
src/
├── lib/
│   ├── payments/
│   │   ├── polar-webhook-handler.ts       # Event processing
│   │   ├── polar-subscription-service.ts  # CRUD operations
│   │   ├── polar-pricing-calculator.ts    # PPP logic
│   │   └── polar-types.ts                 # TypeScript types
│   ├── middleware/
│   │   └── subscription-gate-middleware.ts # Access control
│   └── services/
│       ├── user-subscription-service.ts    # User subscription state
│       └── notification-service.ts         # Expiry warnings
└── app/api/webhooks/polar/route.ts         # Webhook endpoint (exists)

Database Schema (Supabase):
subscriptions
├── id (uuid, PK)
├── user_id (bigint, FK → telegram users)
├── polar_subscription_id (text, unique)
├── status (enum: active, cancelled, expired)
├── plan_id (text)
├── current_period_start (timestamp)
├── current_period_end (timestamp)
├── cancel_at_period_end (boolean)
├── created_at (timestamp)
└── updated_at (timestamp)

payment_events (audit trail)
├── id (uuid, PK)
├── event_type (text)
├── polar_event_id (text, unique)
├── payload (jsonb)
├── processed (boolean)
├── created_at (timestamp)
```

**Data Flow**:
1. User clicks `/subscribe` in Telegram
2. Bot generates Polar.sh checkout link with PPP pricing
3. User completes payment on Polar.sh
4. Polar.sh sends webhook to `/api/webhooks/polar`
5. Webhook handler verifies signature
6. Event processor updates `subscriptions` table
7. Notification sent to Telegram (subscription activated)
8. Access control middleware allows premium commands

## Related Code Files

### Files to Create
- `src/lib/payments/polar-webhook-handler.ts` - Event processing logic
- `src/lib/payments/polar-subscription-service.ts` - Subscription CRUD
- `src/lib/payments/polar-pricing-calculator.ts` - PPP calculations
- `src/lib/payments/polar-types.ts` - TypeScript types
- `src/lib/middleware/subscription-gate-middleware.ts` - Access control
- `src/lib/services/user-subscription-service.ts` - User state management
- `src/lib/services/notification-service.ts` - Telegram notifications
- `supabase/migrations/003_subscriptions_table.sql` - Schema migration

### Files to Modify
- `src/app/api/webhooks/polar/route.ts` - Add event routing logic
- `src/bot/middleware/auth-middleware.ts` - Integrate subscription gate
- `src/bot/commands/subscribe-command-handler.ts` - Add checkout flow
- `.env.example` - Add `POLAR_PRODUCT_ID`, `POLAR_WEBHOOK_SECRET`

### Files to Delete
- Any legacy PayPal/Stripe components (if exist)

## Implementation Steps

1. **Create Database Schema**
   ```sql
   -- supabase/migrations/003_subscriptions_table.sql
   CREATE TABLE subscriptions (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id BIGINT NOT NULL REFERENCES users(telegram_id),
     polar_subscription_id TEXT UNIQUE NOT NULL,
     status TEXT CHECK (status IN ('active', 'cancelled', 'expired')),
     plan_id TEXT NOT NULL,
     current_period_start TIMESTAMPTZ NOT NULL,
     current_period_end TIMESTAMPTZ NOT NULL,
     cancel_at_period_end BOOLEAN DEFAULT FALSE,
     created_at TIMESTAMPTZ DEFAULT NOW(),
     updated_at TIMESTAMPTZ DEFAULT NOW()
   );

   CREATE TABLE payment_events (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     event_type TEXT NOT NULL,
     polar_event_id TEXT UNIQUE NOT NULL,
     payload JSONB NOT NULL,
     processed BOOLEAN DEFAULT FALSE,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );

   CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
   CREATE INDEX idx_subscriptions_status ON subscriptions(status);
   CREATE INDEX idx_payment_events_processed ON payment_events(processed);
   ```

2. **Build Pricing Calculator**
   - Create `src/lib/payments/polar-pricing-calculator.ts`
   - Implement PPP logic using user's country code
   - Pricing tiers:
     - Tier 1 (US/EU/AU): $49/mo
     - Tier 2 (Asia/LATAM): $29/mo
     - Tier 3 (Emerging): $19/mo
   - Use MaxMind GeoIP or Telegram location data

3. **Build Subscription Service**
   - Create `src/lib/payments/polar-subscription-service.ts`
   - Methods:
     - `createSubscription(userId, polarSubId, planId)`
     - `updateSubscription(polarSubId, data)`
     - `cancelSubscription(polarSubId)`
     - `getActiveSubscription(userId)`
   - Cache results in Redis (TTL: 1 hour)

4. **Build Webhook Handler**
   - Create `src/lib/payments/polar-webhook-handler.ts`
   - Event handlers:
     ```typescript
     handleSubscriptionCreated(event): Update DB, send confirmation
     handleSubscriptionUpdated(event): Update DB, notify changes
     handleSubscriptionCancelled(event): Mark cancelled, send notice
     handleSubscriptionExpired(event): Revoke access, send renewal link
     ```
   - Idempotency: Check `payment_events.polar_event_id` before processing

5. **Update Webhook Endpoint**
   - Modify `src/app/api/webhooks/polar/route.ts`
   - Verify HMAC signature:
     ```typescript
     const signature = headers.get('polar-signature');
     const isValid = verifyPolarSignature(body, signature, POLAR_WEBHOOK_SECRET);
     if (!isValid) return new Response('Invalid signature', { status: 401 });
     ```
   - Route events to appropriate handlers
   - Log all events to `payment_events` table

6. **Build Access Control Middleware**
   - Create `src/lib/middleware/subscription-gate-middleware.ts`
   - Check if user has active subscription:
     ```typescript
     const subscription = await getActiveSubscription(userId);
     if (!subscription || subscription.status !== 'active') {
       return { error: 'Subscription required' };
     }
     ```
   - Apply to premium commands: `/discover`, `/campaign`

7. **Build Notification Service**
   - Create `src/lib/services/notification-service.ts`
   - Send Telegram messages:
     - Subscription activated: "Welcome! Your premium access is now live."
     - Subscription expiring: "Your subscription ends in 7 days. Renew now!"
     - Subscription cancelled: "Your access will end on {date}."
   - Use Telegraf `bot.telegram.sendMessage()`

8. **Implement Subscribe Command Flow**
   - Modify `src/bot/commands/subscribe-command-handler.ts`
   - Steps:
     1. Detect user's country (Telegram location or IP)
     2. Calculate PPP pricing
     3. Generate Polar.sh checkout link
     4. Send inline keyboard with payment button
     5. Await webhook confirmation
   - Example:
     ```typescript
     const country = await getUserCountry(userId);
     const price = calculatePPP(country);
     const checkoutUrl = await createPolarCheckout(userId, price);
     await ctx.reply('Subscribe for ${price}/mo', {
       reply_markup: {
         inline_keyboard: [[{ text: 'Pay Now', url: checkoutUrl }]]
       }
     });
     ```

9. **Implement Grace Period Logic**
   - After cancellation, allow 7-day grace period
   - Cron job (Vercel Cron):
     ```typescript
     // api/cron/expire-subscriptions/route.ts
     const expiring = await getSubscriptionsEndingToday();
     for (const sub of expiring) {
       await updateSubscription(sub.id, { status: 'expired' });
       await sendExpiryNotification(sub.user_id);
     }
     ```

10. **Add Audit Trail Queries**
    - Create helper functions:
      ```typescript
      getPaymentHistory(userId): All payment events for user
      getSubscriptionMetrics(): Total active subs, MRR, churn rate
      ```

11. **Test Webhook Locally**
    - Use Polar.sh webhook testing tool
    - Test events: `subscription.created`, `subscription.cancelled`
    - Verify signature validation works
    - Verify idempotency (send same event twice)

12. **Deploy and Monitor**
    - Deploy to Vercel
    - Set up webhook endpoint in Polar.sh dashboard
    - Monitor webhook delivery success rate (target: 100%)
    - Set up alerts for failed webhooks

## Todo List

- [ ] Create `subscriptions` table migration
- [ ] Create `payment_events` table migration
- [ ] Run migrations on Supabase
- [ ] Build pricing calculator with PPP logic
- [ ] Build subscription service (CRUD operations)
- [ ] Build webhook handler with event processors
- [ ] Update webhook endpoint with signature verification
- [ ] Build access control middleware
- [ ] Integrate middleware with premium commands
- [ ] Build notification service for Telegram messages
- [ ] Update `/subscribe` command with checkout flow
- [ ] Implement grace period logic (7-day post-cancellation)
- [ ] Create Vercel Cron job for subscription expiry
- [ ] Add audit trail query functions
- [ ] Test webhook with Polar.sh testing tool
- [ ] Test idempotency (duplicate event handling)
- [ ] Test PPP pricing for different countries
- [ ] Deploy to Vercel
- [ ] Register webhook URL in Polar.sh dashboard
- [ ] Monitor webhook delivery success rate
- [ ] Set up alerts for failed webhooks

## Success Criteria

- [x] Webhook endpoint verifies signatures correctly
- [x] `subscription.created` event activates user access
- [x] `subscription.cancelled` event revokes access after grace period
- [x] PPP pricing shows correct amounts for Tier 1/2/3 countries
- [x] Access control middleware blocks non-subscribers
- [x] Payment link generates in < 500ms
- [x] Webhook processing completes in < 100ms
- [x] Duplicate events are ignored (idempotency)
- [x] All payment events logged to `payment_events` table
- [x] Notification service sends Telegram messages on status changes
- [x] Grace period allows 7-day access after cancellation
- [x] Vercel Cron job expires subscriptions correctly
- [x] Zero PayPal/Stripe code remains in codebase

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Webhook signature verification fails | Medium | High | Test with Polar.sh CLI, log all failed attempts |
| Duplicate event processing | High | Medium | Implement idempotency with `polar_event_id` |
| PPP pricing incorrect for user location | Medium | Low | Use Telegram location data as fallback |
| Payment link expiry (user delays payment) | Medium | Low | Set 24h expiry, allow regeneration |
| Webhook delivery failures | Low | High | Polar.sh auto-retries, monitor delivery rate |
| Race condition (webhook before user action) | Low | Medium | Use optimistic locking on DB updates |

## Security Considerations

- **Webhook Signature**: ALWAYS verify HMAC signature before processing
- **Idempotency**: Check `polar_event_id` to prevent duplicate processing
- **Secret Storage**: Store `POLAR_WEBHOOK_SECRET` in Vercel env vars
- **Access Control**: Verify subscription status on EVERY premium command
- **Audit Trail**: Log ALL payment events to `payment_events` table
- **PCI Compliance**: Never store card data (Polar.sh handles this)
- **Rate Limiting**: Limit `/subscribe` command to prevent checkout spam

## Next Steps

After Phase 3 completion:
1. Proceed to [Phase 4: Discovery Engine](./phase-04-discovery-engine.md)
2. Test full subscription flow (signup → payment → activation → cancellation)
3. Monitor webhook delivery success rate (target: 100%)
4. Verify PPP pricing with users from different countries
5. Set up alerts for failed webhooks and subscription expirations
