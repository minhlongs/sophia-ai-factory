/**
 * Reality Loop v1 — canonical product events (Phase C).
 *
 * Layer: tree (domain-specific reusable). Imports seed only.
 * @module tree/performance/loop-events
 */

import { recordPerformanceEventIdempotent } from './events';
import { logger } from '@/seed/utils/logger-utility';
import {
  AUTONOMY_FAILURE_CLASSES,
  classifyAutonomyFailure,
  type AutonomyFailureClass,
} from './autonomy-failure-classifier';

export {
  AUTONOMY_FAILURE_CLASSES,
  classifyAutonomyFailure,
  type AutonomyFailureClass,
};

/** Canonical event_type namespace (dot-notation, distinct from legacy snake_case producers). */
export const REALITY_LOOP_EVENT_TYPES = [
  'mission.created',
  'mission.abandoned',
  'agent.started',
  'agent.failed',
  'approval.requested',
  'approval.approved',
  'approval.rejected',
  'creative.accepted',
  'creative.edited',
  'creative.rejected',
  'memory.used',
  'memory.corrected',
  'mission.cost_recorded',
] as const;

export type RealityLoopEventType = (typeof REALITY_LOOP_EVENT_TYPES)[number];

/** Allowlisted payload value: IDs, enums, counts, cents, durations only. */
export type LoopMetrics = Record<string, string | number | boolean | null>;

export interface LoopEventContext {
  workspaceId: string;
  recordedAt: number;
}

/** Deterministic event id from identity fields only. Idempotent re-emits are no-ops. */
export function loopEventId(prefix: string, ...parts: (string | number | undefined | null)[]): string {
  const p = parts.filter((x): x is string => typeof x === 'string' && x.length > 0);
  const raw = [prefix, ...p].join('_');
  let h = 0xcbf29ce484222325n;
  for (let i = 0; i < raw.length; i++) {
    h ^= BigInt(raw.charCodeAt(i));
    h = (h * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return `loop_${h.toString(16).padStart(16, '0')}`;
}

interface EmitOptions {
  workspaceId: string;
  entityId: string;
  entityType?: string;
  channel?: string;
  recordedAt: number;
  metrics: LoopMetrics;
  valueCents?: number;
  count?: number;
}

/**
 * Single non-fatal, idempotent write path for ALL 10 canonical events.
 */
export async function emitLoopEvent(eventType: RealityLoopEventType, opts: EmitOptions): Promise<boolean> {
  try {
    return await recordPerformanceEventIdempotent({
      id: loopEventId(eventType, opts.entityId, opts.workspaceId),
      workspaceId: opts.workspaceId,
      assetId: '',
      projectId: '',
      entityType: opts.entityType ?? 'mission',
      entityId: opts.entityId,
      channel: opts.channel ?? 'sophia',
      eventType,
      count: opts.count ?? 1,
      valueCents: opts.valueCents,
      recordedAt: opts.recordedAt,
      rawData: { ...opts.metrics, event_type: eventType, workspace_id: opts.workspaceId },
    });
  } catch (err) {
    logger.warn(`loop-events: emit ${eventType} failed (non-fatal)`, {
      eventType,
      entityId: opts.entityId,
      workspaceId: opts.workspaceId,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}
