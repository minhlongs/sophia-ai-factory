/**
 * Telegram bot campaign command handlers
 *
 * Handles /campaign, /status, /results commands for campaign management.
 * Uses D1 client exclusively — no Supabase dependency.
 * /campaign now uses FSM multi-step flow (topic → audience → offer → confirm).
 */

import { createServerClient } from '@/lib/db/client';
import { sendTelegramMessage } from './telegram-client';
import { TelegramFSM, BotState } from './telegram-fsm-state-manager';
import {
  startCampaignFsm,
  handleTopicInput,
  handleAudienceInput,
  handleOfferSelection,
  handleCampaignConfirm,
} from './telegram-bot-campaign-fsm';

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

// -------------------------------------------------------------------------
// Command handlers
// -------------------------------------------------------------------------

/**
 * Handle /campaign command — starts multi-step FSM flow (topic → audience → offer → confirm).
 */
export async function handleCampaign(chatId: string, _topic?: string) {
  try {
    await startCampaignFsm(chatId);
  } catch {
    await sendTelegramMessage(chatId, '❌ An unexpected error occurred.');
  }
}

/**
 * Handle incoming text messages for FSM-driven campaign flow.
 * Called from the Telegram webhook handler for non-command messages.
 */
export async function handleFsmTextInput(chatId: string, text: string): Promise<boolean> {
  const context = await TelegramFSM.getContext(chatId);
  if (!context) return false;

  switch (context.state) {
    case BotState.AWAITING_CAMPAIGN_TOPIC:
      await handleTopicInput(chatId, text);
      return true;
    case BotState.AWAITING_CONFIRMATION: // reused for audience step
      await handleAudienceInput(chatId, text);
      return true;
    default:
      return false;
  }
}

/**
 * Handle callback_query for offer selection buttons.
 */
export async function handleOfferCallback(chatId: string, callbackData: string): Promise<boolean> {
  if (!callbackData.startsWith('offer_')) return false;
  await handleOfferSelection(chatId, callbackData);
  return true;
}

/**
 * Handle /confirm command from user.
 */
export async function handleConfirmCommand(chatId: string): Promise<void> {
  try {
    await handleCampaignConfirm(chatId);
  } catch {
    await sendTelegramMessage(chatId, '❌ An unexpected error occurred.');
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
