import { TelegramFSM } from '../telegram-fsm-state-manager'
import { createServerClient } from '@/seed/db/client'
import { sendMessage } from './utils'
import { logger } from '@/seed/utils/logger-utility'

const getSupabase = () => createServerClient()

/**
 * Handle /status command
 * Shows bot context state and active campaigns from database
 */
export async function handleStatus(chatId: string): Promise<void> {
  const context = await TelegramFSM.getContext(chatId)

  if (!context) {
    await sendMessage(chatId, '📭 No active session. Start with /start or link your email with /email.')
    return
  }

  let message = `📊 *Your Status*\n`
  message += `Email: ${context.email || 'Not set'}\n`
  message += `Bot State: ${context.state}\n\n`

  try {
    const db = getSupabase()

    // 1. Identify user from chatId
    const { data: profileData } = await db
      .from('user_profiles')
      .select('user_id')
      .eq('telegram_chat_id', chatId)
      .single()

    if (profileData) {
      interface CampaignRow {
        title: string;
        status: string;
        progress: number;
      }

      // 2. Fetch active campaigns
      const profile = profileData as unknown as { user_id: string }
      const { data: campaigns } = await db.from<CampaignRow>('campaigns')
        .select('*')
        .eq('user_id', profile.user_id)
        .in('status', ['queued', 'processing_script', 'processing_video'])
        .order('created_at', { ascending: false })
        .limit(3)

      if (campaigns && campaigns.length > 0) {
        message += `*Active Campaigns:*\n`
        campaigns.forEach((c) => {
          const statusEmoji = c.status === 'queued' ? '⏳' : '⚙️'
          message += `${statusEmoji} *${c.title}*\n`
          message += `   Status: ${c.status?.replace('_', ' ')} (${c.progress}%)\n`
        })
      } else {
        message += `_No active video campaigns._`
      }
    } else {
      message += `⚠️ _Account not linked to Sophia AI Factory database. Use /email to link._`
    }
  } catch (error) {
    logger.error('Error in handleStatus', error instanceof Error ? error : new Error(String(error)))
    message += `\n❌ _Error fetching campaign data from database._`
  }

  await sendMessage(chatId, message)
}
