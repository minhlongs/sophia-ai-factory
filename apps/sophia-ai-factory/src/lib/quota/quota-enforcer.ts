/**
 * Quota Enforcer - Hard Usage Limits
 *
 * Real-time quota enforcement with hard blocking:
 * - Runs AFTER JWT/mk_ authentication
 * - BEFORE model inference/execution
 * - Returns 429 with quota_exceeded code when limit exceeded
 * - Syncs with Stripe/Polar usage records as source of truth
 *
 * @module quota/quota-enforcer
 */

import { createServerClient } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger-utility';
import { checkQuotaWithOverage, DEFAULT_CONFIG, getEffectiveQuotaLimits, invalidateQuotaCache } from './quota-checker';
import type { QuotaCheckContext, EnhancedQuotaCheckResult } from './quota-checker';
import { invalidateRealTimeCache } from '@/lib/usage-metering/realtime-tracker';
import { canAccessApi, type DunningState } from '@/lib/billing/dunning-workflow';

/**
 * Quota exceeded error response
 */
export interface QuotaExceededResponse {
  error: string;
  code: 'quota_exceeded' | 'account_suspended';
  message: string;
  exceeded: {
    type: string;
    limit: number;
    current: number;
    requested: number;
  };
  remaining: {
    dailyCredits: number;
    hourlyCredits: number;
    monthlyCredits: number;
    dailyRequests: number;
  };
  retryAfter: number;
  upgradeUrl: string;
  polarCustomerId?: string;
  dunningState?: DunningState;
  dunningReason?: string;
}

// Polar quota sync removed — local DB is source of truth, updated by NOWPayments IPN

/**
 * Create standardized 429 quota exceeded response
 *
 * Response format:
 * - HTTP 429 status code
 * - Retry-After header
 * - X-RateLimit-Remaining header
 * - JSON body with detailed error info
 */
export function createQuotaExceededResponse(
  result: EnhancedQuotaCheckResult,
  context: QuotaCheckContext,
  polarCustomerId?: string
): QuotaExceededResponse {
  const exceededType = result.exceeded?.type || 'unknown';
  const retryAfterSeconds = getRetryAfterSeconds(exceededType);

  const errorMessages: Record<string, string> = {
    hourly_credits: 'Hourly credit limit exceeded',
    daily_credits: 'Daily credit limit exceeded',
    monthly_credits: 'Monthly credit limit exceeded',
    daily_requests: 'Daily request limit exceeded',
  };

  return {
    error: 'quota_exceeded',
    code: 'quota_exceeded',
    message: errorMessages[exceededType] || 'Usage limit exceeded',
    exceeded: {
      type: exceededType,
      limit: result.exceeded?.limit || 0,
      current: result.exceeded?.current || 0,
      requested: context.requestedCredits,
    },
    remaining: result.remaining,
    retryAfter: retryAfterSeconds,
    upgradeUrl: '/dashboard/billing',
    polarCustomerId,
  };
}

/**
 * Create dunning block response for suspended/delinquent accounts
 */
function createDunningBlockResponse(
  dunningCheck: { state: DunningState; reason?: string }
): QuotaExceededResponse {
  return {
    error: 'account_suspended',
    code: 'account_suspended',
    message: dunningCheck.reason || 'Your account has been suspended due to non-payment',
    exceeded: { type: 'dunning_state', limit: 0, current: 0, requested: 0 },
    remaining: { dailyCredits: 0, hourlyCredits: 0, monthlyCredits: 0, dailyRequests: 0 },
    retryAfter: 0,
    upgradeUrl: '/dashboard/billing',
    dunningState: dunningCheck.state,
    dunningReason: dunningCheck.reason,
  };
}

/**
 * Calculate retry-after time based on exceeded type
 */
function getRetryAfterSeconds(exceededType: string): number {
  const now = Math.floor(Date.now() / 1000);

  switch (exceededType) {
    case 'hourly_credits':
      // Reset at next hour
      return 3600 - (now % 3600);
    case 'daily_credits':
    case 'daily_requests':
      // Reset at midnight UTC
      return 86400 - (now % 86400);
    case 'monthly_credits':
      // Reset at next month (approximate 30 days)
      return 30 * 86400;
    default:
      return 3600; // Default 1 hour
  }
}

/**
 * Hard quota enforcement - blocks requests when limit exceeded
 *
 * This is the main entry point for quota enforcement.
 * Call this AFTER authentication, BEFORE business logic.
 *
 * @returns Quota check result or 429 response object
 */
