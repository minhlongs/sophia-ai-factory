# Phase 4: Triggers & Notifications

## Overview
**Priority:** Medium
**Status:** Pending
**Description:** Connect external triggers (Webhooks) and internal notifications to the automation engine to create a seamless user loop.

## Context Links
- [Main Plan](./plan.md)
- [Existing Telegram Client](../src/lib/telegram/telegram-client.ts)

## Requirements
- Trigger automation from Polar payment webhook
- Send Telegram notifications on key campaign events
- Enable Realtime updates for frontend

## Architecture
- **Trigger:** `src/app/api/webhooks/polar/route.ts` -> `inngest.send()`
- **Notification:** `src/lib/notifications/telegram.ts` called from Inngest

## Related Code Files
- [UPDATE] `src/app/api/webhooks/polar/route.ts`
- [UPDATE] `src/lib/inngest/functions/generate-campaign.ts`
- [NEW] `src/lib/inngest/events.ts`

## Implementation Steps

1.  **Update Polar Webhook**
    - In `api/webhooks/polar/route.ts`:
    - After verifying user/subscription, trigger `campaign.created` event via `inngest.send()`
    - Pass necessary payload (userId, tier, default topic)

2.  **Integrate Telegram Notifications**
    - Inside `generate-campaign` function:
    - Add step `notify-start`: Send "🎬 Starting campaign..."
    - Add step `notify-complete`: Send "✅ Campaign ready! [Link]"
    - Use `TelegramClient`

3.  **Test Webhook Flow**
    - Simulate Polar payload
    - Verify Inngest function triggers
    - Verify Telegram message received

## Success Criteria
- [ ] Payment webhook triggers campaign generation
- [ ] Telegram messages received at start and end of workflow
- [ ] System handles missing Telegram ID gracefully

## Risk Assessment
- **Risk:** User hasn't linked Telegram.
- **Mitigation:** Check for `telegram_chat_id` in profile before sending. Skip silently if missing.

## Security Considerations
- Verify webhook signatures (already implemented).
- Don't expose sensitive user data in notifications.
