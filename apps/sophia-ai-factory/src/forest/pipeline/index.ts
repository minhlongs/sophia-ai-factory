/**
 * @module pipeline
 *
 * Pipeline state management for Inngest workflows.
 *
 * Provides checkpoint persistence (D1-backed) and Zod schema validation
 * for multi-stage pipeline execution. Ported from OpenMontage's checkpoint
 * system to Sophia AI Factory's Cloudflare D1 layer.
 *
 * @example
 * import { CheckpointService } from '@/forest/pipeline';
 * const svc = new CheckpointService(tenantId);
 * await svc.writeCheckpoint(missionId, 'visual', 'completed', { asset_manifest: {...} });
 */

export { CheckpointService } from './checkpoint-service';

export {
  CheckpointSchema,
  CheckpointStatusSchema,
  PipelineTypeSchema,
  ResearchBriefSchema,
  ScriptSchema,
  ScenePlanSchema,
  AssetManifestSchema,
  RenderReportSchema,
  PublishLogSchema,
  DecisionEntrySchema,
  STAGE_ARTIFACT_REGISTRY,
  validateArtifactsForStage,
} from './checkpoint-schemas';

export type {
  Checkpoint,
  CheckpointStatus,
  PipelineType,
  ResearchBrief,
  Script,
  ScenePlan,
  AssetManifest,
  RenderReport,
  PublishLog,
  DecisionEntry,
} from './checkpoint-schemas';
