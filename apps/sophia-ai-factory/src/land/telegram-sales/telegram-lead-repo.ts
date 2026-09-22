/**
 * Direct Cloudflare D1 persistence repository for Telegram Leads
 * Milestone M2 (Requirement R2)
 * Layer: land (high-level domain service / repository)
 * @module land/telegram-sales/telegram-lead-repo
 */

import { createServerClient, tryCreateServerClient } from '@/seed/db/client';
import type { TelegramLeadRow, LeadStatus, BudgetTier } from '@/seed/types/telegram-sales';
import { logger } from '@/seed/utils/logger-utility';

// In-memory fallback map for unit test runs or transient D1 unavailabilities
const inMemoryLeads = new Map<string, TelegramLeadRow>();

function generateLeadId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `lead_${crypto.randomUUID()}`;
  }
  return `lead_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Upsert a lead in D1 telegram_leads table.
 */
export async function upsertLead(
  lead: Partial<TelegramLeadRow> & { telegram_chat_id: string }
): Promise<TelegramLeadRow> {
  const chatId = lead.telegram_chat_id;
  const existing = await getLeadByChatId(chatId);
  const now = nowIso();

  const record: TelegramLeadRow = {
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

  // Always update in-memory cache
  inMemoryLeads.set(chatId, record);

  const db = await tryCreateServerClient();
  if (db) {
    try {
      await db.from('telegram_leads').upsert({
        id: record.id,
        telegram_chat_id: record.telegram_chat_id,
        username: record.username,
        first_name: record.first_name,
        status: record.status,
        source_utm: record.source_utm,
        campaign_id: record.campaign_id,
        referrer_id: record.referrer_id,
        niche: record.niche,
        budget_tier: record.budget_tier,
        qualification_score: record.qualification_score,
        demo_video_sent_at: record.demo_video_sent_at,
        promo_code_offered: record.promo_code_offered,
        payment_method_selected: record.payment_method_selected,
        checkout_order_id: record.checkout_order_id,
        created_at: record.created_at,
        updated_at: record.updated_at,
      });
    } catch (err) {
      logger.warn('[telegram-lead-repo] D1 upsert failed (falling back to memory)', {
        chatId,
        error: String(err),
      });
    }
  }

  return record;
}

/**
 * Retrieve a lead by Telegram chat ID.
 */
export async function getLeadByChatId(chatId: string): Promise<TelegramLeadRow | null> {
  const mem = inMemoryLeads.get(chatId);
  if (mem) return mem;

  const db = await tryCreateServerClient();
  if (db) {
    try {
      const { data } = await db
        .from('telegram_leads')
        .select('*')
        .eq('telegram_chat_id', chatId)
        .maybeSingle();

      if (data) {
        const lead = data as unknown as TelegramLeadRow;
        inMemoryLeads.set(chatId, lead);
        return lead;
      }
    } catch (err) {
      logger.warn('[telegram-lead-repo] D1 select failed (falling back to memory)', {
        chatId,
        error: String(err),
      });
    }
  }

  return null;
}

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

/**
 * Reset in-memory cache (primarily for tests).
 */
export function _resetMemoryLeads(): void {
  inMemoryLeads.clear();
}
