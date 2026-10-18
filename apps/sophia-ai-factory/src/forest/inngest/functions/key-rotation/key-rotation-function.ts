/**
 * @file key-rotation-function.ts
 * @description Inngest function handlers for key rotation re-encryption and 90-day auto-rotation cron
 */

import { inngest } from '@/seed/inngest/client';
import { logger } from '@/seed/utils/logger-utility';
import { logAuditEvent } from '@/tree/audit/logger/audit-query';
import type { RotationPayloadData } from './types';
import {
  reencryptUserApiKeys,
  reencryptProviderCredentials,
  reencryptPlatformCredentials,
  retireOldKeyVersion,
} from './reencrypt-worker';
import { keyRotationCron } from './key-rotation-cron';

export { keyRotationCron };

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
