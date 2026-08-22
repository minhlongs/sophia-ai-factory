/**
 * Types and helpers for YouTube channel configuration.
 * @module land/youtube/channel-config-types
 */

export type Cadence = 'daily' | 'every-2-days' | '3-per-week' | 'weekly';

export interface ChannelConfig {
  readonly id: string;
  readonly userId: string;
  readonly channelId: string;
  readonly channelTitle: string | null;
  readonly objective: string;
  readonly audience: string;
  readonly contentPillars: readonly string[];
  readonly cadence: Cadence;
  readonly postsPerWeek: number;
  readonly guardrails: string | null;
  readonly contentBufferDays: number;
  readonly autonomyLevel: number;
  readonly isActive: boolean;
  readonly metadata: Record<string, unknown> | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateChannelConfigInput {
  readonly userId: string;
  readonly channelId: string;
  readonly channelTitle?: string;
  readonly objective: string;
  readonly audience: string;
  readonly contentPillars: readonly string[];
  readonly cadence: Cadence;
  readonly postsPerWeek?: number;
  readonly guardrails?: string;
  readonly contentBufferDays?: number;
  readonly autonomyLevel?: number;
  readonly metadata?: Record<string, unknown>;
}

export interface UpdateChannelConfigInput {
  readonly channelTitle?: string;
  readonly objective?: string;
  readonly audience?: string;
  readonly contentPillars?: readonly string[];
  readonly cadence?: Cadence;
  readonly postsPerWeek?: number;
  readonly guardrails?: string | null;
  readonly contentBufferDays?: number;
  readonly autonomyLevel?: number;
  readonly isActive?: boolean;
  readonly metadata?: Record<string, unknown>;
}

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

/**
 * Build the SET clause fragments and bind values for an update.
 * Returns null when no fields are provided.
 */
export function buildUpdateFields(
  input: UpdateChannelConfigInput,
): { fields: string[]; values: unknown[] } | null {
  const fields: string[] = [];
  const values: unknown[] = [];
  if (input.channelTitle !== undefined) {
    fields.push('channel_title = ?');
    values.push(input.channelTitle);
  }
  if (input.objective !== undefined) {
    fields.push('objective = ?');
    values.push(input.objective);
  }
  if (input.audience !== undefined) {
    fields.push('audience = ?');
    values.push(input.audience);
  }
  if (input.contentPillars !== undefined) {
    fields.push('content_pillars = ?');
    values.push(stringifyList(input.contentPillars));
  }
  if (input.cadence !== undefined) {
    fields.push('cadence = ?');
    values.push(input.cadence);
  }
  if (input.postsPerWeek !== undefined) {
    fields.push('posts_per_week = ?');
    values.push(postsPerWeekForCadence(input.cadence ?? 'weekly', input.postsPerWeek));
  }
  if (input.guardrails !== undefined) {
    fields.push('guardrails = ?');
    values.push(input.guardrails);
  }
  if (input.contentBufferDays !== undefined) {
    fields.push('content_buffer_days = ?');
    values.push(input.contentBufferDays);
  }
  if (input.autonomyLevel !== undefined) {
    fields.push('autonomy_level = ?');
    values.push(input.autonomyLevel);
  }
  if (input.isActive !== undefined) {
    fields.push('is_active = ?');
    values.push(input.isActive ? 1 : 0);
  }
  if (input.metadata !== undefined) {
    fields.push('metadata = ?');
    values.push(input.metadata ? JSON.stringify(input.metadata) : null);
  }
  if (fields.length === 0) return null;
  return { fields, values };
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