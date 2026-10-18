/**
 * @file job-status-updater.ts
 * @description Status lifecycle mutation for compute jobs in D1 SQLite.
 * @layer forest
 */

import type { D1Database } from '@cloudflare/workers-types';
import { success, failure, type Result } from '@/seed/types/result';
import type {
  ComputeJobRow,
  ComputeJobRecord,
  ComputeJobStatus,
  SchedulerError,
} from './types';
import { getDatabase, mapRowToRecord } from './time-window-resolver';

/**
 * Updates status of a compute job in D1.
 */
export async function updateJobStatus(
  db: D1Database,
  jobId: string,
  newStatus: ComputeJobStatus
): Promise<Result<ComputeJobRecord, SchedulerError>> {
  const activeDb = getDatabase(db);
  const nowSec = Math.floor(Date.now() / 1000);

  try {
    const updateRes = await activeDb
      .prepare('UPDATE growth_v11_compute_jobs SET status = ?, updated_at = ? WHERE job_id = ?')
      .bind(newStatus, nowSec, jobId)
      .run();

    if ((updateRes.meta?.changes ?? 0) === 0) {
      return failure({
        code: 'JOB_NOT_FOUND',
        message: `Job ${jobId} not found for status update.`,
      });
    }

    const row = await activeDb
      .prepare('SELECT * FROM growth_v11_compute_jobs WHERE job_id = ?')
      .bind(jobId)
      .first<ComputeJobRow>();

    if (!row) {
      return failure({
        code: 'JOB_FETCH_FAILED',
        message: `Updated job ${jobId} could not be retrieved.`,
      });
    }

    return success(mapRowToRecord(row));
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return failure({
      code: 'STATUS_UPDATE_FAILED',
      message: `Failed to update job status: ${errorMsg}`,
    });
  }
}
