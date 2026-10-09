/**
 * Production Graph Runner — Inngest function
 * Layer: forest (reusable infrastructure orchestrators)
 *
 * Consumes `production.graph.started`, executes the graph node-by-node in
 * topological order via the canonical tree/agent-protocol executor, and
 * emits `production.graph.completed` / `production.graph.failed` / `production.graph.cancelled`.
 *
 * Modularized submodules live in `src/forest/inngest/functions/production-graph/`.
 */

import { inngest } from '@/seed/inngest/client';
import { handleGraphRunner } from './production-graph/graph-runner-handler';

export {
  type GraphRunnerErrorCode,
  type EmitStep,
  type RunnerContext,
  type RunnerLogContext,
} from './production-graph/types';

export const productionGraphRunner = inngest.createFunction(
  { id: 'production-graph-runner', retries: 1 },
  { event: 'production.graph.started' },
  async ({ event, step }) => {
    return handleGraphRunner({
      event: event as Parameters<typeof handleGraphRunner>[0]['event'],
      step: step as Parameters<typeof handleGraphRunner>[0]['step'],
    });
  },
);