export async function enforceQuota(
  context: QuotaCheckContext,
  config = DEFAULT_CONFIG
): Promise<{ allowed: true; result: EnhancedQuotaCheckResult } | { allowed: false; response: QuotaExceededResponse }> {
  const { licenseNonce, polarCustomerId } = context;

  // NEW: Check dunning state FIRST - block suspended accounts before quota check
  const dunningCheck = await canAccessApi(licenseNonce);
  if (!dunningCheck.allowed) {
    logger.warn('[Quota Enforcer] Block - dunning state', {
      userId: context.userId,
      licenseNonce: licenseNonce.slice(0, 8) + '...',
      dunningState: dunningCheck.state,
      reason: dunningCheck.reason,
    });

    return { allowed: false, response: createDunningBlockResponse(dunningCheck) };
  }

  // Check quota with overage handling (local DB is source of truth via NOWPayments IPN)
  const quotaResult = await checkQuotaWithOverage(context, config);

  // Hard block if not allowed (fail-closed mode)
  if (!quotaResult.allowed && quotaResult.exceeded) {
    const exceededResponse = createQuotaExceededResponse(
      quotaResult,
      context,
      polarCustomerId
    );

    logger.warn('[Quota Enforcer] Hard block - quota exceeded', {
      userId: context.userId,
      licenseNonce: licenseNonce.slice(0, 8) + '...',
      exceededType: quotaResult.exceeded.type,
      retryAfter: exceededResponse.retryAfter,
    });

    return { allowed: false, response: exceededResponse };
  }

  // Invalidate cache after successful quota check (ensures fresh data on next request)
  await invalidateQuotaCache(context.userId, licenseNonce);
  await invalidateRealTimeCache(context.userId, licenseNonce);

  // Allowed with warning
  if (quotaResult.warningThreshold) {
    logger.warn('[Quota Enforcer] Soft warning - approaching quota', {
      userId: context.userId,
      licenseNonce: licenseNonce.slice(0, 8) + '...',
      remaining: quotaResult.remaining,
    });
  }

  return { allowed: true, result: quotaResult };
}

/**
 * Get user ID from license nonce
 */
async function getUserIdFromLicense(licenseNonce: string): Promise<string | null> {
  try {
    const db = createServerClient();
    const { data } = await db
      .from('raas_licenses')
      .select('created_by')
      .eq('nonce', licenseNonce)
      .single() as { data: { created_by: string } | null; error: unknown };

    return data?.created_by || null;
  } catch (error) {
    logger.error('[Quota Enforcer] Error getting user ID from license', error as Error);
    return null;
  }
}

/**
 * Get real-time quota status for a license
 * Includes Polar sync status indicator
 */
export async function getQuotaStatus(
  userId: string,
  licenseNonce: string,
  tier: string,
  polarCustomerId?: string
): Promise<{
  usage: { hourly: number; daily: number; monthly: number; requests: number };
  limits: {
    hourlyCredits: number;
    dailyCredits: number;
    monthlyCredits: number;
    dailyRequests: number;
  };
  percentages: { hourly: number; daily: number; monthly: number };
  status: 'ok' | 'warning' | 'critical';
  polarSynced: boolean;
  lastPolarSync?: string;
}> {
  const limits = await getEffectiveQuotaLimits(licenseNonce, tier);

  // Calculate from local DB
  const db = createServerClient();
  const now = Math.floor(Date.now() / 1000);
  const hourStart = Math.floor(now / 3600) * 3600;
  const dayStart = Math.floor(now / 86400) * 86400;
  const monthStart = Math.floor(new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000);

  const [hourlyResult, dailyResult, monthlyResult] = await Promise.all([
    db
      .from('usage_events')
      .select('credits_used')
      .eq('user_id', userId)
      .eq('license_nonce', licenseNonce)
      .gte('created_at', hourStart),
    db
      .from('usage_events')
      .select('credits_used')
      .eq('user_id', userId)
      .eq('license_nonce', licenseNonce)
      .gte('created_at', dayStart),
    db
      .from('usage_events')
      .select('credits_used')
      .eq('user_id', userId)
      .eq('license_nonce', licenseNonce)
      .gte('created_at', monthStart),
  ]);

  interface UsageEventRow {
  credits_used: number;
}

const usage = {
    hourly: (hourlyResult.data as UsageEventRow[])?.reduce((sum, r) => sum + (r.credits_used || 0), 0) || 0,
    daily: (dailyResult.data as UsageEventRow[])?.reduce((sum, r) => sum + (r.credits_used || 0), 0) || 0,
    monthly: (monthlyResult.data as UsageEventRow[])?.reduce((sum, r) => sum + (r.credits_used || 0), 0) || 0,
    requests: dailyResult.data?.length || 0,
  };

  const percentages = {
    hourly: (usage.hourly / limits.hourlyCredits) * 100,
    daily: (usage.daily / limits.dailyCredits) * 100,
    monthly: (usage.monthly / limits.monthlyCredits) * 100,
  };

  const maxPercent = Math.max(percentages.hourly, percentages.daily, percentages.monthly);
  const status: 'ok' | 'warning' | 'critical' =
    maxPercent >= 100 ? 'critical' :
    maxPercent >= 80 ? 'warning' : 'ok';

  // Check Polar sync status
  let polarSynced = false;
  let lastPolarSync: string | undefined;

  if (polarCustomerId) {
    const { data: syncData } = await db
      .from('usage_events')
      .select('created_at')
      .eq('external_customer_id', polarCustomerId)
      .eq('is_polar_synced', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single() as { data: { created_at: number } | null; error: unknown };

    if (syncData) {
      polarSynced = true;
      lastPolarSync = new Date(syncData.created_at * 1000).toISOString();
    }
  }

  return {
    usage,
    limits,
    percentages,
    status,
    polarSynced,
    lastPolarSync,
  };
}
