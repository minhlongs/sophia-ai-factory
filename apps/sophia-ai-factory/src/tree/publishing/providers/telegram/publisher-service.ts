import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError, classifyHttpStatus } from '@/seed/types/failure-kind';
import {
  type TelegramPublishInput,
  type TelegramPublishResult,
  TelegramApiError,
} from './types';
import { sanitizeCaption, maskToken, buildTelegramMessageUrl } from './caption-sanitizer';
import {
  TELEGRAM_API,
  handleTelegramRateLimit,
  handleTelegramAuthError,
  parseTelegramResponseBody,
} from './api-client';

/**
 * Post a video to a Telegram chat via Bot API sendVideo.
 */
export async function publishToTelegram(
  input: TelegramPublishInput,
): Promise<TelegramPublishResult> {
  const { jobId, videoUrl, caption, chatId } = input;
  if (!shouldAllowRequest('telegram')) {
    throw new Error('[telegram-publisher] Circuit breaker open for telegram');
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error('[telegram-publisher] TELEGRAM_BOT_TOKEN not set in environment');
  }

  if (!chatId) {
    throw new Error('[telegram-publisher] chatId is empty — pairing may have been revoked');
  }

  const safeCaption = caption ? sanitizeCaption(caption) : '';

  const payload = {
    chat_id: chatId,
    video: videoUrl,
    ...(safeCaption ? { caption: safeCaption, parse_mode: 'MarkdownV2' as const } : {}),
    supports_streaming: true,
  };

  logger.info('[telegram-publisher] sendVideo', {
    jobId,
    chatId,
    videoUrlLen: videoUrl.length,
    token: maskToken(token),
  });

  let res: Response;
  try {
    res = await fetch(`${TELEGRAM_API}/bot${token}/sendVideo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    recordFailure('telegram', classifyError(err));
    throw new Error(`[telegram-publisher] Network error: ${getErrorMessage(err)}`);
  }

  if (res.status === 429) {
    await handleTelegramRateLimit(res);
  }

  if (res.status === 401 || res.status === 403) {
    await handleTelegramAuthError(res);
  }

  const data = await parseTelegramResponseBody(res);

  if (!data.ok || !data.result) {
    recordFailure('telegram', classifyHttpStatus(res.status));
    throw new TelegramApiError(
      `[telegram-publisher] Telegram API error: ${data.description ?? 'unknown'} ` +
        `(code ${data.error_code ?? res.status})`,
      { status: data.error_code ?? res.status, bodySnippet: (data.description ?? '').slice(0, 200) },
    );
  }

  const messageId = data.result.message_id;
  const externalUrl = buildTelegramMessageUrl(data.result.chat, messageId);

  logger.info('[telegram-publisher] Video posted', { jobId, chatId, messageId, externalUrl });
  recordSuccess('telegram');

  return {
    externalPostId: String(messageId),
    externalUrl,
  };
}
