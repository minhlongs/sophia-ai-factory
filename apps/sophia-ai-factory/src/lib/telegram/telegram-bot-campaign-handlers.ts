/**
 * Telegram bot campaign command handlers
 *
 * Handles /campaign, /status, /results commands for campaign management.
 * Uses D1 client exclusively — no Supabase dependency.
 */

import { createServerClient } from '@/lib/db/client';
import { inngest } from '@/lib/inngest/client';
import { sendTelegramMessage } from './telegram-client';
import { Tier } from '@/types';

// -------------------------------------------------------------------------
// Internal D1 row types (matches 0018-campaigns.sql schema)
// -------------------------------------------------------------------------

interface CampaignD1Row {
  id: string;
  user_id: string;
  title: string;
  topic: string | null;
  audience: string | null;
  status: string | null;
  progress: number | null;
  template_id: string | null;
  script_content: string | null;
  audio_url: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

interface UserProfileD1Row {
  user_id: string;
  subscription_tier: 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER' | null;
  telegram_chat_id: string | null;
}

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

function getDb() {
  return createServerClient();
}

/**
 * Map D1 subscription_tier value → app Tier enum.
 * D1 stores UPPERCASE per project rule (BASIC|PREMIUM|ENTERPRISE|MASTER).
 * Normalise input to UPPERCASE defensively in case of legacy lowercase rows.
 */
function mapSubscriptionToTier(subTier: string | null): Tier {
  switch (subTier?.toUpperCase()) {
    case 'PREMIUM': return 'PREMIUM';
    case 'ENTERPRISE': return 'ENTERPRISE';
    case 'MASTER': return 'MASTER';
    case 'BASIC':
    default: return 'BASIC';
  }
}

// -------------------------------------------------------------------------
// Command handlers
// -------------------------------------------------------------------------

export async function handleCampaign(chatId: string, topic: string) {
  if (!topic) {
    await sendTelegramMessage(chatId, 'Please provide a topic. Usage: `/campaign <topic>`')
    return
  }

  try {
    // 1. Identify user from chatId
    const { data: profileData, error } = await getDb()
      .from('user_profiles')
      .select('user_id, subscription_tier')
      .eq('telegram_chat_id', chatId)
      .single()

    const profile = profileData as UserProfileD1Row | null;

    if (error || !profile) {
      await sendTelegramMessage(chatId, '❌ Account not linked. Please use `/email your@email.com` to link your account first.')
      return
    }

    // 2. Create Campaign in D1
    const campaignInsert: Omit<CampaignD1Row, 'created_at' | 'updated_at'> = {
      id: crypto.randomUUID(),
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
      audio_url: null,
    };

    const { data: campaignData, error: createError } = await getDb().from('campaigns')
      .insert(campaignInsert as unknown as Record<string, unknown>)
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
    const { data: profileData } = await getDb()
      .from('user_profiles')
      .select('user_id')
      .eq('telegram_chat_id', chatId)
      .single()

    const profile = profileData as { user_id: string } | null;

    if (!profile) {
      await sendTelegramMessage(chatId, '❌ Account not linked. Please use /email to setup.')
      return
    }

    const { data: campaignsData } = await getDb().from('campaigns')
      .select('*')
      .eq('user_id', profile.user_id)
      .in('status', ['queued', 'processing_script', 'processing_video'])
      .order('created_at', { ascending: false })
      .limit(5)

    const campaigns = campaignsData as CampaignD1Row[] | null;

    if (!campaigns || campaigns.length === 0) {
      await sendTelegramMessage(chatId, 'ℹ️ No active campaigns running right now.')
      return
    }

    let message = '📊 *Active Campaigns:*\n\n'
    campaigns.forEach((c) => {
      const statusEmoji = c.status === 'queued' ? '⏳' : '⚙️'
      message += `${statusEmoji} *${c.title}*\n`
      message += `Status: ${c.status?.replace('_', ' ')}\n`
      message += `Progress: ${c.progress ?? 0}%\n\n`
    })

    await sendTelegramMessage(chatId, message)

  } catch {
    await sendTelegramMessage(chatId, '❌ Error fetching status.')
  }
}

export async function handleResults(chatId: string) {
  try {
    const { data: profileData } = await getDb()
      .from('user_profiles')
      .select('user_id')
      .eq('telegram_chat_id', chatId)
      .single()

    const profile = profileData as { user_id: string } | null;

    if (!profile) {
      await sendTelegramMessage(chatId, '❌ Account not linked.')
      return
    }

    const { data: campaignsData } = await getDb().from('campaigns')
      .select('*')
      .eq('user_id', profile.user_id)
      .eq('status', 'completed')
      .order('updated_at', { ascending: false })
      .limit(5)

    const campaigns = campaignsData as CampaignD1Row[] | null;

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
