/**
 * Telegram campaign list and delete commands
 *
 * Layer: forest — orchestrates between tree (messaging) and D1 (data).
 *
 * @module forest/telegram/campaign-commands
 */

import { createServerClient } from '@/seed/db/client'
import { sendTelegramMessage } from '@/tree/telegram/telegram-client'
import { logger } from '@/seed/utils/logger-utility'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ProfileRow {
  user_id: string
}

async function resolveUserId(chatId: string): Promise<string | null> {
  const db = createServerClient()
  const { data } = await db
    .from('user_profiles')
    .select('user_id')
    .eq('telegram_chat_id', chatId)
    .maybeSingle()
  if (!data) return null
  return (data as unknown as ProfileRow).user_id
}

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

interface CampaignRow {
  id: string
  title: string
  status: string | null
  progress: number | null
  created_at: string
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/**
 * Handle /campaign_list — list all campaigns for the user with status indicators.
 */
export async function handleCampaignList(chatId: string): Promise<void> {
  try {
    const userId = await resolveUserId(chatId)
    if (!userId) {
      await sendTelegramMessage(chatId, '⚠️ Account not linked. Please use /email to setup.')
      return
    }

    const db = createServerClient()
    const { data: campaignsData } = await db
      .from('campaigns')
      .select('id, title, status, progress, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)

    const campaigns = campaignsData as unknown as CampaignRow[] | null

    if (!campaigns || campaigns.length === 0) {
      await sendTelegramMessage(chatId, '📭 No campaigns found. Create one with /campaign.')
      return
    }

    let message = '📋 *Your Campaigns:*\n\n'
    campaigns.forEach((c, i) => {
      const statusEmoji =
        c.status === 'completed' ? '✅' :
        c.status === 'failed' ? '❌' :
        c.status?.startsWith('processing') ? '⚙️' : '⏳'
      message += `${i + 1}. ${statusEmoji} *${c.title}*\n`
      message += `   ID: \`${c.id.slice(0, 8)}\`  Status: ${c.status ?? 'unknown'}  ${c.progress ?? 0}%\n`
      message += `   Created: ${new Date(c.created_at).toLocaleDateString()}\n\n`
    })

    await sendTelegramMessage(chatId, message)
  } catch (error) {
    logger.error('[campaign-list]', error instanceof Error ? error : new Error(String(error)))
    await sendTelegramMessage(chatId, '❌ Error fetching campaign list.')
  }
}

/**
 * Handle /campaign_del <id> — delete a campaign by ID (owner only).
 */
export async function handleCampaignDelete(chatId: string, campaignId: string): Promise<void> {
  try {
    const userId = await resolveUserId(chatId)
    if (!userId) {
      await sendTelegramMessage(chatId, '⚠️ Account not linked. Please use /email to setup.')
      return
    }

    const db = createServerClient()

    // Verify campaign exists and belongs to user
    const { data: campaignData } = await db
      .from('campaigns')
      .select('id, title, status')
      .eq('id', campaignId)
      .eq('user_id', userId)
      .maybeSingle()

    if (!campaignData) {
      await sendTelegramMessage(
        chatId,
        `❌ Campaign \`${campaignId.slice(0, 8)}\` not found or not owned by you.`
      )
      return
    }

    const campaign = campaignData as unknown as { id: string; title: string; status: string }

    await db.from('campaigns').delete().eq('id', campaignId).eq('user_id', userId)

    await sendTelegramMessage(
      chatId,
      `🗑️ *Campaign Deleted*\n\nTitle: ${campaign.title}\nStatus: ${campaign.status}\nID: \`${campaign.id.slice(0, 8)}\``
    )
  } catch (error) {
    logger.error('[campaign-delete]', error instanceof Error ? error : new Error(String(error)))
    await sendTelegramMessage(chatId, '❌ Error deleting campaign.')
  }
}
