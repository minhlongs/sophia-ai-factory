/**
 * Telegram bot campaign status and results query handlers
 *
 * Handles /status and /results commands for campaign management.
 * Uses D1 client exclusively — no Supabase dependency.
 */

import { createServerClient } from '@/seed/db/client';
import { sendTelegramMessage } from '@/tree/telegram/telegram-client';
import {
  formatActiveCampaignsMessage,
  formatCompletedCampaignsMessage,
  type CampaignD1Row,
} from './telegram-campaign-formatters';

function getDb() {
  return createServerClient();
}

export async function handleStatus(chatId: string) {
  try {
    const { data: profileData } = await getDb().from('user_profiles').select('user_id').eq('telegram_chat_id', chatId).single();
    const profile = profileData as { user_id: string } | null;
    if (!profile) {
      await sendTelegramMessage(chatId, '❌ Account not linked. Please use /email to setup.');
      return;
    }

    const { data: campaignsData } = await getDb().from('campaigns')
      .select('*')
      .eq('user_id', profile.user_id)
      .in('status', ['queued', 'processing_script', 'processing_video'])
      .order('created_at', { ascending: false })
      .limit(5);

    const campaigns = campaignsData as CampaignD1Row[] | null;
    if (!campaigns || campaigns.length === 0) {
      await sendTelegramMessage(chatId, 'ℹ️ No active campaigns running right now.');
      return;
    }

    await sendTelegramMessage(chatId, formatActiveCampaignsMessage(campaigns));
  } catch {
    await sendTelegramMessage(chatId, '❌ Error fetching status.');
  }
}

export async function handleResults(chatId: string) {
  try {
    const { data: profileData } = await getDb().from('user_profiles').select('user_id').eq('telegram_chat_id', chatId).single();
    const profile = profileData as { user_id: string } | null;
    if (!profile) {
      await sendTelegramMessage(chatId, '❌ Account not linked.');
      return;
    }

    const { data: campaignsData } = await getDb().from('campaigns')
      .select('*')
      .eq('user_id', profile.user_id)
      .eq('status', 'completed')
      .order('updated_at', { ascending: false })
      .limit(5);

    const campaigns = campaignsData as CampaignD1Row[] | null;
    if (!campaigns || campaigns.length === 0) {
      await sendTelegramMessage(chatId, 'ℹ️ No completed campaigns found.');
      return;
    }

    await sendTelegramMessage(chatId, formatCompletedCampaignsMessage(campaigns));
  } catch {
    await sendTelegramMessage(chatId, '❌ Error fetching results.');
  }
}
