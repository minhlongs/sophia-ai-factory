/**
 * D1 Stage Materialization & Crash Window Helpers for 12-Stage Creative Job Runner (Supreme #02.2 R2)
 * Extracted from `creative-job-d1-runner.ts` to keep all convergence modules strictly <= 100 LOC.
 * Layer: forest/convergence (imports seed and tree only)
 */

import type { D1Database } from '@/seed/db/client';
import { success, type Result } from '@/seed/types/result';
import {
  calculateUnitEconomics,
  evaluateConvergedTruth,
  listConvergenceJobsByWorkspaceD1,
  transitionConvergenceCasD1,
  type ArtifactManifestEntry,
  type ConvergenceLedgerRecord,
  type MediaVerificationReport,
} from '@/tree/convergence';
import type { CreativeJobSliceOutput } from './creative-job-pipeline';
import type { CrashWindowId, RunCreativeJobD1Input } from './creative-job-d1-runner';
import { buildDeterministicStageArtifact } from './creative-job-stages';
import { materializeLocalStageArtifact } from './local-artifact-materializer';

export async function finalizeD1Slice(
  d1: D1Database,
  rec: ConvergenceLedgerRecord,
  mekongTicketId: string | null,
  deduplicated: boolean
): Promise<Result<CreativeJobSliceOutput, { code: string; message: string }>> {
  const all = await listConvergenceJobsByWorkspaceD1(d1, rec.workspaceId);
  return success({
    record: rec,
    truthState: evaluateConvergedTruth(rec, rec.sideEffectUncertain, rec.verificationReport.hasVerifiedMedia),
    unitEconomics: calculateUnitEconomics(all),
    mekongTicketId,
    deduplicated,
  });
}

export function buildOrMaterializeStageArtifact(
  input: RunCreativeJobD1Input,
  stageId: ArtifactManifestEntry['stageId'],
  kind: ArtifactManifestEntry['kind']
): ArtifactManifestEntry {
  return input.artifactRootDir
    ? materializeLocalStageArtifact({
        artifactRootDir: input.artifactRootDir,
        workspaceId: input.workspaceId,
        jobId: input.jobId,
        stageId,
        kind,
        goal: input.goal,
        corruptMedia: input.simulateCorruptMedia,
      })
    : buildDeterministicStageArtifact(input.jobId, stageId, kind, input.simulateCorruptMedia);
}

export function isMidPipelineCrashWindow(w: CrashWindowId | undefined): boolean {
  return (
    w === 'W04_DURING_RENDER_BEFORE_ARTIFACT' ||
    w === 'W05_AFTER_ARTIFACT_BEFORE_VERIFICATION' ||
    w === 'W06_AFTER_VERIFICATION_BEFORE_DELIVERY' ||
    w === 'W07_AFTER_EXTERNAL_PUBLISH_BEFORE_RECEIPT' ||
    w === 'W08_AFTER_DELIVERY_BEFORE_COST'
  );
}

export async function applyMidPipelineCrashWindowD1(
  d1: D1Database,
  cur: ConvergenceLedgerRecord,
  leaseToken: string,
  ticketId: string,
  w: CrashWindowId,
  manifest: ArtifactManifestEntry[],
  verificationReport: MediaVerificationReport,
  nowMs?: number
) {
  const isW07 = w === 'W07_AFTER_EXTERNAL_PUBLISH_BEFORE_RECEIPT';
  return transitionConvergenceCasD1(d1, {
    jobId: cur.jobId,
    workspaceId: cur.workspaceId,
    expectedVersion: cur.version,
    leaseToken,
    nowMs,
    lifecycleStage: isW07 ? 'crash_quarantine_recovery' : 'media_integrity_verification',
    mekongJobId: ticketId,
    sideEffectUncertain: isW07,
    artifactManifest: w === 'W04_DURING_RENDER_BEFORE_ARTIFACT' ? manifest.filter((m) => m.kind !== 'video') : manifest,
    verificationReport: w === 'W05_AFTER_ARTIFACT_BEFORE_VERIFICATION' ? undefined : verificationReport,
    axes: isW07
      ? { executionOutcome: 'crashed', verificationOutcome: 'verified', deliveryOutcome: 'pending', businessOutcome: 'human_review_required' }
      : undefined,
  });
}
