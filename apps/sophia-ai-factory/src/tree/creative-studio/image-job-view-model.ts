/**
 * View models mapping raw image-job rows into the shape the workspace renders.
 *
 * Kept free of React and of D1 so it can be unit-tested directly and reused
 * by the fixture states.
 *
 * @module tree/creative-studio/image-job-view-model
 */

import type { ImageJobRow } from './image-job-queries';
import {
  imageJobStage,
  normalizeImageJobStatus,
  type ImageJobStage,
  type ImageJobStatus,
  type ImageJobView,
} from './image-job-status';

export type { ImageJobStage, ImageJobStatus, ImageJobView };

/**
 * A history read that failed, so the workspace can say so instead of showing
 * an empty state that reads as "you have no images yet".
 */
export interface ImageJobListError {
  loadFailed: true;
}

export type ImageJobListResult =
  | { loadFailed: false; jobs: ImageJobView[] }
  | ImageJobListError;

/** Read the list, reporting a failure rather than silently returning nothing. */
export async function loadImageJobsForView(
  read: () => Promise<ImageJobView[]>,
): Promise<ImageJobListResult> {
  try {
    return { loadFailed: false, jobs: await read() };
  } catch {
    return { loadFailed: true };
  }
}

/** Model option offered in the workspace brief, with its tier gate reason. */
export interface ModelOption {
  id: string;
  /** True when the current tier may select this model. */
  allowed: boolean;
}

/** Rows to workspace view models, newest first. */
export function normaliseImageJobsForView(rows: ImageJobRow[]): ImageJobView[] {
  return rows.map((row) => {
    const status = normalizeImageJobStatus(row.status);
    return {
      id: row.id,
      status,
      stage: imageJobStage(status),
      prompt: row.prompt ?? '',
      model: row.model,
      resultUrl: row.result_url,
      thumbnailUrl: row.thumbnail_url,
      createdAt: row.created_at,
      completedAt: row.completed_at,
    };
  });
}
