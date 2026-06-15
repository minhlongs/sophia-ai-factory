# Telegram Dev Bot Setup Guide

For local development and testing, you should use a dedicated "Dev" bot to avoid conflicting with the production bot.

## 1. Create a Dev Bot
1. Open Telegram and search for **@BotFather**.
2. Send `/newbot`.
3. Name it: `Sophia Dev [YourName]` (e.g., `Sophia Dev Alex`).
4. Username: `sophia_dev_[yourname]_bot`.
5. Copy the **HTTP API Token**.

## 2. Configure Local Environment
Add the token to your `.env.local`:

```bash
TELEGRAM_BOT_TOKEN="your-dev-bot-token"
TELEGRAM_WEBHOOK_SECRET="random-secret-string"
```

## 3. Webhook vs Polling
Since we are in local development, Telegram cannot send webhooks to `localhost` directly.

### Option A: Mock Mode (Recommended)
If `NEXT_PUBLIC_MOCK_AI_SERVICES=true` is set, the app simulates Telegram interactions without needing a real bot or tunneling. You can test the UI and flows without Telegram.

### Option B: Ngrok Tunneling (For Real Bot Testing)
If you need to test actual Telegram integration:
1. Install ngrok: `brew install ngrok`
2. Start tunnel: `ngrok http 3000`
3. Copy the HTTPS URL (e.g., `https://1234.ngrok.io`).
4. Set the webhook:
   ```bash
   curl -F "url=https://1234.ngrok.io/api/webhooks/telegram" \
        -F "secret_token=random-secret-string" \
        https://api.telegram.org/bot<YOUR_TOKEN>/setWebhook
   ```

## 4. Testing
- **Mock Mode**: Use the [Mock Mode Indicator] in the UI to trigger simulated "User started bot" events (future feature).
- **Real Mode**: Send `/start` to your bot in Telegram.
