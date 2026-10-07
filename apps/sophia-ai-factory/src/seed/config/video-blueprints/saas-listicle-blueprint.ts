/**
 * SaaS Blueprint: Fast Listicle Top 3-5 AI SaaS Stack
 *
 * Top-of-funnel viral listicle highlighting multi-tool synergy replacing expensive human agencies.
 * Layer: seed (foundational primitives & config)
 * @module seed/config/video-blueprints/saas-listicle-blueprint
 */

import type { VideoBlueprint } from './blueprint-types';

export const SAAS_BLUEPRINT_FAST_LISTICLE_TOP_TOOLS: VideoBlueprint = {
  id: 'saas_fast_listicle_top_tools',
  niche: 'saas_global',
  name: 'Fast Listicle: Top 3-5 AI SaaS Stack',
  description: 'Top-of-funnel viral listicle highlighting multi-tool synergy replacing expensive human agencies.',
  targetAudience: 'Agency founders, solopreneurs, digital marketers',
  hookArchetype: 'HIGH_CURIOSITY_LIST',
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
      name: 'High Curiosity Hook',
      startSec: 0,
      endSec: 3,
      pacingDesc: '0.8s flash with bold premise',
      visualPrompt: 'Futuristic terminal displaying agency revenue counter $10k/month',
      sfxCue: 'Bass Drop',
      cameraMotion: 'Instant Zoom-in 140%',
      overlayText: '3 AI TOOLS RUNNING A $10K/MO AGENCY',
    },
    {
      sceneIndex: 1,
      name: 'Tool 1 Micro-Demo',
      startSec: 3,
      endSec: 17,
      pacingDesc: '1.0s cuts, instant outcome',
      visualPrompt: 'Tool 1 UI: Scraping 500 verified B2B leads in 30 seconds',
      sfxCue: 'Keystroke Clack',
      cameraMotion: 'Pan down lead list',
      overlayText: 'TOOL 1: INSTANT LEAD DISCOVERY',
    },
    {
      sceneIndex: 2,
      name: 'Tool 2 Micro-Demo',
      startSec: 17,
      endSec: 31,
      pacingDesc: '1.0s cuts, instant enrichment',
      visualPrompt: 'Tool 2 UI: Automated AI personalization based on prospect LinkedIn',
      sfxCue: 'Whoosh',
      cameraMotion: 'Cursor zoom on email output',
      overlayText: 'TOOL 2: DEEP AI ENRICHMENT',
    },
    {
      sceneIndex: 3,
      name: 'Tool 3 Micro-Demo',
      startSec: 31,
      endSec: 45,
      pacingDesc: '1.0s cuts, auto-send',
      visualPrompt: 'Tool 3 UI: Multi-inbox deliverability and response triage',
      sfxCue: 'Ding',
      cameraMotion: 'Centered view of sent dashboard',
      overlayText: 'TOOL 3: AUTONOMOUS OUTREACH',
    },
    {
      sceneIndex: 4,
      name: 'Stack Cost vs CTA',
      startSec: 45,
      endSec: 60,
      pacingDesc: '1.5s contrast card',
      visualPrompt: 'Total Stack Cost: $49/mo vs Full-time Contractor: $2,500/mo. Verified bonus links pinned',
      sfxCue: 'Pop Chime',
      cameraMotion: 'Final Full Frame',
      overlayText: 'ALL VERIFIED BONUS LINKS PINNED BELOW',
    },
  ],
};
