/**
 * Reality Loop v1 — canonical product events (Phase C).
 *
 * Layer: tree (domain-specific reusable). Imports seed only.
 *
 * Ten canonical event types (dot-namespace) written into the EXISTING
 * `performance_events` table via `recordPerformanceEventIdempotent`.
 * No new table, no new engine. Every emitter is SIDE-CHANNEL and
 * NON-FATAL: a telemetry failure NEVER aborts the caller's flow and
 * never enters the runner's deterministic checkpoint stream (mirrors
 * the `recordNodePerformance` pattern in production-graph-runner.ts).
 *
 * Privacy contract (binding, plan §7): metrics payload = IDs, enums,
 * counts, cents, durations ONLY. No prompts, no model output text, no
 * raw user input, no secrets/API keys, no customer PII.
 *
 * Idempotency: every emitter builds a deterministic event id from its
 * identity fields so Inngest retries / cron re-dispatches do not
 * double-count. `recordPerformanceEventIdempotent` uses INSERT OR IGNORE.
 *
 * Product questions answered (plan §2):
 * - Q2 human time: approval.requested→resolved latency
 * - Q3 creative decisions: creative.accepted vs creative.rejected rate
 * - Q4 economics: mission.cost_recorded totals
 * - Q5 memory value: memory.used count vs acceptance; memory.corrected rate
 * - Q6 human rejection: approval.rejected nodeId distribution
 * - Q7 autonomy failure: agent.failed taxonomy counts
 * - Q8 workflow break: mission.abandoned + failure stage
 * - Q9/Q10: mission.created → completed funnel coverage
 *
 * @module tree/performance/loop-events
 */

import { recordPerformanceEventIdempotent } from './events';
import { logger } from '@/seed/utils/logger-utility';

// ─── Namespace + shared types ────────────────────────────────────────────────

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
  /** Epoch milliseconds — deterministic emitters pass an injected clock value (matches performance_events producers: Date.now()). */
  recordedAt: number;
}

// ─── Autonomy failure taxonomy (Phase G — measure first, fix nothing) ────────

export const AUTONOMY_FAILURE_CLASSES = [
  'REASONING_ERROR',
  'BAD_CONTEXT',
  'BAD_MEMORY',
  'TOOL_ERROR',
  'PROVIDER_ERROR',
  'TIMEOUT',
  'PERMISSION_ERROR',
  'APPROVAL_ERROR',
  'COST_LIMIT',
  'POLICY_BLOCK',
  'USER_AMBIGUITY',
  'UNKNOWN',
] as const;

export type AutonomyFailureClass = (typeof AUTONOMY_FAILURE_CLASSES)[number];

/**
 * Classify an arbitrary error/failure into one of the 12 autonomy classes.
 * PURE: no side effects, no D1, no logging. Deterministic on inputs.
 * Used first to MEASURE (Phase G), never to retry or patch.
 */
export function classifyAutonomyFailure(error: unknown, context?: {
  code?: string;
  message?: string;
  approvalOutcome?: 'approved' | 'rejected' | 'timeout' | 'skipped';
  budgetExhausted?: boolean;
  permissionDenied?: boolean;
  userInterventionRequired?: boolean;
}): AutonomyFailureClass {
  const code = (context?.code ?? (error as { code?: string })?.code ?? '').toUpperCase();
  const message = (context?.message ?? (error instanceof Error ? error.message : '') ?? '').toLowerCase();

  if (context?.approvalOutcome && ['rejected', 'timeout'].includes(context.approvalOutcome)) return 'APPROVAL_ERROR';
  if (context?.budgetExhausted || code === 'BUDGET_EXCEEDED' || /budget|spent|cost/i.test(message)) return 'COST_LIMIT';
  if (context?.permissionDenied || code === 'PERMISSION_DENIED' || /permission|not allowed/i.test(message)) return 'PERMISSION_ERROR';
  if (code === 'APPROVAL_REJECTED' || code === 'APPROVAL_TIMEOUT') return 'APPROVAL_ERROR';
  if (code === 'POLICY_BLOCK' || /policy|autonomy.?level/i.test(message)) return 'POLICY_BLOCK';
  if (code === 'USER_AMBIGUITY' || /ambiguous|clarif/i.test(message)) return 'USER_AMBIGUITY';
  if (code === 'TOOL_ERROR' || /tool|function.?call/i.test(message)) return 'TOOL_ERROR';
  if (code === 'PROVIDER_ERROR' || /provider|api.?key|unauthorized|401|403/i.test(message)) return 'PROVIDER_ERROR';
  if (code === 'TIMEOUT' || /timeout|timed.?out|deadline/i.test(message)) return 'TIMEOUT';
  if (code === 'BAD_CONTEXT' || /context|not.?found|missing/i.test(message)) return 'BAD_CONTEXT';
  if (code === 'BAD_MEMORY' || /memory|retrieval/i.test(message)) return 'BAD_MEMORY';
  if (code === 'REASONING_ERROR' || /reasoning|max.?tokens|incomplete|truncated/i.test(message)) return 'REASONING_ERROR';
  if (context?.userInterventionRequired) return 'USER_AMBIGUITY';
  return 'UNKNOWN';
}

// ─── Emitter core (side-channel, non-fatal, idempotent) ─────────────────────

/** Deterministic event id from identity fields only. Idempotent re-emits are no-ops. */
export function loopEventId(prefix: string, ...parts: (string | number | undefined | null)[]): string {
  const p = parts.filter((x): x is string => typeof x === 'string' && x.length > 0);
  const raw = [prefix, ...p].join('_');
  // FNV-1a 64-bit hash → stable short id inside the 36-char performance_events.id column.
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
  /** Epoch milliseconds (injected for determinism). */
  recordedAt: number;
  /** Allowlisted metrics only — IDs, enums, counts, cents, durations. */
  metrics: LoopMetrics;
  /** Optional cost in cents (Q4 economics). */
  valueCents?: number;
  /** Optional count (default 1). */
  count?: number;
}

/**
 * Single non-fatal, idempotent write path for ALL 10 canonical events.
 * Failure is swallowed + logged: telemetry must never abort a business flow,
 * and must never appear inside the runner's checkpoint payload stream.
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

// ─── 10 canonical emitters ───────────────────────────────────────────────────
//
// The 7 mission + agent + approval emitters live in the sibling split file
// `loop-emitters-runner.ts` (they are the ones called from
// production-graph-runner.ts, so grouping them keeps the runner-facing
// surface together and keeps this core file ≤200 LOC).
// Creative + memory + cost emitters live in `loop-emitters-creative.ts`
// and `loop-emitters-cost.ts`. All three are re-exported from the barrel
// `index.ts`.
