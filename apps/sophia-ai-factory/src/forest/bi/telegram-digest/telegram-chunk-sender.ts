/**
 * Telegram Digest Single-Chunk HTTP Sender with MarkdownV2 Fallback
 *
 * @module forest/bi/telegram-digest/telegram-chunk-sender
 */

import { logger } from '@/seed/utils/logger-utility';

export interface SendTelegramChunkParams {
  botToken: string;
  chatId: string;
  chunk: string;
  chunkIndex: number;
  disableWebPagePreview: boolean;
}

/**
 * Sends a single chunk to Telegram `sendMessage` with automatic plain-text fallback
 * if MarkdownV2 entity parsing fails with HTTP 400.
 */
export async function sendTelegramChunkWithFallback(
  params: SendTelegramChunkParams,
): Promise<Response> {
  const { botToken, chatId, chunk, chunkIndex, disableWebPagePreview } = params;

  let res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: chunk,
      parse_mode: 'MarkdownV2',
      disable_web_page_preview: disableWebPagePreview,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  // Fallback to plain text on MarkdownV2 parse failure (HTTP 400 with "can't parse")
  if (!res.ok && res.status === 400) {
    const bodyText = await res.text().catch(() => '');
    if (bodyText.includes("can't parse") || bodyText.includes('entities')) {
      logger.warn('[telegram-digest-sender] MarkdownV2 parse failed, falling back to plain text', {
        chatId,
        chunkIndex,
      });
      res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: chunk.replace(/\\([_*[\]()~`>#+\-=|{}.!\\])/g, '$1'),
          disable_web_page_preview: true,
        }),
        signal: AbortSignal.timeout(10_000),
      });
    }
  }

  return res;
}
