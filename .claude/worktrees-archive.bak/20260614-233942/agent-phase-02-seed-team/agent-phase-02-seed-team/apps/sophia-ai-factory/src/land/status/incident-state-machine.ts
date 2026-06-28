/**
 * Incident state machine — pure function, no side effects.
 * 3 consecutive failures opens incident; 3 consecutive successes closes it.
 * @module lib/status/incident-state-machine
 */

export type CheckStatus = 'ok' | 'degraded' | 'down';
export type IncidentAction = 'open' | 'close' | 'noop';

interface CheckInput {
  status: CheckStatus;
}

/**
 * Evaluate whether to open or close an incident based on recent checks.
 * @param checks - recent checks in descending order (latest first)
 * @param activeIncidentId - current open incident id, or null
 */
export function evaluateIncidentAction(
  checks: CheckInput[],
  activeIncidentId: string | null,
): IncidentAction {
  if (checks.length === 0) return 'noop';

  // Take the N most recent for evaluation window
  const window = checks.slice(0, 6);

  const lastThree = window.slice(0, 3);
  const allFail = lastThree.length === 3 && lastThree.every(c => c.status !== 'ok');
  const allOk = lastThree.length === 3 && lastThree.every(c => c.status === 'ok');

  if (allFail && !activeIncidentId) return 'open';
  if (allOk && activeIncidentId) return 'close';
  return 'noop';
}
