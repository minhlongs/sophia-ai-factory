/**
 * Storage and basic CRUD operations for Telegram Leads.
 * Handles D1 persistence with an in-memory fallback.
 */

import { tryCreateServerClient } from '@/seed/db/client';
import type { TelegramLeadRow } from '@/seed/types/telegram-sales';
import { logger } from '@/seed/utils/logger-utility';
import { generateLeadId, nowIso, buildLeadRecord } from './storage-helpers';

export { generateLeadId, nowIso };

// In-memory fallback map for unit test runs or transient D1 unavailabilities
export const inMemoryLeads = new Map<string, TelegramLeadRow>();

/**
 * Upsert a lead in D1 telegram_leads table.
 */
export async function upsertLead(
  lead: Partial<TelegramLeadRow> & { telegram_chat_id: string },
): Promise<TelegramLeadRow> {
  const chatId = lead.telegram_chat_id;
  const existing = await getLeadByChatId(chatId);
  const record = buildLeadRecord(lead, existing, nowIso());

  // Always update in-memory cache
  inMemoryLeads.set(chatId, record);

  const db = await tryCreateServerClient();
  if (db) {
    try {
      await db.from('telegram_leads').upsert({ ...record });
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
 * Reset in-memory cache (primarily for tests).
 */
export function _resetMemoryLeads(): void {
  inMemoryLeads.clear();
}
