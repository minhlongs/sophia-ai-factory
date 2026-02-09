import { bot } from './telegram-bot-instance'
import { TelegramFSM, BotState } from './telegram-fsm-state-manager'
import { checkSubscriptionAuth } from './telegram-auth-middleware'
import { checkRateLimit } from './telegram-rate-limit-middleware'
import {
  buildMainMenuKeyboard,
  buildSubscribeKeyboard,
  buildPricingKeyboard,
  buildDiscoveryFilterKeyboard,
  toReplyMarkup,
} from './telegram-keyboard-builder'
import {
  formatWelcomeMessage,
  formatRateLimitMessage,
  formatPremiumGateMessage,
  formatErrorMessage,
} from './telegram-message-formatter'
import { backupSessionState } from './telegram-state-backup-service'
import { getSubscriptionStatus } from '@/lib/subscription'

/**
 * Send a plain text message
 */
async function sendMessage(chatId: string, text: string): Promise<void> {
  try {
    await bot.telegram.sendMessage(chatId, text, { parse_mode: 'Markdown' })
  } catch (error) {
    throw error
  }
}

/**
 * Send a message with inline keyboard
 */
async function sendMessageWithKeyboard(
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
    throw error
  }
}

/**
 * Middleware wrapper - checks rate limit before executing handler
 */
export async function withMiddleware(
  chatId: string,
  handler: () => Promise<void>
): Promise<void> {
  // Rate limit check
  const rateLimit = await checkRateLimit(chatId)
  if (!rateLimit.allowed) {
    await sendMessage(chatId, formatRateLimitMessage(rateLimit.resetInSeconds))
    return
  }
  await handler()
}

/**
 * Handle /start command
 */
export async function handleStart(chatId: string): Promise<void> {
  await TelegramFSM.clearContext(chatId)

  const auth = await checkSubscriptionAuth(chatId)
  const message = formatWelcomeMessage(auth.tier !== 'BASIC', auth.tier)

  if (auth.tier !== 'BASIC') {
    await sendMessageWithKeyboard(chatId, message, toReplyMarkup(buildMainMenuKeyboard()))
  } else {
    await sendMessage(chatId, message)
  }
}

/**
 * Handle /help command
 */
export async function handleHelp(chatId: string): Promise<void> {
  await sendMessage(
    chatId,
    `📚 *Available Commands:*

/start - Start fresh conversation
/help - Show this help message
/subscribe - Subscribe to premium plan
/discover - Find trending products
/email <your@email.com> - Set your email
/campaign <topic> - Create new campaign
/status - Check campaign status
/results - View campaign results

*Need support?* Contact us at support@sophia.ai`
  )
}

/**
 * Handle /subscribe command - generates Polar.sh checkout link
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

/**
 * Handle /discover command (premium) - shows trend discovery filters
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

/**
 * Handle /email command or email input based on state
 */
export async function handleEmail(chatId: string, email: string): Promise<void> {
  if (!email) {
    await TelegramFSM.setState(chatId, BotState.AWAITING_EMAIL)
    await sendMessage(chatId, '📧 Please send me your email address:')
    return
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    await sendMessage(chatId, '❌ Invalid email format. Please try again.')
    return
  }

  const context = { email, state: BotState.IDLE }
  await TelegramFSM.setContext(chatId, context)

  // Backup to Postgres on email set
  const fullContext = await TelegramFSM.getContext(chatId)
  if (fullContext) {
    await backupSessionState(chatId, fullContext, 'email_set')
  }

  await sendMessage(
    chatId,
    `✅ Email saved: ${email}\n\nYou can now create campaigns with /campaign <topic>`
  )
}

/**
 * Handle /campaign command or topic input based on state
 */
export async function handleCampaign(chatId: string, topic: string): Promise<void> {
  const context = await TelegramFSM.getContext(chatId)

  if (!context?.email) {
    await sendMessage(chatId, '⚠️ Please set your email first with /email <your@email.com>')
    return
  }

  if (!topic) {
    await TelegramFSM.setState(chatId, BotState.AWAITING_CAMPAIGN_TOPIC)
    await sendMessage(chatId, '📝 What topic would you like to create a campaign about?')
    return
  }

  await TelegramFSM.setContext(chatId, {
    campaignTopic: topic,
    state: BotState.AWAITING_CONFIRMATION,
  })

  await sendMessage(
    chatId,
    `📊 *Campaign Preview*

Email: ${context.email}
Topic: ${topic}

Type "confirm" to create this campaign, or /cancel to abort.`
  )
}

/**
 * Handle /status command
 */
export async function handleStatus(chatId: string): Promise<void> {
  const context = await TelegramFSM.getContext(chatId)

  if (!context) {
    await sendMessage(chatId, '📭 No active campaigns. Start with /campaign <topic>')
    return
  }

  let status = `📊 *Your Status*\n\n`
  status += `Email: ${context.email || 'Not set'}\n`
  status += `State: ${context.state}\n`

  if (context.campaignTopic) {
    status += `Campaign: ${context.campaignTopic}\n`
  }

  await sendMessage(chatId, status)
}

/**
 * Handle /results command
 */
export async function handleResults(chatId: string): Promise<void> {
  const context = await TelegramFSM.getContext(chatId)

  if (!context?.campaignTopic) {
    await sendMessage(chatId, '📭 No campaign results yet. Create a campaign with /campaign <topic>')
    return
  }

  await sendMessage(
    chatId,
    `📈 *Campaign Results*

Topic: ${context.campaignTopic}
Status: In Progress
Opens: --
Clicks: --

_Results will be updated as your campaign runs._`
  )
}

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
      // Route to command handlers
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
      // Generate Polar.sh checkout link for selected tier
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sophia.ai'
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
      // Stub: Phase 4 will implement actual discovery
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
      if (action === 'confirm') {
        const ctx = await TelegramFSM.getContext(chatId)
        await sendMessage(chatId, `✅ Action confirmed!`)
        if (ctx) await backupSessionState(chatId, ctx, 'campaign_created')
      } else {
        await sendMessage(chatId, '❌ Action cancelled.')
      }
      await TelegramFSM.setState(chatId, BotState.IDLE)
      break
  }
}

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
        await sendMessage(
          chatId,
          `✅ Campaign created successfully!\n\nYour campaign "${context.campaignTopic}" is now processing.\nCheck /status for updates.`
        )
        await backupSessionState(chatId, context, 'campaign_created')
        await TelegramFSM.setState(chatId, BotState.IDLE)
      } else if (text.toLowerCase() === '/cancel') {
        await TelegramFSM.setState(chatId, BotState.IDLE)
        await sendMessage(chatId, '❌ Campaign cancelled.')
      } else {
        await sendMessage(chatId, 'Please type "confirm" to proceed or /cancel to abort.')
      }
      break

    default:
      await handleUnknown(chatId)
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
