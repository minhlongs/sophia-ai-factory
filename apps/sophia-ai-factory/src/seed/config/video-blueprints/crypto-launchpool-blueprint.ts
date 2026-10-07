/**
 * Crypto Blueprint: Exchange Launchpool & Token Staking Guide
 *
 * Staking stablecoins/native assets to harvest new tokens before public trading.
 * Layer: seed (foundational primitives & config)
 * @module seed/config/video-blueprints/crypto-launchpool-blueprint
 */

import type { VideoBlueprint } from './blueprint-types';

export const CRYPTO_BLUEPRINT_EXCHANGE_LAUNCHPOOL: VideoBlueprint = {
  id: 'crypto_exchange_launchpool',
  niche: 'crypto_global',
  name: 'Exchange Launchpool & Token Staking Guide',
  description: 'Step-by-step staking BNB/USDT/FDUSD to harvest newly listed tokens before public trading goes live.',
  targetAudience: 'Web3 yield seekers, early token farmers',
  hookArchetype: 'EXCLUSIVE_ACCESS',
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
      name: 'Pre-Market Allocation Hook',
      startSec: 0,
      endSec: 6,
      pacingDesc: '0.8s fast cut with ticker animations',
      visualPrompt: 'New token launch countdown banner with hourly reward counter',
      sfxCue: 'Clock Tick Accelerating',
      cameraMotion: 'Zoom-in 130%',
      overlayText: 'GET NEW TOKENS BEFORE PUBLIC TRADING OPENS',
    },
    {
      sceneIndex: 1,
      name: 'Mechanism & Staking Pools',
      startSec: 6,
      endSec: 25,
      pacingDesc: '1.2s cuts explaining pool dilution & APY',
      visualPrompt: 'Pool breakdown: Stablecoin pool vs Native token pool. Hourly harvest mechanism',
      sfxCue: 'Whoosh',
      cameraMotion: 'Side-by-side Pan',
      overlayText: 'COMMIT STABLECOINS -> EARN NEW TOKEN HOURLY',
    },
    {
      sceneIndex: 2,
      name: 'Mobile App Execution Walkthrough',
      startSec: 25,
      endSec: 40,
      pacingDesc: '1.0s cuts on mobile device frame',
      visualPrompt: 'Mobile screen recording: Tap Launchpool -> Lock USDT -> Harvest tokens to Spot wallet',
      sfxCue: 'Phone Tap Ding',
      cameraMotion: 'Mobile frame centered zoom',
      overlayText: 'LOCK -> SNAPSHOT -> HARVEST TO SPOT',
    },
    {
      sceneIndex: 3,
      name: 'Yield Variance & Lockup Terms',
      startSec: 40,
      endSec: 45,
      pacingDesc: 'Clear brief risk warning',
      visualPrompt: 'Callout card: Pool APY fluctuates based on total TVL. Zero impermanent loss on stablecoins',
      sfxCue: 'Warning Ping',
      cameraMotion: 'Card Pop',
      overlayText: 'APY FLUCTUATES WITH POOL SIZE. READ TERMS',
    },
    {
      sceneIndex: 4,
      name: '15s Legal End-Card & Registration CTA',
      startSec: 45,
      endSec: 60,
      pacingDesc: 'Static 15s hold, audio bed dipped to -18dB',
      visualPrompt: 'Standardized compliance disclosure card with partner link for KYC bonus',
      sfxCue: 'Subtle Ambient Hum',
      cameraMotion: 'Completely Static',
      overlayText: 'DISCLOSURE: NOT FINANCIAL ADVICE. PAID PARTNERSHIP',
    },
  ],
};
