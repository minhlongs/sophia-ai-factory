import { TelegramFSM, BotState } from '@/tree/telegram/telegram-fsm-state-manager'
import { checkSubscriptionAuth } from '@/tree/telegram/telegram-auth-middleware'
import { buildDiscoveryFilterKeyboard, toReplyMarkup } from '@/tree/telegram/telegram-keyboard-builder'
import { formatPremiumGateMessage } from '@/tree/telegram/telegram-message-formatter'
import { sendMessage, sendMessageWithKeyboard } from '@/tree/telegram/handlers/utils'

/**
 * Handle /discover command (Premium feature)
 * Shows trend discovery filters
 */
export async function handleDiscover(chatId: string): Promise<void> {
  const auth = await checkSubscriptionAuth(chatId, 'PREMIUM')

  if (!auth.authorized) {
    await sendMessage(chatId, formatPremiumGateMessage('Growth'))
    return
  }

  await TelegramFSM.setState(chatId, BotState.DISCOVERING_TRENDS)

  await sendMessageWithKeyboard(
    chatId,
    `🔍 *Trend Discovery*

Select a niche to explore trending products:`,
    toReplyMarkup(buildDiscoveryFilterKeyboard())
  )
}
