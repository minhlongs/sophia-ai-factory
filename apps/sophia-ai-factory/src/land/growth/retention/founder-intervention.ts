/**
 * Customer Retention Founder 1-Click Intervention.
 *
 * Layer: land/growth/retention
 *
 * @module land/growth/retention/founder-intervention
 */

import { addCredits } from '@/tree/mcu/credits-repo';
import { logger } from '@/seed/utils/logger-utility';
import { getCustomerHealthMetrics } from './activity-aggregator';
import {
  sendFounderCareEmail,
  notifyFounderTelegram,
  recordFounderInterventionAuditLog,
} from './founder-intervention-notifications';
import type {
  FounderInterventionRequest,
  FounderInterventionResult,
} from './types';

/**
 * 1-Click Founder Intervention:
 * Grants bonus credits and dispatches immediate high-touch founder outreach.
 */
export async function executeFounderIntervention(
  request: FounderInterventionRequest,
): Promise<FounderInterventionResult> {
  const {
    userId,
    bonusCredits = 500,
    customMessage,
    notifyEmail = true,
    notifyTelegram = true,
    actorUserId = 'founder_admin',
  } = request;
  const nowStr = new Date().toISOString();

  // 1. Fetch user to confirm existence and email
  const customer = await getCustomerHealthMetrics(userId);
  if (!customer) {
    return {
      success: false,
      userId,
      creditsAdded: 0,
      emailSent: false,
      telegramNotified: false,
      message: 'Customer not found',
      timestamp: nowStr,
    };
  }

  // 2. Atomically grant bonus MCU credits
  let creditsAdded = 0;
  if (bonusCredits > 0) {
    const success = await addCredits(
      userId,
      bonusCredits,
      'FOUNDER_WINBACK_BONUS',
      { customMessage, actorUserId, grantedAt: nowStr },
    );
    if (success) {
      creditsAdded = bonusCredits;
    } else {
      logger.error(
        '[CustomerRetentionService] Failed to grant bonus credits',
        { userId, bonusCredits },
      );
    }
  }

  // 3. Send high-touch Founder Support Email if requested
  const emailSent =
    notifyEmail && customer.userEmail
      ? await sendFounderCareEmail({
          userId,
          userEmail: customer.userEmail,
          userName: customer.userName,
          creditsAdded,
          customMessage,
        })
      : false;

  // 4. Send confirmation alert to Founder Telegram
  const telegramNotified = notifyTelegram
    ? await notifyFounderTelegram({
        userId,
        userEmail: customer.userEmail,
        userName: customer.userName,
        creditsAdded,
        emailSent,
        customMessage,
        nowStr,
      })
    : false;

  // 5. Record intervention event to admin_audit_log
  const auditLogId = await recordFounderInterventionAuditLog({
    actorUserId,
    userId,
    creditsAdded,
    customMessage,
    emailSent,
    telegramNotified,
    nowStr,
  });

  // 6. Recalculate health metrics after credit bonus
  const updatedCustomer = await getCustomerHealthMetrics(userId);

  return {
    success: true,
    userId,
    creditsAdded,
    emailSent,
    telegramNotified,
    auditLogId,
    message: `Successfully granted ${creditsAdded} bonus MCU and dispatched intervention`,
    timestamp: nowStr,
    updatedHealthScore: updatedCustomer?.totalHealthScore,
  };
}
