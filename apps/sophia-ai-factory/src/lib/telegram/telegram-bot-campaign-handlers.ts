/**
 * Telegram bot campaign command handlers
 *
 * Handles /campaign, /status, /results commands for campaign management.
 */

import { createServerClient } from '@/lib/db/client';
import { inngest } from '@/lib/inngest/client';
import { sendTelegramMessage } from './telegram-client';
import { Database } from '@/lib/supabase/types';
import { Tier } from '@/types';

function getSupabase() {
  return createServerClient();
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

export async function handleCampaign(chatId: string, topic: string) {
  if (!topic) {
      await sendTelegramMessage(chatId, 'Please provide a topic. Usage: `/campaign <topic>`')
      return
  }

  try {
    // 1. Identify user from chatId
    const { data: profileData, error } = await getSupabase()
      .from('user_profiles')
      .select('user_id, subscription_tier')
      .eq('telegram_chat_id', chatId)
      .single()

    const profile = profileData as { user_id: string; subscription_tier: 'free' | 'pro' | 'enterprise' | null } | null;

    if (error || !profile) {
      await sendTelegramMessage(chatId, '❌ Account not linked. Please use `/email your@email.com` to link your account first.')
      return
    }

    // 2. Create Campaign in DB
    const campaignInsert: Database['public']['Tables']['campaigns']['Insert'] = {
        user_id: profile.user_id,
        title: topic,
        topic: topic,
        status: 'queued',
        progress: 0,
        audience: null,
        error_message: null,
        script_content: null,
        video_url: null,
        thumbnail_url: null,
        template_id: null,
        audio_url: null
    };

    const { data: campaignData, error: createError } = await getSupabase().from('campaigns')
      .insert(campaignInsert)
      .select()
      .single()

    const campaign = campaignData as { id: string } | null;

    if (createError || !campaign) {
      await sendTelegramMessage(chatId, '❌ Failed to create campaign. Please try again.')
      return
    }

    // 3. Trigger Inngest Event
    const tier = mapSubscriptionToTier(profile.subscription_tier)

    await inngest.send({
      name: "campaign.created",
      data: {
        campaignId: campaign.id,
        userId: profile.user_id,
        topic: topic,
        audience: "General",
        tier: tier
      }
    })

    await sendTelegramMessage(chatId, `🚀 *Campaign Started!*\n\nTopic: ${topic}\nID: \`${campaign.id.slice(0, 8)}\`\n\nI will notify you when it's ready. Check progress with /status.`)

  } catch {
    await sendTelegramMessage(chatId, '❌ An unexpected error occurred.')
  }
}

export async function handleStatus(chatId: string) {
  try {
    const { data: profileData } = await getSupabase()
      .from('user_profiles')
      .select('user_id')
      .eq('telegram_chat_id', chatId)
      .single()

    const profile = profileData as unknown as { user_id: string } | null;

    if (!profile) {
      await sendTelegramMessage(chatId, '❌ Account not linked. Please use /email to setup.')
      return
    }

    const { data: campaignsData } = await getSupabase().from('campaigns')
      .select('*')
      .eq('user_id', profile.user_id)
      .in('status', ['queued', 'processing_script', 'processing_video'])
      .order('created_at', { ascending: false })
      .limit(5)

    const campaigns = campaignsData as Database['public']['Tables']['campaigns']['Row'][] | null;

    if (!campaigns || campaigns.length === 0) {
      await sendTelegramMessage(chatId, 'ℹ️ No active campaigns running right now.')
      return
    }

    let message = '📊 *Active Campaigns:*\n\n'
    campaigns.forEach((c) => {
      const statusEmoji = c.status === 'queued' ? '⏳' : '⚙️'
      message += `${statusEmoji} *${c.title}*\n`
      message += `Status: ${c.status?.replace('_', ' ')}\n`
      message += `Progress: ${c.progress}%\n\n`
    })

    await sendTelegramMessage(chatId, message)

  } catch {
    await sendTelegramMessage(chatId, '❌ Error fetching status.')
  }
}

export async function handleResults(chatId: string) {
  try {
    const { data: profileData } = await getSupabase()
      .from('user_profiles')
      .select('user_id')
      .eq('telegram_chat_id', chatId)
      .single()

    const profile = profileData as unknown as { user_id: string } | null;

    if (!profile) {
      await sendTelegramMessage(chatId, '❌ Account not linked.')
      return
    }

    const { data: campaignsData } = await getSupabase().from('campaigns')
      .select('*')
      .eq('user_id', profile.user_id)
      .eq('status', 'completed')
      .order('updated_at', { ascending: false })
      .limit(5)

    const campaigns = campaignsData as Database['public']['Tables']['campaigns']['Row'][] | null;

    if (!campaigns || campaigns.length === 0) {
      await sendTelegramMessage(chatId, 'ℹ️ No completed campaigns found.')
      return
    }

    let message = '✅ *Recent Results:*\n\n'
    campaigns.forEach((c) => {
      message += `🎬 *${c.title}*\n`
      if (c.video_url) {
        message += `[Watch Video](${c.video_url})\n`
      } else {
         message += `(Video URL missing)\n`
      }
      message += `Completed: ${new Date(c.updated_at).toLocaleDateString()}\n\n`
    })

    await sendTelegramMessage(chatId, message)

  } catch {
    await sendTelegramMessage(chatId, '❌ Error fetching results.')
  }
}
