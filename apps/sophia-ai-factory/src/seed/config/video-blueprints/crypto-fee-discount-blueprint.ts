/**
 * Crypto Blueprint: Exclusive Fee Rebate & Signup Tier Bonus
 *
 * High-LTV volume conversion blueprint with regulatory compliance.
 * Layer: seed (foundational primitives & config)
 * @module seed/config/video-blueprints/crypto-fee-discount-blueprint
 */

import type { VideoBlueprint } from './blueprint-types';

export const CRYPTO_BLUEPRINT_FEE_DISCOUNT_SIGNUP_BONUS: VideoBlueprint = {
  id: 'crypto_fee_discount_signup_bonus',
  niche: 'crypto_global',
  name: 'Exclusive Fee Rebate & Signup Tier Bonus',
  description: 'Highlight fee tier bleeding, demonstrate 20-30% lifetime rebate activation, claim $1,000-$5,000 bonus.',
  targetAudience: 'Active crypto traders, futures scalpers, spot volume traders',
  hookArchetype: 'FINANCIAL_LOSS_WARNING',
  defaultDurationSec: 60,
  aspectRatio: '9:16',
  complianceRequirements: {
    requiresFtcDisclosure: true,
    requiresCryptoRiskBanner: true,
    requiresEndCard15s: true,
    restrictedJurisdictions: ['VN', 'SG'],
  },
  monetizationModel: 'VOLUME_REBATE',
  scenes: [
    {
      sceneIndex: 0,
      name: 'Fee Bleed Hook',
      startSec: 0,
      endSec: 5,
      pacingDesc: '0.8s cuts with shock value',
      visualPrompt: 'Obsidian Slate UI showing $500k volume bleeding $450 in taker fees monthly',
      sfxCue: 'Coin Drop Warning',
      cameraMotion: 'Rapid Zoom-in 130%',
      overlayText: 'STOP BLEEDING 30% IN EXCHANGE FEES',
    },
    {
      sceneIndex: 1,
      name: 'Rebate Math & Proof',
      startSec: 5,
      endSec: 20,
      pacingDesc: '1.2s cuts with fee tier comparison',
      visualPrompt: 'Exchange fee ladder contrast: Standard tier vs 20% Lifetime Kickback Tier',
      sfxCue: 'Whoosh',
      cameraMotion: 'Pan right along fee tier table',
      overlayText: 'STANDARD: 0.05% vs VIP REBATE: -20% BACK',
    },
    {
      sceneIndex: 2,
      name: 'Registration & Bonus Demo',
      startSec: 20,
      endSec: 35,
      pacingDesc: '1.0s cuts showing official exchange app',
      visualPrompt: 'Screen record: Inputting partner referral code, confirming fee discount badge, claiming bonus',
      sfxCue: 'Keystroke Clack',
      cameraMotion: 'Cursor zoom on referral tag confirmation',
      overlayText: 'CODE VERIFIED: 20% COMMISSION KICKBACK ACTIVATED',
    },
    {
      sceneIndex: 3,
      name: 'Mid-roll Risk Disclosure',
      startSec: 35,
      endSec: 45,
      pacingDesc: 'Calm pacing with mandatory audio disclosure',
      visualPrompt: 'Bottom-third card: Capital at risk. 70-80% retail lose money. Paid partnership',
      sfxCue: 'Warning Ping',
      cameraMotion: 'Static Focus',
      overlayText: 'RISK WARNING: TRADING CARRIES RISK OF LOSS. NFA',
    },
    {
      sceneIndex: 4,
      name: '15s Legal End-Card & CTA',
      startSec: 45,
      endSec: 60,
      pacingDesc: 'Static 15s hold, audio bed dips to -18dB',
      visualPrompt: 'Obsidian dark card with full CFTC/MiCA risk disclosure, partner code, link in bio',
      sfxCue: 'Subtle Ambient Hum',
      cameraMotion: 'Completely Static',
      overlayText: 'MANDATORY FINANCIAL & LEGAL DISCLOSURE (CFTC 4.41 / MiCA)',
    },
  ],
};
