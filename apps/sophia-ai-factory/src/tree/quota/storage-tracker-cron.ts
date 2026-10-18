/**
 * Storage Tracker — Daily Inngest Cron (Phase 11)
 *
 * Runs at 03:00 UTC daily. For each tenant:
 *   1. Lists R2 objects under prefix `tenants/{tid}/`
 *   2. Sums total bytes (paginated)
 *   3. Upserts tenant_storage_usage
 *
 * @module quota/storage-tracker-cron
 */

import { inngest } from '@/seed/inngest/client';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import {
  getR2,
  listTenantIds,
  sumR2Bytes,
  upsertStorageUsage,
  getVideoCount,
  type StorageBreakdown,
} from './storage-tracker-helpers';

export const storageTrackerDaily = inngest.createFunction(
  {
    id: 'storage-tracker-daily',
    name: 'Daily Storage Usage Tracker',
  },
  { cron: '0 3 * * *' },
  async ({ step }) => {
    // Resolve bindings at function body scope (not inside step.run — D1Database
    // is not JSON-serialisable and cannot be returned from a step checkpoint).
    const db = await getD1();
    if (!db) {
      logger.error('[StorageTracker] D1 binding unavailable — aborting run');
      return { processed: 0, error: 'D1 unavailable' };
    }

    const tenantIds = await step.run('list-tenants', () => listTenantIds(db));

    logger.info('[StorageTracker] Starting daily run', { tenantCount: tenantIds.length });

    const r2 = getR2();

    for (const tenantId of tenantIds) {
      await step.run(`process-tenant-${tenantId}`, async () => {
        let totalBytes = 0;
        let breakdown: StorageBreakdown = { videoBytes: 0, otherBytes: 0 };

        if (r2) {
          try {
            const result = await sumR2Bytes(r2, tenantId);
            totalBytes = result.totalBytes;
            breakdown = result.breakdown;
          } catch (err) {
            logger.error('[StorageTracker] R2 list error', { tenantId, err });
          }
        }

        const videoCount = await getVideoCount(db, tenantId);
        await upsertStorageUsage(db, tenantId, totalBytes, videoCount, breakdown);

        logger.info('[StorageTracker] Tenant processed', {
          tenantId,
          totalBytes,
          videoCount,
        });
      });
    }

    return { processed: tenantIds.length };
  }
);
