import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';
import { getErrorMessage } from '@/seed/utils/to-error';
import { logger } from '@/seed/utils/logger-utility';
import type { ExecutiveBIMetricsSummary } from '@/seed/types/executive-bi';
import type { BrandingSettings } from '@/seed/tenant-settings/defaults';
import type {
  TelegramConfig,
  TelegramDigestOptions,
  TelegramDigestResult,
} from './types';
import { TELEGRAM_SAFE_CHUNK_LENGTH } from './types';
import { formatTelegramDigest } from './metrics-formatter';
import { splitTelegramMarkdownV2 } from './digest-delivery';
import { sendTelegramChunkWithFallback } from './telegram-chunk-sender';

/**
 * Sends an Executive BI Digest to Telegram Bot API.
 * Named sendTelegramExecutiveDigest per prompt contract, with sendTelegramDigest as alias.
 */
export async function sendTelegramExecutiveDigest(
  telegramConfig: TelegramConfig,
  metrics: ExecutiveBIMetricsSummary,
  branding?: Partial<BrandingSettings> | null,
): Promise<TelegramDigestResult> {
  const botToken = telegramConfig?.botToken ?? process.env.TELEGRAM_BOT_TOKEN;
  const chatId = telegramConfig?.chatId ?? process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    logger.warn('[telegram-digest-sender] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not configured — skipping');
    return {
      success: false,
      skipped: true,
      reason: 'missing_credentials',
      totalChunks: 0,
      chunksSent: 0,
      messageIds: [],
    };
  }

  if (!shouldAllowRequest('telegram')) {
    logger.warn('[telegram-digest-sender] Circuit breaker open for telegram — skipping');
    return {
      success: false,
      skipped: true,
      reason: 'circuit_breaker_open',
      totalChunks: 0,
      chunksSent: 0,
      messageIds: [],
    };
  }

  const formattedText = formatTelegramDigest(metrics, branding);
  const chunks = splitTelegramMarkdownV2(formattedText, TELEGRAM_SAFE_CHUNK_LENGTH);
  const messageIds: number[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    try {
      const res = await sendTelegramChunkWithFallback({
        botToken,
        chatId,
        chunk,
        chunkIndex: i,
        disableWebPagePreview: telegramConfig?.disableWebPagePreview ?? true,
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        recordFailure('telegram', classifyError(new Error(`HTTP ${res.status}`)));
        return {
          success: false,
          totalChunks: chunks.length,
          chunksSent: messageIds.length,
          messageIds,
          error: `Telegram API ${res.status}: ${errBody.slice(0, 200)}`,
        };
      }

      const data = (await res.json()) as { ok: boolean; result?: { message_id: number } };
      if (data.ok && data.result?.message_id) {
        messageIds.push(data.result.message_id);
      }

      // Safe pacing between chunks to respect Telegram rate limits
      if (i < chunks.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    } catch (err) {
      recordFailure('telegram', classifyError(err));
      return {
        success: false,
        totalChunks: chunks.length,
        chunksSent: messageIds.length,
        messageIds,
        error: getErrorMessage(err),
      };
    }
  }

  recordSuccess('telegram');
  return {
    success: true,
    totalChunks: chunks.length,
    chunksSent: messageIds.length,
    messageIds,
  };
}

/**
 * Convenient alias matching sendTelegramDigest(metrics, options).
 */
export async function sendTelegramDigest(
  metrics: ExecutiveBIMetricsSummary,
  options: TelegramDigestOptions = {},
): Promise<TelegramDigestResult> {
  return sendTelegramExecutiveDigest(
    {
      chatId: options.chatId,
      botToken: options.botToken,
      disableWebPagePreview: options.disableWebPagePreview,
    },
    metrics,
    options.branding,
  );
}
