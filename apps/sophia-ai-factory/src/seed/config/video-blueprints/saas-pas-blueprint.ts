/**
 * SaaS Blueprint: Problem - Agitation - Solution (SOP Fix)
 *
 * Hook on visceral operational pain, demo 3-step automation, prove ROI metric.
 * Layer: seed (foundational primitives & config)
 * @module seed/config/video-blueprints/saas-pas-blueprint
 */

import type { VideoBlueprint } from './blueprint-types';

export const SAAS_BLUEPRINT_PROBLEM_AGITATION_SOLUTION: VideoBlueprint = {
  id: 'saas_problem_agitation_solution',
  niche: 'saas_global',
  name: 'Problem - Agitation - AI SaaS Solution (SOP Fix)',
  description: 'Hook on visceral operational pain, demo 3-step automation, prove ROI metric, and CTA for trial.',
  targetAudience: 'Solopreneurs, agency owners, ops leads, tech founders',
  hookArchetype: 'STATISTIC_PAIN',
  defaultDurationSec: 60,
  aspectRatio: '9:16',
  complianceRequirements: {
    requiresFtcDisclosure: true,
    requiresCryptoRiskBanner: false,
    requiresEndCard15s: false,
  },
  monetizationModel: 'RECURRING_MRR',
  scenes: [
    {
      sceneIndex: 0,
      name: 'Pain Hook',
      startSec: 0,
      endSec: 3,
      pacingDesc: 'Fast 0.8s cut, direct punchline',
      visualPrompt: 'Minimalist Dark UI with glowing red metric counter highlighting wasted hours',
      sfxCue: 'Keystroke Clack',
      cameraMotion: 'Rapid Zoom-in 135%',
      overlayText: 'STOP WASTING 8H/WEEK',
    },
    {
      sceneIndex: 1,
      name: 'Agitation & Chaos',
      startSec: 3,
      endSec: 12,
      pacingDesc: 'Chaotic rapid flashes 1.0s',
      visualPrompt: 'Screen capture of messy workspace, 20 open browser tabs, spreadsheet formatting errors',
      sfxCue: 'Glitch Whoosh',
      cameraMotion: 'Subtle Pan-right',
      overlayText: 'MANUAL WORKFLOWS BURN CAPITAL',
    },
    {
      sceneIndex: 2,
      name: 'SaaS 3-Step Demo',
      startSec: 12,
      endSec: 38,
      pacingDesc: 'Smooth 300ms transition cuts, zero idle latency',
      visualPrompt: 'Clean Obsidian Dark UI, single-click automated flow execution, AI generated output',
      sfxCue: 'Smooth Slide Whoosh',
      cameraMotion: 'Centered Cursor Tracking 125%',
      overlayText: 'STEP 1: CONNECT -> STEP 2: GENERATE',
    },
    {
      sceneIndex: 3,
      name: 'Proof & ROI Contrast',
      startSec: 38,
      endSec: 48,
      pacingDesc: 'Calm 1.5s hold with bold stats',
      visualPrompt: 'Split-screen Before vs After: 8 Hours vs 45 Seconds. $0 upfront investment',
      sfxCue: 'Metric Ding',
      cameraMotion: 'Static Punchy Pop',
      overlayText: '8 HOURS -> 45 SECONDS',
    },
    {
      sceneIndex: 4,
      name: 'Frictionless CTA',
      startSec: 48,
      endSec: 60,
      pacingDesc: 'Clear 2.0s hold with vanity coupon',
      visualPrompt: 'Clean CTA screen showing trial button with exclusive credits badge',
      sfxCue: 'Pop Chime',
      cameraMotion: 'Zoom-out to Full Frame',
      overlayText: 'FREE 14-DAY TRIAL + CREDITS IN PINNED COMMENT',
    },
  ],
};
