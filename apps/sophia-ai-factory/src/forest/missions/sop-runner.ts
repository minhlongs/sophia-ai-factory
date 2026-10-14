/**
 * SOP Runner — core orchestrator
 *
 * Parses agents + playbook, dispatches each step as an engine_mission,
 * polls for completion, validates output, persists run history.
 */

import { logger } from '@/seed/utils/logger-utility';
import { assertTemplateExecutable } from '@/seed/sop/sop-marketplace-guard';
import { getInstallation, advanceSchedule } from '@/seed/sop/sop-repo-installations';
import { getTemplateById } from '@/seed/sop/sop-repo-templates';
import { createRun, updateRunStatus, appendMissionId } from '@/seed/sop/sop-repo-runs';
import { parseAgentsYaml } from '@/seed/sop/executor/agents-yaml-parser';
import { parsePlaybook } from '@/seed/sop/executor/playbook-parser';
import { validateOutput } from '@/seed/sop/executor/output-validator';
import { resolveArgs } from '@/seed/sop/executor/arg-resolver';
import type { RunContext, RunResult, StepResult } from '@/seed/sop/executor/types';
import { StepFailed } from '@/seed/sop/executor/types';
import type { SopCustomizations } from '@/seed/sop/sop-types';
import {
  nowSec,
  awaitMissionResult,
  dispatchStep,
  getRunById,
  nextCronAt,
} from './sop-runner-helpers';

/**
 * Main SOP run orchestrator.
 * Parses template, executes steps sequentially, validates output, advances schedule.
 */
export async function runSop(
  db: D1Database,
  ctx: RunContext,
): Promise<RunResult> {
  const inst = await getInstallation(db, ctx.installationId);
  if (!inst) throw new Error(`Installation not found: ${ctx.installationId}`);

  await assertTemplateExecutable(db, inst.template_id);

  const tpl = await getTemplateById(db, inst.template_id);
  if (!tpl) throw new Error(`Template not found: ${inst.template_id}`);

  const customizations: SopCustomizations = inst.customizations
    ? (JSON.parse(inst.customizations) as SopCustomizations)
    : {};

  const configValues: Record<string, unknown> = inst.config_values
    ? (JSON.parse(inst.config_values) as Record<string, unknown>)
    : {};

  const agentsYaml = customizations.agents_yaml_override ?? tpl.agents_yaml;
  const playbookMd = customizations.playbook_md_override ?? tpl.playbook_md;

  parseAgentsYaml(agentsYaml);
  const steps = parsePlaybook(playbookMd);

  const run = ctx.runId
    ? await getRunById(db, ctx.runId)
    : await createRun(db, ctx.installationId, ctx.trigger);

  if (!run) throw new Error(`Run not found: ${ctx.runId}`);

  await updateRunStatus(db, run.id, { status: 'running', startedAt: nowSec() });

  const stepResults: StepResult[] = [];
  let requiresApproval = false;

  try {
    for (const step of steps) {
      const resolvedArgs = resolveArgs(step.args, stepResults, ctx.triggerPayload, configValues);
      const missionId = await dispatchStep(db, inst.user_id, step.command, resolvedArgs);

      await appendMissionId(db, run.id, missionId);

      const missionResult = await awaitMissionResult(db, missionId);
      if (!missionResult.ok) throw new StepFailed(step.order, missionResult.error ?? 'unknown');

      stepResults.push({ order: step.order, command: step.command, missionId, output: missionResult.output });
    }

    const aggregate: Record<string, unknown> = {};
    for (const r of stepResults) Object.assign(aggregate, r.output);

    if (tpl.output_schema.includes('"requiresApproval"')) {
      requiresApproval = aggregate.requiresApproval === true;
    }

    validateOutput(aggregate, tpl.output_schema, tpl.id);

    const completedAt = nowSec();
    await updateRunStatus(db, run.id, {
      status: 'completed',
      resultSummary: JSON.stringify(aggregate),
      requiresApproval: requiresApproval ? 1 : 0,
      completedAt,
    });
    await advanceSchedule(db, inst.id, completedAt, nextCronAt(inst.schedule_cron));

    void import('@/tree/handover/handover-magic-link')
      .then((m) => m.markFirstRun(inst.user_id))
      .catch(() => { /* swallow */ });

    return { runId: run.id, status: 'completed', summary: aggregate };
  } catch (e) {
    const isPartial = e instanceof StepFailed && stepResults.length > 0;
    const errMsg = e instanceof Error ? e.message : String(e);
    await updateRunStatus(db, run.id, {
      status: isPartial ? 'paused' : 'failed',
      errorMessage: errMsg,
      completedAt: nowSec(),
    });
    logger.error('[sop-runner] run failed', e instanceof Error ? e : new Error(errMsg), { runId: run.id });
    return { runId: run.id, status: isPartial ? 'paused' : 'failed', errorMessage: errMsg };
  }
}
