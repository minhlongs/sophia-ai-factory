/**
 * Telegram bot analytics command handler
 *
 * Handles /analytics command — shows campaign performance snapshot
 * including campaign counts by status, affiliate clicks, conversions, and earnings.
 */

import { tryCreateServerClient } from '@/seed/db/client';
import { sendMessage } from '@/tree/telegram/handlers/utils';
import { logger } from '@/seed/utils/logger-utility';
import {
  type ProfileRow,
  type CampaignStatusRow,
  summarizeCampaignStatuses,
  queryAffiliateAndConversionStats,
  formatAnalyticsMessage,
} from './analytics-query-helper';

// -------------------------------------------------------------------------
// Handler
// -------------------------------------------------------------------------

/**
 * Handle /analytics command — shows campaign performance snapshot.
 */
export async function handleAnalytics(chatId: string): Promise<void> {
  try {
    const db = await tryCreateServerClient();

    if (!db) {
      await sendMessage(chatId, 'Database unavailable. Please try again later.');
      return;
    }

    // 1. Resolve user from chatId
    const { data: profileData } = await db
      .from('user_profiles')
      .select('user_id')
      .eq('telegram_chat_id', chatId)
      .single();

    const profile = profileData as ProfileRow | null;
    if (!profile) {
      await sendMessage(chatId, '❌ Account not linked. Please use /email to setup.');
      return;
    }

    const userId = profile.user_id;

    // 2. Campaign stats — total and by status
    const { data: campaignsData } = (await db
      .from('campaigns')
      .select('status')
      .eq('user_id', userId)) as unknown as { data: CampaignStatusRow[] | null; error: unknown };

    const campaignSummary = summarizeCampaignStatuses(campaignsData ?? []);

    // 3 & 4. Affiliate clicks and conversion stats
    const { affiliateClicks, conversions, totalEarnings } = await queryAffiliateAndConversionStats(
      () => db.unwrap(),
      userId,
    );

    // 5. Build message
    const message = formatAnalyticsMessage({
      ...campaignSummary,
      affiliateClicks,
      conversions,
      totalEarnings,
    });

    await sendMessage(chatId, message);
  } catch (error) {
    logger.error(
      'Error fetching analytics',
      error instanceof Error ? error : new Error(String(error))
    );
    await sendMessage(chatId, '❌ Error fetching analytics.');
  }
}
