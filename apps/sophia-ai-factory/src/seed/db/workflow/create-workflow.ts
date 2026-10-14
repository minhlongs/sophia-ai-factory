/**
 * Workflow Creation Logic
 * Layer: SEED (Foundational Primitives)
 */

import { SUPERVISOR_STEPS, WORKFLOW_PRESETS, type WorkflowStep } from '@/seed/config/workflow-presets';
import type { WorkflowWithSteps } from './types';
import { getD1, newId } from './d1-binding';

/**
 * Atomically insert 1 workflow + N step missions via D1 batch().
 *
 * @param presetName - Optional workflow preset name. Falls back to SUPERVISOR_STEPS (default).
 */
export async function createWorkflow(
  orgId: string,
  prompt: string,
  presetName?: string,
  workflowPresets?: Record<string, { id: string; name: string; description: string; mode: string; steps: WorkflowStep[] }>,
): Promise<WorkflowWithSteps> {
  const db = await getD1();
  const workflowId = newId();
  const now = new Date().toISOString();

  // Resolve steps from preset or fall back to default
  const resolvedPresets = workflowPresets ?? WORKFLOW_PRESETS;
  const preset = presetName ? resolvedPresets[presetName] : undefined;
  const effectivePresetName = preset?.id ?? 'default';
  const steps: WorkflowStep[] = preset?.steps ?? (SUPERVISOR_STEPS as unknown as WorkflowStep[]);
  const stepIds = steps.map(() => newId());

  const wfInsert = db.prepare(
    `INSERT INTO workflows (id, org_id, prompt, status, created_at, updated_at)
     VALUES (?, ?, ?, 'queued', ?, ?)`,
  ).bind(workflowId, orgId, prompt, now, now);

  const missionInserts = steps.map((step, i) => {
    const missionId = stepIds[i];
    const hasDependencies = (step.dependsOn?.length ?? 0) > 0;
    const status = preset?.mode === 'parallel'
      ? (hasDependencies ? 'blocked' : 'queued')
      : (step.order === 1 ? 'queued' : 'blocked');
    const title = step.label
      ? `${step.label.en}`
      : `Step ${step.order}: ${step.type}`;
    const params = JSON.stringify({
      step_order: step.order,
      step_type: step.type,
      workflow_id: workflowId,
      parallel_group: step.parallelGroup ?? null,
      depends_on: step.dependsOn ?? [],
      preset: effectivePresetName,
    });
    return db.prepare(
      `INSERT INTO missions
       (id, org_id, title, command, params, status, parent_mission_id,
        created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      missionId,
      orgId,
      title,
      step.command,
      params,
      status,
      workflowId,
      now,
      now,
    );
  });

  await db.batch([wfInsert, ...missionInserts]);

  return {
    id: workflowId,
    org_id: orgId,
    prompt,
    status: 'queued',
    final_result: null,
    error_message: null,
    created_at: now,
    updated_at: now,
    steps: steps.map((step, i) => ({
      id: stepIds[i],
      org_id: orgId,
      parent_mission_id: workflowId,
      status: preset?.mode === 'parallel'
        ? ((step.dependsOn?.length ?? 0) > 0 ? 'blocked' : 'queued')
        : (step.order === 1 ? 'queued' : 'blocked'),
      params: JSON.stringify({
        step_order: step.order,
        step_type: step.type,
        workflow_id: workflowId,
        parallel_group: step.parallelGroup ?? null,
        depends_on: step.dependsOn ?? [],
        preset: effectivePresetName,
      }),
      result: null,
      error_message: null,
      started_at: null,
      completed_at: null,
      created_at: now,
    })),
  };
}
