/**
 * Video row location and status polling helpers for Synthetic Fulfillment Runner.
 * @module tree/admin/synthetic/synthetic-video-poller
 */

import { getD1 } from '@/seed/db/client';
import { findByPurchaseId } from '@/seed/db/repositories/videos-repo';
import {
  POLL_INTERVAL_MS,
  type SyntheticTimeline,
  type VideoRow,
} from './types';

export async function locateQueuedVideo(
  purchaseId: string,
  timeline: SyntheticTimeline,
  errors: string[],
): Promise<string | null> {
  try {
    const videoRow = await findByPurchaseId(purchaseId);
    if (videoRow) {
      timeline.queued_at = Date.now();
      if (videoRow.status === 'processing') timeline.processing_at = Date.now();
      if (videoRow.status === 'completed') timeline.completed_at = Date.now();
      return videoRow.id;
    }
    errors.push('No videos row found after triggerOneTimeFulfillment');
    return null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`findByPurchaseId failed: ${msg}`);
    return null;
  }
}

async function handleVideoPollTick(
  videoId: string,
  timeline: SyntheticTimeline,
  errors: string[],
): Promise<boolean> {
  try {
    const _db = await getD1();
    if (!_db) throw new Error('D1 binding not available');
    const row = await _db
      .prepare(`SELECT id, status FROM videos WHERE id = ?1 LIMIT 1`)
      .bind(videoId)
      .first<VideoRow>();

    if (!row) {
      errors.push('Video row disappeared during polling');
      return true;
    }

    if (row.status === 'processing' && timeline.processing_at === null) {
      timeline.processing_at = Date.now();
    }
    if (row.status === 'completed') {
      timeline.completed_at = Date.now();
      return true;
    }
    if (row.status === 'failed' || row.status === 'failed_permanent') {
      errors.push(`Video status: ${row.status}`);
      return true;
    }
    return false;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Poll error: ${msg}`);
    return false;
  }
}

export async function pollVideoStatus(
  videoId: string,
  timeline: SyntheticTimeline,
  deadline: number,
  errors: string[],
): Promise<void> {
  while (Date.now() < deadline && timeline.completed_at === null) {
    await new Promise<void>((r) => setTimeout(r, POLL_INTERVAL_MS));
    const shouldStop = await handleVideoPollTick(videoId, timeline, errors);
    if (shouldStop) break;
  }
}
