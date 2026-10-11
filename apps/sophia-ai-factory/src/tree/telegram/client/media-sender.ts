import { logger } from '@/seed/utils/logger-utility';
import type { TelegramMediaOptions, TelegramVideoOptions } from './types';
import { postTelegramEndpoint } from './http-transport';
import {
  canDispatchTelegram,
  recordTelegramSuccess,
  recordTelegramFailure,
} from './rate-limiter';

export async function sendTelegramVideo(
  chatId: string,
  videoUrl: string,
  options?: TelegramVideoOptions,
) {
  if (!canDispatchTelegram()) {
    return null;
  }
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return null;

  try {
    const payload: Record<string, unknown> = {
      chat_id: chatId,
      video: videoUrl,
      supports_streaming: options?.supports_streaming ?? true,
    };
    if (options?.caption) payload.caption = options.caption;
    if (options?.parse_mode) payload.parse_mode = options.parse_mode;
    if (options?.reply_markup) payload.reply_markup = options.reply_markup;

    const response = await postTelegramEndpoint('sendVideo', botToken, payload);

    if (!response.ok) {
      if (options?.parse_mode && response.status === 400) {
        delete payload.parse_mode;
        const retryRes = await postTelegramEndpoint('sendVideo', botToken, payload);
        if (retryRes.ok) {
          recordTelegramSuccess();
          return await retryRes.json();
        }
      }
      logger.warn('[sendTelegramVideo] Telegram API non-ok response', {
        status: response.status,
        chatId,
      });
      recordTelegramFailure(new Error(`HTTP ${response.status}`));
      return null;
    }
    recordTelegramSuccess();
    return await response.json();
  } catch (err) {
    recordTelegramFailure(err);
    return null;
  }
}

export async function sendTelegramPhoto(
  chatId: string,
  photoUrl: string,
  options?: TelegramMediaOptions,
) {
  if (!canDispatchTelegram()) {
    return null;
  }
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return null;

  try {
    const payload: Record<string, unknown> = {
      chat_id: chatId,
      photo: photoUrl,
    };
    if (options?.caption) payload.caption = options.caption;
    if (options?.parse_mode) payload.parse_mode = options.parse_mode;
    if (options?.reply_markup) payload.reply_markup = options.reply_markup;

    const response = await postTelegramEndpoint('sendPhoto', botToken, payload);

    if (!response.ok) {
      if (options?.parse_mode && response.status === 400) {
        delete payload.parse_mode;
        const retryRes = await postTelegramEndpoint('sendPhoto', botToken, payload);
        if (retryRes.ok) {
          recordTelegramSuccess();
          return await retryRes.json();
        }
      }
      logger.warn('[sendTelegramPhoto] Telegram API non-ok response', {
        status: response.status,
        chatId,
      });
      recordTelegramFailure(new Error(`HTTP ${response.status}`));
      return null;
    }
    recordTelegramSuccess();
    return await response.json();
  } catch (err) {
    recordTelegramFailure(err);
    return null;
  }
}
