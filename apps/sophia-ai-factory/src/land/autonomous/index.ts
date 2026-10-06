/**
 * Autonomous Land Layer Barrel Exports
 *
 * Layer: land/autonomous
 * Conforms to: Sophia 4-Layer Architecture Doctrine (seed -> tree -> forest -> land)
 *
 * Re-exports:
 * - Transactional Server Actions for AGI loop control
 * - Operations Cockpit UI presentation component
 * - Action result and telemetry contract types
 *
 * @module land/autonomous
 */

export {
  getAutonomousLoopStatusAction,
  triggerAutonomousCycleAction,
  pauseAutonomousLoopAction,
  resumeAutonomousLoopAction,
  emergencyHaltAutonomousLoopAction,
  resetAutonomousCircuitBreakerAction,
  resetCircuitBreakerAction,
  replayDeadLetterTaskAction,
  startAutonomousLoopAction,
} from './loop-actions';

export type {
  AutonomousActionResult,
  ActionResult,
  AutonomousCockpitStatus,
  TriggerCycleOptions,
} from './loop-actions';

export { OperationsCockpit } from './operations-cockpit';
export type { OperationsCockpitProps } from './operations-cockpit';
