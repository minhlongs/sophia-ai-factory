/**
 * @module seed/config/video-blueprints/scene-graph-types
 * Hybrid Scene-Graph primitives combining 3s AI Hook B-Roll, Deterministic Edge SVG Data Cards,
 * AI Avatar/Voiceover authority segments, and Geo-Fenced Compliance End-Cards.
 */

import type { VideoNiche } from './blueprint-types';
import type { VideoSceneTaskType } from '@/seed/ai/video-model-radar-types';

export type SceneNodeKind =
  | 'GENERATIVE_HOOK_BROLL'
  | 'DETERMINISTIC_DATA_CARD'
  | 'AVATAR_AUTHORITY_SEGMENT'
  | 'COMPLIANCE_END_CARD';

export interface BaseSceneNode {
  nodeId: string;
  kind: SceneNodeKind;
  startSec: number;
  durationSec: number;
  sceneTask: VideoSceneTaskType;
}

export interface GenerativeHookBrollNode extends BaseSceneNode {
  kind: 'GENERATIVE_HOOK_BROLL';
  prompt: string;
  preferredModelId?: string;
  cacheKeySha256?: string;
  assetR2Key?: string;
}

export interface DeterministicDataCardNode extends BaseSceneNode {
  kind: 'DETERMINISTIC_DATA_CARD';
  cardType: 'CEX_COMPARISON_CARD' | 'SAAS_ROI_CARD';
  svgContent: string;
  motionPreset: 'KEN_BURNS_ZOOM_IN' | 'SLIDE_UP_BENTO';
  assetR2Key?: string;
}

export interface AvatarAuthoritySegmentNode extends BaseSceneNode {
  kind: 'AVATAR_AUTHORITY_SEGMENT';
  narrationText: string;
  voiceId: string;
  avatarId?: string;
  pipPosition: 'bottom-right' | 'bottom-left' | 'full-screen';
}

export interface ComplianceEndCardNode extends BaseSceneNode {
  kind: 'COMPLIANCE_END_CARD';
  jurisdiction: string;
  disclaimerText: string;
  regulatoryRef: string;
  affiliateCtaText: string;
  referralCode: string;
}

export type SceneGraphNode =
  | GenerativeHookBrollNode
  | DeterministicDataCardNode
  | AvatarAuthoritySegmentNode
  | ComplianceEndCardNode;

export interface HybridSceneGraph {
  graphId: string;
  campaignId: string;
  niche: VideoNiche;
  jurisdiction: string;
  width: number;
  height: number;
  fps: number;
  totalDurationSec: number;
  nodes: SceneGraphNode[];
}
