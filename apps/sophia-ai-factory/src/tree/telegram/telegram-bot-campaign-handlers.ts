/**
 * Telegram bot campaign command handlers
 *
 * Handles /campaign, /status, /results commands for campaign management.
 * Uses D1 client exclusively — no Supabase dependency.
 * /campaign now uses FSM multi-step flow (topic → audience → offer → confirm).
 */

import { sendTelegramMessage } from '@/tree/telegram/telegram-client';
import { TelegramFSM, BotState } from '@/tree/telegram/telegram-fsm-state-manager';
import {
  startCampaignFsm,
  handleTopicInput,
  handleAudienceInput,
  handleOfferSelection,
  handleCampaignConfirm,
} from '@/tree/telegram/telegram-bot-campaign-fsm';

export { handleStatus, handleResults } from './telegram-bot-campaign-queries';

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
