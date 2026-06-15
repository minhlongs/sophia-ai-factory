# Phase B — Telegram Bot Reactivation Report

**Date:** 260429  
**Status:** COMPLETED

---

## Command Inventory (route.ts routing)

| Command | Handler | Module |
|---------|---------|--------|
| `/start` | `handleStart` | telegram-command-handlers |
| `/help` | `handleHelp` | telegram-command-handlers |
| `/subscribe` | `handleSubscribe` | telegram-command-handlers |
| `/discover` | `handleDiscover` | telegram-command-handlers |
| `/email <addr>` | `handleEmail` | telegram-command-handlers |
| `/campaign <topic>` | `handleCampaignFsm` | telegram-bot-campaign-handlers (FSM) |
| `/confirm` | `handleConfirmCommand` | telegram-bot-campaign-handlers |
| `/cancel` | `TelegramFSM.clearContext` | telegram-fsm-state-manager |
| `/status` | `handleStatus` | telegram-command-handlers |
| `/results` | `handleResults` | telegram-command-handlers |
| `/ticket <text>` | `handleTicket` (after D1 userId lookup) | telegram-command-handlers |
| unknown `/cmd` | `handleUnknown` | telegram-command-handlers |
| `offer_*` callback | `handleOfferCallback` | telegram-bot-campaign-handlers |
| other callback | `handleCallbackQuery` | telegram-command-handlers |
| plain text (FSM) | `handleFsmTextInput` → `handleTextMessage` fallback | both |

---

## Test Results

- Test files: 3 passed
- Tests: **40 passed** (was 39 before Phase B — 1 new test added)
- TypeScript: 0 errors (`npx tsc --noEmit --skipLibCheck`)

---

## Files Touched

| File | Change |
|------|--------|
| `src/app/api/webhooks/telegram/route.ts` | Added `console.warn` log to missing-token guard (line 43-47) |
| `src/app/api/webhooks/telegram/route.test.ts` | Added test: missing-token returns 200, no handlers called (+11 lines) |
| `/Users/macbook/sophia-ai-factory/docs/telegram-bot-setup.md` | NEW — operator setup doc (BotFather → wrangler secret → setWebhook → smoke test + troubleshooting) |

Files NOT touched: all other `src/app/api/**`, `src/components/**`.

---

## Findings / Audit Notes

1. **Missing-token guard already existed** at route line 43-45 (silent 200). Added `console.warn` for operator visibility — uses `console.warn` not `console.log` (rules ban `console.log` only).
2. **All 11 commands properly routed** — no dead-code branches found.
3. `/campaign` correctly wired to FSM handler (`telegram-bot-campaign-handlers`), not legacy `telegram-command-handlers.handleCampaign`. This was a prior C1 fix; confirmed intact.
4. FSM `/cancel` clears context via `TelegramFSM.clearContext` — correct.
5. `offer_*` callbacks route to FSM before falling through to legacy — confirmed by test.
6. `/ticket` does D1 userId lookup with empty-string fallback on failure — safe.
7. `TELEGRAM_WEBHOOK_SECRET` optional — only validates when set (correct progressive security).

---

## Docs File

`/Users/macbook/sophia-ai-factory/docs/telegram-bot-setup.md`

Sections: Prerequisites → Step 1 (wrangler secret) → Step 2 (setWebhook curl) → Step 3 (smoke test table) → Troubleshooting (webhook delivery failures, 401, dormant bot, FSM stuck, token rotation).

---

## Unresolved Questions

1. `telegram_fsm_contexts` table — does it exist in the D1 schema? FSM clearContext may silently fail if table missing. Suggest running `npx wrangler d1 execute sophia-raas-db --command "SELECT name FROM sqlite_master WHERE type='table' AND name='telegram_fsm_contexts'"` to verify.
2. `TELEGRAM_BOT_TOKEN` wrangler secret — needs to be set in production before bot will respond. No CI guard prevents deploy without it.
3. `user_profiles.telegram_chat_id` column — assumed to exist for `/ticket` userId resolution. Not verified against current D1 schema.
