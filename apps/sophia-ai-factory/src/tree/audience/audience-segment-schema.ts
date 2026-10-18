/**
 * Audience segment schema, D1 row shape, and row parser.
 *
 * Layer: tree (domain-reusable). Imports seed only.
 * @module tree/audience/audience-segment-schema
 */

import { z } from 'zod/v4';
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
