/**
 * Campaign FSM Helpers
 *
 * Shared types, profile lookup, and tier mapping for the campaign FSM.
 *
 * @module telegram/telegram-bot-campaign-fsm-helpers
 */

import { createServerClient } from '@/lib/db/client';
import type { Tier } from '@/types';
import type { UserContext } from './telegram-fsm-state-manager';

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
