/**
 * Approval Timeout Cron — Inngest function
 * Layer: forest (reusable infrastructure orchestrators)
 *
 * Periodically sweeps for pending approvals whose timeout_at has passed and
 * expires them, failing the corresponding awaiting_approval runs with
 * APPROVAL_TIMEOUT. This is the safety net for the in-gate waitForEvent
 * timeout: if a run's wait was lost (e.g. the run was evicted), the cron
 * still reconciles the durable approval + run state.
 *
 * All expiry + run-fail logic lives in tree/mission/agent-run-repo
 * (expireStaleApprovals), which is guarded and idempotent, so overlapping
 * sweeps are safe.
 *
 * Triggered by cron every 15 minutes.
 *
 * @module forest/inngest/functions
 */

import { inngest } from '@/seed/inngest/client';
import { logger } from '@/seed/utils/logger-utility';
import { expireStaleApprovals } from '@/tree/mission/agent-run-repo';

export const approvalTimeoutCron = inngest.createFunction(
  {
    id: 'approval-timeout-sweep',
    retries: 2,
  },
  { cron: '*/15 * * * *' },
  async () => {
    logger.info('approvalTimeoutCron: starting sweep');

    const result = await expireStaleApprovals();
    if (!result.ok) {
      logger.error('approvalTimeoutCron: expireStaleApprovals failed', {
        code: result.error.code,
        message: result.error.message,
      });
      throw new Error(`expireStaleApprovals failed: ${result.error.code} ${result.error.message}`);
    }

    const { expiredCount, expired } = result.value;
    logger.info('approvalTimeoutCron: sweep complete', {
      expiredCount,
      approvalIds: expired.map((e) => e.id),
    });

    return { expiredCount, expired };
  }
);
