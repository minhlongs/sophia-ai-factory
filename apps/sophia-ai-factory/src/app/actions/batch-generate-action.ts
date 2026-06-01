'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getUserTier } from '@/seed/db/get-user-tier';
import { getVideoBucket } from '@/land/video/r2-binding';
import { getErrorMessage } from '@/seed/utils/to-error';
import {
  createBatchJob,
  insertBatchVideos,
  getBatchJob,
  listBatchJobs,
  getBatchVideos,
  updateBatchJobStatus,
  cancelPendingBatchVideos,
} from '@/seed/db/repositories/batch-jobs-repo';
import { parseBatchCsv, parseBatchJson, estimateBatchCost } from '@/land/video/batch-csv-parser';
import { inngest } from '@/forest/inngest/client';
import type { BatchJob, BatchVideo } from '@/seed/db/repositories/batch-jobs-repo';

const BATCH_LIMITS: Record<string, number> = {
  BASIC: 0,
  PREMIUM: 50,
  ENTERPRISE: 200,
  MASTER: 500,
};

type BatchResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

export async function createBatchAction(
  formData: FormData,
): Promise<BatchResult<{ batchId: string; estimatedCostCents: number; videoCount: number }>> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const tier = await getUserTier(user.id);
  const maxBatch = BATCH_LIMITS[tier] ?? 0;
  if (maxBatch === 0) return { success: false, error: 'Batch generation not available on your plan' };

  const file = formData.get('file') as File | null;
  const name = (formData.get('name') as string) ?? 'Batch';

  if (!file) return { success: false, error: 'No file uploaded' };

  try {
    const text = await file.text();
    const isJson = file.name.endsWith('.json');
    const parsed = isJson ? parseBatchJson(text) : parseBatchCsv(text);

    if (parsed.errors.length > 0) {
      return { success: false, error: parsed.errors.join('; ') };
    }

    if (parsed.rows.length === 0) {
      return { success: false, error: 'No valid rows found' };
    }

    if (parsed.rows.length > maxBatch) {
      return { success: false, error: `Batch limit is ${maxBatch} videos on your plan (got ${parsed.rows.length})` };
    }

    const estimatedCostCents = estimateBatchCost(parsed.rows.length);

    // Upload original file to R2
    const r2Key = `batch-inputs/${user.id}/${Date.now()}-${file.name}`;
    const ref = await getVideoBucket();
    if (ref) {
      const buffer = await file.arrayBuffer();
      await ref.bucket.put(r2Key, buffer, {
        httpMetadata: { contentType: file.type || 'text/csv' },
      });
    }

    const batch = await createBatchJob({
      userId: user.id,
      name,
      totalVideos: parsed.rows.length,
      estimatedCostCents,
      inputR2Key: r2Key,
    });

    await insertBatchVideos(
      batch.id,
      parsed.rows.map((r) => ({
        rowIndex: r.rowIndex,
        inputData: JSON.stringify(r),
      })),
    );

    return {
      success: true,
      data: { batchId: batch.id, estimatedCostCents, videoCount: parsed.rows.length },
    };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

export async function startBatchAction(
  batchId: string,
): Promise<BatchResult<{ started: boolean }>> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const batch = await getBatchJob(batchId);
  if (!batch || batch.user_id !== user.id) {
    return { success: false, error: 'Batch not found' };
  }

  if (batch.status !== 'pending') {
    return { success: false, error: `Batch already ${batch.status}` };
  }

  try {
    await updateBatchJobStatus(batchId, 'processing');

    await inngest.send({
      name: 'batch/video.fanout',
      data: { batchId, userId: user.id },
    });

    return { success: true, data: { started: true } };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

export async function getBatchStatusAction(
  batchId: string,
): Promise<BatchResult<{ batch: BatchJob; videos: BatchVideo[] }>> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const batch = await getBatchJob(batchId);
  if (!batch || batch.user_id !== user.id) {
    return { success: false, error: 'Batch not found' };
  }

  const videos = await getBatchVideos(batchId);
  return { success: true, data: { batch, videos } };
}

export async function listBatchesAction(): Promise<BatchResult<BatchJob[]>> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const batches = await listBatchJobs(user.id);
  return { success: true, data: batches };
}

export async function cancelBatchAction(
  batchId: string,
): Promise<BatchResult<{ cancelled: number }>> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const batch = await getBatchJob(batchId);
  if (!batch || batch.user_id !== user.id) {
    return { success: false, error: 'Batch not found' };
  }

  if (batch.status === 'completed' || batch.status === 'cancelled') {
    return { success: false, error: `Batch already ${batch.status}` };
  }

  try {
    const cancelled = await cancelPendingBatchVideos(batchId);
    await updateBatchJobStatus(batchId, 'cancelled', new Date().toISOString());
    return { success: true, data: { cancelled } };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}
