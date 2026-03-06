import { TelegramFSM } from '../telegram-fsm-state-manager'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/lib/supabase/types'
import { sendMessage } from './utils'
import { logger } from '../../utils/logger-utility'

const getSupabase = () => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase environment variables not configured')
  }
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

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
    const supabase = getSupabase()

    // 1. Identify user from chatId
    const { data: profileData } = await supabase
      .from('user_profiles')
      .select('user_id')
      .eq('telegram_chat_id', chatId)
      .single()

    if (profileData) {
      // 2. Fetch active campaigns
      const { data: campaigns } = await (supabase as any).from('campaigns')
        .select('*')
        .eq('user_id', (profileData as any).user_id)
        .in('status', ['queued', 'processing_script', 'processing_video'])
        .order('created_at', { ascending: false })
        .limit(3)

      if (campaigns && campaigns.length > 0) {
        message += `*Active Campaigns:*\n`
        campaigns.forEach((c: any) => {
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
