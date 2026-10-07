/**
 * Autonomous Video Pipeline Orchestrator.
 * Connects Blueprints, A/B Hooks, B-Roll, SFX Audio Ducking, Hormozi Captions,
 * Compliance Disclaimers and Multi-Platform Syndication in one deterministic execution.
 */

import { listBlueprintsByNiche } from '@/seed/config/video-blueprints';
import { generateHookVariants } from '@/tree/video/ab-testing/niche-hook-variant-generator';
import { buildAudioMixSpec } from '@/tree/video/audio/audio-mixer-builder';
import { generateSFXCues } from '@/tree/video/audio/sfx-cue-generator';
import { createNicheVideoCampaignPlan } from '@/tree/video/blueprints/niche-video-service';
import { matchBRollTimeline } from '@/tree/video/broll/broll-matcher';
import { generateComplianceOverlay } from '@/tree/video/compliance/compliance-overlay-generator';
import { generateStyledSubtitles } from '@/tree/video/subtitles/caption-styler';
import { buildNicheSyndicationPackage } from '@/tree/video/syndication/niche-syndication-builder';
import { assembleRenderManifest } from './render-manifest-builder';
import type {
  AutonomousPipelineInput,
  PipelineExecutionSummary,
} from './video-pipeline-types';

export function runAutonomousVideoPipeline(
  input: AutonomousPipelineInput
): PipelineExecutionSummary {
  const {
    campaignId,
    niche,
    productName,
    productUrl,
    productDescription,
    targetDurationSeconds = 15.0,
    affiliateBaseUrl,
  } = input;

  // 1. Resolve Blueprint and Campaign Plan
  const blueprints = listBlueprintsByNiche(niche);
  const defaultBlueprint = blueprints[0];
  const planResult = createNicheVideoCampaignPlan({
    niche,
    blueprintId: defaultBlueprint ? defaultBlueprint.id : 'saas_problem_solution_v1',
    productName,
    productUrl,
    jurisdiction: 'GLOBAL',
  });

  if (!planResult.ok) {
    throw new Error(`Failed to create campaign plan: ${planResult.error.message}`);
  }

  const campaignPlan = planResult.value;

  // 2. Generate A/B Hook Variants (4 psychological angles)
  const hookResult = generateHookVariants(campaignPlan, 'en');
  const winningHook = hookResult.variants[0];

  // 3. Synthesize High-Converting Script
  const fullScript = `${winningHook.narration} ${productDescription} Try ${productName} today with the link in bio!`;

  // 4. Match Dynamic B-Roll Visual Timeline
  const brollResult = matchBRollTimeline({
    niche,
    totalDurationSeconds: targetDurationSeconds,
    scriptText: fullScript,
    targetCutIntervalSeconds: 2.5,
  });

  // 5. Generate SFX and Audio Ducking Timeline
  const cutTimestamps = brollResult.cues.map((c) => c.startTimeSeconds);
  const sfxCues = generateSFXCues({
    totalDurationSeconds: targetDurationSeconds,
    scriptText: fullScript,
    cutTimestamps,
    hasAffiliateCallout: true,
    hasComplianceDisclaimer: true,
  });

  const audioMix = buildAudioMixSpec({
    niche,
    totalDurationSeconds: targetDurationSeconds,
    sfxCues,
    hasVoiceover: true,
  });

  // 6. Generate Dynamic Hormozi-style Subtitles
  const subtitles = generateStyledSubtitles({
    scriptText: fullScript,
    totalDurationSeconds: targetDurationSeconds,
    wordsPerChunk: 3,
  });

  // 7. Generate Compliance Geo-Fenced Overlay
  const complianceOverlay = generateComplianceOverlay({
    niche,
    hasFinancialClaim: niche === 'crypto_global',
    hasAffiliateLink: true,
    targetJurisdiction: 'GLOBAL',
  });

  // 8. Assemble Multi-Platform Syndication Package
  const syndication = buildNicheSyndicationPackage(campaignPlan, 'en');

  // 9. Build Composite Render Manifest
  const manifest = assembleRenderManifest({
    campaignId,
    niche,
    title: `${productName} — ${winningHook.angle.toUpperCase()}`,
    durationSeconds: targetDurationSeconds,
    hookVariantAngle: winningHook.angle,
    scriptText: fullScript,
    brollCues: brollResult.cues,
    audioMix,
    subtitles,
    complianceOverlay,
    syndication,
  });

  return {
    success: true,
    campaignId,
    manifest,
    hookVariantsGeneratedCount: hookResult.variants.length,
    totalBrollCuts: brollResult.totalCues,
    totalSfxCues: sfxCues.length,
    estimatedRenderTimeSeconds: Math.ceil(targetDurationSeconds * 0.4),
  };
}
