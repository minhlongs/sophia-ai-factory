/**
 * @file key-rotation-cron.ts
 * @description Inngest 90-day auto-rotation cron function for key rotation
 */

import { inngest } from '@/seed/inngest/client';
import { logger } from '@/seed/utils/logger-utility';
import { logAuditEvent } from '@/tree/audit/logger/audit-query';
import { checkLatestKeyVersion, createNewVersionAndFireEvent } from './key-scanner';

export const keyRotationCron = inngest.createFunction(
  { id: 'key-rotation-cron' },
  { cron: '0 0 1 */3 *' },
  async ({ step }) => {
    const latestVersion = await step.run('check-latest-version', async () => {
      return checkLatestKeyVersion();
    });

    if (!latestVersion) {
      await logAuditEvent({
        action: 'key_rotation.cron_skip_no_version',
        userId: 'system',
        metadata: { actorType: 'system' },
      }).catch((err) => {
        logger.error('[key-rotation-cron] Audit log failed', { error: err });
      });

      logger.info('[key-rotation-cron] Skipped — no key versions exist');
      return { skipped: true, reason: 'no_key_version' };
    }

    const ageMs = Date.now() - new Date(latestVersion.created_at).getTime();
    const ageDays = ageMs / 86_400_000;

    if (ageDays < 90) {
      await logAuditEvent({
        action: 'key_rotation.cron_skip_too_young',
        userId: 'system',
        metadata: {
          currentVersion: latestVersion.version,
          ageDays: Math.round(ageDays * 10) / 10,
          actorType: 'system',
        },
      }).catch((err) => {
        logger.error('[key-rotation-cron] Audit log failed', { error: err });
      });

      logger.info('[key-rotation-cron] Skipped — key version too young', {
        version: latestVersion.version,
        ageDays,
      });

      return { skipped: true, reason: 'too_young', version: latestVersion.version, ageDays };
    }

    const rotationResult = await step.run('create-new-version-and-fire-event', async () => {
      return createNewVersionAndFireEvent(latestVersion.version);
    });

    await logAuditEvent({
      action: 'key_rotation.cron_triggered',
      userId: 'system',
      metadata: {
        keyVersion: rotationResult.keyVersion,
        oldVersion: rotationResult.oldVersion,
        ageDays: Math.round(ageDays * 10) / 10,
        actorType: 'system',
      },
    }).catch((err) => {
      logger.error('[key-rotation-cron] Audit log failed', { error: err });
    });

    logger.info('[key-rotation-cron] Rotation triggered', {
      keyVersion: rotationResult.keyVersion,
      oldVersion: rotationResult.oldVersion,
      ageDays,
    });

    return {
      skipped: false,
      keyVersion: rotationResult.keyVersion,
      oldVersion: rotationResult.oldVersion,
      ageDays,
    };
  },
);
