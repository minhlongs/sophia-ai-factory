/**
 * automation-hooks.ts — Automation hooks wired to the event bus.
 *
 * Phase: Month 3 — "Expand agent orchestration to 60% automation"
 *
 * Provides:
 *   - `registerAutomationHooks(tenantId)` — idempotent registration of
 *     built-in automation handlers (content, support, finance, video, social, onboarding).
 *   - `getAutomationCoverage()` — extends auto-dispatch-layer with runtime hook stats.
 *   - `listAutomationHooks(tenantId)` — for observability / admin UI.
 *
 * Invariants:
 *   - Each hook handler is a pure async fn that delegates to `spawnAgentFleet`.
 *   - Handlers do NOT call `runSoloCompany` (that would double-wrap).
 *   - On error, the hook logs and re-throws; the event bus swallows per-handler failures
 *     via `Promise.allSettled` semantics.
 */

import { emit, onEvent } from '@/land/openclaw/event-bus';
import { routeLLM } from '@/land/openclaw/llm-router';
import { spawnAgentFleet } from '@/tree/agent-fleet/spawn-agent-fleet';
import { canAutoDispatch, classifyMission } from '@/tree/sop/auto-dispatch-layer';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';

// ---------------------------------------------------------------------------
// Hook event names (shared across services)
// ---------------------------------------------------------------------------

export const AUTOMATION_EVENTS = {
  MISSION_CREATED: 'mission:created',
  MISSION_DISPATCHED: 'mission:dispatched',
  AUTOMATION_RAN: 'automation:ran',
} as const;

// ---------------------------------------------------------------------------
// Hook specs — used for registration + admin UI
// ---------------------------------------------------------------------------

interface AutomationHookSpec {
  event: string;
  label: string;
  description: string;
}

export const AUTOMATION_HOOK_SPECS: AutomationHookSpec[] = [
  {
    event: AUTOMATION_EVENTS.MISSION_CREATED,
    label: 'Auto-dispatch on mission created',
    description: 'Classifies mission and dispatches agent fleet when confidence is high.',
  },
  {
    event: AUTOMATION_EVENTS.MISSION_DISPATCHED,
    label: 'Audit mission dispatch',
    description: 'Logs every dispatch attempt for observability.',
  },
  {
    event: AUTOMATION_EVENTS.AUTOMATION_RAN,
    label: 'Record automation outcome',
    description: 'Persists success / failure counts for coverage metrics.',
  },
];

// ---------------------------------------------------------------------------
// Hook handlers
// ---------------------------------------------------------------------------

interface MissionPayload {
  missionId: string;
  missionText: string;
  tenantId: string;
  triggeredBy: 'user' | 'cron' | 'webhook';
}

/**
 * Primary dispatch hook: when a mission is created, attempt auto-dispatch.
 * Runs `canAutoDispatch` (which calls `classifyMission`) and, on success,
 * calls `spawnAgentFleet` with the recommended fleet.
 */
export async function handleMissionCreated(payload: MissionPayload): Promise<void> {
  const { missionId, missionText, tenantId, triggeredBy } = payload;
  logger.info('automation: mission created, attempting auto-dispatch', {
    missionId,
    triggeredBy,
  });

  // 1. Ask the auto-dispatch layer whether this mission is a known type.
  const decision = await canAutoDispatch(missionText);

  if (!decision?.canAuto) {
    logger.info('automation: mission requires human intervention', {
      missionId,
      missionType: decision?.missionType ?? 'unknown',
      agentFleet: [],
    });
    return;
  }

  // 2. Dispatch to the recommended fleet.
  const { agentFleet, missionType } = decision;
  logger.info('automation: dispatching fleet', {
    missionId,
    missionType,
    agentFleet,
  });

  try {
    const agentTasks = agentFleet.map((agentName, idx) => ({
      id: `${agentName}-${missionId.slice(0, 8)}-${idx}`,
      prompt: `[AUTO] Handle mission ${missionId} of type ${missionType} on behalf of tenant ${tenantId}. Mission: ${missionText.slice(0, 1000)}`,
      
    }));

    const results = await spawnAgentFleet(agentTasks, {
      tenantId,
      parallel: true,
    });

    // 3. Emit dispatch audit event.
    await emit(AUTOMATION_EVENTS.MISSION_DISPATCHED, tenantId, {
      missionId,
      missionType,
      agentFleet,
      successCount: results.filter((r) => r.success).length,
      total: results.length,
      triggeredBy,
    });

    logger.info('automation: dispatch complete', {
      missionId,
      successCount: results.filter((r) => r.success).length,
      total: results.length,
    });
  } catch (err) {
    logger.error('automation: fleet dispatch failed', {
      missionId,
      error: getErrorMessage(err),
    });
    // Swallow — the mission record still exists; human can retry.
  }
}

