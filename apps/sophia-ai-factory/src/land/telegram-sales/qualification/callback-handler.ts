/**
 * Interactive Qualification Callback Handler
 * Layer: land/telegram-sales
 */

import type { BudgetTier } from '@/seed/types/telegram-sales';
import {
  sendTelegramMessage,
  sendTelegramMessageWithKeyboard,
  sendTelegramVideo,
} from '@/tree/telegram/telegram-client';
import {
  buildNicheSelectionKeyboard,
  buildDemoActionKeyboard,
} from '@/tree/telegram/telegram-lead-keyboards';
import { getLeadByChatId } from '../telegram-lead-repo';
import { getSampleVideoForNiche } from '../sample-video-catalog';
import { handleCheckoutTrigger } from './checkout-handler';
import { handleNicheSelection, handleBudgetSelection } from './qualification-flow';

/**
 * Handles interactive qualification callback queries from inline keyboards.
 */
export async function handleQualificationCallback(
  chatId: string,
  callbackData: string,
): Promise<void> {
  if (callbackData.startsWith('lead_niche:')) {
    const niche = callbackData.replace('lead_niche:', '');
    await handleNicheSelection(chatId, niche);
    return;
  }

  if (callbackData.startsWith('lead_budget:')) {
    const budget = callbackData.replace('lead_budget:', '') as BudgetTier;
    await handleBudgetSelection(chatId, budget);
    return;
  }

  if (callbackData.startsWith('checkout_pay:')) {
    const parts = callbackData.split(':');
    const provider = (parts[1] || 'payos') as 'nowpayments' | 'payos';
    const tier = (parts[2] || 'BASIC') as 'BASIC' | 'PREMIUM';
    const promo = parts[3] || 'SOLO100';
    await handleCheckoutTrigger(chatId, provider, tier, promo);
    return;
  }

  if (callbackData === 'lead_action:start_survey') {
    await sendTelegramMessageWithKeyboard(
      chatId,
      '🎯 *Chọn lĩnh vực của bạn để nhận mẫu video phù hợp:*',
      buildNicheSelectionKeyboard(),
    );
    return;
  }

  if (callbackData === 'lead_action:watch_demo') {
    const lead = await getLeadByChatId(chatId);
    const niche = lead?.niche || 'other';
    const sample = getSampleVideoForNiche(niche);

    await sendTelegramVideo(chatId, sample.videoUrl, {
      caption: `🎬 *Video AI Mẫu (${sample.nicheNameVi})*\n\n${sample.descriptionVi}`,
      supports_streaming: true,
      reply_markup: buildDemoActionKeyboard(sample.videoUrl),
    });
    return;
  }

  if (callbackData === 'lead_action:get_starter') {
    await handleCheckoutTrigger(chatId, 'payos', 'BASIC', 'SOLO100');
    return;
  }

  if (callbackData === 'lead_action:chat_founder') {
    await sendTelegramMessage(
      chatId,
      `💬 Bạn có thể nhắn tin trực tiếp với Founder Minh Long tại: https://t.me/minhlongdo\n\nSophia luôn sẵn sàng hỗ trợ bạn 24/7!`,
    );
  }
}
