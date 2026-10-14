/**
 * Lifecycle operations for Telegram leads (survey steps, demo delivery, checkout, settlement).
 */

import { tryCreateServerClient } from '@/seed/db/client';
import type { TelegramLeadRow, LeadStatus, BudgetTier } from '@/seed/types/telegram-sales';
import { logger } from '@/seed/utils/logger-utility';
import { upsertLead, nowIso, inMemoryLeads } from './storage';

/**
 * Record user's survey responses (niche, budget tier, and updated score).
 */
export async function recordSurveyStep(
  chatId: string,
  step: {
    niche?: string;
    budget_tier?: BudgetTier;
    qualification_score?: number;
    status?: LeadStatus;
  }
): Promise<TelegramLeadRow | null> {
  return upsertLead({
    telegram_chat_id: chatId,
    niche: step.niche,
    budget_tier: step.budget_tier,
    qualification_score: step.qualification_score,
    status: step.status || 'survey_started',
  });
}

/**
 * Record that a sample video demo was delivered to the user.
 */
export async function recordDemoDelivery(
  chatId: string,
  promoCode = 'SOLO100'
): Promise<TelegramLeadRow | null> {
  return upsertLead({
    telegram_chat_id: chatId,
    status: 'demo_sent',
    demo_video_sent_at: nowIso(),
    promo_code_offered: promoCode,
  });
}

/**
 * Record that the user initiated a checkout (selected PayOS or NOWPayments).
 */
export async function recordCheckoutIntent(
  chatId: string,
  provider: 'nowpayments' | 'payos',
  orderId: string
): Promise<TelegramLeadRow | null> {
  return upsertLead({
    telegram_chat_id: chatId,
    status: 'checkout_initiated',
    payment_method_selected: provider,
    checkout_order_id: orderId,
  });
}

/**
 * Mark lead as successfully paid.
 */
export async function markLeadPaid(
  chatId: string,
  orderId?: string
): Promise<TelegramLeadRow | null> {
  return upsertLead({
    telegram_chat_id: chatId,
    status: 'paid',
    checkout_order_id: orderId,
  });
}

/**
 * List high intent leads (score >= minScore).
 */
export async function listHighIntentLeads(minScore = 70): Promise<TelegramLeadRow[]> {
  const db = await tryCreateServerClient();
  if (db) {
    try {
      const { data } = await db
        .from('telegram_leads')
        .select('*')
        .gte('qualification_score', minScore);

      if (data && Array.isArray(data) && data.length > 0) {
        return data as unknown as TelegramLeadRow[];
      }
    } catch (err) {
      logger.warn('[telegram-lead-repo] D1 list failed (falling back to memory)', {
        error: String(err),
      });
    }
  }

  const result: TelegramLeadRow[] = [];
  for (const lead of inMemoryLeads.values()) {
    if (lead.qualification_score >= minScore) {
      result.push(lead);
    }
  }
  return result;
}
