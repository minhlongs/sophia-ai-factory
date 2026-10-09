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
  recordWinBackOutreach,
} from './activity-aggregator';
import { CHURN_HEALTH_THRESHOLD } from './constants';
import { sendWinBackEmail } from './email-notifier';
import { sendWinBackTelegramAlert } from './telegram-notifier';
import type { CustomerHealthMetrics, WinBackTriggerResult } from './types';

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
    return {
      userId: customer.userId,
      userEmail: customer.userEmail,
      emailSent: false,
      telegramNotified: false,
      timestamp: nowStr,
      healthScore: customer.totalHealthScore,
      skippedReason: 'NOT_AT_RISK',
    };
  }

  // Guard: Intra-process in-flight concurrency lock
  if (inFlightDispatches.has(customer.userId)) {
    return {
      userId: customer.userId,
      userEmail: customer.userEmail,
      emailSent: false,
      telegramNotified: false,
      timestamp: nowStr,
      healthScore: customer.totalHealthScore,
      skippedReason: 'COOLDOWN_ACTIVE',
    };
  }

  inFlightDispatches.add(customer.userId);

  try {
    // Guard: Anti-spam cooldown in D1 audit log
    const cooldown = await checkWinBackCooldown(customer.userId);
    if (cooldown.inCooldown) {
      return {
        userId: customer.userId,
        userEmail: customer.userEmail,
        emailSent: false,
        telegramNotified: false,
        timestamp: nowStr,
        healthScore: customer.totalHealthScore,
        skippedReason: 'COOLDOWN_ACTIVE',
      };
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

    // Write in-flight reservation record to admin_audit_log BEFORE async network I/O
    await recordWinBackOutreach(customer.userId, {
      status: 'in_flight',
      healthScore: customer.totalHealthScore,
      dispatchedAt: nowStr,
    });

    // 1. Send targeted bilingual win-back email via Resend
    const emailSent = await sendWinBackEmail(customer);

    // 2. Send Telegram alert to founder
    const telegramNotified = await sendWinBackTelegramAlert(customer);

    // 3. Record completion status in audit log
    await recordWinBackOutreach(customer.userId, {
      status: 'completed',
      healthScore: customer.totalHealthScore,
      breakdown: customer.breakdown,
      emailSent,
      telegramNotified,
      dispatchedAt: nowStr,
    });

    return {
      userId: customer.userId,
      userEmail: customer.userEmail,
      emailSent,
      telegramNotified,
      timestamp: nowStr,
      healthScore: customer.totalHealthScore,
    };
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
