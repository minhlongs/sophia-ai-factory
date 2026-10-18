/**
 * Audience segment model — Zod validation + D1 persistence.
 *
 * Layer: tree (domain-reusable). Imports seed only.
 * Timestamps: MILLISECONDS (matches performance_events convention).
 * Business logic returns Result<T,E> — no throw for expected failures.
 *
 * @module tree/audience/audience-segments
 */

import { createServerClient } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type { AudienceSegment } from './types';
import {
  AudienceSegmentInputSchema,
  parseSegmentRow,
  type SegmentError,
  type AudienceSegmentInput,
  type AudienceSegmentRow,
} from './audience-segment-schema';

export {
  AudienceSegmentInputSchema,
  parseSegmentRow,
  type SegmentError,
  type AudienceSegmentInput,
  type AudienceSegmentRow,
};

function newSegmentId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return `seg_${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

/** Create and persist a segment. */
export async function createSegment(
  input: AudienceSegmentInput,
): Promise<Result<AudienceSegment, SegmentError>> {
  const parsed = AudienceSegmentInputSchema.safeParse(input);
  if (!parsed.success) {
    return failure({
      code: 'INVALID_INPUT',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    });
  }
  const data = parsed.data;
  const nowMs = Date.now();
  const id = newSegmentId();

  try {
    const db = createServerClient();
    await db
      .prepare(
        `INSERT INTO audience_segments (
           id, workspace_id, name, platforms, content_types,
           age_buckets, countries, created_at, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)`,
      )
      .bind(
        id,
        data.workspaceId,
        data.name,
        JSON.stringify(data.platforms),
        JSON.stringify(data.contentTypes),
        JSON.stringify(data.ageBuckets),
        JSON.stringify(data.countries),
        nowMs,
      )
      .run();
  } catch (err) {
    logger.error('[audience-segments] insert failed', toError(err), { workspaceId: data.workspaceId });
    return failure({ code: 'INSERT_FAILED', message: toError(err).message });
  }

  const segment: AudienceSegment = {
    id,
    workspaceId: data.workspaceId,
    name: data.name,
    platforms: data.platforms,
    contentTypes: data.contentTypes,
    ageBuckets: data.ageBuckets,
    countries: data.countries,
    createdAt: nowMs,
    updatedAt: nowMs,
  };
  logger.info('[audience-segments] Segment created', { id, workspaceId: data.workspaceId });
  return success(segment);
}

/** List all segments for a workspace (empty array when none exist). */
export async function listSegments(
  workspaceId: string,
): Promise<Result<AudienceSegment[], SegmentError>> {
  try {
    const db = createServerClient();
    const { results } = await db
      .prepare('SELECT * FROM audience_segments WHERE workspace_id = ?1 ORDER BY created_at')
      .bind(workspaceId)
      .all<AudienceSegmentRow>();
    return success((results ?? []).map(parseSegmentRow));
  } catch (err) {
    logger.error('[audience-segments] list failed', toError(err), { workspaceId });
    return failure({ code: 'QUERY_FAILED', message: toError(err).message });
  }
}
