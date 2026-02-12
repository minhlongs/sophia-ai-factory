import { TelegramFSM, BotState } from '../telegram-fsm-state-manager'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/lib/supabase/types'
import { backupSessionState } from '../telegram-state-backup-service'
import { sendMessage } from './utils'
import { logger } from '../../utils/logger-utility'

// Lazy initialization of Supabase client
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

    // 1. Find user by email (using Admin API)
    const { data: { users }, error: userError } = await supabase.auth.admin.listUsers()

    if (userError) {
      await sendMessage(chatId, '❌ Error verifying account. Please try again later.')
      return
    }

    const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase())

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
        await supabase.from('user_profiles').insert({
            user_id: user.id,
            telegram_chat_id: chatId,
            settings: { notifications: { telegram: { enabled: true } } }
        })
    } else {
        await supabase.from('user_profiles')
            .update({
                telegram_chat_id: chatId,
            })
            .eq('user_id', user.id)
    }

    // 3. Save to FSM Context
    const context = { email, state: BotState.IDLE }
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
