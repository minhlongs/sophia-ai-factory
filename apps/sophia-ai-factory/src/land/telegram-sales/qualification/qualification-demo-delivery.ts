/**
 * Telegram Qualification Demo Delivery & Founder Notification Helper
 * Layer: land/telegram-sales
 */

import type { BudgetTier, TelegramLeadRow } from '@/seed/types/telegram-sales';
import {
  sendTelegramMessageWithKeyboard,
  sendTelegramVideo,
} from '@/tree/telegram/telegram-client';
import { notifyFounderLeadQualified } from '@/tree/telegram/telegram-admin-notifier';
import {
  buildDemoActionKeyboard,
  buildCheckoutKeyboard,
} from '@/tree/telegram/telegram-lead-keyboards';
import { getSampleVideoForNiche } from '../sample-video-catalog';
import {
  buildSampleVideoCaption,
  buildSolo100OfferMessage,
} from './qualification-messages';

export async function deliverSampleVideoAndOffer(params: {
  chatId: string;
  niche: string;
  budgetTier: BudgetTier;
  score: number;
  lead: TelegramLeadRow | null;
}): Promise<void> {
  const { chatId, niche, budgetTier, score, lead } = params;
  const sampleVideo = getSampleVideoForNiche(niche);
  const caption = buildSampleVideoCaption(sampleVideo);

  const sentVideo = await sendTelegramVideo(chatId, sampleVideo.videoUrl, {
    caption,
    supports_streaming: true,
    reply_markup: buildDemoActionKeyboard(sampleVideo.videoUrl),
  });

  if (!sentVideo) {
    await sendTelegramMessageWithKeyboard(
      chatId,
      caption + `\n\n🔗 Xem video tại: ${sampleVideo.videoUrl}`,
      buildDemoActionKeyboard(sampleVideo.videoUrl),
    );
  }

  await sendTelegramMessageWithKeyboard(
    chatId,
    buildSolo100OfferMessage(),
    buildCheckoutKeyboard(),
  );

  if (score >= 70 && lead) {
    await notifyFounderLeadQualified({
      chatId,
      firstName: lead.first_name || 'Khách tiềm năng',
      username: lead.username || undefined,
      niche,
      budgetTier,
      leadScore: score,
      sourceUtm: lead.source_utm || undefined,
      campaignId: lead.campaign_id || undefined,
    });
  }
}
