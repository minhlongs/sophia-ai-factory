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

export {
  postsPerWeekForCadence,
  stringifyList,
  parseList,
  parseMetadata,
  genId,
  buildUpdateFields,
  rowToConfig,
} from './channel-config-serializers';
