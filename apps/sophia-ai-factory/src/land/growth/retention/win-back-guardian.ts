/**
 * Customer Retention Win-Back Guardian.
 *
 * Layer: land/growth/retention
 *
 * @module land/growth/retention/win-back-guardian
 */

import { logger } from '@/seed/utils/logger-utility';
import {
  checkWinBackCooldown,
  listAllCustomerHealthMetrics,
} from './activity-aggregator';
import { CHURN_HEALTH_THRESHOLD } from './constants';
import type { CustomerHealthMetrics, WinBackTriggerResult } from './types';
import {
  buildSkippedWinBackResult,
  executeWinBackDelivery,
} from './win-back-outreach-executor';

// Set to track in-flight dispatches within current isolate to prevent intra-process TOCTOU races
const inFlightDispatches = new Set<string>();

/**
 * Dispatches targeted win-back outreach (Resend Email & Founder Telegram Alert).
 */
export async function dispatchWinBackOutreach(
  customer: CustomerHealthMetrics,
  options?: { dryRun?: boolean },
): Promise<WinBackTriggerResult> {
  const nowStr = new Date().toISOString();

  // Guard: Must be at churn risk (< 40)
  // Non-finite or NaN total score is treated as CRITICAL_CHURN_RISK (never masked as healthy)
  if (
    Number.isFinite(customer.totalHealthScore) &&
    customer.totalHealthScore >= CHURN_HEALTH_THRESHOLD
  ) {
    return buildSkippedWinBackResult(customer, nowStr, 'NOT_AT_RISK');
  }

  // Guard: Intra-process in-flight concurrency lock
  if (inFlightDispatches.has(customer.userId)) {
    return buildSkippedWinBackResult(customer, nowStr, 'COOLDOWN_ACTIVE');
  }

  inFlightDispatches.add(customer.userId);

  try {
    // Guard: Anti-spam cooldown in D1 audit log
    const cooldown = await checkWinBackCooldown(customer.userId);
    if (cooldown.inCooldown) {
      return buildSkippedWinBackResult(customer, nowStr, 'COOLDOWN_ACTIVE');
    }

    if (options?.dryRun) {
      return {
        userId: customer.userId,
        userEmail: customer.userEmail,
        emailSent: true,
        telegramNotified: true,
        timestamp: nowStr,
        healthScore: customer.totalHealthScore,
      };
    }

    return await executeWinBackDelivery(customer, nowStr);
  } finally {
    inFlightDispatches.delete(customer.userId);
  }
}

/**
 * Scans all customers, identifies those with health score < 40, and dispatches win-back actions.
 */
export async function scanAndDispatchWinBackTriggers(options?: {
  dryRun?: boolean;
}): Promise<{
  scanned: number;
  atRisk: number;
  dispatched: WinBackTriggerResult[];
}> {
  const customers = await listAllCustomerHealthMetrics({ limit: 100 });
  const dispatched: WinBackTriggerResult[] = [];
  let atRiskCount = 0;

  for (const customer of customers) {
    if (customer.totalHealthScore < CHURN_HEALTH_THRESHOLD) {
      atRiskCount++;
      const result = await dispatchWinBackOutreach(customer, options);
      if (
        result.emailSent ||
        result.telegramNotified ||
        result.skippedReason === 'COOLDOWN_ACTIVE'
      ) {
        dispatched.push(result);
      }
    }
  }

  logger.info('[CustomerRetentionService] Scan complete', {
    scanned: customers.length,
    atRisk: atRiskCount,
    dispatchedCount: dispatched.length,
  });

  return {
    scanned: customers.length,
    atRisk: atRiskCount,
    dispatched,
  };
}
