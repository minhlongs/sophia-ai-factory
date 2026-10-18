/**
 * Record builders and ID/timestamp utilities for Telegram Leads.
 * @module land/telegram-sales/repo/storage-helpers
 */

import type { TelegramLeadRow } from '@/seed/types/telegram-sales';

export function generateLeadId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `lead_${crypto.randomUUID()}`;
  }
  return `lead_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function buildLeadRecord(
  lead: Partial<TelegramLeadRow> & { telegram_chat_id: string },
  existing: TelegramLeadRow | null,
  now: string,
): TelegramLeadRow {
  const chatId = lead.telegram_chat_id;
  return {
    id: existing?.id || lead.id || generateLeadId(),
    telegram_chat_id: chatId,
    username: lead.username !== undefined ? lead.username : existing?.username || null,
    first_name: lead.first_name !== undefined ? lead.first_name : existing?.first_name || null,
    status: lead.status || existing?.status || 'new',
    source_utm: lead.source_utm !== undefined ? lead.source_utm : existing?.source_utm || null,
    campaign_id: lead.campaign_id !== undefined ? lead.campaign_id : existing?.campaign_id || null,
    referrer_id: lead.referrer_id !== undefined ? lead.referrer_id : existing?.referrer_id || null,
    niche: lead.niche !== undefined ? lead.niche : existing?.niche || null,
    budget_tier: lead.budget_tier !== undefined ? lead.budget_tier : existing?.budget_tier || null,
    qualification_score:
      lead.qualification_score !== undefined
        ? lead.qualification_score
        : existing?.qualification_score || 0,
    demo_video_sent_at:
      lead.demo_video_sent_at !== undefined
        ? lead.demo_video_sent_at
        : existing?.demo_video_sent_at || null,
    promo_code_offered:
      lead.promo_code_offered !== undefined
        ? lead.promo_code_offered
        : existing?.promo_code_offered || null,
    payment_method_selected:
      lead.payment_method_selected !== undefined
        ? lead.payment_method_selected
        : existing?.payment_method_selected || null,
    checkout_order_id:
      lead.checkout_order_id !== undefined
        ? lead.checkout_order_id
        : existing?.checkout_order_id || null,
    created_at: existing?.created_at || lead.created_at || now,
    updated_at: now,
  };
}
