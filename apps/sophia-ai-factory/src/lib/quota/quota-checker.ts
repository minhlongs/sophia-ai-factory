/**
 * Quota Checker Service
 *
 * Real-time quota validation with:
 * - Cloudflare KV caching for sub-ms quota checks
 * - Soft/hard threshold enforcement
 * - Overage event logging
 * - Integration with RaaS Gateway
 *
 * @module quota/quota-checker
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/utils/logger-utility';
import { QUOTA_LIMITS } from '@/lib/usage-metering/aggregator';
import type { QuotaLimit, QuotaCheckResult } from '@/lib/usage-metering/types';
import type { QuotaLimitRow } from '@/lib/supabase/types';
import { triggerUsageThresholdAlert } from '@/lib/alerts/realtime-alert-service';

/**
 * Exceeded type for quota check results
 */
type ExceededType = 'hourly_credits' | 'daily_credits' | 'monthly_credits' | 'daily_requests';

/**
 * Cached quota data structure for Cloudflare KV
 */
export interface CachedQuota {
  hourly: number;
  daily: number;
  monthly: number;
  requests: number;
  timestamp?: number;
}

/**
 * Cloudflare KV binding type
 * Bind in wrangler.toml or Vercel environment:
 * kv_namespace = "YOUR_KV_NAMESPACE_ID"
 */
declare global {
  // eslint-disable-next-line no-var
  var KV_KV: {
    get: (key: string) => Promise<CachedQuota | null>;
    set: (key: string, value: CachedQuota, options?: { expirationTtl?: number }) => Promise<void>;
  } | undefined;
}

/**
 * Quota check context from RaaS Gateway
 */
export interface QuotaCheckContext {
  userId: string;
  licenseNonce: string;
  tier: string;
  requestedCredits: number;
  endpoint?: string;
  service?: string;
  action?: string;
  ipAddress?: string;
  userAgent?: string;
  polarCustomerId?: string;
}

/**
 * Quota enforcement configuration
 */
export interface QuotaConfig {
  softWarningThreshold: number;  // 0.8 = 80% - show warning
  enableOverageBilling: boolean; // false = block on exceeded
  failClosed: boolean;           // true = block on exceeded (fail-open if false)
}

export const DEFAULT_CONFIG: QuotaConfig = {
  softWarningThreshold: 0.8,
  enableOverageBilling: false,
  failClosed: true,
};

/**
 * Enhanced quota check result with warning flag
 */
export interface EnhancedQuotaCheckResult extends QuotaCheckResult {
  warningThreshold?: boolean;    // true if >= 80% usage
  softLimitReached?: boolean;    // true if between 80-100%
  overageAllowed?: boolean;      // true if overage billing enabled
}

/**
 * Get KV client (lazy init for Cloudflare Workers)
 */
function getKvClient() {
  // Cloudflare KV binding
  if (typeof globalThis !== 'undefined' && (globalThis as any).KV_KV) {
    return (globalThis as any).KV_KV;
  }

  // Fallback: No KV (disable caching, use DB directly)
  return null;
}

/**
 * Get effective quota limits (DB override > tier defaults)
 *
 * Priority:
 * 1. quota_limits table (custom per-license)
 * 2. QUOTA_LIMITS constant (tier defaults)
 */
export async function getEffectiveQuotaLimits(
  licenseNonce: string,
  tier: string
): Promise<QuotaLimit> {
  try {
    // Check for custom limits
    const supabase = createAdminClient();
    const { data: custom, error } = await supabase
      .from('quota_limits')
      .select('*')
      .eq('license_nonce', licenseNonce)
      .single();

    const defaultLimit = QUOTA_LIMITS[tier] || QUOTA_LIMITS.BASIC;

    if (error || !custom) {
      return defaultLimit;
    }

    // Merge custom with defaults
    return {
      tier,
      dailyCredits: custom.custom_daily_credits ?? defaultLimit.dailyCredits,
      hourlyCredits: custom.custom_hourly_credits ?? defaultLimit.hourlyCredits,
      monthlyCredits: custom.custom_monthly_credits ?? defaultLimit.monthlyCredits,
      dailyRequests: custom.custom_daily_requests ?? defaultLimit.dailyRequests,
    };
  } catch (error) {
    logger.error('[Quota Checker] Error fetching quota limits', error as Error);
    // Fallback to defaults on error
    return QUOTA_LIMITS[tier] || QUOTA_LIMITS.BASIC;
  }
}

