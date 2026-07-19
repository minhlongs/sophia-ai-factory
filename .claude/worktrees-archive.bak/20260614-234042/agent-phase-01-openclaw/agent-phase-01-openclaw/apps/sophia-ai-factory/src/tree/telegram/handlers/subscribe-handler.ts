import { TelegramFSM, BotState } from '@/tree/telegram/telegram-fsm-state-manager'
import { checkSubscriptionAuth } from '@/tree/telegram/telegram-auth-middleware'
import { buildPricingKeyboard, toReplyMarkup } from '@/tree/telegram/telegram-keyboard-builder'
import { sendMessage, sendMessageWithKeyboard } from '@/tree/telegram/handlers/utils'

/**
 * Handle /subscribe command
 * Shows pricing plans if not already subscribed
 */
export async function handleSubscribe(chatId: string): Promise<void> {
  await TelegramFSM.setState(chatId, BotState.AWAITING_SUBSCRIPTION)

  // Check if already subscribed
  const auth = await checkSubscriptionAuth(chatId)
  if (auth.tier !== 'BASIC') {
    const status = auth.tier === 'PREMIUM' ? 'Growth' : 'Premium'
    await sendMessage(
      chatId,
      `✅ You already have an active *${status}* subscription!\n\nUse /status to check details.`
    )
    return
  }

  await sendMessageWithKeyboard(
    chatId,
    `💎 *Choose Your Plan*

Unlock the full power of Sophia AI Factory:

🌱 *Starter* - $19/mo
  Basic trend discovery

🚀 *Growth* - $29/mo
  Full discovery + campaigns

💎 *Premium* - $49/mo
  Everything + priority support + exports`,
    toReplyMarkup(buildPricingKeyboard())
  )
}
