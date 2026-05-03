/**
 * Campaign FSM Confirm Step
 *
 * Handles the final confirmation step: D1 inserts + Inngest event.
 *
 * @module telegram/telegram-bot-campaign-fsm-confirm
 */

import { createServerClient } from '@/seed/db/client';
import { inngest } from '@/forest/inngest/client';
import { generateShortCode } from '@/lib/affiliate-shortlink/short-code-generator';
import { logger } from '@/seed/utils/logger-utility';
import { sendTelegramMessage } from '@/tree/telegram/telegram-client';
import { TelegramFSM } from '@/tree/telegram/telegram-fsm-state-manager';
import { mapTier, type CampaignFsmContext } from '@/tree/telegram/telegram-bot-campaign-fsm-helpers';
import type { AffiliateProgram } from '@/seed/types';

/**
 * Performs D1 inserts (campaign + affiliate_offers_selected) and fires Inngest event.
 */
export async function insertCampaignWithOffer(
  chatId: string,
  context: CampaignFsmContext,
  profile: { user_id: string; subscription_tier: string | null },
  program: AffiliateProgram
): Promise<void> {
  const db = createServerClient();
  const campaignId = crypto.randomUUID();
  const tier = mapTier(profile.subscription_tier);

  const { error: campaignError } = await db.from('campaigns').insert({
    id: campaignId,
    user_id: profile.user_id,
    title: context.campaignTopic,
    topic: context.campaignTopic,
    audience: context.campaignAudience,
    status: 'queued',
    progress: 0,
  });

  if (campaignError) {
    logger.warn('campaign_fsm_insert_error', { chatId, error: String(campaignError) });
    await sendTelegramMessage(chatId, '❌ Failed to create campaign. Please try again.');
    return;
  }

  let shortCode = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    const candidate = generateShortCode();
    const { error: insertError } = await db.from('affiliate_offers_selected').insert({
      campaign_id: campaignId,
      user_id: profile.user_id,
      offer_id: program.id,
      offer_name: program.name,
      affiliate_link: program.link,
      short_code: candidate,
      network: 'clickbank',
      // TODO(M5): source actual commission % from network API — program.epc is EPC not commission rate
      commission_rate: null,
    });
    if (!insertError) { shortCode = candidate; break; }
    if (attempt === 2) logger.warn('affiliate_offer_insert_failed_all_attempts', { campaignId });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sophia.agencyos.network';
  const shortUrl = shortCode ? `${appUrl}/r/${shortCode}` : '';

  try {
    await inngest.send({
      name: 'campaign.created',
      data: { campaignId, userId: profile.user_id, topic: context.campaignTopic ?? '', audience: context.campaignAudience ?? '', tier },
    });
  } catch (err) {
    logger.warn('inngest_send_failed', { campaignId, error: String(err) });
  }

  await TelegramFSM.clearContext(chatId);

  const shortLinkLine = shortUrl ? `\n🔗 Affiliate link: ${shortUrl}` : '';
  await sendTelegramMessage(
    chatId,
    `🚀 *Campaign Started!*\n\nTopic: ${context.campaignTopic}\nOffer: ${program.name}${shortLinkLine}\nID: \`${campaignId.slice(0, 8)}\`\n\nCheck progress with /status.`
  );
}
