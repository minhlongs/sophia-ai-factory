import { bot } from './telegram-bot-instance'
import { TelegramFSM, BotState } from './telegram-fsm-state-manager'

/**
 * Send a message to a chat
 */
async function sendMessage(chatId: string, text: string): Promise<void> {
  try {
    await bot.telegram.sendMessage(chatId, text, { parse_mode: 'Markdown' })
  } catch (error) {
    console.error('Error sending message:', error)
    throw error
  }
}

/**
 * Handle /start command
 */
export async function handleStart(chatId: string): Promise<void> {
  await TelegramFSM.clearContext(chatId)
  await sendMessage(
    chatId,
    `🚀 *Welcome to Sophia AI Factory!*

I'm your AI-powered campaign assistant. Here's what I can do:

• Help you set up email campaigns
• Analyze campaign performance
• Provide AI-driven insights

Type /help to see available commands.`
  )
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
/email <your@email.com> - Set your email
/campaign <topic> - Create new campaign
/status - Check campaign status
/results - View campaign results

*Need support?* Contact us at support@sophia.ai`
  )
}

/**
 * Handle /email command or email input based on state
 */
export async function handleEmail(chatId: string, email: string): Promise<void> {
  // Check context to verify flow
  // const context = await TelegramFSM.getContext(chatId)

  if (!email) {
    await TelegramFSM.setState(chatId, BotState.AWAITING_EMAIL)
    await sendMessage(chatId, '📧 Please send me your email address:')
    return
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    await sendMessage(chatId, '❌ Invalid email format. Please try again.')
    return
  }

  await TelegramFSM.setContext(chatId, {
    email,
    state: BotState.IDLE,
  })

  await sendMessage(
    chatId,
    `✅ Email saved: ${email}

You can now create campaigns with /campaign <topic>`
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

  // TODO: Integrate with actual campaign results from database
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
          `✅ Campaign created successfully!

Your campaign "${context.campaignTopic}" is now processing.
Check /status for updates.`
        )
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
    `❓ I didn't understand that command.

Type /help to see available commands.`
  )
}
