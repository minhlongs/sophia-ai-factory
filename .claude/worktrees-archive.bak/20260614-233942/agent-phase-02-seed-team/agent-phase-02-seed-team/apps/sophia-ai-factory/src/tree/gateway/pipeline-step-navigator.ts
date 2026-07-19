/**
 * Pipeline step definitions and navigation utilities.
 *
 * Provides the ordered step list and pure navigation functions
 * (index lookup, next step, step removal). No I/O.
 *
 * Consumed by smart-resume-engine.ts.
 */

/** Ordered pipeline steps for campaign execution */
export const PIPELINE_STEPS = [
  "notify-start",
  "generate-script",
  "generate-voiceover",
  "start-video-generation",
  "poll-video-status",
  "distribute-channels",
  "finalize-campaign",
] as const;

export type PipelineStep = (typeof PIPELINE_STEPS)[number];

/**
 * Determine the next pipeline step after the given completed step.
 * Returns "complete" if already at the last step, or the first step if unknown.
 */
export function getNextStep(step: string): string {
  const index = PIPELINE_STEPS.indexOf(step as PipelineStep);
  if (index === -1) return PIPELINE_STEPS[0];
  const next = index + 1;
  if (next >= PIPELINE_STEPS.length) return "complete";
  return PIPELINE_STEPS[next];
}

/**
 * Return all pipeline steps at and after the given step index (inclusive).
 * Used for clearing checkpoints on retry.
 * Returns empty array if step is unknown.
 */
export function getStepsFromIndex(stepName: PipelineStep): readonly PipelineStep[] {
  const index = PIPELINE_STEPS.indexOf(stepName);
  if (index === -1) return [];
  return PIPELINE_STEPS.slice(index);
}

/**
 * Check whether a step name is a valid pipeline step.
 */
export function isValidStep(step: string): step is PipelineStep {
  return PIPELINE_STEPS.includes(step as PipelineStep);
}
