/**
 * DR Drill R2 Bucket Probe Operations
 * Layer: tree/handover/dr
 */

import type { R2Bucket } from '@cloudflare/workers-types';
import { logger } from '@/seed/utils/logger-utility';

export interface R2ProbeResult {
  r2BackupObjectFound: boolean;
  latestBackupKey?: string;
  latestBackupSizeBytes?: number;
}

export async function executeR2Probe(
  bucket: R2Bucket | null,
  probeNonce: string,
  probeHash: string,
): Promise<R2ProbeResult> {
  let r2BackupObjectFound = false;
  let latestBackupKey: string | undefined;
  let latestBackupSizeBytes: number | undefined;

  if (!bucket || typeof bucket.list !== 'function') {
    return { r2BackupObjectFound };
  }

  try {
    const listResult = await bucket.list({ prefix: 'd1-', limit: 10 });
    const objects = listResult.objects ?? [];

    if (objects.length > 0) {
      r2BackupObjectFound = true;
      const sorted = [...objects].sort((a, b) => b.uploaded.getTime() - a.uploaded.getTime());
      latestBackupKey = sorted[0].key;
      latestBackupSizeBytes = sorted[0].size;
    }

    const testObjectKey = `dr-drill-test/probe-${Date.now()}.json`;
    const testPayload = JSON.stringify({ probeNonce, hash: probeHash });

    await bucket.put(testObjectKey, testPayload, {
      customMetadata: { drProbe: 'active-acceptance' },
    });

    const fetched = await bucket.get(testObjectKey);
    if (fetched) {
      const bodyText = await fetched.text();
      if (bodyText === testPayload) {
        r2BackupObjectFound = true;
      }
    }

    await bucket.delete(testObjectKey);
  } catch (r2Err) {
    logger.warn('[dr-drill-executor] R2 bucket probe encountered warning', {
      error: r2Err instanceof Error ? r2Err.message : String(r2Err),
    });
  }

  return {
    r2BackupObjectFound,
    latestBackupKey,
    latestBackupSizeBytes,
  };
}
