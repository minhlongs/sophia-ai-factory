import { createServerClient } from '@/lib/supabase/server'
import { sendMessage } from './utils'
import { logger } from '../../utils/logger-utility'

const getSupabase = () => createServerClient()

/**
 * Handle /results command
 * Shows recently completed campaigns with video links
 */
export async function handleResults(chatId: string): Promise<void> {
  try {
    const supabase = getSupabase()

    // 1. Identify user
    const { data: profileData } = await supabase
      .from('user_profiles')
      .select('user_id')
      .eq('telegram_chat_id', chatId)
      .single()

    if (!profileData) {
      await sendMessage(chatId, '❌ Account not linked. Please use /email to setup.')
      return
    }

    // 2. Fetch completed campaigns
    const { data: campaigns } = await (supabase as any).from('campaigns')
      .select('*')
      .eq('user_id', (profileData as any).user_id)
      .eq('status', 'completed')
      .order('updated_at', { ascending: false })
      .limit(5)

    if (!campaigns || campaigns.length === 0) {
      await sendMessage(chatId, 'ℹ️ No completed campaigns found yet. Create one with /campaign.')
      return
    }

    interface CampaignRow {
      title: string;
      video_url: string | null;
      updated_at: string;
    }

    let message = '✅ *Recent Results:*\n\n'
    campaigns.forEach((c: CampaignRow) => {
      message += `🎬 *${c.title}*\n`
      if (c.video_url) {
        message += `[Watch Video](${c.video_url})\n`
      } else {
        message += `(Video URL missing)\n`
      }
      message += `Completed: ${new Date(c.updated_at).toLocaleDateString()}\n\n`
    })

    await sendMessage(chatId, message)
  } catch (error) {
    logger.error('Error in handleResults', error instanceof Error ? error : new Error(String(error)))
    await sendMessage(chatId, '❌ Error fetching results from database.')
  }
}
