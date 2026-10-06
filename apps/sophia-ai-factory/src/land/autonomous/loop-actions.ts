'use server';

/**
 * Autonomous AGI Loop Control & Heartbeat Scheduler Server Actions
 *
 * Layer: land/autonomous (Server Actions & Mutation Endpoints)
 * Conforms to: Sophia 4-Layer Architecture Doctrine (seed -> tree -> forest -> land)
 *
 * Provides transactional server actions for:
 * - Querying real-time loop state, scheduled tasks, DLQ, and cycle runs
 * - Deterministic FSM lifecycle transitions (Start, Pause, Resume, Emergency Halt, Reset Circuit)
 * - Autonomous cycle execution with capability dispatch (Affiliate Scout, Content Producer, Auto-Publisher)
 * - DLQ task replay and failure remediation
 *
 * @module land/autonomous/loop-actions
 */

import type {
  AutonomousActionResult,
  AutonomousCockpitStatus,
  TriggerCycleOptions,
} from '@/seed/types/autonomous-engine';

export type {
  AutonomousActionResult,
  AutonomousActionResult as ActionResult,
  AutonomousCockpitStatus,
  TriggerCycleOptions,
};

// Re-export all submodules for complete backward compatibility
export { resolveDb, ensureTenantLoopState } from './loop-actions-db';
export { getAutonomousLoopStatusAction } from './loop-actions-status';
export {
  startAutonomousLoopAction,
  pauseAutonomousLoopAction,
  resumeAutonomousLoopAction,
  emergencyHaltAutonomousLoopAction,
  resetAutonomousCircuitBreakerAction,
  resetCircuitBreakerAction,
} from './loop-actions-lifecycle';
export { triggerAutonomousCycleAction } from './loop-actions-cycle';
export { replayDeadLetterTaskAction } from './loop-actions-dlq';
