# Phase 02: Bot Architecture

## Context Links

- [Main Plan](./plan.md)
- [Phase 1: Foundation Setup](./phase-01-setup-foundation.md)
- [Telegraf Docs](https://telegraf.js.org)
- [Redis FSM Pattern](https://redis.io/docs/manual/patterns/)

## Overview

**Priority**: P1 (Critical)
**Status**: Pending
**Description**: Build Telegram bot with Telegraf, implement Redis FSM for "Smart Resume" logic, and design command structure for Zero-UI experience.

## Key Insights

- **Zero-UI Requirement**: All interactions happen in Telegram, no web navigation
- **Smart Resume**: Redis FSM tracks conversation state, Postgres backs up on critical events
- **Webhook Mode**: Use webhook instead of polling for better performance
- **Command Structure**: Hierarchical commands with inline keyboards for navigation
- **State Persistence**: Redis TTL (24h) + Postgres backup ensures no data loss

## Requirements

### Functional Requirements
- Telegraf bot setup with webhook endpoint
- Redis FSM for conversation state management
- Command registry with handlers
- Inline keyboard navigation
- Session management (user tracking)
- Smart Resume: Continue conversations across bot restarts
- Error handling with user-friendly messages
- Rate limiting per user (prevent abuse)

### Non-Functional Requirements
- Webhook response time < 200ms
- Redis state updates < 50ms
- Handle 100 concurrent users
- Graceful degradation if Redis unavailable
- Comprehensive logging for debugging

## Architecture

```
src/
├── bot/
│   ├── bot-instance.ts                    # Telegraf setup
│   ├── commands/
│   │   ├── start-command-handler.ts       # /start
│   │   ├── subscribe-command-handler.ts   # /subscribe
│   │   ├── discover-command-handler.ts    # /discover
│   │   ├── campaign-command-handler.ts    # /campaign
│   │   └── help-command-handler.ts        # /help
│   ├── middleware/
│   │   ├── auth-middleware.ts             # Polar.sh subscription check
│   │   ├── rate-limit-middleware.ts       # Prevent abuse
│   │   ├── logger-middleware.ts           # Request logging
│   │   └── session-middleware.ts          # Load/save state
│   ├── handlers/
│   │   ├── inline-keyboard-handler.ts     # Button callbacks
│   │   ├── text-message-handler.ts        # Free-form text
│   │   └── error-handler.ts               # Error recovery
│   ├── state/
│   │   ├── redis-state-manager.ts         # Redis FSM operations
│   │   ├── state-backup-service.ts        # Postgres backup
│   │   └── state-types.ts                 # TypeScript types
│   └── utils/
│       ├── keyboard-builder-util.ts       # Inline keyboard helper
│       └── message-formatter-util.ts      # Text formatting
└── app/api/webhooks/telegram/route.ts     # Webhook endpoint
```

**FSM States**:
```typescript
type BotState =
  | { type: 'IDLE' }
  | { type: 'AWAITING_SUBSCRIPTION' }
  | { type: 'DISCOVERING_TRENDS', filters?: string[] }
  | { type: 'CREATING_CAMPAIGN', template?: string }
  | { type: 'EXPORTING_CAMPAIGN', format?: 'pdf' | 'csv' }
```

**Data Flow**:
1. Telegram sends webhook to `/api/webhooks/telegram`
2. Middleware: Auth → Rate Limit → Session Load
3. Command handler processes request
4. State Manager updates Redis FSM
5. Backup Service syncs critical events to Postgres
6. Response sent to Telegram (inline keyboard or text)

## Related Code Files

### Files to Create
- `src/bot/bot-instance.ts` - Telegraf initialization
- `src/bot/commands/start-command-handler.ts` - Welcome flow
- `src/bot/commands/subscribe-command-handler.ts` - Polar.sh payment
- `src/bot/commands/discover-command-handler.ts` - Trend discovery
- `src/bot/commands/campaign-command-handler.ts` - Campaign creation
- `src/bot/commands/help-command-handler.ts` - Help menu
- `src/bot/middleware/auth-middleware.ts` - Subscription verification
- `src/bot/middleware/rate-limit-middleware.ts` - Abuse prevention
- `src/bot/middleware/logger-middleware.ts` - Request logging
- `src/bot/middleware/session-middleware.ts` - State management
- `src/bot/handlers/inline-keyboard-handler.ts` - Button handling
- `src/bot/handlers/text-message-handler.ts` - Text input
- `src/bot/handlers/error-handler.ts` - Error recovery
- `src/bot/state/redis-state-manager.ts` - FSM logic
- `src/bot/state/state-backup-service.ts` - Postgres sync
- `src/bot/state/state-types.ts` - Type definitions
- `src/bot/utils/keyboard-builder-util.ts` - Keyboard helper
- `src/bot/utils/message-formatter-util.ts` - Text formatting
- `src/app/api/webhooks/telegram/route.ts` - Webhook endpoint

### Files to Modify
- `.env.example` - Add `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`

## Implementation Steps

1. **Install Telegraf**
   ```bash
   npm install telegraf @types/node
   ```

2. **Create Telegraf Bot Instance**
   - Create `src/bot/bot-instance.ts`
   - Initialize with `TELEGRAM_BOT_TOKEN`
   - Configure webhook mode (not polling)
   - Set up error handling

3. **Create Webhook Endpoint**
   - Create `src/app/api/webhooks/telegram/route.ts`
   - Verify webhook secret
   - Forward requests to Telegraf
   - Return 200 OK immediately

4. **Implement Middleware Stack**
   - **Logger Middleware**: Log all incoming requests
   - **Rate Limit Middleware**: Max 10 commands/min per user
   - **Session Middleware**: Load state from Redis
   - **Auth Middleware**: Verify Polar.sh subscription

5. **Build Redis State Manager**
   - Create `src/bot/state/redis-state-manager.ts`
   - Methods: `getState()`, `setState()`, `deleteState()`
   - TTL: 24 hours for active sessions
   - Namespace: `telegram:state:{userId}`

6. **Build State Backup Service**
   - Create `src/bot/state/state-backup-service.ts`
   - Sync to Postgres on critical events:
     - Subscription activated
     - Campaign created
     - Export completed
   - Schema: `user_sessions` table with JSONB state column

7. **Implement Command Handlers**

   **Start Command** (`/start`):
   ```typescript
   // Welcome message + subscription check
   // If subscribed: Show main menu
   // If not: Show subscribe button
   ```

   **Subscribe Command** (`/subscribe`):
   ```typescript
   // Generate Polar.sh checkout link
   // Send inline keyboard with payment button
   // Await webhook confirmation
   ```

   **Discover Command** (`/discover`):
   ```typescript
   // Show filter options (niche, region, timeframe)
   // Trigger discovery engine (Phase 4)
   // Display top 10 trends
   ```

   **Campaign Command** (`/campaign`):
   ```typescript
   // Show template selection
   // Fill template with AI-generated content
   // Preview and edit flow
   ```

   **Help Command** (`/help`):
   ```typescript
   // Show all available commands
   // Usage examples
   // Support contact
   ```

8. **Build Inline Keyboard Handler**
   - Create `src/bot/handlers/inline-keyboard-handler.ts`
   - Parse `callback_data` from button clicks
   - Route to appropriate handler
   - Update message with new keyboard

9. **Build Text Message Handler**
   - Create `src/bot/handlers/text-message-handler.ts`
   - Handle free-form text input (e.g., campaign edits)
   - Context-aware responses based on FSM state

10. **Build Error Handler**
    - Create `src/bot/handlers/error-handler.ts`
    - Catch all unhandled errors
    - Send user-friendly error message
    - Log to Supabase for debugging

11. **Build Keyboard Utilities**
    - Create `src/bot/utils/keyboard-builder-util.ts`
    - Helper functions for inline keyboards
    - Reusable button templates

12. **Register Webhook with Telegram**
    ```bash
    curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
      -H "Content-Type: application/json" \
      -d '{"url": "https://your-app.vercel.app/api/webhooks/telegram"}'
    ```

13. **Test Bot Locally**
    - Use ngrok for local webhook testing
    - Test all commands with real Telegram account
    - Verify state persistence across messages

## Todo List

- [ ] Install Telegraf and dependencies
- [ ] Create Telegraf bot instance with webhook mode
- [ ] Create webhook endpoint at `/api/webhooks/telegram`
- [ ] Implement logger middleware
- [ ] Implement rate limit middleware (10 cmd/min)
- [ ] Implement session middleware (Redis state load/save)
- [ ] Implement auth middleware (Polar.sh check)
- [ ] Build Redis state manager (get/set/delete)
- [ ] Build state backup service (Postgres sync)
- [ ] Create `user_sessions` table in Supabase
- [ ] Implement `/start` command handler
- [ ] Implement `/subscribe` command handler
- [ ] Implement `/discover` command handler (stub for Phase 4)
- [ ] Implement `/campaign` command handler (stub for Phase 5)
- [ ] Implement `/help` command handler
- [ ] Build inline keyboard handler
- [ ] Build text message handler
- [ ] Build error handler
- [ ] Build keyboard builder utility
- [ ] Build message formatter utility
- [ ] Register webhook with Telegram
- [ ] Test all commands in real Telegram chat
- [ ] Verify state persists across bot restarts
- [ ] Load test with 10 concurrent users

## Success Criteria

- [x] Bot responds to `/start` command within 200ms
- [x] All commands registered and functional
- [x] Inline keyboards render correctly
- [x] Redis state updates successfully
- [x] Postgres backup syncs on critical events
- [x] Smart Resume: Conversation continues after bot restart
- [x] Rate limiting prevents abuse (max 10 cmd/min)
- [x] Auth middleware blocks non-subscribers (for premium commands)
- [x] Error handler catches all exceptions
- [x] Webhook endpoint returns 200 OK
- [x] Zero-UI experience (no web navigation required)

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Telegram webhook timeout (>30s) | Medium | High | Respond 200 OK immediately, process async |
| Redis state loss during restart | Low | High | Postgres backup on critical events |
| Rate limit bypass | Medium | Medium | Implement token bucket algorithm |
| Inline keyboard pagination issues | Medium | Low | Test with 50+ buttons, implement scrolling |
| Bot spam/abuse | High | Medium | Rate limit + captcha for new users |

## Security Considerations

- **Webhook Verification**: Always verify `X-Telegram-Bot-Api-Secret-Token` header
- **User Input Sanitization**: Escape all user inputs to prevent injection
- **Rate Limiting**: Per-user limits to prevent abuse
- **Auth Middleware**: Verify Polar.sh subscription before premium commands
- **Secret Storage**: Store `TELEGRAM_BOT_TOKEN` in Vercel env vars
- **State Encryption**: Consider encrypting sensitive data in Redis (e.g., payment info)

## Next Steps

After Phase 2 completion:
1. Proceed to [Phase 3: Polar.sh Payments](./phase-03-polar-payments.md)
2. Test webhook endpoint with real Telegram messages
3. Verify state persistence with bot restart
4. Monitor Redis memory usage (set TTL to prevent overflow)
