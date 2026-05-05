# DM Pairing Implementation Report — 260503

## Discovery

**Current bot auth state:** Webhook validates `X-Telegram-Bot-Api-Secret-Token` (when `TELEGRAM_WEBHOOK_SECRET` is set), but there is zero allowlist gate — any Telegram user who knows the webhook URL (or guesses the bot username) can send messages and trigger bot commands. `TELEGRAM_ADMIN_CHAT_ID` was referenced in other files (auto-discover affiliates, notification adapter) but not used in the webhook handler.

## Files Added/Modified

| File | Action |
|------|--------|
| `migrations/0077-telegram-pairing.sql` | Added — 2 tables + index |
| `src/lib/telegram/pairing.ts` | Added — 155 lines, pairing module |
| `src/lib/telegram/__tests__/pairing.test.ts` | Added — 13 unit tests |
| `src/app/api/webhooks/telegram/route.ts` | Modified — pairing gate + 3 admin commands wired in |
| `src/app/api/webhooks/telegram/route.test.ts` | Modified — mocks updated + 9 new pairing integration tests |

## Migration Created

`migrations/0077-telegram-pairing.sql`:
- `telegram_paired_chats(chat_id PK, first_name, paired_at, paired_by)`
- `telegram_pending_pairing(chat_id PK, code, requested_at, expires_at)`
- `idx_pending_code` on `telegram_pending_pairing(code)`

## Test Results

- Pairing unit tests: 13/13 pass
- Webhook route integration tests: 24/24 pass (incl. 9 new pairing tests)
- Total: **37/37 passed**
- TypeScript check (new files only): **0 errors**

## Manual Setup Required by Admin

1. **Apply migration** — run against D1 binding:
   ```bash
   npx wrangler d1 execute sophia-raas-db --file=migrations/0077-telegram-pairing.sql --remote
   ```

2. **Set env var** — tells the bot who the admin is:
   ```bash
   npx wrangler secret put TELEGRAM_ADMIN_CHAT_ID
   # Enter your personal Telegram chat_id (numeric)
   ```
   To find your chat_id: message @userinfobot on Telegram.

3. **If `TELEGRAM_ADMIN_CHAT_ID` is NOT set** — pairing gate is disabled (open mode, backward-compatible). Existing deployments continue working unchanged.

## Behavior Summary

- Unknown sender → `requestPairing()` → code stored 15min → bot replies with code
- Admin `/pair_approve <CODE>` → approved sender added to `telegram_paired_chats`, pending row deleted, both parties notified
- Admin `/pair_list` → lists all paired chats
- Admin `/pair_revoke <CHAT_ID>` → removes from allowlist
- Expired codes cleaned up inline on every `requestPairing()` call

## Skipped / Notes

- No separate cron for cleanup (inline cleanup per spec, KISS)
- `first_name` stored on approve (passed by admin), not stored during request (pending table has no first_name column by design, admin provides it at approval time via optional arg — defaults to null)
- Pre-existing TS errors in unrelated test files (billing, fulfillment) untouched per file ownership rules
