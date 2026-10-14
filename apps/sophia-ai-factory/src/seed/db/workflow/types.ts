/**
 * Workflow Repository Types
 * Layer: SEED (Foundational Primitives)
 */

export interface WorkflowRow {
  id: string;
  org_id: string;
  prompt: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  final_result: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface StepMissionRow {
  id: string;
  org_id: string;
  parent_mission_id: string;
  status: string;
  params: string; // JSON: {step_order, step_type, workflow_id}
  result?: string | null;
  error_message?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
}

export interface WorkflowWithSteps extends WorkflowRow {
  steps: StepMissionRow[];
}
