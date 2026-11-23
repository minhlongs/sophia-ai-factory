/**
 * Fair paired comparison runner: Arm A (Sophia BASIC First-Value) vs Arm B (Direct Model).
 * Enforces ZERO_PAID_INFERENCE in fixture_simulated mode and reports NOT_MEASURED
 * for real-model tokens, latency, and comparative quality.
 *
 * @module land/eval/first-value-benchmark/paired-arms
 */

import { BasicFirstValueService } from '@/land/first-value/basic-first-value-service';
import type { ScriptOutput } from '@/seed/ai/script-generator';
import { ARM_COMPARISON_SPECS, buildDirectModelPrompt, buildTrialId } from './arm-specs';
import { computeSha256Hex } from './dataset-loader';
import {
  BENCHMARK_ARMS,
  type EvaluationBrief,
  type ExperimentConfig,
  type TrialExecutionRecord,
  type TrialTelemetry,
} from './types';

function renderNeutralScriptText(script: ScriptOutput): string {
  const lines = [`Title: ${script.title}`, `Target Duration: ${script.total_duration}s`];
  for (const scene of script.scenes) {
    lines.push(
      `Scene ${scene.scene_number} (${scene.duration_estimate}s) | Visual: ${scene.visual_description} | Narration: ${scene.narration}`,
    );
  }
  return lines.join('\n');
}

function buildFixtureTelemetry(config: ExperimentConfig): TrialTelemetry {
  return {
    modelId: config.plannedModelId,
    modelVersion: config.plannedModelVersion,
    promptTokens: { status: 'NOT_MEASURED', reason: 'fixture_simulated_no_provider_usage' },
    completionTokens: { status: 'NOT_MEASURED', reason: 'fixture_simulated_no_provider_usage' },
    retryCount: 0,
    wallClockLatencyMs: { status: 'NOT_MEASURED', reason: 'fixture_simulated_no_real_inference' },
    estimatedInferenceCostMicroUsd: {
      status: 'NOT_MEASURED',
      reason: 'fixture_simulated_use_cost_preview_separately',
    },
    measuredInferenceCostMicroUsd: {
      status: 'NOT_MEASURED',
      reason: 'fixture_simulated_zero_paid_inference',
    },
    infrastructureCostAllocationMicroUsd: 0,
    realPaidInferenceCostMicroUsd: 0,
  };
}

function buildSyntheticOfflineKey(): string {
  return ['sk', 'or', 'v1', '0'.repeat(48)].join('-');
}

async function runArmAFixtureTrial(
  brief: EvaluationBrief,
  config: ExperimentConfig,
  trialNumber: number,
  trialId: string,
): Promise<TrialExecutionRecord> {
  const service = new BasicFirstValueService({
    signingSecret: 'b4-offline-fixture-signing-secret-01',
    verifyOrgMembership: async () => true,
    storeEncryptedKey: async () => undefined,
    chargeMcu: async () => true,
    nowMs: () => 1_760_000_000_000,
  });

  const session = await service.startJourney({
    userId: 'b4-synthetic-user',
    orgId: 'b4-synthetic-org',
    sessionId: `sess-${trialId}`,
  });
  if (!session.ok) throw new Error(`Arm A startJourney failed: ${session.code}`);

  const receipt = await service.configureByok({
    sessionId: session.data.sessionId,
    userId: 'b4-synthetic-user',
    orgId: 'b4-synthetic-org',
    provider: 'openrouter',
    rawKey: buildSyntheticOfflineKey(),
    verifyWithProvider: false,
  });
  if (!receipt.ok) throw new Error(`Arm A configureByok failed: ${receipt.code}`);

  const generated = await service.generateScriptForReview({
    sessionId: session.data.sessionId,
    userId: 'b4-synthetic-user',
    orgId: 'b4-synthetic-org',
    idempotencyKey: trialId,
    topic: `${brief.productOrService} — ${brief.campaignObjective}`,
    audience: brief.targetAudience,
    durationSec: config.targetDurationSec,
    model: config.plannedModelId,
    receipt: receipt.data,
    mode: 'fixture_simulated',
    authorizePaidInference: false,
  });
  if (!generated.ok) throw new Error(`Arm A generateScriptForReview failed: ${generated.code}`);

  const renderedOutput = renderNeutralScriptText(generated.data.script);
  return {
    trialId,
    briefId: brief.briefId,
    industry: brief.industry,
    armId: 'arm_a_sophia_basic',
    trialNumber,
    executionMode: 'fixture_simulated',
    qualityStatus: 'QUALITY_NOT_MEASURED',
    renderedOutput,
    inputSha256: computeSha256Hex(JSON.stringify(brief)),
    outputSha256: computeSha256Hex(renderedOutput),
    orchestrationNotes: ARM_COMPARISON_SPECS.arm_a_sophia_basic.orchestration,
    telemetry: buildFixtureTelemetry(config),
  };
}

