/**
 * SOP Runner — core orchestrator
 *
 * Parses agents + playbook, dispatches each step as an engine_mission,
 * polls for completion, validates output, persists run history.
 *
 * File kept ≤200 LOC; arg resolution + validation in separate modules.
 */

import { logger } from '@/lib/utils/logger-utility';
import { dispatchMission } from '@/lib/missions/dispatcher';
import { getInstallation } from '../sop-repo-installations';
import { getTemplateById } from '../sop-repo-templates';
import { createRun, updateRunStatus, appendMissionId } from '../sop-repo-runs';
import { advanceSchedule } from '../sop-repo-installations';
import { parseAgentsYaml } from './agents-yaml-parser';
import { parsePlaybook } from './playbook-parser';
import { validateOutput } from './output-validator';
import { resolveArgs } from './arg-resolver';
import type { RunContext, RunResult, StepResult } from './types';
import { StepFailed } from './types';
import type { SopCustomizations } from '../sop-types';

function nowSec(): number { return Math.floor(Date.now() / 1000); }

/** Poll a mission for completion (max 5 min, 3s intervals) */
async function awaitMissionResult(
  db: D1Database,
  missionId: string,
): Promise<{ ok: boolean; output: Record<string, unknown>; error?: string }> {
  const maxAttempts = 100;   // 100 × 3s = 5 min
  const pollMs = 3_000;

  for (let i = 0; i < maxAttempts; i++) {
    const row = await db
      .prepare(`SELECT status, result, error FROM engine_missions WHERE id = ?1`)
      .bind(missionId)
      .first<{ status: string; result: string | null; error: string | null }>();

    if (!row) return { ok: false, output: {}, error: 'mission not found' };

    if (row.status === 'succeeded') {
      let output: Record<string, unknown> = {};
      try { output = row.result ? (JSON.parse(row.result) as Record<string, unknown>) : {}; } catch { /* ignore */ }
      return { ok: true, output };
    }

    if (row.status === 'failed' || row.status === 'cancelled') {
      return { ok: false, output: {}, error: row.error ?? 'mission failed' };
    }

    await new Promise(r => setTimeout(r, pollMs));
  }

  return { ok: false, output: {}, error: 'mission timeout after 5 minutes' };
}

/** Create and dispatch a single mission, returning missionId */
async function dispatchStep(
  db: D1Database,
  userId: string,
  command: string,
  args: Record<string, unknown>,
): Promise<string> {
  const missionId = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO engine_missions (id, user_id, command, params, status, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, 'pending', ?5, ?5)`,
    )
    .bind(missionId, userId, command, JSON.stringify(args), nowSec())
    .run();

  void dispatchMission(missionId).catch(e => {
    logger.error('[sop-runner] dispatch error', e instanceof Error ? e : new Error(String(e)), { missionId, command });
  });

  return missionId;
}

/** Compute next cron trigger time (simplified: null if no cron pattern) */
function nextCronAt(cron: string | null): number | null {
  if (!cron) return null;
  // Basic: advance by 24h as default; real cron parsing deferred to Phase 3
  return nowSec() + 24 * 3600;
}

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

  const tpl = await getTemplateById(db, inst.template_id);
  if (!tpl) throw new Error(`Template not found: ${inst.template_id}`);

  const customizations: SopCustomizations = inst.customizations
    ? (JSON.parse(inst.customizations) as SopCustomizations)
    : {};

  const agentsYaml = customizations.agents_yaml_override ?? tpl.agents_yaml;
  const playbookMd = customizations.playbook_md_override ?? tpl.playbook_md;

  parseAgentsYaml(agentsYaml);  // validate — throws on invalid
  const steps = parsePlaybook(playbookMd);

  const run = await createRun(db, ctx.installationId, ctx.trigger);

  await updateRunStatus(db, run.id, { status: 'running', startedAt: nowSec() });

  const stepResults: StepResult[] = [];
  let requiresApproval = false;

  try {
    for (const step of steps) {
      const resolvedArgs = resolveArgs(step.args, stepResults, ctx.triggerPayload);
      const missionId = await dispatchStep(db, inst.user_id, step.command, resolvedArgs);

      await appendMissionId(db, run.id, missionId);

      const missionResult = await awaitMissionResult(db, missionId);
      if (!missionResult.ok) throw new StepFailed(step.order, missionResult.error ?? 'unknown');

      stepResults.push({ order: step.order, command: step.command, missionId, output: missionResult.output });
    }

    // Build aggregate output from last step or merge all outputs
    const aggregate: Record<string, unknown> = {};
    for (const r of stepResults) Object.assign(aggregate, r.output);

    // Check requiresApproval flag in output schema
    if (tpl.output_schema.includes('"requiresApproval"')) {
      requiresApproval = aggregate.requiresApproval === true;
    }

    validateOutput(aggregate, tpl.output_schema, tpl.id);

    const completedAt = nowSec();
    await updateRunStatus(db, run.id, {
      status: 'succeeded',
      resultSummary: JSON.stringify(aggregate),
      requiresApproval: requiresApproval ? 1 : 0,
      completedAt,
    });
    await advanceSchedule(db, inst.id, completedAt, nextCronAt(inst.schedule_cron));

    return { runId: run.id, status: 'succeeded', summary: aggregate };

  } catch (e) {
    const isPartial = e instanceof StepFailed && stepResults.length > 0;
    const errMsg = e instanceof Error ? e.message : String(e);
    await updateRunStatus(db, run.id, {
      status: isPartial ? 'partial' : 'failed',
      errorMessage: errMsg,
      completedAt: nowSec(),
    });
    logger.error('[sop-runner] run failed', e instanceof Error ? e : new Error(errMsg), { runId: run.id });
    return { runId: run.id, status: isPartial ? 'partial' : 'failed', errorMessage: errMsg };
  }
}
