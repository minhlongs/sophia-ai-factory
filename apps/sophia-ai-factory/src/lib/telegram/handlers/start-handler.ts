import { TelegramFSM } from '../telegram-fsm-state-manager'
import { checkSubscriptionAuth } from '../telegram-auth-middleware'
import { buildMainMenuKeyboard, toReplyMarkup } from '../telegram-keyboard-builder'
import { formatWelcomeMessage } from '../telegram-message-formatter'
import { sendMessage, sendMessageWithKeyboard } from './utils'

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
