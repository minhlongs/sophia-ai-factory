/**
 * Telegram Sales Qualification Types
 * Layer: land/telegram-sales
 */

import type { BudgetTier } from '@/seed/types/telegram-sales';

export type { BudgetTier };

export interface ParsedStartPayload {
  campaignId: string | null;
  referrerId: string | null;
  preferredNiche: string | null;
  isSolo100: boolean;
}
