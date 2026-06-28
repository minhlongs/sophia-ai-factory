# Telegram Bot Setup — Operator Guide

Configure @Sophia_Bbot from scratch or reactivate after token rotation.

---

## Prerequisites

- Cloudflare Workers deployment live at `https://sophia.agencyos.network`
- `wrangler` CLI authenticated (`npx wrangler whoami`)
- Telegram BotFather token for @Sophia_Bbot

### Get or rotate the BotFather token

1. Open Telegram, search `@BotFather`
2. Send `/mybots` → select **@Sophia_Bbot**
3. **API Token** → copy the token (format: `123456789:AAF...`)
4. If token is compromised: **Revoke current token** → regenerate

---

## Step 1 — Store the token as a Wrangler secret

```bash
cd apps/sophia-ai-factory
npx wrangler secret put TELEGRAM_BOT_TOKEN
# Paste the BotFather token when prompted
```

Verify the secret is stored:

```bash
npx wrangler secret list
# Should show: TELEGRAM_BOT_TOKEN
```

Optional — add a webhook secret to prevent spoofed requests:

```bash
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
# Use a random string, e.g.: openssl rand -hex 32
```

---

## Step 2 — Register the webhook with Telegram

Replace `<TOKEN>` with your actual BotFather token.

```bash
curl -F "url=https://sophia.agencyos.network/api/webhooks/telegram" \
  https://api.telegram.org/bot<TOKEN>/setWebhook
```

If you set `TELEGRAM_WEBHOOK_SECRET`, add the secret header:

```bash
curl -F "url=https://sophia.agencyos.network/api/webhooks/telegram" \
     -F "secret_token=<YOUR_WEBHOOK_SECRET>" \
  https://api.telegram.org/bot<TOKEN>/setWebhook
```

Expected response:

```json
{"ok":true,"result":true,"description":"Webhook was set"}
```

Verify webhook is active:

```bash
curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo
# Should show: "url": "https://sophia.agencyos.network/api/webhooks/telegram"
```

---

## Step 3 — Smoke test all commands

Open a Telegram chat with @Sophia_Bbot and send each command. Expected responses:

| Command | Expected response |
|---------|------------------|
| `/start` | Welcome message with quick-start instructions |
| `/help` | Full command reference list |
| `/campaign <topic>` | FSM starts: asks for campaign topic details |
| `/status` | Recent campaign status summary |
| `/results` | Latest campaign results |
| `/discover` | Trending affiliate offers discovery |
| `/subscribe` | Subscription / upgrade prompt |
| `/ticket <message>` | Support ticket created confirmation |
| `/cancel` | Clears any in-progress campaign flow |

---

## Troubleshooting

### Webhook delivery failures

Check Telegram's view of the webhook:

```bash
curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo
```

Look for `"last_error_message"` — common values:

- `"Wrong response from the webhook: 401 Unauthorized"` — `TELEGRAM_WEBHOOK_SECRET` mismatch. Re-run setWebhook with correct `-F "secret_token=..."`.
- `"Wrong response from the webhook: 500"` — server error. Check Cloudflare Workers logs: `npx wrangler tail`.
- `"Connection timeout"` — webhook URL unreachable. Verify `curl -I https://sophia.agencyos.network/api/webhooks/telegram` returns 200.

### 401 responses

Cause: `TELEGRAM_WEBHOOK_SECRET` set in Wrangler but not passed in setWebhook call (or wrong value).

Fix:

```bash
# Re-run setWebhook with matching secret_token value
curl -F "url=https://sophia.agencyos.network/api/webhooks/telegram" \
     -F "secret_token=<SAME_VALUE_AS_WRANGLER_SECRET>" \
  https://api.telegram.org/bot<TOKEN>/setWebhook
```

### Bot dormant — no responses

Cause: `TELEGRAM_BOT_TOKEN` not set. Webhook returns `{"ok":true}` silently and logs a warning.

Check Workers logs:

```bash
npx wrangler tail
# Look for: [telegram-webhook] TELEGRAM_BOT_TOKEN is not set
```

Fix: repeat Step 1.

### FSM state stuck (campaign flow frozen)

User is stuck mid-campaign flow. Reset their session:

```bash
# From Telegram as the user — send:
/cancel
```

If `/cancel` does not respond, the D1 `telegram_fsm_contexts` row may be stale. Delete manually:

```bash
npx wrangler d1 execute sophia-raas-db \
  --command "DELETE FROM telegram_fsm_contexts WHERE chat_id = '<CHAT_ID>'"
```

### Re-register webhook after token rotation

After revoking and regenerating the BotFather token:

1. Update Wrangler secret (Step 1) with the new token
2. Re-run setWebhook (Step 2) — old webhook is automatically invalidated by Telegram when the token changes
3. Re-smoke-test (Step 3)
