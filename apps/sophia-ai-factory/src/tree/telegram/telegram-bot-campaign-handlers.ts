/**
 * Telegram bot campaign command handlers
 *
 * Handles /campaign, /status, /results commands for campaign management.
 * Uses D1 client exclusively — no Supabase dependency.
 * /campaign now uses FSM multi-step flow (topic → audience → offer → confirm).
 */

import { createServerClient } from '@/seed/db/client';
import { sendTelegramMessage } from '@/tree/telegram/telegram-client';
import { TelegramFSM, BotState } from '@/tree/telegram/telegram-fsm-state-manager';
import {
  startCampaignFsm,
  handleTopicInput,
  handleAudienceInput,
  handleOfferSelection,
  handleCampaignConfirm,
} from '@/tree/telegram/telegram-bot-campaign-fsm';
import {
  formatActiveCampaignsMessage,
  formatCompletedCampaignsMessage,
  type CampaignD1Row,
} from './telegram-campaign-formatters';

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
  void _topic; // reserved for future FSM resume
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
    const { data: profileData } = await getDb().from('user_profiles').select('user_id').eq('telegram_chat_id', chatId).single()
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

    await sendTelegramMessage(chatId, formatActiveCampaignsMessage(campaigns))
  } catch {
    await sendTelegramMessage(chatId, '❌ Error fetching status.')
  }
}

export async function handleResults(chatId: string) {
  try {
    const { data: profileData } = await getDb().from('user_profiles').select('user_id').eq('telegram_chat_id', chatId).single()
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

    await sendTelegramMessage(chatId, formatCompletedCampaignsMessage(campaigns))
  } catch {
    await sendTelegramMessage(chatId, '❌ Error fetching results.')
  }
}
