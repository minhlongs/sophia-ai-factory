import { TelegramFSM, BotState } from '../telegram-fsm-state-manager'
import { sendMessage } from './utils'
import { handleEmail } from './email-handler'
import { handleCampaign, executeCampaignCreation } from './campaign-handler'
import { matchFaq } from './faq-handler'

/**
 * Handle text messages based on FSM state
 */
export async function handleTextMessage(chatId: string, text: string): Promise<void> {
  const context = await TelegramFSM.getContext(chatId)

  switch (context?.state) {
    case BotState.AWAITING_EMAIL:
      await handleEmail(chatId, text)
      break

    case BotState.AWAITING_CAMPAIGN_TOPIC:
      await handleCampaign(chatId, text)
      break

    case BotState.AWAITING_CONFIRMATION:
      if (text.toLowerCase() === 'confirm') {
        await executeCampaignCreation(chatId)
      } else if (text.toLowerCase() === '/cancel' || text.toLowerCase() === 'cancel') {
        await TelegramFSM.setState(chatId, BotState.IDLE)
        await sendMessage(chatId, '❌ Campaign cancelled.')
      } else {
        await sendMessage(chatId, 'Please type "confirm" to proceed or /cancel to abort.')
      }
      break

    default: {
      // Auto-FAQ: check for known keywords before falling back to unknown
      const faqResponse = matchFaq(text)
      if (faqResponse) {
        await sendMessage(chatId, faqResponse)
      } else {
        await handleUnknown(chatId)
      }
    }
  }
}

/**
 * Handle unknown commands
 */
export async function handleUnknown(chatId: string): Promise<void> {
  await sendMessage(
    chatId,
    `❓ I didn't understand that command.\n\nType /help to see available commands.`
  )
}
