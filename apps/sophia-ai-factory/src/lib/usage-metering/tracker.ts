/**
 * Usage Metering Tracker
 *
 * Core tracking logic for AI service usage
 */

import { createHash } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/utils/logger-utility';
import type { UsageEventInput, UsageEventDB } from './types';
import { CREDIT_RULES } from './constants';

/**
 * Track a usage event
 *
 * Usage:
 * 1. Before API call: startTimer()
 * 2. Make API call
 * 3. After API call: trackUsage() with results
 *
 * @param event - Usage event data
 */
export async function trackUsage(event: UsageEventInput): Promise<void> {
  try {
    const supabase = createAdminClient();
    const timestamp = event.createdAt ?? Math.floor(Date.now() / 1000);

    const dbEvent: UsageEventDB = {
      user_id: event.userId,
      license_key_hash: event.licenseKeyHash,
      license_nonce: event.licenseNonce,
      service_name: event.service,
      endpoint: event.endpoint,
      action: event.action,
      tokens_input: event.tokensInput ?? 0,
      tokens_output: event.tokensOutput ?? 0,
      credits_used: event.creditsUsed,
      request_id: event.requestId ?? null,
      model_name: event.modelName ?? null,
      tier_at_request: event.tierAtRequest,
      status_code: event.statusCode ?? null,
      error_message: event.errorMessage ?? null,
      response_time_ms: event.responseTimeMs ?? null,
      created_at: timestamp,
    };

    const { error: insertError } = await supabase
      .from('usage_events')
      .insert(dbEvent as any);

    if (insertError) {
      logger.error('[Usage Metering] Failed to track usage: ' + insertError.message);
      // Don't throw - usage tracking should not block main operation
    } else {
      logger.debug('[Usage Metering] Tracked usage', {
        service: event.service,
        action: event.action,
        credits: event.creditsUsed,
      });
    }
  } catch (error) {
    logger.error('[Usage Metering] Critical error tracking usage', error instanceof Error ? error : new Error(String(error)));
    // Silent fail - usage tracking is non-blocking
  }
}

/**
 * Calculate credits based on service rules
 *
 * @param service - Service name (heygen, elevenlabs, openrouter)
 * @param action - Action name (createVideo, textToSpeech, chatCompletion)
 * @param tokensTotal - Total tokens for token-based billing
 * @param tier - User tier for rate multiplier
 */
export function calculateCredits(
  service: string,
  action: string,
  tokensTotal?: number,
  tier: string = 'BASIC'
): number {
  const rules = CREDIT_RULES[service];
  if (!rules) return 1;

  const rule = rules[action] || rules.default;

  let baseCredits: number;

  if (rule.type === 'per-call') {
    baseCredits = rule.credits ?? 1;
  } else if (rule.type === 'per-1k-tokens' && tokensTotal) {
    baseCredits = Math.ceil(tokensTotal / 1000) * (rule.creditsPer1k ?? 1);
  } else {
    baseCredits = 1;
  }

  // Apply tier multiplier (lower tier = pay more)
  const tierMultiplier = getTierMultiplier(tier);
  return Math.ceil(baseCredits / tierMultiplier);
}

/**
 * Get tier rate multiplier
 */
function getTierMultiplier(tier: string): number {
  const multipliers: Record<string, number> = {
    BASIC: 1.0,
    PREMIUM: 0.8,
    ENTERPRISE: 0.6,
    MASTER: 0.5,
  };
  return multipliers[tier] ?? 1.0;
}

/**
 * Generate license key hash
 *
 * @param key - License key string
 */
export function hashLicenseKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/**
 * Start a timer for response time tracking
 */
export function startTimer(): () => number {
  const start = Date.now();
  return () => Date.now() - start;
}
