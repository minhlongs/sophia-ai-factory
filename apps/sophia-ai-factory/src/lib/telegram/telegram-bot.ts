import { createClient } from '@supabase/supabase-js'
import { inngest } from '@/lib/inngest/client'
import { sendTelegramMessage } from './telegram-client'
import { Database, Json } from '@/lib/supabase/types'
import { Tier } from '@/types'

// Initialize Supabase Admin client
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Helper to map Supabase subscription tier to App Tier
function mapSubscriptionToTier(subTier: 'free' | 'pro' | 'enterprise' | null): Tier {
  switch (subTier) {
    case 'pro': return 'PREMIUM';
    case 'enterprise': return 'ENTERPRISE';
    case 'free':
    default: return 'BASIC';
  }
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
    // 1. Find user by email (using Admin API)
    const { data: { users }, error: userError } = await supabase.auth.admin.listUsers()

    if (userError) {
      console.error('Error listing users:', userError)
      await sendTelegramMessage(chatId, '❌ Error verifying account. Please try again later.')
      return
    }

    const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase())

    if (!user) {
      await sendTelegramMessage(chatId, `❌ Could not find an account with email: ${email}\nPlease make sure you have signed up at Sophia AI Factory first.`)
      return
    }

    // 2. Update user profile with chat_id
    // First check if profile exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (supabase.from('user_profiles') as any)
        .select('user_id, settings')
        .eq('user_id', user.id)
        .single()

    if (!profile) {
        // Create profile if it doesn't exist
        const newProfile = {
            user_id: user.id,
            telegram_chat_id: chatId,
            settings: { notifications: { telegram: { enabled: true } } } as Json
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('user_profiles') as any).insert(newProfile)
    } else {
        // Update existing profile
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const currentSettings = (profile.settings as Record<string, any>) || {}
        const newSettings = {
            ...currentSettings,
            notifications: {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ...(currentSettings.notifications as any || {}),
                telegram: {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    ...(currentSettings.notifications?.telegram as any || {}),
                    enabled: true
                }
            }
        } as Json

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('user_profiles') as any)
            .update({
                telegram_chat_id: chatId,
                settings: newSettings
            })
            .eq('user_id', user.id)
    }

    await sendTelegramMessage(chatId, `✅ *Success!* Your account (${email}) has been linked.\n\nYou can now create campaigns using:\n\`/campaign Your Topic\``)

  } catch (error) {
    console.error('Error in handleEmail:', error)
    await sendTelegramMessage(chatId, '❌ An unexpected error occurred.')
  }
}

export async function handleCampaign(chatId: string, topic: string) {
  if (!topic) {
      await sendTelegramMessage(chatId, 'Please provide a topic. Usage: `/campaign <topic>`')
      return
  }

  try {
    // 1. Identify user from chatId
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile, error } = await (supabase.from('user_profiles') as any)
      .select('user_id, subscription_tier')
      .eq('telegram_chat_id', chatId)
      .single()

    if (error || !profile) {
      await sendTelegramMessage(chatId, '❌ Account not linked. Please use `/email your@email.com` to link your account first.')
      return
    }

    // 2. Create Campaign in DB
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: campaign, error: createError } = await (supabase.from('campaigns') as any)
      .insert({
        user_id: profile.user_id,
        title: topic,
        topic: topic,
        status: 'queued',
        progress: 0
      })
      .select()
      .single()

    if (createError || !campaign) {
      console.error('Error creating campaign:', createError)
      await sendTelegramMessage(chatId, '❌ Failed to create campaign. Please try again.')
      return
    }

    // 3. Trigger Inngest Event
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tier = mapSubscriptionToTier(profile.subscription_tier as any)

    await inngest.send({
      name: "campaign.created",
      data: {
        campaignId: campaign.id,
        userId: profile.user_id,
        topic: topic,
        audience: "General", // Default
        tier: tier
      }
    })

    await sendTelegramMessage(chatId, `🚀 *Campaign Started!*\n\nTopic: ${topic}\nID: \`${campaign.id.slice(0, 8)}\`\n\nI will notify you when it's ready. Check progress with /status.`)

  } catch (error) {
    console.error('Error in handleCampaign:', error)
    await sendTelegramMessage(chatId, '❌ An unexpected error occurred.')
  }
}

export async function handleStatus(chatId: string) {
  try {
    // 1. Identify user
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (supabase.from('user_profiles') as any)
      .select('user_id')
      .eq('telegram_chat_id', chatId)
      .single()

    if (!profile) {
      await sendTelegramMessage(chatId, '❌ Account not linked. Please use /email to setup.')
      return
    }

    // 2. Fetch active campaigns
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: campaigns } = await (supabase.from('campaigns') as any)
      .select('*')
      .eq('user_id', profile.user_id)
      .in('status', ['queued', 'processing_script', 'processing_video'])
      .order('created_at', { ascending: false })
      .limit(5)

    if (!campaigns || campaigns.length === 0) {
      await sendTelegramMessage(chatId, 'ℹ️ No active campaigns running right now.')
      return
    }

    let message = '📊 *Active Campaigns:*\n\n'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    campaigns.forEach((c: any) => {
      const statusEmoji = c.status === 'queued' ? '⏳' : '⚙️'
      message += `${statusEmoji} *${c.title}*\n`
      message += `Status: ${c.status?.replace('_', ' ')}\n`
      message += `Progress: ${c.progress}%\n\n`
    })

    await sendTelegramMessage(chatId, message)

  } catch (error) {
    console.error('Error in handleStatus:', error)
    await sendTelegramMessage(chatId, '❌ Error fetching status.')
  }
}

export async function handleResults(chatId: string) {
  try {
    // 1. Identify user
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (supabase.from('user_profiles') as any)
      .select('user_id')
      .eq('telegram_chat_id', chatId)
      .single()

    if (!profile) {
      await sendTelegramMessage(chatId, '❌ Account not linked.')
      return
    }

    // 2. Fetch completed campaigns
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: campaigns } = await (supabase.from('campaigns') as any)
      .select('*')
      .eq('user_id', profile.user_id)
      .eq('status', 'completed')
      .order('updated_at', { ascending: false })
      .limit(5)

    if (!campaigns || campaigns.length === 0) {
      await sendTelegramMessage(chatId, 'ℹ️ No completed campaigns found.')
      return
    }

    let message = '✅ *Recent Results:*\n\n'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    campaigns.forEach((c: any) => {
      message += `🎬 *${c.title}*\n`
      if (c.video_url) {
        message += `[Watch Video](${c.video_url})\n`
      } else {
         message += `(Video URL missing)\n`
      }
      message += `Completed: ${new Date(c.updated_at).toLocaleDateString()}\n\n`
    })

    await sendTelegramMessage(chatId, message)

  } catch (error) {
    console.error('Error in handleResults:', error)
    await sendTelegramMessage(chatId, '❌ Error fetching results.')
  }
}

export async function handleUnknown(chatId: string) {
  await sendTelegramMessage(chatId, "❓ Unknown command. Try /help to see available commands.")
}
