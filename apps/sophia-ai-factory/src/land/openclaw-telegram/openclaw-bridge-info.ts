/**
 * OpenClaw Bridge info tools: version, tier, quota, affiliate stats, video status, handover.
 * @module land/openclaw-telegram/openclaw-bridge-info
 */

import { createServerClient } from '@/seed/db/client';
import { getQuotaStatus } from '@/tree/quota/quota-checker';
import { QUOTA_LIMITS } from '@/seed/config/quota-limits';
import { getRecentConversions } from '@/land/affiliates/dashboard-stats';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

// ─── Chat → User resolver ────────────────────────────────────────────────────

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

// ─── 1. sophia_get_version ───────────────────────────────────────────────────

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

// ─── 2. sophia_get_tier ──────────────────────────────────────────────────────

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

// ─── 3. sophia_get_quota ─────────────────────────────────────────────────────

export interface QuotaInfo {
  tier: string;
  status: string;
  usage: { hourly: number; daily: number; monthly: number; requests: number };
  limits: { hourlyCredits: number; dailyCredits: number; monthlyCredits: number; dailyRequests: number };
  percentages: { hourly: number; daily: number; monthly: number };
}

export async function callGetQuota(userId: string): Promise<QuotaInfo> {
  try {
    const db = createServerClient();
    const { data: license } = await db
      .from('raas_licenses')
      .select('nonce, tier')
      .eq('created_by', userId)
      .eq('is_revoked', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .single() as { data: { nonce: string; tier: string | null } | null };

    if (!license) {
      return {
        tier: 'BASIC',
        usage: { hourly: 0, daily: 0, monthly: 0, requests: 0 },
        limits: QUOTA_LIMITS.BASIC,
        percentages: { hourly: 0, daily: 0, monthly: 0 },
        status: 'ok',
      };
    }

    const tier = (license.tier ?? 'BASIC').toUpperCase();
    const rawStatus = await getQuotaStatus(userId, license.nonce, tier);
    return rawStatus as unknown as QuotaInfo;
  } catch (err) {
    logger.warn('[openclaw-bridge] callGetQuota failed', toError(err));
    return {
      tier: 'unknown',
      status: 'error',
      usage: { hourly: 0, daily: 0, monthly: 0, requests: 0 },
      limits: { hourlyCredits: 0, dailyCredits: 0, monthlyCredits: 0, dailyRequests: 0 },
      percentages: { hourly: 0, daily: 0, monthly: 0 },
    };
  }
}

// ─── 4. sophia_get_affiliate_stats ───────────────────────────────────────────

export interface AffiliateStats {
  count: number;
  conversions: Awaited<ReturnType<typeof getRecentConversions>>;
}

export async function callGetAffiliateStats(
  userId: string,
  limit = 5,
  offset = 0,
): Promise<AffiliateStats> {
  try {
    const conversions = await getRecentConversions(userId, userId, limit, offset);
    return { count: conversions.length, conversions };
  } catch (err) {
    logger.warn('[openclaw-bridge] affiliate stats failed', toError(err), { userId });
    return { count: 0, conversions: [] };
  }
}

// ─── 5. sophia_get_video_status → openclaw-bridge-status.ts ──────────────────
// ─── 6. sophia_get_handover     → openclaw-bridge-status.ts ──────────────────
