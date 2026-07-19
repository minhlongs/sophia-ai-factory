import { getErrorMessage } from '@/seed/utils/to-error';
import { logger } from '@/seed/utils/logger-utility';

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

export interface InlineKeyboardButton {
  text: string;
  callback_data: string;
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

/**
 * Try sending with MarkdownV2; fallback to plain text on parse failure.
 * Wave 20 Phase 01 (7A): strict escaping for all user-provided content.
 */
async function tryFetchMarkdownV2(
  botToken: string,
  chatId: string,
  text: string,
  extra: Record<string, unknown> = {},
): Promise<Response> {
  const firstRes = await fetch(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        ...extra,
        parse_mode: 'MarkdownV2',
      }),
    },
  );

  if (!firstRes.ok) {
    const bodyText = await firstRes.text().catch(() => '');
    // On parse failure (400 with "can't parse"), fallback to plain text.
    if (bodyText.includes("can't parse") || firstRes.status === 400) {
      logger.warn('[sendTelegramMessage] MarkdownV2 parse failed, falling back to plain text', {
        chatId,
        status: firstRes.status,
      });
      return fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text, ...extra }),
        },
      );
    }
  }

  return firstRes;
}

export async function sendTelegramMessageWithKeyboard(
  chatId: string,
  text: string,
  keyboard: InlineKeyboardMarkup
) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return null;

  try {
    const response = await tryFetchMarkdownV2(botToken, chatId, text, {
      reply_markup: keyboard,
    });

    if (!response.ok) {
      logger.warn('[sendTelegramMessageWithKeyboard] Telegram API non-ok response', {
        status: response.status,
        chatId,
      });
      await response.json().catch(() => {});
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
}

export async function sendTelegramMessage(chatId: string, text: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return null;
  }

  try {
    const response = await tryFetchMarkdownV2(botToken, chatId, text);

    if (!response.ok) {
      logger.warn('[sendTelegramMessage] Telegram API non-ok response', {
        status: response.status,
        chatId,
      });
      await response.json().catch(() => {});
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
}
