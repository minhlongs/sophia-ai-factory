# Setting Up a Telegram Dev Bot for Testing

To avoid conflicts with the production bot and to enable safe local testing, follow these steps to create a Development Bot.

## 1. Create the Bot
1.  Open Telegram and search for **@BotFather**.
2.  Send command: `/newbot`
3.  **Name**: `Sophia Dev Bot` (or similar)
4.  **Username**: `sophia_ai_dev_bot` (must be unique)
5.  **Copy the Token**: BotFather will give you an HTTP API Token (e.g., `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`).

## 2. Configure Environment
Add the token to your `.env.local` file:

```bash
TELEGRAM_BOT_TOKEN=your_new_dev_token_here
TELEGRAM_WEBHOOK_SECRET=my_dev_secret_value
```

## 3. Local Webhook Testing (Optional)
If you need to test incoming webhooks locally (e.g., user sending `/start` to the bot):

1.  **Expose Localhost**: Use `ngrok` or `localtunnel`.
    ```bash
    ngrok http 3000
    ```
2.  **Set Webhook**:
    Run the setup script or manually call the API:
    ```bash
    curl -F "url=https://your-ngrok-url.ngrok.io/api/webhooks/telegram" \
         -F "secret_token=my_dev_secret_value" \
         https://api.telegram.org/bot<YOUR_DEV_TOKEN>/setWebhook
    ```

## 4. Mock Mode (Recommended)
For most development tasks involving *outbound* notifications, you don't need a real bot.
Enable Mock Mode in `.env.local`:

```bash
NEXT_PUBLIC_MOCK_AI_SERVICES=true
```

When enabled, `sendTelegramMessage` will log to the console instead of hitting the Telegram API.

## 5. Verification
To verify your Dev Bot is working:
1.  Send `/start` to your new bot in Telegram.
2.  Check your server logs (if webhook is set up) or the database to see if the user was linked.