/**
 * Get cached usage from KV (fast path)
 * Cache key format: quota:{userId}:{licenseNonce}
 */
async function getCachedUsage(
  userId: string,
  licenseNonce: string
): Promise<CachedQuota | null> {
  const kv = getKvClient();
  if (!kv) return null;

  try {
    const key = `quota:${userId}:${licenseNonce}`;
    const cached = await kv.get(key);
    return cached;
  } catch (error) {
    logger.error('[Quota Checker] KV cache read error', error as Error);
    return null;
  }
}

/**
 * Update cached usage in KV
 * TTL: 1 hour for hourly rolling window
 */
async function updateCachedUsage(
  userId: string,
  licenseNonce: string,
  usage: CachedQuota,
  ttlSeconds: number = 3600
): Promise<void> {
  const kv = getKvClient();
  if (!kv) return;

  try {
    const key = `quota:${userId}:${licenseNonce}`;
    await kv.set(key, usage, { expirationTtl: ttlSeconds });
  } catch (error) {
    logger.error('[Quota Checker] KV cache write error', error as Error);
  }
}

/**
 * Invalidate quota cache (called after usage event ingestion)
 */
export async function invalidateQuotaCache(
  userId: string,
  licenseNonce: string
): Promise<void> {
  const kv = getKvClient();
  if (!kv) return;

  try {
    const key = `quota:${userId}:${licenseNonce}`;
    await kv.set(key, null); // Delete key
  } catch (error) {
    logger.error('[Quota Checker] Cache invalidation error', error as Error);
  }
}

/**
 * Calculate current usage from database
 * Uses rolling time windows: current hour, current day, current month
 */
async function calculateCurrentUsage(
  userId: string,
  licenseNonce: string
): Promise<CachedQuota> {
  const supabase = createAdminClient();
  const now = Math.floor(Date.now() / 1000);

  const hourStart = Math.floor(now / 3600) * 3600;
  const dayStart = Math.floor(now / 86400) * 86400;
  const monthStart = Math.floor(new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000);

  try {
    // Parallel queries for performance
    const [hourlyResult, dailyResult, monthlyResult] = await Promise.all([
      supabase
        .from('usage_events')
        .select('credits_used')
        .eq('user_id', userId)
        .eq('license_nonce', licenseNonce)
        .gte('created_at', hourStart)
        .lt('created_at', hourStart + 3600),

      supabase
        .from('usage_events')
        .select('credits_used')
        .eq('user_id', userId)
        .eq('license_nonce', licenseNonce)
        .gte('created_at', dayStart)
        .lt('created_at', dayStart + 86400),

      supabase
        .from('usage_events')
        .select('credits_used')
        .eq('user_id', userId)
        .eq('license_nonce', licenseNonce)
        .gte('created_at', monthStart),
    ]);

    // Type-safe aggregation with fallback to zero
    const hourlyCredits = (hourlyResult.data ?? []).reduce(
      (sum, row) => sum + (row.credits_used ?? 0),
      0
    );
    const dailyCredits = (dailyResult.data ?? []).reduce(
      (sum, row) => sum + (row.credits_used ?? 0),
      0
    );
    const monthlyCredits = (monthlyResult.data ?? []).reduce(
      (sum, row) => sum + (row.credits_used ?? 0),
      0
    );

    return {
      hourly: hourlyCredits,
      daily: dailyCredits,
      monthly: monthlyCredits,
      requests: dailyResult.data?.length ?? 0,
    };
  } catch (error) {
    logger.error('[Quota Checker] Error calculating usage', error as Error);
    // Return zero usage on error (fail-open)
    return { hourly: 0, daily: 0, monthly: 0, requests: 0 };
  }
}

