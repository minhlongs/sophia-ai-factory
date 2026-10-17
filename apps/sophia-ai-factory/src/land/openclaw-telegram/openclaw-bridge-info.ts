/**
 * OpenClaw Bridge info tools: version, tier, quota, affiliate stats, video status, handover.
 * @module land/openclaw-telegram/openclaw-bridge-info
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  callGetQuota,
  callGetAffiliateStats,
  type QuotaInfo,
  type AffiliateStats,
} from './openclaw-bridge-quota-affiliate';

export { callGetQuota, callGetAffiliateStats, type QuotaInfo, type AffiliateStats };

/**
 * Resolve the Sophia user_id paired to a given Telegram chat_id.
 * Returns null when the chat has not been paired yet.
 */
export async function resolveUserIdFromChat(chatId: string): Promise<string | null> {
  try {
    const db = createServerClient();
    const { data } = await db
      .from('telegram_paired_chats')
      .select('paired_by')
      .eq('chat_id', chatId)
      .limit(1)
      .single() as { data: { paired_by: string | null } | null };
    return data?.paired_by ?? null;
  } catch (err) {
    logger.warn('[openclaw-bridge] resolveUserIdFromChat failed', toError(err));
    return null;
  }
}

export interface VersionInfo {
  shortSha: string;
  deployedAt: string;
}

export function callGetVersion(): VersionInfo {
  return {
    shortSha: (process.env.COMMIT_SHA ?? 'unknown').slice(0, 8),
    deployedAt: process.env.DEPLOYED_AT ?? 'unknown',
  };
}

export interface TierInfo {
  tier: string;
  email: string;
  displayName: string;
  locale: string;
}

export async function callGetTier(userId: string): Promise<TierInfo | null> {
  try {
    const db = createServerClient();

    const { data: profileRow } = await db
      .from('user_profiles')
      .select('settings')
      .eq('user_id', userId)
      .single() as { data: { settings: string | null } | null };

    if (!profileRow) return null;

    let settings: Record<string, unknown> = {};
    try {
      if (profileRow.settings) settings = JSON.parse(profileRow.settings) as Record<string, unknown>;
    } catch {
      // malformed JSON — leave empty
    }

    const displayName = (settings?.display_name as string) ?? '';
    const locale = (settings?.locale as string) ?? 'en';

    const { data: userRow } = await db
      .from('user')
      .select('email')
      .eq('id', userId)
      .single() as { data: { email: string } | null };

    const email = userRow?.email ?? '';

    const { data: license } = await db
      .from('raas_licenses')
      .select('tier')
      .eq('created_by', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single() as { data: { tier: string | null } | null };

    const tier = (license?.tier ?? 'BASIC').toUpperCase();

    return { tier, email, displayName, locale };
  } catch (err) {
    logger.warn('[openclaw-bridge] callGetTier failed', toError(err));
    return null;
  }
}
