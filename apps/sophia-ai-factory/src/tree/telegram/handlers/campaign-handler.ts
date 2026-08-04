import { TelegramFSM, BotState } from '@/tree/telegram/telegram-fsm-state-manager'
import { tryCreateServerClient, D1Client } from '@/seed/db/client'
import { inngest } from '@/tree/inngest'
import { Tier } from '@/seed/types'
import { backupSessionState } from '@/tree/telegram/telegram-state-backup-service'
import { sendMessage } from '@/tree/telegram/handlers/utils'
import { logger } from '@/seed/utils/logger-utility'
import { truncateMarkdownV2Safely } from '../format-markdown-v2'

let _campaignDb: D1Client | null = null
export function resetCampaignDb() { _campaignDb = null; }
function getCampaignDb(): D1Client | null {
  if (!_campaignDb) _campaignDb = tryCreateServerClient();
  return _campaignDb;
}

// -------------------------------------------------------------------------
// Campaign row types
// -------------------------------------------------------------------------

interface CampaignRow {
  id: string;
  title: string;
  status: string | null;
  progress: number | null;
  created_at: string;
  updated_at: string;
}

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
    `📊 *Campaign Preview*\n\nEmail: ${context.email}\nTopic: ${topic}\n\nType "confirm" to create this campaign, or /cancel to abort.`,
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
    const db = getCampaignDb();
    if (!db) {
      await sendMessage(chatId, 'Database unavailable. Please try again later.');
      return;
    }

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
      `🚀 *Campaign Started!*\n\nTopic: ${context.campaignTopic}\nID: \`${campaign.id.slice(0, 8)}\`\n\nI will notify you when it's ready. Check progress with /status.`,
    )
  } catch (error) {
    logger.error('Error executing campaign creation', error instanceof Error ? error : new Error(String(error)))
    await sendMessage(chatId, '❌ An unexpected error occurred while starting your campaign.')
  }
}

// -------------------------------------------------------------------------
// Campaign statuses that are considered "active" (can be cancelled)
// -------------------------------------------------------------------------
const ACTIVE_STATUSES = ['queued', 'processing_script', 'processing_video'] as const;


const MAX_CAMPAIGN_LIST_ROWS = 10
const MAX_CAMPAIGN_TITLE_LEN = 80
const MAX_CAMPAIGN_MESSAGE_LEN = 3800

/**
 * Handle /campaign list — list all campaigns for the user with their statuses.
 */
export async function handleCampaignList(chatId: string): Promise<void> {
  try {
    const db = getCampaignDb();
    if (!db) {
      await sendMessage(chatId, 'Database unavailable. Please try again later.');
      return;
    }

    const { data: profileData } = await db
      .from('user_profiles')
      .select('user_id')
      .eq('telegram_chat_id', chatId)
      .single()

    const profile = profileData as { user_id: string } | null
    if (!profile) {
      await sendMessage(chatId, '❌ Account not linked. Please use /email to setup.')
      return
    }

    const { data: campaignsData } = await db
      .from('campaigns')
      .select('id, title, status, progress, created_at')
      .eq('user_id', profile.user_id)
      .order('created_at', { ascending: false })
      .limit(MAX_CAMPAIGN_LIST_ROWS)

    const campaigns = (campaignsData as CampaignRow[] | null) ?? []
    if (campaigns.length === 0) {
      await sendMessage(chatId, '📭 No campaigns found. Start one with /campaign <topic>')
      return
    }

    const statusEmoji: Record<string, string> = {
      draft: '📝',
      queued: '⏳',
      processing_script: '⚙️',
      processing_video: '🎬',
      completed: '✅',
      failed: '❌',
      video_timeout: '⏰',
    }

    let message = '📋 *All Campaigns:*\n\n'
    campaigns.forEach((c, i) => {
      const emoji = statusEmoji[c.status ?? ''] || '❓'
      const shortId = c.id.slice(0, 8)
      const date = new Date(c.created_at).toLocaleDateString()
      const title = truncateMarkdownV2Safely(c.title, MAX_CAMPAIGN_TITLE_LEN)
      message += `${emoji} *${title}*\n`
      message += ` ID: \`${shortId}\` | Status: ${c.status ?? 'unknown'} | Progress: ${c.progress ?? 0}%\n`
      message += ` Created: ${date}\n`
      if (i < campaigns.length - 1) message += '\n'
    })

    const finalMessage = truncateMarkdownV2Safely(message, MAX_CAMPAIGN_MESSAGE_LEN)
    await sendMessage(
      chatId,
      finalMessage + (finalMessage.length >= MAX_CAMPAIGN_MESSAGE_LEN ? '…\n_(truncated)_' : ''),
    )
  } catch (error) {
    logger.error('Error listing campaigns', error instanceof Error ? error : new Error(String(error)))
    await sendMessage(chatId, '❌ Error fetching campaign list.')
  }
}

/**
 * Handle /campaign cancel <id> — cancel a running campaign.
 * Only active campaigns (queued, processing) can be cancelled.
 * Uses status= 'failed' with error_message convention since the schema
 * CHECK constraint only allows: draft, queued, processing_script,
 * processing_video, completed, failed, video_timeout.
 */
export async function handleCampaignCancel(chatId: string, campaignId: string): Promise<void> {
  try {
    const db = getCampaignDb();
    if (!db) {
      await sendMessage(chatId, 'Database unavailable. Please try again later.');
      return;
    }

    const { data: profileData } = await db
      .from('user_profiles')
      .select('user_id')
      .eq('telegram_chat_id', chatId)
      .single()

    const profile = profileData as { user_id: string } | null
    if (!profile) {
      await sendMessage(chatId, '❌ Account not linked. Please use /email to setup.')
      return
    }

    // Fetch the campaign and verify ownership
    const { data: campaignData } = await db
      .from('campaigns')
      .select('id, title, status')
      .eq('id', campaignId)
      .eq('user_id', profile.user_id)
      .single()

    const campaign = campaignData as { id: string; title: string; status: string } | null
    if (!campaign) {
      await sendMessage(chatId, `❌ Campaign \`${campaignId.slice(0, 8)}\` not found or does not belong to you.`)
      return
    }

    // Only active campaigns can be cancelled
    if (!ACTIVE_STATUSES.includes(campaign.status as typeof ACTIVE_STATUSES[number])) {
      await sendMessage(
        chatId,
        `❌ Campaign *${campaign.title}* (status: ${campaign.status}) cannot be cancelled.\n` +
        `Only active campaigns (queued, processing) can be cancelled.`,
      )
      return
    }

    // Set status to failed with cancellation note
    await db
      .from('campaigns')
      .update({
        status: 'failed',
        error_message: 'Cancelled by user',
        updated_at: new Date().toISOString(),
      })
      .eq('id', campaignId)
      .eq('user_id', profile.user_id)

    await sendMessage(chatId, `✅ Campaign *${campaign.title}* has been cancelled.`)
  } catch (error) {
    logger.error('Error cancelling campaign', error instanceof Error ? error : new Error(String(error)))
    await sendMessage(chatId, '❌ An unexpected error occurred while cancelling the campaign.')
  }
}