/**
 * Log overage event for billing reconciliation
 * Structured event for downstream billing systems
 *
 * Phase 7.3: Also triggers real-time alert when threshold breached
 */
export async function logOverageEvent(
  context: QuotaCheckContext & {
    exceededType: string;
    exceededLimit: number;
    exceededCurrent: number;
    exceededBy: number;
  },
  config: QuotaConfig = DEFAULT_CONFIG
): Promise<string | null> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('overage_events')
      .insert({
        user_id: context.userId,
        license_nonce: context.licenseNonce,
        exceeded_type: context.exceededType,
        exceeded_limit: context.exceededLimit,
        exceeded_current: context.exceededCurrent,
        exceeded_by: context.exceededBy,
        requested_credits: context.requestedCredits,
        endpoint: context.endpoint,
        service_name: context.service,
        action: context.action,
        tier_at_exceeded: context.tier,
        billable: config.enableOverageBilling,
        ip_address: context.ipAddress,
        user_agent: context.userAgent,
      })
      .select('id')
      .single();

    if (error) throw error;

    logger.warn('[Quota Checker] Overage event logged', {
      eventId: data?.id,
      userId: context.userId,
      licenseNonce: context.licenseNonce.slice(0, 8) + '...',
      exceededType: context.exceededType,
      exceededBy: context.exceededBy,
      billable: config.enableOverageBilling,
    });

    // Phase 7.3: Trigger real-time alert for threshold breaches
    const thresholdMap: Record<string, number> = {
      hourly_credits: 80,
      daily_credits: 80,
      monthly_credits: 80,
    };

    const baseThreshold = thresholdMap[context.exceededType] || 80;
    const percentage = (context.exceededCurrent / context.exceededLimit) * 100;

    // Trigger alert if >= 80% threshold
    if (percentage >= baseThreshold) {
      await triggerUsageThresholdAlert({
        userId: context.userId,
        licenseNonce: context.licenseNonce,
        tier: context.tier as any,
        threshold: percentage >= 100 ? 100 : percentage >= 90 ? 90 : 80,
        percentage,
        limit: context.exceededLimit,
        currentUsage: context.exceededCurrent,
        exceededType: context.exceededType,
        ipAddress: context.ipAddress,
      }).catch(err => {
        logger.error('[Quota Checker] Failed to trigger real-time alert', err as Error);
      });
    }

    return data?.id ?? null;
  } catch (error) {
    logger.error('[Quota Checker] Failed to log overage event', error as Error);
    // Don't throw - audit logging failure shouldn't block request
    return null;
  }
}

/**
 * Check quota with caching and overage logging
 *
 * Flow:
 * 1. Try KV cache first (fast path)
 * 2. Cache miss → calculate from DB
 * 3. Check soft threshold (80%) → warning flag
 * 4. Check hard limit (100%) → block or log overage
 * 5. Update cache (non-blocking)
 *
 * @returns EnhancedQuotaCheckResult with allowed, remaining, exceeded, warning flags
 */
