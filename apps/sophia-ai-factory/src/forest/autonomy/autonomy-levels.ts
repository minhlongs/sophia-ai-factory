/**
 * Autonomy level descriptors
 * Layer: forest (reusable infrastructure)
 *
 * Autonomy Levels:
 *   0 = OBSERVE_ONLY   — Read-only, no side effects permitted
 *   1 = SUGGEST        — Can suggest actions but not execute them
 *   2 = EXECUTE_SAFE   — Execute pre-approved safe actions only
 *   3 = EXECUTE_BROAD  — Execute most actions, human-gate on expensive ones
 *   4 = FULL_AUTONOMY  — Execute everything without human approval
 *
 * @module forest/autonomy/autonomy-levels
 */

import type { AutonomyLevel } from '@/seed/types/creative-domain';
import { AutonomyError } from './autonomy-error';

export interface AutonomyLevelDescriptor {
  level: AutonomyLevel;
  name: string;
  description: string;
  /** Cost (cents) at or below which no human approval is needed. Infinity = no limit. */
  autoApproveCostCents: number;
  /** Whether this level can execute side-effecting actions at all. */
  canExecute: boolean;
}

export const AUTONOMY_LEVELS: readonly AutonomyLevelDescriptor[] = [
  {
    level: 0,
    name: 'OBSERVE_ONLY',
    description: 'Read-only. No side effects permitted.',
    autoApproveCostCents: 0,
    canExecute: false,
  },
  {
    level: 1,
    name: 'SUGGEST',
    description: 'Can suggest actions but not execute them. Human must approve all.',
    autoApproveCostCents: 0,
    canExecute: false,
  },
  {
    level: 2,
    name: 'EXECUTE_SAFE',
    description: 'Execute pre-approved safe actions. Human gates on expensive or risky ones.',
    autoApproveCostCents: 500,
    canExecute: true,
  },
  {
    level: 3,
    name: 'EXECUTE_BROAD',
    description: 'Execute most actions. Human gates only on high-cost or irreversible ones.',
    autoApproveCostCents: 2_000,
    canExecute: true,
  },
  {
    level: 4,
    name: 'FULL_AUTONOMY',
    description: 'Full execution authority. No human approval required.',
    autoApproveCostCents: Infinity,
    canExecute: true,
  },
] as const;

/**
 * Get the descriptor for a given autonomy level.
 * Throws AutonomyError if level is not 0-4.
 */
export function getAutonomyLevelDescriptor(level: AutonomyLevel): AutonomyLevelDescriptor {
  const descriptor = AUTONOMY_LEVELS.find((d) => d.level === level);
  if (!descriptor) {
    throw new AutonomyError('INVALID_LEVEL', `Invalid autonomy level: ${level}`);
  }
  return descriptor;
}
