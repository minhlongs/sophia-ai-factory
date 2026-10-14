import { emit, onEvent } from '@/land/openclaw/event-bus';
import { canAutoDispatch } from '@/tree/sop/auto-dispatch-layer';
import {
  AUTOMATION_EVENTS,
  AUTOMATION_HOOK_SPECS,
  type AutomationHookSpec,
  type HookRegistration,
  type MissionPayload,
} from './types';
import {
  handleMissionCreated,
  handleMissionDispatched,
  handleAutomationRan,
} from './handlers';

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
