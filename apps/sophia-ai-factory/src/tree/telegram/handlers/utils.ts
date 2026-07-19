import { bot } from '@/tree/telegram/telegram-bot-instance'
import { toReplyMarkup } from '@/tree/telegram/telegram-keyboard-builder'
import { logger } from '@/seed/utils/logger-utility'

/**
 * Send message with MarkdownV2, falling back to plain text on parse failure.
 *
 * Wave 20 Phase 01 (7A): MarkdownV2 is stricter — all special characters in
 * user content must be escaped. Callers should escape user-provided values
 * before building the message text.
 */
async function trySendMarkdownV2(
  chatId: string,
  text: string,
  extra?: Record<string, unknown>,
): Promise<void> {
  try {
    await bot.telegram.sendMessage(chatId, text, { ...extra, parse_mode: 'MarkdownV2' });
  } catch (firstErr) {
    // If MarkdownV2 parse fails, fall back to plain text to keep messages flowing.
    const msg = firstErr instanceof Error ? firstErr.message : String(firstErr);
    if (msg.includes('400') || msg.includes('can\'t parse')) {
      logger.warn('[sendMessage] MarkdownV2 parse failed, falling back to plain text', {
        chatId,
        error: msg.slice(0, 200),
      });
      await bot.telegram.sendMessage(chatId, text);
      return;
    }
    throw firstErr;
  }
}

/**
 * Send a plain text message using Telegraf bot instance
 */
export async function sendMessage(chatId: string, text: string): Promise<void> {
  try {
    await trySendMarkdownV2(chatId, text);
  } catch (error) {
    logger.error(`Error sending message to ${chatId}`, error instanceof Error ? error : new Error(String(error)))
    throw error
  }
}

/**
 * Send a message with inline keyboard using Telegraf bot instance
 */
export async function sendMessageWithKeyboard(
  chatId: string,
  text: string,
  keyboard: ReturnType<typeof toReplyMarkup>
): Promise<void> {
  try {
    await trySendMarkdownV2(chatId, text, { reply_markup: keyboard });
  } catch (error) {
    logger.error(`Error sending message with keyboard to ${chatId}`, error instanceof Error ? error : new Error(String(error)))
    throw error
  }
}
