/**
 * Telegram Campaign FSM
 *
 * Multi-step state machine for campaign creation via Telegram:
 * awaiting_topic → awaiting_audience → awaiting_offer → awaiting_confirm → creating
 *
 * Uses TelegramFSM from telegram-fsm-state-manager for D1 persistence.
 *
 * @module telegram/telegram-bot-campaign-fsm
 */

import { TelegramFSM, BotState } from '@/tree/telegram/telegram-fsm-state-manager';
import { sendTelegramMessage, sendTelegramMessageWithKeyboard } from '@/tree/telegram/telegram-client';
import { buildOfferKeyboard, formatOfferList, extractOfferIdFromCallback } from '@/tree/telegram/telegram-bot-offer-picker';
// [EXEMPTION: cross-layer] tree→land import. Per `cross-layer-orchestration.md`
// this direction is normally forbidden, but campaign FSM legitimately needs
// affiliate program lookup as a domain primitive (not a workflow). The refactor
// (move affiliate lookup to forest layer + inject into FSM) is tracked as future
// work — see handover-260513-0549-gap-90to100.md CA-2.
import { getTopPrograms, getProgramById } from '@/tree/affiliates';
import { getUserProfile, mapTier, type CampaignFsmContext } from '@/tree/telegram/telegram-bot-campaign-fsm-helpers';
import { insertCampaignWithOffer } from '@/tree/telegram/telegram-bot-campaign-fsm-confirm';

/**
 * Handle /campaign command — enters topic collection step.
 */
export async function startCampaignFsm(chatId: string): Promise<void> {
  await TelegramFSM.setContext(chatId, {
    state: BotState.AWAITING_CAMPAIGN_TOPIC,
    campaignTopic: undefined,
    campaignAudience: undefined,
    selectedOfferId: undefined,
  } as CampaignFsmContext);

  await sendTelegramMessage(
    chatId,
    '🎬 *New Campaign*\n\nWhat topic should the video be about?\n\n_Example: "Weight loss supplements" or "Crypto investing"_'
  );
}

/**
 * Handle text message when FSM is in AWAITING_CAMPAIGN_TOPIC state.
 */
export async function handleTopicInput(chatId: string, topic: string): Promise<void> {
  if (!topic.trim()) {
    await sendTelegramMessage(chatId, '❌ Topic cannot be empty. Please enter the video topic:');
    return;
  }

  await TelegramFSM.mergeContext(chatId, {
    state: BotState.AWAITING_CONFIRMATION,
    campaignTopic: topic.trim(),
  } as CampaignFsmContext);

  await sendTelegramMessage(
    chatId,
    `✅ Topic: *${topic}*\n\nWho is your target audience?\n\n_Example: "Women 25-45 struggling with weight" or "Crypto beginners"_`
  );
}

/**
 * Handle text message when FSM is in audience collection step.
 */
export async function handleAudienceInput(chatId: string, audience: string): Promise<void> {
  if (!audience.trim()) {
    await sendTelegramMessage(chatId, '❌ Audience cannot be empty. Please describe your target audience:');
    return;
  }

  const profile = await getUserProfile(chatId);
  if (!profile) {
    await sendTelegramMessage(chatId, '❌ Account not linked. Use `/email your@email.com` first.');
    return;
  }

  const tier = mapTier(profile.subscription_tier);
  const topPrograms = getTopPrograms(3, tier);

  await TelegramFSM.mergeContext(chatId, {
    state: BotState.DISCOVERING_TRENDS,
    campaignAudience: audience.trim(),
  } as CampaignFsmContext);

  const keyboard = buildOfferKeyboard(topPrograms);
  const text = formatOfferList(topPrograms);
  await sendTelegramMessageWithKeyboard(chatId, text, keyboard);
}

/**
 * Handle callback_query when user taps an offer button.
 */
export async function handleOfferSelection(chatId: string, callbackData: string): Promise<void> {
  const offerId = extractOfferIdFromCallback(callbackData);
  if (!offerId) {
    await sendTelegramMessage(chatId, '❌ Invalid offer selection. Please try again.');
    return;
  }

  const program = getProgramById(offerId);
  if (!program) {
    await sendTelegramMessage(chatId, '❌ Offer not found. Please try again.');
    return;
  }

  await TelegramFSM.mergeContext(chatId, {
    state: BotState.CREATING_CAMPAIGN,
    selectedOfferId: offerId,
  } as CampaignFsmContext);

  await sendTelegramMessage(
    chatId,
    `✅ Selected: *${program.name}*\n💰 Commission: ${program.commission}\n\nConfirm campaign creation?\n\n/confirm — Yes, create it!\n/cancel — Start over`
  );
}

/**
 * Handle /confirm — creates campaign + affiliate offer row + sends Inngest event.
 */
export async function handleCampaignConfirm(chatId: string): Promise<void> {
  const context = await TelegramFSM.getContext(chatId) as CampaignFsmContext | null;

  if (!context?.campaignTopic || !context.campaignAudience || !context.selectedOfferId) {
    await sendTelegramMessage(chatId, '❌ Campaign setup incomplete. Please start again with /campaign.');
    return;
  }

  const profile = await getUserProfile(chatId);
  if (!profile) {
    await sendTelegramMessage(chatId, '❌ Account not linked. Use /email first.');
    return;
  }

  const program = getProgramById(context.selectedOfferId);
  if (!program) {
    await sendTelegramMessage(chatId, '❌ Selected offer no longer available.');
    return;
  }

  await insertCampaignWithOffer(chatId, context, profile, program);
}

