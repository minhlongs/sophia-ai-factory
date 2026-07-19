/**
 * Social Channel Quota Enforcer
 *
 * Module: forest/quota/social-channel-quota
 *
 * Hard-checks tier-based limits for the Social RNN module:
 * - Channel count cap (maxChannels)
 * - Monthly publish cap (maxPublishPerMonth)
 *
 * Uses D1 publishing_jobs table for usage tracking.
 * Follows existing quota-enforcer patterns (Result<T,E>, atomic lock).
 */

import { getD1 } from '@/seed/db/client';
import { getUserTier } from '@/seed/db/get-user-tier';
import { getSocialTierLimits } from '@/seed/config/tiers/tier-social-limits';
import { logger } from '@/seed/utils/logger-utility';
import { success, failure, type Result } from '@/seed/types/result';
import { toError } from '@/seed/utils/to-error';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SocialChannelQuota {
  maxChannels: number;
  maxPublishPerMonth: number;
}

export interface QuotaStatus {
  used: number;
  limit: number;
  percent: number;
  warning: boolean;
}

// ── D1 helpers ────────────────────────────────────────────────────────────────

type PreparedStub = {
  bind: (...vals: unknown[]) => PreparedStub;
  first: <T>() => Promise<T | null>;
  all: <T>() => Promise<{ results: T[] }>;
  run: () => Promise<{ changes: number }>;
};

function getPrepared(sql: string): PreparedStub {
  const d1 = getD1();
  if (!d1) throw new Error('[SocialChannelQuota] D1 not available');
  return d1.prepare(sql) as unknown as PreparedStub;
}

// ── Enforcer ──────────────────────────────────────────────────────────────────

export class SocialChannelQuotaEnforcer {
  /**
   * Check if the user can connect another social channel.
   * Counts channels currently owned by the user regardless of agency status
   * (resource ownership check; agency-scoped gating deferred to Phase 6).
   */
  async canAddChannel(userId: string): Promise<Result<boolean, { code: string; message: string }>> {
    try {
      const tier = await getUserTier(userId);
      const limits = getSocialTierLimits(tier);

      if (!limits.socialEnabled) {
        return failure({
          code: 'SOCIAL_TIER_LOCKED',
          message: 'Upgrade to PREMIUM to use Social Publishing',
        });
      }

      if (limits.maxChannels === Infinity) return success(true);

      const stmt = getPrepared(
        'SELECT COUNT(*) as cnt FROM connected_channels WHERE user_id = ?1 AND status = ?2',
      );
      const row = await stmt.bind(userId, 'active').first<{ cnt: number }>();
      const used = row?.cnt ?? 0;

      if (used >= limits.maxChannels) {
        return failure({
          code: 'SOCIAL_CHANNEL_LIMIT_REACHED',
          message: `Channel limit reached (${limits.maxChannels} max for ${tier} tier). Upgrade to add more.`,
        });
      }

      return success(true);
    } catch (err) {
      logger.error('[SocialChannelQuota] canAddChannel failed', toError(err));
      return failure({ code: 'SOCIAL_QUOTA_ERROR', message: 'Unable to verify channel quota' });
    }
  }

  /**
   * Enforce monthly publish quota — called at publish-action time.
   * Uses atomic INSERT ON CONFLICT DO NOTHING on publishing_jobs (idempotent).
   */
  async enforcePublishQuota(
    userId: string,
    month: Date,
  ): Promise<Result<void, { code: string; message: string }>> {
    try {
      const tier = await getUserTier(userId);
      const limits = getSocialTierLimits(tier);

      if (!limits.socialEnabled) {
        return failure({
          code: 'SOCIAL_TIER_LOCKED',
          message: 'Upgrade to PREMIUM to use Social Publishing',
        });
      }

      if (limits.maxPublishPerMonth === Infinity) return success(undefined);

      // Count jobs created within the month window (UTC)
      const monthStart = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1));
      const stmt = getPrepared(
        `SELECT COUNT(*) as cnt FROM publishing_jobs
         WHERE user_id = ?1 AND created_at >= ?2 AND status != ?3`,
      );
      const row = await stmt.bind(userId, monthStart.toISOString(), 'draft').first<{ cnt: number }>();
      const used = row?.cnt ?? 0;

      if (used >= limits.maxPublishPerMonth) {
        return failure({
          code: 'SOCIAL_PUBLISH_LIMIT_REACHED',
          message: `Monthly publish limit reached (${limits.maxPublishPerMonth}/${tier}). Resets next month.`,
        });
      }

      return success(undefined);
    } catch (err) {
      logger.error('[SocialChannelQuota] enforcePublishQuota failed', toError(err));
      return failure({ code: 'SOCIAL_QUOTA_ERROR', message: 'Unable to verify publish quota' });
    }
  }

  /**
   * Soft-blocking status — used by UI to show warning badge at 80% threshold.
   */
  async getQuotaStatus(userId: string): Promise<QuotaStatus> {
    try {
      const tier = await getUserTier(userId);
      const limits = getSocialTierLimits(tier);

      if (!limits.socialEnabled || limits.maxChannels === 0) {
        return { used: 0, limit: 0, percent: 0, warning: false };
      }

      const stmt = getPrepared(
        'SELECT COUNT(*) as cnt FROM connected_channels WHERE user_id = ?1 AND status = ?2',
      );
      const row = await stmt.bind(userId, 'active').first<{ cnt: number }>();
      const used = row?.cnt ?? 0;
      const limit = limits.maxChannels;
      const percent = limit === Infinity ? 0 : Math.round((used / limit) * 100);
      const warning = !Number.isFinite(limit) ? false : percent >= 80;

      return { used, limit, percent, warning };
    } catch (err) {
      logger.error('[SocialChannelQuota] getQuotaStatus failed', err);
      return { used: 0, limit: 0, percent: 0, warning: false };
    }
  }
}

export const socialChannelQuota = new SocialChannelQuotaEnforcer();
