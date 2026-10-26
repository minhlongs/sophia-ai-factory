/**
 * @module tree/video/scene-graph/hybrid-scene-graph-builder
 * Builds deterministic 4-node Hybrid Scene-Graph combining AI Hook B-Roll,
 * Edge SVG Data Cards, Avatar Authority Segments, and Compliance End-Cards.
 */

import type { HybridSceneGraph, SceneGraphNode } from '@/seed/config/video-blueprints/scene-graph-types';
import type { VideoNiche } from '@/seed/config/video-blueprints/blueprint-types';

export interface SceneGraphBuildInput {
  campaignId: string;
  niche: VideoNiche;
  jurisdiction?: string;
  hookPrompt: string;
  cardType: 'CEX_COMPARISON_CARD' | 'SAAS_ROI_CARD';
  cardSvg: string;
  narrationText: string;
  voiceId: string;
  disclaimerText: string;
  regulatoryRef: string;
  referralCode: string;
  totalDurationSec?: number;
}

export function buildHybridSceneGraph(input: SceneGraphBuildInput): HybridSceneGraph {
  const totalDuration = input.totalDurationSec ?? 20.0;
  const jur = input.jurisdiction ?? 'GLOBAL';

  const nodes: SceneGraphNode[] = [
    {
      nodeId: `node_hook_${Date.now()}`,
      kind: 'GENERATIVE_HOOK_BROLL',
      sceneTask: 'HOOK_CINEMATIC_3S',
      startSec: 0,
      durationSec: 3.0,
      prompt: input.hookPrompt,
    },
    {
      nodeId: `node_data_${Date.now()}`,
      kind: 'DETERMINISTIC_DATA_CARD',
      sceneTask: 'BROLL_TECH_LOOP',
      startSec: 3.0,
      durationSec: 7.0,
      cardType: input.cardType,
      svgContent: input.cardSvg,
      motionPreset: 'KEN_BURNS_ZOOM_IN',
    },
    {
      nodeId: `node_avatar_${Date.now()}`,
      kind: 'AVATAR_AUTHORITY_SEGMENT',
      sceneTask: 'AVATAR_TALKING_HEAD',
      startSec: 10.0,
      durationSec: Math.max(4.0, totalDuration - 14.0),
      narrationText: input.narrationText,
      voiceId: input.voiceId,
      pipPosition: 'bottom-right',
    },
    {
      nodeId: `node_compliance_${Date.now()}`,
      kind: 'COMPLIANCE_END_CARD',
      sceneTask: 'BROLL_TECH_LOOP',
      startSec: Math.max(14.0, totalDuration - 4.0),
      durationSec: 4.0,
      jurisdiction: jur,
      disclaimerText: input.disclaimerText,
      regulatoryRef: input.regulatoryRef,
      affiliateCtaText: 'Claim exclusive sign-up bonuses via link in bio',
      referralCode: input.referralCode,
    },
  ];

  return {
    graphId: `hsg_${input.campaignId}_${Date.now()}`,
    campaignId: input.campaignId,
    niche: input.niche,
    jurisdiction: jur,
    width: 1080,
    height: 1920,
    fps: 30,
    totalDurationSec: totalDuration,
    nodes,
  };
}
