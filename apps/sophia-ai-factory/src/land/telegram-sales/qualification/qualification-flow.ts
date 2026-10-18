/**
 * Telegram Sales Survey & Step Flow
 * Layer: land/telegram-sales
 */

import type { BudgetTier } from '@/seed/types/telegram-sales';
import { sendTelegramMessageWithKeyboard } from '@/tree/telegram/telegram-client';
import {
  buildNicheSelectionKeyboard,
  buildBudgetSelectionKeyboard,
} from '@/tree/telegram/telegram-lead-keyboards';
import {
  upsertLead,
  getLeadByChatId,
  recordSurveyStep,
  recordDemoDelivery,
} from '../telegram-lead-repo';
import { calculateLeadScore, parseStartPayload } from './lead-scorer';
import {
  buildGreetingMessage,
  buildBudgetPromptMessage,
} from './qualification-messages';
import { deliverSampleVideoAndOffer } from './qualification-demo-delivery';

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

  await deliverSampleVideoAndOffer({
    chatId,
    niche,
    budgetTier,
    score,
    lead,
  });
}
