/**
 * @file key-rotation-function.ts
 * @description Inngest function handlers for key rotation re-encryption and 90-day auto-rotation cron
 */

import { inngest } from '@/seed/inngest/client';
import { logger } from '@/seed/utils/logger-utility';
import { logAuditEvent } from '@/tree/audit/logger/audit-query';
import type { RotationPayloadData } from './types';
import { checkLatestKeyVersion, createNewVersionAndFireEvent } from './key-scanner';
import {
  reencryptUserApiKeys,
  reencryptProviderCredentials,
  reencryptPlatformCredentials,
  retireOldKeyVersion,
} from './reencrypt-worker';

export const keyRotationReencrypt = inngest.createFunction(
  { id: 'key-rotation-reencrypt', retries: 3 },
  { event: 'key.rotation.requested' },
  async ({ event, step }) => {
    const { keyVersion, oldVersion, reason } = event.data as RotationPayloadData;

    logger.info('[key-rotation] Starting re-encrypt job', { keyVersion, oldVersion });

    await logAuditEvent({
      action: 'key_rotation.reencrypt_start',
      userId: 'system',
      metadata: {
        keyVersion,
        oldVersion,
        reason,
        actorType: 'system',
      },
    }).catch((err) => {
      logger.error('[key-rotation] Audit log (start) failed', { error: err });
    });

    const userApiKeys = await step.run('reencrypt-user-api-keys', async () => {
      return reencryptUserApiKeys(keyVersion, oldVersion);
    });

    const providerCredentials = await step.run('reencrypt-provider-credentials', async () => {
      return reencryptProviderCredentials(keyVersion, oldVersion);
    });

    const platformCredentials = await step.run('reencrypt-platform-credentials', async () => {
      return reencryptPlatformCredentials(keyVersion, oldVersion);
    });

    const total = userApiKeys + providerCredentials + platformCredentials;

    logger.info('[key-rotation] Re-encrypt job complete', {
      keyVersion,
      oldVersion,
      userApiKeys,
      providerCredentials,
      platformCredentials,
      total,
    });

    await step.run('retire-old-version', async () => {
      return retireOldKeyVersion(oldVersion);
    });

    await logAuditEvent({
      action: 'key_rotation.reencrypt_complete',
      userId: 'system',
      metadata: {
        keyVersion,
        oldVersion,
        userApiKeys,
        providerCredentials,
        platformCredentials,
        total,
        reason,
        actorType: 'system',
      },
    }).catch((err) => {
      logger.error('[key-rotation] Audit log (complete) failed', { error: err });
    });

    return {
      keyVersion,
      oldVersion,
      userApiKeys,
      providerCredentials,
      platformCredentials,
      total,
    };
  },
);

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