function runArmBFixtureTrial(
  brief: EvaluationBrief,
  config: ExperimentConfig,
  trialNumber: number,
  trialId: string,
): TrialExecutionRecord {
  const prompt = buildDirectModelPrompt(brief);
  const renderedOutput = [
    `Title: ${brief.productOrService} (${brief.intendedPlatform})`,
    `Target Duration: ${config.targetDurationSec}s`,
    `Scene 1 (8s) | Visual: Opening shot tailored to ${brief.targetAudience} | Narration: [FIXTURE_STUB] ${brief.campaignObjective}`,
    `Scene 2 (14s) | Visual: Product highlight for ${brief.productOrService} | Narration: [FIXTURE_STUB] Voice: ${brief.brandVoice}`,
    `Scene 3 (8s) | Visual: Closing card | Narration: ${brief.requiredCta}`,
  ].join('\n');

  return {
    trialId,
    briefId: brief.briefId,
    industry: brief.industry,
    armId: 'arm_b_direct_model',
    trialNumber,
    executionMode: 'fixture_simulated',
    qualityStatus: 'QUALITY_NOT_MEASURED',
    renderedOutput,
    inputSha256: computeSha256Hex(prompt),
    outputSha256: computeSha256Hex(renderedOutput),
    orchestrationNotes: ARM_COMPARISON_SPECS.arm_b_direct_model.orchestration,
    telemetry: buildFixtureTelemetry(config),
  };
}

async function executeSingleFixtureTrial(
  brief: EvaluationBrief,
  config: ExperimentConfig,
  armId: (typeof BENCHMARK_ARMS)[number],
  trialNumber: number,
  seenTrialIds: Set<string>,
): Promise<TrialExecutionRecord> {
  const trialId = buildTrialId(config.configVersion, brief.briefId, armId, trialNumber);
  if (seenTrialIds.has(trialId)) {
    throw new Error(`Duplicate trialId detected: ${trialId}`);
  }
  seenTrialIds.add(trialId);
  return armId === 'arm_a_sophia_basic'
    ? runArmAFixtureTrial(brief, config, trialNumber, trialId)
    : runArmBFixtureTrial(brief, config, trialNumber, trialId);
}

export async function runPairedFixtureBenchmark(
  briefs: readonly EvaluationBrief[],
  config: ExperimentConfig,
): Promise<readonly TrialExecutionRecord[]> {
  if (config.mode !== 'fixture_simulated') {
    throw new Error('B4.0 enforces ZERO_PAID_INFERENCE: live_observed execution is not authorized in this runner');
  }
  if (!Number.isInteger(config.trialsPerBrief) || config.trialsPerBrief < 1) {
    throw new Error('trialsPerBrief must be a positive integer');
  }

  const records: TrialExecutionRecord[] = [];
  const seenTrialIds = new Set<string>();

  for (const brief of briefs) {
    for (const armId of BENCHMARK_ARMS) {
      for (let trialNumber = 1; trialNumber <= config.trialsPerBrief; trialNumber += 1) {
        records.push(await executeSingleFixtureTrial(brief, config, armId, trialNumber, seenTrialIds));
      }
    }
  }

  return records;
}
