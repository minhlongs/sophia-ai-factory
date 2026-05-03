/**
 * Telegram bot account command handlers
 *
 * Handles /start, /help, /email commands for account linking and onboarding.
 */

import { createServerClient } from '@/seed/db/client';
import { sendTelegramMessage } from './telegram-client';
import { Database, Json } from '@/lib/supabase/types';

function getSupabase() {
  return createServerClient();
}

export async function handleStart(chatId: string) {
  const message = `
👋 *Welcome to Sophia AI Factory Bot!*

I can help you manage your AI video campaigns directly from Telegram.

*First step:* Link your account by sending your email:
\`/email your@email.com\`

*Available commands:*
/start - Show this welcome message
/campaign <topic> - Start a new campaign
/status - Check progress of active campaigns
/results - Get links to your completed videos
/help - Show all commands
`
  await sendTelegramMessage(chatId, message)
}

export async function handleHelp(chatId: string) {
  const message = `
*Sophia AI Factory Bot Commands:*

• /start - Welcome & Setup
• /email <email> - Link your Sophia account
• /campaign <topic> - Create a new video campaign (e.g., "/campaign Eco-friendly gadgets")
• /status - Check status of running campaigns
• /results - View your completed campaigns
• /help - Show this list
`
  await sendTelegramMessage(chatId, message)
}

export async function handleEmail(chatId: string, email: string) {
  try {
    // 1. Find user by email via D1 users table
    const { data: userData, error: userError } = await getSupabase()
      .from('users')
      .select('id, email')
      .eq('email', email.toLowerCase())
      .single()

    if (userError) {
      await sendTelegramMessage(chatId, '❌ Error verifying account. Please try again later.')
      return
    }

    const user = userData as { id: string; email: string } | null

    if (!user) {
      await sendTelegramMessage(chatId, `❌ Could not find an account with email: ${email}\nPlease make sure you have signed up at Sophia AI Factory first.`)
      return
    }

    // 2. Update user profile with chat_id
    const { data: profile } = await getSupabase()
        .from('user_profiles')
        .select('user_id, settings')
        .eq('user_id', user.id)
        .single()

    const existingProfile = profile as { user_id: string; settings: Json } | null;

    if (!existingProfile) {
        const newProfile: Database['public']['Tables']['user_profiles']['Insert'] = {
            user_id: user.id,
            telegram_chat_id: chatId,
            settings: { notifications: { telegram: { enabled: true } } } as Json
        }
        // @ts-expect-error - Known Supabase typing limitation with Json column types
        await getSupabase().from('user_profiles').insert(newProfile)
    } else {
        const currentSettings = (existingProfile.settings as Record<string, unknown>) || {}
        const currentNotifications = (currentSettings['notifications'] as Record<string, unknown>) || {}
        const currentTelegram = (currentNotifications['telegram'] as Record<string, unknown>) || {}

        const newSettings = {
            ...currentSettings,
            notifications: {
                ...currentNotifications,
                telegram: {
                    ...currentTelegram,
                    enabled: true
                }
            }
        } as Json

        await getSupabase().from('user_profiles')
            .update({
                telegram_chat_id: chatId,
                settings: newSettings
            })
            .eq('user_id', user.id)
    }

    await sendTelegramMessage(chatId, `✅ *Success!* Your account (${email}) has been linked.\n\nYou can now create campaigns using:\n\`/campaign Your Topic\``)

  } catch {
    await sendTelegramMessage(chatId, '❌ An unexpected error occurred.')
  }
}

export async function handleUnknown(chatId: string) {
  await sendTelegramMessage(chatId, "❓ Unknown command. Try /help to see available commands.")
}
