/**
 * Autonomous Video Pipeline Orchestrator.
 * Connects Blueprints, Hooks, B-Roll, SFX, Hormozi Captions,
 * Scene-Graph, Pre-Render Compliance Gate, and Syndication.
 */

import { listBlueprintsByNiche } from '@/seed/config/video-blueprints';
import { generateHookVariants } from '@/tree/video/ab-testing/niche-hook-variant-generator';
import { buildAudioMixSpec } from '@/tree/video/audio/audio-mixer-builder';
import { generateSFXCues } from '@/tree/video/audio/sfx-cue-generator';
import { createNicheVideoCampaignPlan } from '@/tree/video/blueprints/niche-video-service';
import { matchBRollTimeline } from '@/tree/video/broll/broll-matcher';
import { generateComplianceOverlay } from '@/tree/video/compliance/compliance-overlay-generator';
import { evaluatePreRenderCompliance } from '@/tree/video/compliance/pre-render-compliance-gate';
import { generateStyledSubtitles } from '@/tree/video/subtitles/caption-styler';
import { buildNicheSyndicationPackage } from '@/tree/video/syndication/niche-syndication-builder';
import { assembleRenderManifest } from './render-manifest-builder';
import { buildOrchestratorSceneGraph } from './autonomous-video-card-helper';
import type { AutonomousPipelineInput, PipelineExecutionSummary } from './video-pipeline-types';

export function runAutonomousVideoPipeline(input: AutonomousPipelineInput): PipelineExecutionSummary {
  const {
    campaignId,
    niche,
    productName,
    productUrl,
    productDescription,
    targetDurationSeconds = 15.0,
    targetJurisdiction = 'GLOBAL',
    referralCode = 'SOPHIA20',
  } = input;

  const complianceDecision = evaluatePreRenderCompliance({
    niche,
    targetJurisdiction,
    scriptText: `${productName} ${productDescription}`,
  });
  if (!complianceDecision.isAllowed) {
    throw new Error(`Compliance gate blocked campaign: ${complianceDecision.blockingReason}`);
  }

  const blueprints = listBlueprintsByNiche(niche);
  const planResult = createNicheVideoCampaignPlan({
    niche,
    blueprintId: blueprints[0] ? blueprints[0].id : 'saas_problem_solution_v1',
    productName,
    productUrl,
    jurisdiction: complianceDecision.jurisdiction,
  });
  if (!planResult.ok) {
    throw new Error(`Failed to create campaign plan: ${planResult.error.message}`);
  }

  const campaignPlan = planResult.value;
  const hookResult = generateHookVariants(campaignPlan, 'en');
  const winningHook = hookResult.variants[0];
  const fullScript = `${winningHook.narration} ${productDescription} Try ${productName} today with the link in bio!`;

  const brollResult = matchBRollTimeline({
    niche,
    totalDurationSeconds: targetDurationSeconds,
    scriptText: fullScript,
    targetCutIntervalSeconds: 2.5,
  });

  const sfxCues = generateSFXCues({
    totalDurationSeconds: targetDurationSeconds,
    scriptText: fullScript,
    cutTimestamps: brollResult.cues.map((c) => c.startTimeSeconds),
    hasAffiliateCallout: true,
    hasComplianceDisclaimer: true,
  });

  const audioMix = buildAudioMixSpec({ niche, totalDurationSeconds: targetDurationSeconds, sfxCues, hasVoiceover: true });
  const subtitles = generateStyledSubtitles({ scriptText: fullScript, totalDurationSeconds: targetDurationSeconds, wordsPerChunk: 3 });
  const complianceOverlay = generateComplianceOverlay({
    niche,
    hasFinancialClaim: niche === 'crypto_global',
    hasAffiliateLink: true,
    targetJurisdiction: complianceDecision.jurisdiction,
  });

  const sceneGraph = buildOrchestratorSceneGraph({
    campaignId,
    niche,
    productName,
    jurisdiction: complianceDecision.jurisdiction,
    hookPrompt: winningHook.visualPrompt,
    fullScript,
    disclaimerText: complianceOverlay.disclaimerText,
    regulatoryRef: complianceDecision.regulatoryRef ?? 'FTC 16 C.F.R. § 255',
    referralCode,
    targetDurationSeconds,
  });

  const syndication = buildNicheSyndicationPackage(campaignPlan, 'en');
  const baseManifest = assembleRenderManifest({
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
    manifest: { ...baseManifest, sceneGraph },
    hookVariantsGeneratedCount: hookResult.variants.length,
    totalBrollCuts: brollResult.totalCues,
    totalSfxCues: sfxCues.length,
    estimatedRenderTimeSeconds: Math.ceil(targetDurationSeconds * 0.4),
  };
}
