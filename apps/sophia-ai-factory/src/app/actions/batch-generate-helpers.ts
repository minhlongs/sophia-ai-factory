/**
 * File parsing, R2 upload, and D1 creation helpers for batch video generation.
 * @module app/actions/batch-generate-helpers
 */

import { getVideoBucket } from '@/land/video/storage/r2-binding';
import {
  createBatchJob,
  insertBatchVideos,
  getBatchVideos,
} from '@/seed/db/repositories/batch-jobs-repo';
import { parseBatchCsv, parseBatchJson, estimateBatchCost } from '@/land/video/templates/batch-csv-parser';

export const BATCH_LIMITS: Record<string, number> = {
  BASIC: 0,
  PREMIUM: 50,
  ENTERPRISE: 200,
  MASTER: 500,
};

export type BatchResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function processAndInsertBatchFile(params: {
  userId: string;
  maxBatch: number;
  file: File;
  name: string;
}): Promise<BatchResult<{ batchId: string; estimatedCostCents: number; videoCount: number }>> {
  const { userId, maxBatch, file, name } = params;
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
    return {
      success: false,
      error: `Batch limit is ${maxBatch} videos on your plan (got ${parsed.rows.length})`,
    };
  }

  const estimatedCostCents = estimateBatchCost(parsed.rows.length);
  const idempotencyKey = await sha256Hex(
    JSON.stringify({
      userId,
      name,
      fileName: file.name,
      totalVideos: parsed.rows.length,
      content: text,
    }),
  );

  const r2Key = `batch-inputs/${userId}/${Date.now()}-${file.name}`;
  const ref = await getVideoBucket();
  if (ref) {
    const buffer = await file.arrayBuffer();
    await ref.bucket.put(r2Key, buffer, {
      httpMetadata: { contentType: file.type || 'text/csv' },
    });
  }

  const { job: batch, created } = await createBatchJob({
    userId,
    name,
    totalVideos: parsed.rows.length,
    estimatedCostCents,
    inputR2Key: r2Key,
    idempotencyKey,
  });

  if (created || (await getBatchVideos(batch.id)).length === 0) {
    await insertBatchVideos(
      batch.id,
      parsed.rows.map((r) => ({
        rowIndex: r.rowIndex,
        inputData: JSON.stringify(r),
      })),
    );
  }

  return {
    success: true,
    data: { batchId: batch.id, estimatedCostCents, videoCount: parsed.rows.length },
  };
}
