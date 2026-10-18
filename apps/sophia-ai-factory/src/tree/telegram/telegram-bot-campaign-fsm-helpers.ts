/**
 * Campaign FSM Helpers
 *
 * Shared types, profile lookup, and tier mapping for the campaign FSM.
 *
 * @module telegram/telegram-bot-campaign-fsm-helpers
 */

import { createServerClient } from '@/seed/db/client';
import type { AffiliateProgram, Tier } from '@/seed/types';
import { getProgramById } from '@/tree/affiliates';
import { sendTelegramMessage } from '@/tree/telegram/telegram-client';
import { TelegramFSM, type UserContext } from '@/tree/telegram/telegram-fsm-state-manager';

/** Extended context fields for campaign FSM */
export interface CampaignFsmContext extends UserContext {
  campaignTopic?: string;
  campaignAudience?: string;
  selectedOfferId?: string;
}

export interface UserProfileRow {
  user_id: string;
  subscription_tier: string | null;
}

export function mapTier(raw: string | null): Tier {
  switch (raw?.toUpperCase()) {
    case 'PREMIUM': return 'PREMIUM';
    case 'ENTERPRISE': return 'ENTERPRISE';
    case 'MASTER': return 'MASTER';
    default: return 'BASIC';
  }
}

export async function getUserProfile(chatId: string): Promise<UserProfileRow | null> {
  const db = createServerClient();
  const { data, error } = await db
    .from('user_profiles')
    .select('user_id, subscription_tier')
    .eq('telegram_chat_id', chatId)
    .single();
  if (error) return null;
  return data as UserProfileRow | null;
}

export async function resolveCampaignConfirmInputs(chatId: string): Promise<{
  context: CampaignFsmContext;
  profile: UserProfileRow;
  program: AffiliateProgram;
} | null> {
  const context = (await TelegramFSM.getContext(chatId)) as CampaignFsmContext | null;
  if (!context?.campaignTopic || !context.campaignAudience || !context.selectedOfferId) {
    await sendTelegramMessage(chatId, '❌ Campaign setup incomplete. Please start again with /campaign.');
    return null;
  }

  const profile = await getUserProfile(chatId);
  if (!profile) {
    await sendTelegramMessage(chatId, '❌ Account not linked. Use /email first.');
    return null;
  }

  const program = getProgramById(context.selectedOfferId);
  if (!program) {
    await sendTelegramMessage(chatId, '❌ Selected offer no longer available.');
    return null;
  }

  return { context, profile, program };
}
