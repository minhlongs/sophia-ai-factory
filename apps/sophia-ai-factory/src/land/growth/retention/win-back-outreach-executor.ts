/**
 * Customer Retention Win-Back Outreach Executor.
 *
 * Layer: land/growth/retention
 *
 * @module land/growth/retention/win-back-outreach-executor
 */

import { recordWinBackOutreach } from './activity-aggregator';
import { sendWinBackEmail } from './email-notifier';
import { sendWinBackTelegramAlert } from './telegram-notifier';
import type { CustomerHealthMetrics, WinBackTriggerResult } from './types';

export function buildSkippedWinBackResult(
  customer: CustomerHealthMetrics,
  timestamp: string,
  skippedReason: 'NOT_AT_RISK' | 'COOLDOWN_ACTIVE',
): WinBackTriggerResult {
  return {
    userId: customer.userId,
    userEmail: customer.userEmail,
    emailSent: false,
    telegramNotified: false,
    timestamp,
    healthScore: customer.totalHealthScore,
    skippedReason,
  };
}

export async function executeWinBackDelivery(
  customer: CustomerHealthMetrics,
  nowStr: string,
): Promise<WinBackTriggerResult> {
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
}
