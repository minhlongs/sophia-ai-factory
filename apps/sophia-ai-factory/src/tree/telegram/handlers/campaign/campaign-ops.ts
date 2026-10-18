import { sendMessage } from '@/tree/telegram/handlers/utils';
import { logger } from '@/seed/utils/logger-utility';
import {
  CampaignRow,
  ACTIVE_STATUSES,
  MAX_CAMPAIGN_LIST_ROWS,
  getCampaignDb,
} from './types-and-db';
import { formatCampaignListMessage } from './campaign-ops-formatter';

/**
 * Handle /campaign list — list all campaigns for the user with their statuses.
 */
export async function handleCampaignList(chatId: string): Promise<void> {
  try {
    const db = getCampaignDb();
    if (!db) {
      await sendMessage(chatId, 'Database unavailable. Please try again later.');
      return;
    }

    const { data: profileData } = await db
      .from('user_profiles')
      .select('user_id')
      .eq('telegram_chat_id', chatId)
      .single();

    const profile = profileData as { user_id: string } | null;
    if (!profile) {
      await sendMessage(chatId, '❌ Account not linked. Please use /email to setup.');
      return;
    }

    const { data: campaignsData } = await db
      .from('campaigns')
      .select('id, title, status, progress, created_at')
      .eq('user_id', profile.user_id)
      .order('created_at', { ascending: false })
      .limit(MAX_CAMPAIGN_LIST_ROWS);

    const campaigns = (campaignsData as CampaignRow[] | null) ?? [];
    if (campaigns.length === 0) {
      await sendMessage(chatId, '📭 No campaigns found. Start one with /campaign <topic>');
      return;
    }

    await sendMessage(chatId, formatCampaignListMessage(campaigns));
  } catch (error) {
    logger.error('Error listing campaigns', error instanceof Error ? error : new Error(String(error)));
    await sendMessage(chatId, '❌ Error fetching campaign list.');
  }
}

/**
 * Handle /campaign cancel <id> — cancel a running campaign.
 * Only active campaigns (queued, processing) can be cancelled.
 */
export async function handleCampaignCancel(chatId: string, campaignId: string): Promise<void> {
  try {
    const db = getCampaignDb();
    if (!db) {
      await sendMessage(chatId, 'Database unavailable. Please try again later.');
      return;
    }

    const { data: profileData } = await db
      .from('user_profiles')
      .select('user_id')
      .eq('telegram_chat_id', chatId)
      .single();

    const profile = profileData as { user_id: string } | null;
    if (!profile) {
      await sendMessage(chatId, '❌ Account not linked. Please use /email to setup.');
      return;
    }

    // Fetch the campaign and verify ownership
    const { data: campaignData } = await db
      .from('campaigns')
      .select('id, title, status')
      .eq('id', campaignId)
      .eq('user_id', profile.user_id)
      .single();

    const campaign = campaignData as { id: string; title: string; status: string } | null;
    if (!campaign) {
      await sendMessage(chatId, `❌ Campaign \`${campaignId.slice(0, 8)}\` not found or does not belong to you.`);
      return;
    }

    // Only active campaigns can be cancelled
    if (!ACTIVE_STATUSES.includes(campaign.status as typeof ACTIVE_STATUSES[number])) {
      await sendMessage(
        chatId,
        `❌ Campaign *${campaign.title}* (status: ${campaign.status}) cannot be cancelled.\n` +
        `Only active campaigns (queued, processing) can be cancelled.`,
      );
      return;
    }

    // Set status to failed with cancellation note
    await db
      .from('campaigns')
      .update({
        status: 'failed',
        error_message: 'Cancelled by user',
        updated_at: new Date().toISOString(),
      })
      .eq('id', campaignId)
      .eq('user_id', profile.user_id);

    await sendMessage(chatId, `✅ Campaign *${campaign.title}* has been cancelled.`);
  } catch (error) {
    logger.error('Error cancelling campaign', error instanceof Error ? error : new Error(String(error)));
    await sendMessage(chatId, '❌ An unexpected error occurred while cancelling the campaign.');
  }
}
