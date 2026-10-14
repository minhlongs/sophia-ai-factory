/**
 * Stage Artifact Registry and Runtime Validator
 *
 * Layer: forest/pipeline
 */

import { z } from 'zod';
import {
  ResearchBriefSchema,
  ScriptSchema,
  ScenePlanSchema,
  AssetManifestSchema,
  RenderReportSchema,
  PublishLogSchema,
} from './artifacts';

/**
 * Maps canonical stage names to their expected artifact key and Zod schema.
 * Used by CheckpointService to validate artifacts before persisting.
 */
export const STAGE_ARTIFACT_REGISTRY: Record<
  string,
  { key: string; schema: z.ZodType<unknown> }
> = {
  parse_input: { key: 'research_brief', schema: ResearchBriefSchema },
  scripting: { key: 'script', schema: ScriptSchema },
  scene_plan: { key: 'scene_plan', schema: ScenePlanSchema },
  visual: { key: 'asset_manifest', schema: AssetManifestSchema },
  compose: { key: 'render_report', schema: RenderReportSchema },
  publish: { key: 'publish_log', schema: PublishLogSchema },
};

/**
 * Validate the artifacts dict for a specific pipeline stage.
 * Throws ZodError if any registered artifact fails validation.
 */
export function validateArtifactsForStage(
  stage: string,
  artifacts: Record<string, unknown>,
): void {
  const entry = STAGE_ARTIFACT_REGISTRY[stage];
  if (!entry) return; // no registered artifact for this stage
  const raw = artifacts[entry.key];
  if (raw === undefined || raw === null) return; // optional at write time
  const result = entry.schema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Artifact "${entry.key}" for stage "${stage}" failed validation: ${result.error.message}`,
    );
  }
}
