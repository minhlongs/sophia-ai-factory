/**
 * Serialization and SQL update builders for YouTube channel configuration.
 * @module land/youtube/channel-config-serializers
 */

import type {
  Cadence,
  ChannelConfig,
  UpdateChannelConfigInput,
} from './channel-config-types';

const CADENCE_POSTS: Record<Cadence, number> = {
  daily: 7,
  'every-2-days': 3,
  '3-per-week': 3,
  weekly: 1,
};

/** Resolve posts-per-week from cadence when not explicitly provided. */
export function postsPerWeekForCadence(cadence: Cadence, explicit?: number): number {
  if (explicit != null && Number.isFinite(explicit) && explicit > 0) return Math.floor(explicit);
  return CADENCE_POSTS[cadence];
}

export function stringifyList(values: readonly string[]): string {
  return JSON.stringify(values ?? []);
}

export function parseList(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((v) => String(v)) : [];
  } catch {
    return [];
  }
}

export function parseMetadata(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function genId(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

type FieldMapper = {
  key: keyof UpdateChannelConfigInput;
  column: string;
  transform?: (val: unknown, input: UpdateChannelConfigInput) => unknown;
};

const UPDATE_FIELD_MAPPERS: readonly FieldMapper[] = [
  { key: 'channelTitle', column: 'channel_title' },
  { key: 'objective', column: 'objective' },
  { key: 'audience', column: 'audience' },
  { key: 'contentPillars', column: 'content_pillars', transform: (v) => stringifyList(v as readonly string[]) },
  { key: 'cadence', column: 'cadence' },
  {
    key: 'postsPerWeek',
    column: 'posts_per_week',
    transform: (v, inp) => postsPerWeekForCadence(inp.cadence ?? 'weekly', v as number),
  },
  { key: 'guardrails', column: 'guardrails' },
  { key: 'contentBufferDays', column: 'content_buffer_days' },
  { key: 'autonomyLevel', column: 'autonomy_level' },
  { key: 'isActive', column: 'is_active', transform: (v) => (v ? 1 : 0) },
  { key: 'metadata', column: 'metadata', transform: (v) => (v ? JSON.stringify(v) : null) },
];

/**
 * Build the SET clause fragments and bind values for an update.
 * Returns null when no fields are provided.
 */
export function buildUpdateFields(
  input: UpdateChannelConfigInput,
): { fields: string[]; values: unknown[] } | null {
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const mapper of UPDATE_FIELD_MAPPERS) {
    const rawValue = input[mapper.key];
    if (rawValue !== undefined) {
      fields.push(`${mapper.column} = ?`);
      values.push(mapper.transform ? mapper.transform(rawValue, input) : rawValue);
    }
  }

  return fields.length === 0 ? null : { fields, values };
}

export function rowToConfig(row: Record<string, unknown>): ChannelConfig {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    channelId: String(row.channel_id),
    channelTitle: row.channel_title == null ? null : String(row.channel_title),
    objective: String(row.objective),
    audience: String(row.audience),
    contentPillars: parseList(row.content_pillars as string | null),
    cadence: String(row.cadence) as Cadence,
    postsPerWeek: Number(row.posts_per_week) || 0,
    guardrails: row.guardrails == null ? null : String(row.guardrails),
    contentBufferDays: Number(row.content_buffer_days) || 0,
    autonomyLevel: Number(row.autonomy_level) || 0,
    isActive: Number(row.is_active) === 1,
    metadata: parseMetadata(row.metadata as string | null),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}
