/**
 * Workflow Presets Registry — configuration data for workflow step templates.
 *
 * Moved to seed for layer compliance (shared between seed/db/workflow-repository
 * and land/workflows/supervisor-steps).
 */

import { SUPERVISOR_STEPS, type WorkflowStep } from './supervisor-step-types';
import { CEO_SOLO_MEDIA_STEPS } from './ceo-solo-media-preset-steps';

export { SUPERVISOR_STEPS, type WorkflowStep };

export interface WorkflowPreset {
  id: string;
  name: string;
  description: string;
  goal?: string;
  targetScore?: number;
  mode: 'linear' | 'parallel' | 'auto';
  steps: WorkflowStep[];
  /** Default specialist roles for Solo Company mode */
  soloRoles?: string[];
}

/**
 * Registry of available workflow presets.
 * Add new presets here to make them available in the UI / API.
 */
export const WORKFLOW_PRESETS: Record<string, WorkflowPreset> = {
  // ── Default: 3-step linear MVP (backward compatible) ─────────────────────
  default: {
    id: 'default',
    name: 'Default Supervisor',
    description: 'Standard 3-step plan → develop → test workflow',
    mode: 'linear',
    steps: [
      { order: 1, type: 'create_plan', command: 'supervisor.plan' },
      { order: 2, type: 'execute_development', command: 'supervisor.execute' },
      { order: 3, type: 'run_tests', command: 'supervisor.test' },
    ],
  },

  // ── CEO Solo Media: $1M MRR goal, parallel execution ────────────────────
  'ceo-solo-media': {
    id: 'ceo-solo-media',
    name: 'CEO Solo Media',
    description: 'AI-powered media company targeting $1M MRR — parallel execution',
    goal: '$1,000,000 MRR',
    targetScore: 100,
    mode: 'parallel',
    soloRoles: ['ceo', 'marketer', 'analyst', 'ops'],
    steps: CEO_SOLO_MEDIA_STEPS,
  },
};
