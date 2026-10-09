/**
 * Production Graph Initialization & Validation Helpers.
 *
 * Layer: forest (reusable infrastructure orchestrators)
 *
 * @module forest/inngest/functions/production-graph/init-helpers
 */

import type { Result } from '@/seed/types/result';
import type {
  ProductionGraphRunError,
  ProductionGraph,
  ProductionGraphRun,
} from '@/seed/types/production-factory';
import type { ValidatedGraph } from '@/tree/production-graph/validate';
import type { Mission } from '@/seed/types/creative-economy';
import { agentDefinitionRegistry } from '@/tree/agent-protocol';
import { getGraphById, getRun } from '@/tree/production-graph/repo';
import { validateGraphDefinition } from '@/tree/production-graph/validate';
import { getMission } from '@/tree/mission/repository';
import type { EmitStep, RunnerLogContext } from './types';
import { emitFailed, failTerminal } from './emitter-helpers';

export interface InitializedRunContext {
  run: ProductionGraphRun;
  graph: ProductionGraph;
  mission: Mission;
  validated: ValidatedGraph;
}

export type InitRunResult =
  | { ok: true; context: InitializedRunContext }
  | { ok: false; code: string };

/**
 * Loads run, graph, mission, and validates the graph definition.
 */
export async function initializeGraphRun(
  step: EmitStep,
  logCtx: RunnerLogContext,
  retryCount: number,
): Promise<InitRunResult> {
  const { graphRunId, graphId, missionId, workspaceId } = logCtx;

  const runResult = await getRun(graphRunId);
  if (!runResult.ok || !runResult.value) {
    const error: ProductionGraphRunError = {
      code: 'RUN_NOT_FOUND',
      message: `Run ${graphRunId} not found`,
    };
    await emitFailed(step, logCtx, error, retryCount);
    return { ok: false, code: 'RUN_NOT_FOUND' };
  }
  const run = runResult.value;

  const graphResult = await getGraphById(graphId);
  if (!graphResult.ok || !graphResult.value) {
    const error: ProductionGraphRunError = {
      code: 'GRAPH_NOT_FOUND',
      message: `Graph ${graphId} not found`,
    };
    await failTerminal(graphRunId, run.status, error, undefined, workspaceId, missionId);
    await emitFailed(step, logCtx, error, retryCount);
    return { ok: false, code: 'GRAPH_NOT_FOUND' };
  }
  const graph = graphResult.value;

  const mission = await getMission(missionId);
  if (!mission) {
    const error: ProductionGraphRunError = {
      code: 'MISSION_NOT_FOUND',
      message: `Mission ${missionId} not found`,
    };
    await failTerminal(graphRunId, run.status, error, undefined, workspaceId, missionId);
    await emitFailed(step, logCtx, error, retryCount);
    return { ok: false, code: 'MISSION_NOT_FOUND' };
  }

  const knownSlugs = new Set(agentDefinitionRegistry.list().map((d) => d.id));
  const validated = validateGraphDefinition(graph.definition, knownSlugs);
  if (!validated.ok) {
    const error: ProductionGraphRunError = {
      code: 'INVALID_GRAPH',
      message: validated.error.message,
      details: { validationCode: validated.error.code },
    };
    await failTerminal(graphRunId, run.status, error, undefined, workspaceId, missionId);
    await emitFailed(step, logCtx, error, retryCount);
    return { ok: false, code: 'INVALID_GRAPH' };
  }

  return {
    ok: true,
    context: { run, graph, mission, validated: validated.value },
  };
}
