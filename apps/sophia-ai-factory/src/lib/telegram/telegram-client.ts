import { getErrorMessage } from '@/lib/utils/to-error';

export async function setTelegramWebhook() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!botToken || !appUrl) {
    return { ok: false, description: 'Missing TELEGRAM_BOT_TOKEN or NEXT_PUBLIC_APP_URL env vars' };
  }

  const webhookUrl = `${appUrl}/api/webhooks/telegram`;

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/setWebhook`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webhookUrl,
          secret_token: process.env.TELEGRAM_WEBHOOK_SECRET
        })
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      return { ok: false, description: `Telegram API ${response.status}: ${errorBody}` };
    }

    return response.json();
  } catch (err) {
    return { ok: false, description: `Network error: ${getErrorMessage(err)}` };
  }
}

export async function sendTelegramMessage(chatId: string, text: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return null;
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: "Markdown"
        }),
      }
    );

    if (!response.ok) {
      // Consume body to avoid potential memory leaks, but ignore the error
      await response.json().catch(() => {});
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
}
