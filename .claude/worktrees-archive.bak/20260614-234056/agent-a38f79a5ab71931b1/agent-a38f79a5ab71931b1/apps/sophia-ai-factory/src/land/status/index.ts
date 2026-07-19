/**
 * @module status
 * Barrel re-exports.
 *
 * Note: CheckStatus is defined in both incident-state-machine.ts and status-store.ts
 * with the same shape. The canonical source is incident-state-machine.ts.
 */
export * from './incident-state-machine';
// status-store excluded from wildcard — CheckStatus clashes with incident-state-machine
export { getActiveIncident, getRecentChecks, getRollup, recordCheck, } from './status-store';
