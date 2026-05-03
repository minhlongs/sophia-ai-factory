import { TelegramFSM, BotState } from '@/tree/telegram/telegram-fsm-state-manager'
import { createServerClient } from '@/seed/db/client'
import { inngest } from '@/forest/inngest/client'
import { Tier } from '@/seed/types'
import { backupSessionState } from '@/tree/telegram/telegram-state-backup-service'
import { sendMessage } from '@/tree/telegram/handlers/utils'
import { logger } from '@/seed/utils/logger-utility'

const getSupabase = () => createServerClient()

// Helper to map Supabase subscription tier to App Tier
function mapSubscriptionToTier(subTier: 'free' | 'pro' | 'enterprise' | null): Tier {
  switch (subTier) {
    case 'pro': return 'PREMIUM';
    case 'enterprise': return 'ENTERPRISE';
    case 'free':
    default: return 'BASIC';
  }
}

/**
 * Handle /campaign command or topic input
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
 * Actual implementation of campaign creation (merged from telegram-bot.ts)
 */
export async function executeCampaignCreation(chatId: string): Promise<void> {
  const context = await TelegramFSM.getContext(chatId)
  if (!context || !context.campaignTopic) {
    await sendMessage(chatId, '❌ No campaign topic found. Please start over with /campaign.')
    return
  }

  try {
    const db = getSupabase()

    // 1. Identify user from chatId
    const { data: profileData, error } = await db
      .from('user_profiles')
      .select('user_id, subscription_tier')
      .eq('telegram_chat_id', chatId)
      .single()

    if (error || !profileData) {
      await sendMessage(chatId, '❌ Account not linked correctly in our database. Please try linking your email again.')
      return
    }

    const profile = profileData as { user_id: string; subscription_tier: 'free' | 'pro' | 'enterprise' | null }

    // 2. Create Campaign in DB
    interface CampaignInsertRow { id: string }
    const { data: campaignData, error: createError } = await db.from<CampaignInsertRow>('campaigns')
      .insert({
        user_id: profile.user_id,
        title: context.campaignTopic,
        topic: context.campaignTopic,
        status: 'queued',
        progress: 0,
      })
      .select()
      .single()

    if (createError || !campaignData) {
      logger.error('Campaign creation error', new Error(createError?.message ?? 'Unknown error'))
      await sendMessage(chatId, '❌ Failed to create campaign in database. Please try again.')
      return
    }

    const campaign = campaignData

    // 3. Trigger Inngest Event
    const tier = mapSubscriptionToTier(profile.subscription_tier)

    await inngest.send({
      name: "campaign.created",
      data: {
        campaignId: campaign.id,
        userId: profile.user_id,
        topic: context.campaignTopic,
        audience: "General",
        tier: tier
      }
    })

    // 4. Update FSM state
    await TelegramFSM.setState(chatId, BotState.IDLE)
    await backupSessionState(chatId, context, 'campaign_created')

    await sendMessage(
      chatId,
      `🚀 *Campaign Started!*

Topic: ${context.campaignTopic}
ID: \`${campaign.id.slice(0, 8)}\`

I will notify you when it's ready. Check progress with /status.`
    )
  } catch (error) {
    logger.error('Error executing campaign creation', error instanceof Error ? error : new Error(String(error)))
    await sendMessage(chatId, '❌ An unexpected error occurred while starting your campaign.')
  }
}