export async function checkQuotaWithOverage(
  context: QuotaCheckContext,
  config: QuotaConfig = DEFAULT_CONFIG
): Promise<EnhancedQuotaCheckResult> {
  const { userId, licenseNonce, tier, requestedCredits } = context;

  // Get effective limits (DB override or defaults)
  const limits = await getEffectiveQuotaLimits(licenseNonce, tier);

  // Try KV cache first
  let cached = await getCachedUsage(userId, licenseNonce);

  // Cache miss → calculate from DB
  if (!cached) {
    cached = await calculateCurrentUsage(userId, licenseNonce);
    // Update cache (non-blocking, fire-and-forget)
    updateCachedUsage(userId, licenseNonce, cached).catch(() => {});
  }

  // Check each limit
  const checks = [
    { type: 'hourly_credits', current: cached.hourly, limit: limits.hourlyCredits },
    { type: 'daily_credits', current: cached.daily, limit: limits.dailyCredits },
    { type: 'monthly_credits', current: cached.monthly, limit: limits.monthlyCredits },
    { type: 'daily_requests', current: cached.requests, limit: limits.dailyRequests },
  ];

  let warningThreshold = false;
  let softLimitReached = false;
  const softThreshold = limits.hourlyCredits * config.softWarningThreshold;

  // First pass: check warning thresholds
  for (const check of checks) {
    if (check.current >= check.limit * config.softWarningThreshold && check.current < check.limit) {
      warningThreshold = true;
      softLimitReached = true;
    }
  }

  // Second pass: check hard limits
  for (const check of checks) {
    const usageAfter = check.current + requestedCredits;

    // Check if exceeded
    if (usageAfter > check.limit) {
      // Log overage event
      await logOverageEvent({
        ...context,
        exceededType: check.type,
        exceededLimit: check.limit,
        exceededCurrent: check.current,
        exceededBy: usageAfter - check.limit,
      }, config);

      // Return blocked result if fail-closed
      if (config.failClosed && !config.enableOverageBilling) {
        return {
          allowed: false,
          remaining: {
            dailyCredits: Math.max(0, limits.dailyCredits - cached.daily),
            hourlyCredits: Math.max(0, limits.hourlyCredits - cached.hourly),
            dailyRequests: Math.max(0, limits.dailyRequests - cached.requests),
            monthlyCredits: Math.max(0, limits.monthlyCredits - cached.monthly),
          },
          exceeded: {
            type: check.type as ExceededType,
            limit: check.limit,
            current: check.current,
          },
          warningThreshold,
          softLimitReached: false, // Hard limit exceeded, not soft
        };
      }

      // Overage allowed: continue but mark
      if (config.enableOverageBilling) {
        warningThreshold = true; // Show warning even if allowed
      }
    }
  }

  // All checks passed or overage allowed
  return {
    allowed: true,
    remaining: {
      dailyCredits: limits.dailyCredits - cached.daily,
      hourlyCredits: limits.hourlyCredits - cached.hourly,
      dailyRequests: limits.dailyRequests - cached.requests,
      monthlyCredits: limits.monthlyCredits - cached.monthly,
    },
    warningThreshold,
    softLimitReached,
    overageAllowed: config.enableOverageBilling,
  };
}

/**
 * Get quota status for dashboard display
 * Returns full quota breakdown with percentages
 */
export async function getQuotaStatus(
  userId: string,
  licenseNonce: string,
  tier: string
): Promise<{
  usage: { hourly: number; daily: number; monthly: number; requests: number };
  limits: QuotaLimit;
  percentages: { hourly: number; daily: number; monthly: number };
  status: 'ok' | 'warning' | 'critical';
}> {
  const limits = await getEffectiveQuotaLimits(licenseNonce, tier);
  const usage = await calculateCurrentUsage(userId, licenseNonce);

  const percentages = {
    hourly: (usage.hourly / limits.hourlyCredits) * 100,
    daily: (usage.daily / limits.dailyCredits) * 100,
    monthly: (usage.monthly / limits.monthlyCredits) * 100,
  };

  const maxPercent = Math.max(percentages.hourly, percentages.daily, percentages.monthly);
  const status: 'ok' | 'warning' | 'critical' =
    maxPercent >= 100 ? 'critical' :
    maxPercent >= 80 ? 'warning' : 'ok';

  return {
    usage,
    limits,
    percentages,
    status,
  };
}
