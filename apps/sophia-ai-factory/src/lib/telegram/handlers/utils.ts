import { bot } from '../telegram-bot-instance'
import { toReplyMarkup } from '../telegram-keyboard-builder'
import { logger } from '../../utils/logger-utility'

/**
 * Send a plain text message using Telegraf bot instance
 */
export async function sendMessage(chatId: string, text: string): Promise<void> {
  try {
    await bot.telegram.sendMessage(chatId, text, { parse_mode: 'Markdown' })
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
    await bot.telegram.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    })
  } catch (error) {
    logger.error(`Error sending message with keyboard to ${chatId}`, error instanceof Error ? error : new Error(String(error)))
    throw error
  }
}
