import { TelegramFSM, BotState } from '../telegram-fsm-state-manager'
import { createServerClient } from '@/lib/supabase/server'
import { backupSessionState } from '../telegram-state-backup-service'
import { sendMessage } from './utils'
import { logger } from '../../utils/logger-utility'

const getSupabase = () => createServerClient()

/**
 * Handle /email command or email input
 * Links Telegram account with Sophia AI Factory user account
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

  try {
    const supabase = getSupabase()

    // 1. Find user by email via D1 users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email.toLowerCase())
      .single()

    if (userError) {
      await sendMessage(chatId, '❌ Error verifying account. Please try again later.')
      return
    }

    const user = userData as { id: string; email: string } | null

    if (!user) {
      await sendMessage(chatId, `❌ Could not find an account with email: ${email}\nPlease make sure you have signed up at Sophia AI Factory first.`)
      return
    }

    // 2. Update user profile with chat_id
    // First check if profile exists
    const { data: profile } = await supabase
        .from('user_profiles')
        .select('user_id')
        .eq('user_id', user.id)
        .single()

    if (!profile) {
        // Create profile if missing (though it should exist from sign-up)
        await (supabase as any).from('user_profiles').insert({
            user_id: user.id,
            telegram_chat_id: chatId,
            settings: { notifications: { telegram: { enabled: true } } }
        })
    } else {
        await (supabase as any).from('user_profiles')
            .update({
                telegram_chat_id: chatId,
            })
            .eq('user_id', user.id)
    }

    // 3. Save to FSM Context
    const context = { email, state: BotState.IDLE, lastUpdated: Date.now() }
    await TelegramFSM.setContext(chatId, context)

    // 4. Backup to Postgres
    await backupSessionState(chatId, context, 'email_set')

    await sendMessage(
      chatId,
      `✅ *Success!* Your account (${email}) has been linked.\n\nYou can now create campaigns using:\n\`/campaign Your Topic\``
    )
  } catch (error) {
    logger.error('Error in handleEmail', error instanceof Error ? error : new Error(String(error)))
    await sendMessage(chatId, '❌ An unexpected error occurred while linking your account.')
  }
}
