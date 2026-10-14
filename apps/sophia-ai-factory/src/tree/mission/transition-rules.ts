/**
 * Mission lifecycle transition rules and state machine constraints.
 * Layer: tree (domain-specific reusable)
 */

import type { CreativeMissionStatus } from '@/seed/types/creative-economy';

const NEXT_STATUS: Record<CreativeMissionStatus, CreativeMissionStatus[]> = {
  draft: ['planned', 'cancelled'],
  planned: ['approval_required', 'cancelled'],
  approval_required: ['running', 'cancelled'],
  running: ['paused', 'review', 'completed', 'failed', 'cancelled'],
  paused: ['running', 'review', 'failed', 'cancelled'],
  review: ['completed', 'iterating', 'failed', 'cancelled'],
  completed: ['learning'],
  learning: ['iterating'],
  iterating: ['draft', 'planned', 'running', 'cancelled'],
  failed: ['draft', 'planned', 'running'],
  cancelled: ['draft'],
};

export function canTransition(from: CreativeMissionStatus, to: CreativeMissionStatus): boolean {
  return NEXT_STATUS[from]?.includes(to) ?? false;
}

/**
 * States from which an agent execution may legally start.
 */
export const EXECUTION_START_FROM: readonly CreativeMissionStatus[] = [
  'draft',
  'planned',
  'approval_required',
  'paused',
];

export function canStartExecution(from: CreativeMissionStatus): boolean {
  return EXECUTION_START_FROM.includes(from);
}
