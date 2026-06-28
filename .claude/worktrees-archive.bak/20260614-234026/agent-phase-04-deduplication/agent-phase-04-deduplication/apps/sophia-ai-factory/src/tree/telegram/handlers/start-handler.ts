import { TelegramFSM } from '@/tree/telegram/telegram-fsm-state-manager'
import { checkSubscriptionAuth } from '@/tree/telegram/telegram-auth-middleware'
import { buildMainMenuKeyboard, toReplyMarkup } from '@/tree/telegram/telegram-keyboard-builder'
import { formatWelcomeMessage } from '@/tree/telegram/telegram-message-formatter'
import { sendMessage, sendMessageWithKeyboard } from '@/tree/telegram/handlers/utils'

/**
 * Handle /start command
 * Clears context and shows welcome message based on subscription status
 */
export async function handleStart(chatId: string): Promise<void> {
  await TelegramFSM.clearContext(chatId)

  const auth = await checkSubscriptionAuth(chatId)
  const message = formatWelcomeMessage(auth.tier !== 'BASIC', auth.tier)

  if (auth.tier !== 'BASIC') {
    await sendMessageWithKeyboard(chatId, message, toReplyMarkup(buildMainMenuKeyboard()))
  } else {
    // Add tip for BASIC users to link account (from telegram-bot.ts logic)
    const basicMessage = message + '\n\n*Next step:* Link your account by sending your email:\n`/email your@email.com`';
    await sendMessage(chatId, basicMessage)
  }
}
