/**
 * SaaS Blueprint: Tool Battle / Direct VS Showdown
 *
 * Bottom-of-funnel comparative showdown testing speed, context depth, and seat pricing.
 * Layer: seed (foundational primitives & config)
 * @module seed/config/video-blueprints/saas-battle-blueprint
 */

import type { VideoBlueprint } from './blueprint-types';

export const SAAS_BLUEPRINT_TOOL_BATTLE_VS: VideoBlueprint = {
  id: 'saas_tool_battle_vs',
  niche: 'saas_global',
  name: 'Tool Battle / Direct VS Showdown',
  description: 'Bottom-of-funnel comparative showdown testing speed, context depth, and seat pricing.',
  targetAudience: 'Software builders, developers, marketers evaluating alternatives',
  hookArchetype: 'POLARIZING_VERDICT',
  defaultDurationSec: 60,
  aspectRatio: '9:16',
  complianceRequirements: {
    requiresFtcDisclosure: true,
    requiresCryptoRiskBanner: false,
    requiresEndCard15s: false,
  },
  monetizationModel: 'DUAL_AFFILIATE',
  scenes: [
    {
      sceneIndex: 0,
      name: 'Polarizing Hook',
      startSec: 0,
      endSec: 3,
      pacingDesc: '0.8s punchy declaration',
      visualPrompt: 'Side-by-side tool logos with one getting crossed out dynamically',
      sfxCue: 'Paper Tear',
      cameraMotion: 'Quick Snap-in',
      overlayText: 'WHY I SWITCHED FROM TOOL A TO TOOL B',
    },
    {
      sceneIndex: 1,
      name: 'Context & Baseline',
      startSec: 3,
      endSec: 12,
      pacingDesc: '1.2s cuts showing both dashboards',
      visualPrompt: 'Side-by-side terminal UI showing benchmark environment',
      sfxCue: 'Whoosh',
      cameraMotion: 'Smooth Horizontal Pan',
      overlayText: 'THE 3 BENCHMARKS THAT MATTER',
    },
    {
      sceneIndex: 2,
      name: 'Head-to-Head 3 Rounds',
      startSec: 12,
      endSec: 42,
      pacingDesc: '1.0s cuts per round (Latency -> Context -> Pricing)',
      visualPrompt: 'Round 1: 350ms vs 1200ms. Round 2: 100k context. Round 3: $20/mo vs $40/mo',
      sfxCue: 'Gong Strike',
      cameraMotion: 'Alternating Split-View Focus',
      overlayText: 'ROUND 1: LATENCY | ROUND 2: CONTEXT',
    },
    {
      sceneIndex: 3,
      name: 'Audience Verdict',
      startSec: 42,
      endSec: 50,
      pacingDesc: '1.5s segmenting personas',
      visualPrompt: 'Clear segmentation card: Solo Dev vs Enterprise Compliance',
      sfxCue: 'Metric Ding',
      cameraMotion: 'Centered Card Pop',
      overlayText: 'WHO SHOULD USE WHICH?',
    },
    {
      sceneIndex: 4,
      name: 'Dual Monetization CTA',
      startSec: 50,
      endSec: 60,
      pacingDesc: '2.0s hold with dual links & coupons',
      visualPrompt: 'Clean two-column card showing discount for Tool A and extended trial for Tool B',
      sfxCue: 'Pop Chime',
      cameraMotion: 'Final Pull-back',
      overlayText: 'CLAIM EXCLUSIVE DISCOUNTS BELOW',
    },
  ],
};
