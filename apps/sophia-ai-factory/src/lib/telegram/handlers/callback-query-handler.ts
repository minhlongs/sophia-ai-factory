import { TelegramFSM, BotState } from '../telegram-fsm-state-manager'
import { buildSubscribeKeyboard, toReplyMarkup } from '../telegram-keyboard-builder'
import { sendMessage, sendMessageWithKeyboard } from './utils'
import { handleDiscover } from './discover-handler'
import { handleCampaign, executeCampaignCreation } from './campaign-handler'
import { handleStatus } from './status-handler'
import { handleResults } from './results-handler'
import { handleHelp } from './help-handler'
import { handleStart } from './start-handler'
import { handleSubscribe } from './subscribe-handler'

/**
 * Handle inline keyboard callback queries
 */
export async function handleCallbackQuery(
  chatId: string,
  callbackData: string
): Promise<void> {
  const [action, value] = callbackData.split(':')

  switch (action) {
    case 'cmd':
      switch (value) {
        case 'discover': await handleDiscover(chatId); break
        case 'campaign': await handleCampaign(chatId, ''); break
        case 'status': await handleStatus(chatId); break
        case 'results': await handleResults(chatId); break
        case 'help': await handleHelp(chatId); break
        case 'menu': await handleStart(chatId); break
        case 'plans': await handleSubscribe(chatId); break
      }
      break

    case 'subscribe': {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sophia-ai-factory.vercel.app'
      const checkoutUrl = `${appUrl}/api/checkout?tier=${value}&telegram_chat_id=${chatId}`
      await sendMessageWithKeyboard(
        chatId,
        `💳 Click below to complete your *${value}* subscription:`,
        toReplyMarkup(buildSubscribeKeyboard(checkoutUrl))
      )
      break
    }

    case 'discover':
      await TelegramFSM.setContext(chatId, {
        filters: value === 'all' ? [] : [value],
        state: BotState.DISCOVERING_TRENDS,
      })
      await sendMessage(
        chatId,
        `🔍 Searching for *${value === 'all' ? 'all niches' : value}* trends...\n\n_Discovery engine coming in Phase 4._`
      )
      break

    case 'export':
      await TelegramFSM.setContext(chatId, {
        exportFormat: value as 'pdf' | 'csv' | 'json',
        state: BotState.EXPORTING_CAMPAIGN,
      })
      await sendMessage(chatId, `📤 Exporting as ${value.toUpperCase()}...\n\n_Export feature coming in Phase 5._`)
      break

    case 'confirm':
    case 'cancel':
      if (value === 'campaign' || action === 'confirm') {
         if (action === 'confirm') {
            await executeCampaignCreation(chatId)
         } else {
            await TelegramFSM.setState(chatId, BotState.IDLE)
            await sendMessage(chatId, '❌ Action cancelled.')
         }
      }
      break
  }
}
