/**
 * Audience segment model — Zod validation + D1 persistence.
 *
 * Layer: tree (domain-reusable). Imports seed only.
 * Timestamps: MILLISECONDS (matches performance_events convention).
 * Business logic returns Result<T,E> — no throw for expected failures.
 *
 * @module tree/audience/audience-segments
 */

import { z } from 'zod/v4';
import { createServerClient } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  AGE_BUCKETS,
  AUDIENCE_PLATFORMS,
  CONTENT_TYPES,
  type AudienceSegment,
} from './types';

export interface SegmentError {
  code: 'INVALID_INPUT' | 'INSERT_FAILED' | 'QUERY_FAILED';
  message: string;
}

/** Input schema for creating a segment. */
export const AudienceSegmentInputSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().min(1).max(120),
  platforms: z.array(z.enum(AUDIENCE_PLATFORMS)).min(1),
  contentTypes: z.array(z.enum(CONTENT_TYPES)).min(1),
  ageBuckets: z.array(z.enum(AGE_BUCKETS)).default([]),
  countries: z.array(z.string().length(2)).default([]),
});

export type AudienceSegmentInput = z.infer<typeof AudienceSegmentInputSchema>;

/** D1 row shape for audience_segments. */
export interface AudienceSegmentRow {
  id: string;
  workspace_id: string;
  name: string;
  platforms: string; // JSON array
  content_types: string; // JSON array
  age_buckets: string; // JSON array
  countries: string; // JSON array
  created_at: number;
  updated_at: number;
}

function newSegmentId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return `seg_${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

/** Parse a D1 row into a typed segment. Fails loud on malformed JSON. */
export function parseSegmentRow(row: AudienceSegmentRow): AudienceSegment {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    platforms: JSON.parse(row.platforms) as AudienceSegment['platforms'],
    contentTypes: JSON.parse(row.content_types) as AudienceSegment['contentTypes'],
    ageBuckets: JSON.parse(row.age_buckets) as AudienceSegment['ageBuckets'],
    countries: JSON.parse(row.countries) as AudienceSegment['countries'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
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