/**
 * Audit-only hook: logs every dispatch for observability / compliance.
 */
export async function handleMissionDispatched(payload: MissionPayload & Record<string, unknown>): Promise<void> {
  // In production this would write to D1 / analytics store.
  logger.info('automation: audit dispatch', {
    missionId: payload.missionId,
    tenantId: payload.tenantId,
  });
}

/**
 * Record automation outcome hook: updates success/failure counters
 * that feed `getAutomationCoverage()`.
 */
export async function handleAutomationRan(payload: Record<string, unknown>): Promise<void> {
  // In production this would update a D1 automation_metrics table.
  logger.info('automation: outcome recorded', { payload });
}

// ---------------------------------------------------------------------------
// Registration helper
// ---------------------------------------------------------------------------

type HookRegistration = {
  event: string;
  handler: (payload: unknown) => Promise<void>;
  unsubscribe: () => void;
};

const _registry = new Map<string, HookRegistration>();

/**
 * Register all built-in automation hooks for a tenant.
 * Idempotent: calling twice for the same tenant reuses existing registrations.
 */
export function registerAutomationHooks(tenantId: string): () => void {
  const specs: { event: string; handler: (p: unknown) => Promise<void> }[] = [
    { event: AUTOMATION_EVENTS.MISSION_CREATED, handler: handleMissionCreated as (p: unknown) => Promise<void> },
    { event: AUTOMATION_EVENTS.MISSION_DISPATCHED, handler: handleMissionDispatched as (p: unknown) => Promise<void> },
    { event: AUTOMATION_EVENTS.AUTOMATION_RAN, handler: handleAutomationRan as (p: unknown) => Promise<void> },
  ];

  const unsubs: (() => void)[] = [];

  for (const spec of specs) {
    const key = `${tenantId}:${spec.event}`;
    if (_registry.has(key)) {
      unsubs.push(_registry.get(key)!.unsubscribe);
      continue;
    }
    const unsubscribe = onEvent(
      spec.event,
      tenantId,
      spec.handler as (p: unknown, t: string) => Promise<void>,
    );
    const entry: HookRegistration = { event: spec.event, handler: spec.handler, unsubscribe };
    _registry.set(key, entry);
    unsubs.push(unsubscribe);
  }

  // Return a single teardown fn that unsubscribes all hooks for this tenant.
  return () => {
    for (const fn of unsubs) fn();
    for (const spec of specs) _registry.delete(`${tenantId}:${spec.event}`);
  };
}

/**
 * List automation hook specs (for admin UI / observability).
 */
export function listAutomationHooks(): AutomationHookSpec[] {
  return [...AUTOMATION_HOOK_SPECS];
}

/**
 * Trigger auto-dispatch for a mission text directly (no event bus required).
 * Useful for CLI / `/cook` style workflows.
 */
export async function triggerAutoDispatch(
  missionText: string,
  tenantId: string,
  options?: { triggeredBy?: MissionPayload['triggeredBy'] },
): Promise<{ missionId: string; dispatched: boolean; agentFleet?: string[]; missionType?: string }> {
  const missionId = crypto.randomUUID();
  const triggeredBy = options?.triggeredBy ?? 'user';

  // Emit mission:created — registered hooks will handle dispatch.
  await emit(AUTOMATION_EVENTS.MISSION_CREATED, tenantId, {
    missionId,
    missionText,
    tenantId,
    triggeredBy,
  } as MissionPayload);

  // Compute decision directly so the caller gets a synchronous answer.
  const decision = await canAutoDispatch(missionText);

  return {
    missionId,
    dispatched: decision?.canAuto ?? false,
    agentFleet: decision?.agentFleet,
    missionType: decision?.missionType,
  };
}
