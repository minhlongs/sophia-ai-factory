# Phase B — Telegram Bot Reactivation Audit

**Owner:** fullstack-developer (telegram)
**File ownership:** `src/app/api/webhooks/telegram/**`, `src/lib/telegram/**` (read-only audit + bug fixes only)

## Goals

1. Audit `/api/webhooks/telegram/route.ts` end-to-end — no 500 errors on known commands
2. Verify command handlers (`/start`, `/help`, `/campaign`, `/status`, `/results`, `/discover`, `/subscribe`, `/ticket`)
3. Verify FSM state manager + callback query handling
4. Document customer's onboarding step in `docs/telegram-bot-setup.md`:
   - `wrangler secret put TELEGRAM_BOT_TOKEN`
   - curl Telegram setWebhook to point at production
   - Smoke test commands
5. Verify `route.test.ts` passes

## Current State (scout findings)

- 11 telegram lib files exist (`telegram-bot.ts`, `telegram-fsm-state-manager.ts`, etc.)
- Webhook route exists with 1 test file
- TELEGRAM_BOT_TOKEN secret NOT set → bot is dormant
- Production /api/webhooks/telegram returns 200 GET (probably health check shim)

## Implementation Steps

1. Read `src/app/api/webhooks/telegram/route.ts` + `route.test.ts`
2. Read `src/lib/telegram/telegram-command-handlers.ts` to inventory commands
3. Run existing test suite for telegram: `npx vitest run src/lib/telegram src/app/api/webhooks/telegram`
4. If tests fail → fix root cause (do NOT skip)
5. Create `docs/telegram-bot-setup.md`:
   - Prerequisites: Telegram BotFather token
   - Step 1: `cd apps/sophia-ai-factory && wrangler secret put TELEGRAM_BOT_TOKEN`
   - Step 2: setWebhook curl example with TELEGRAM_BOT_TOKEN substituted
   - Step 3: smoke each command via @Sophia_Bbot in Telegram
   - Troubleshooting section: webhook not firing, command returns blank
6. Optionally add a "missing token" guard to webhook route to log warning instead of crash

## File Ownership (do NOT touch outside)

- ✅ `src/app/api/webhooks/telegram/route.ts` (audit + minor fixes)
- ✅ `src/app/api/webhooks/telegram/route.test.ts` (extend if needed)
- ✅ `src/lib/telegram/**` (bug fixes only — do not refactor)
- ✅ `docs/telegram-bot-setup.md` (NEW)
- ❌ DO NOT touch ANY other `src/app/api/**` or `src/components/**`

## Success Criteria

- [ ] All telegram tests pass (`npx vitest run src/lib/telegram src/app/api/webhooks/telegram`)
- [ ] `docs/telegram-bot-setup.md` exists with 3 numbered steps + troubleshooting
- [ ] Webhook returns appropriate non-500 status for missing token (log warning)
- [ ] No new TS errors

## Reports

Save report to `/Users/macbook/sophia-ai-factory/plans/260429-2101-revenue-growth-parallel/reports/fullstack-developer-telegram-260429-2101.md`
