import { getErrorMessage } from '@/seed/utils/to-error';
import { logger } from '@/seed/utils/logger-utility';
import type { InlineKeyboardMarkup } from './types';
import { tryFetchMarkdownV2, postTelegramEndpoint } from './http-transport';
import {
  canDispatchTelegram,
  recordTelegramSuccess,
  recordTelegramFailure,
} from './rate-limiter';

export async function setTelegramWebhook() {
  if (!canDispatchTelegram()) {
    return { ok: false, description: 'Circuit breaker open for telegram' };
  }
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!botToken || !appUrl) {
    return { ok: false, description: 'Missing TELEGRAM_BOT_TOKEN or NEXT_PUBLIC_APP_URL env vars' };
  }

  const webhookUrl = `${appUrl}/api/webhooks/telegram`;

  try {
    const response = await postTelegramEndpoint('setWebhook', botToken, {
      url: webhookUrl,
      secret_token: process.env.TELEGRAM_WEBHOOK_SECRET,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      recordTelegramFailure(new Error(errorBody));
      return { ok: false, description: `Telegram API ${response.status}: ${errorBody}` };
    }
    recordTelegramSuccess();
    return response.json();
  } catch (err) {
    recordTelegramFailure(err);
    return { ok: false, description: `Network error: ${getErrorMessage(err)}` };
  }
}

export async function sendTelegramMessageWithKeyboard(
  chatId: string,
  text: string,
  keyboard: InlineKeyboardMarkup,
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
  if (!canDispatchTelegram()) {
    return null;
  }
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
      recordTelegramFailure(new Error(`HTTP ${response.status}`));
      return null;
    }
    recordTelegramSuccess();
    return await response.json();
  } catch {
    return null;
  }
}
