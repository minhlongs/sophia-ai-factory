/**
 * Crypto Blueprint: Trading Bot & Copy Trading Automation
 *
 * 24/7 spot grid automation, PnL vs Max Drawdown (MDD) analysis, clone master traders.
 * Layer: seed (foundational primitives & config)
 * @module seed/config/video-blueprints/crypto-trading-bot-blueprint
 */

import type { VideoBlueprint } from './blueprint-types';

export const CRYPTO_BLUEPRINT_TRADING_BOT_COPY_TRADING: VideoBlueprint = {
  id: 'crypto_trading_bot_copy_trading',
  niche: 'crypto_global',
  name: 'Trading Bot & Copy Trading Blueprint',
  description: 'Explain 24/7 spot grid automation, analyze backtested PnL vs Max Drawdown (MDD), and clone master traders.',
  targetAudience: 'Systematic crypto traders, passive volatility harvesters',
  hookArchetype: 'AUTOMATION_PROOF',
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
      name: 'Sideways Volatility Hook',
      startSec: 0,
      endSec: 5,
      pacingDesc: '0.9s cuts on live order book',
      visualPrompt: 'Cyber-Fintech candlestick chart showing automated grid lines capturing trades 24/7',
      sfxCue: 'Data Stream Beep',
      cameraMotion: 'Dynamic Zoom-in 135%',
      overlayText: 'HOW SPOT GRID BOTS TRADE WHILE YOU SLEEP',
    },
    {
      sceneIndex: 1,
      name: 'Grid Architecture & Strategy',
      startSec: 5,
      endSec: 25,
      pacingDesc: '1.2s cuts explaining upper/lower bounds',
      visualPrompt: 'Animated SVG grid lines executing buys in red dip and sells in green pump',
      sfxCue: 'Smooth Slide Whoosh',
      cameraMotion: 'Vertical Scan across price levels',
      overlayText: 'UPPER BOUND | LOWER BOUND | SPREAD 0.5%',
    },
    {
      sceneIndex: 2,
      name: 'Rigorous MDD Risk Disclosure',
      startSec: 25,
      endSec: 35,
      pacingDesc: 'Serious calm tone, trust building',
      visualPrompt: 'Drawdown risk chart: What happens when price crashes below grid. Stop-loss parameters',
      sfxCue: 'Warning Tone',
      cameraMotion: 'Static Center Focus',
      overlayText: 'MAX DRAWDOWN RISK: ALWAYS CONFIGURE STOP-LOSS',
    },
    {
      sceneIndex: 3,
      name: 'Terminal Filter & Clone',
      startSec: 35,
      endSec: 45,
      pacingDesc: '1.0s cuts in exchange bot terminal',
      visualPrompt: 'Navigating to bot marketplace, filtering traders with MDD < 15% and win-rate > 80%',
      sfxCue: 'Keystroke Clack',
      cameraMotion: 'Cursor Zoom on Clone Button',
      overlayText: 'ONE-CLICK BOT CLONE VIA PARTNER LINK',
    },
    {
      sceneIndex: 4,
      name: '15s Legal End-Card & CTA',
      startSec: 45,
      endSec: 60,
      pacingDesc: 'Static 15s compliance hold, -18dB audio bed',
      visualPrompt: 'Full legal disclaimer card: Past performance is not indicative of future returns',
      sfxCue: 'Subtle Ambient Hum',
      cameraMotion: 'Completely Static',
      overlayText: 'PAST PERFORMANCE != FUTURE RETURNS. CAPITAL AT RISK',
    },
  ],
};
