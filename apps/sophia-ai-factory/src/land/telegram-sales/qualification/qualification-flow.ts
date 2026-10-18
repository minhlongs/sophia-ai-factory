/**
 * Telegram Sales Survey & Step Flow
 * Layer: land/telegram-sales
 */

import type { BudgetTier } from '@/seed/types/telegram-sales';
import {
  sendTelegramMessageWithKeyboard,
  sendTelegramVideo,
} from '@/tree/telegram/telegram-client';
import { notifyFounderLeadQualified } from '@/tree/telegram/telegram-admin-notifier';
import {
  buildNicheSelectionKeyboard,
  buildBudgetSelectionKeyboard,
  buildDemoActionKeyboard,
  buildCheckoutKeyboard,
} from '@/tree/telegram/telegram-lead-keyboards';
import {
  upsertLead,
  getLeadByChatId,
  recordSurveyStep,
  recordDemoDelivery,
} from '../telegram-lead-repo';
import { getSampleVideoForNiche } from '../sample-video-catalog';
import { calculateLeadScore, parseStartPayload } from './lead-scorer';
import {
  buildGreetingMessage,
  buildBudgetPromptMessage,
  buildSampleVideoCaption,
  buildSolo100OfferMessage,
} from './qualification-messages';

/**
 * Handles inbound /start or viral deep-link greeting.
 */
export async function handleLeadGreeting(
  chatId: string,
  firstName = 'bạn',
  startPayload: string | null = null,
  username?: string,
): Promise<void> {
  const parsed = parseStartPayload(startPayload);
  const initialScore = calculateLeadScore(startPayload, parsed.preferredNiche, null);

  await upsertLead({
    telegram_chat_id: chatId,
    first_name: firstName,
    username: username || null,
    source_utm: startPayload,
    campaign_id: parsed.campaignId,
    referrer_id: parsed.referrerId,
    niche: parsed.preferredNiche,
    qualification_score: initialScore,
    status: 'new',
  });

  await sendTelegramMessageWithKeyboard(
    chatId,
    buildGreetingMessage(firstName),
    buildNicheSelectionKeyboard(),
  );
}

/**
 * Handles user selecting an industry niche.
 */
export async function handleNicheSelection(chatId: string, niche: string): Promise<void> {
  const lead = await getLeadByChatId(chatId);
  const score = calculateLeadScore(lead?.source_utm, niche, lead?.budget_tier);

  await recordSurveyStep(chatId, {
    niche,
    qualification_score: score,
    status: 'survey_started',
  });

  await sendTelegramMessageWithKeyboard(
    chatId,
    buildBudgetPromptMessage(),
    buildBudgetSelectionKeyboard(),
  );
}

/**
 * Handles user selecting monthly budget & volume.
 */
export async function handleBudgetSelection(
  chatId: string,
  budgetTier: BudgetTier,
): Promise<void> {
  const lead = await getLeadByChatId(chatId);
  const niche = lead?.niche || 'other';
  const score = calculateLeadScore(lead?.source_utm, niche, budgetTier);

  await recordSurveyStep(chatId, {
    budget_tier: budgetTier,
    qualification_score: score,
    status: 'demo_sent',
  });
  await recordDemoDelivery(chatId, 'SOLO100');

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
