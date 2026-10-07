/**
 * B-Roll Matcher & Visual Timeline Synthesizer.
 * Analyzes script text, sentiment, and pacing to generate high-retention video cues.
 */

import { getAssetsByNiche } from './broll-asset-registry';
import type {
  BRollAsset,
  BRollCategory,
  BRollCue,
  BRollMatchRequest,
  BRollMatchResult,
  BRollMotionStyle,
} from './broll-types';

const KEYWORD_CATEGORY_MAP: Record<string, BRollCategory> = {
  // SaaS triggers
  dashboard: 'saas_ui_walkthrough',
  metrics: 'saas_ui_walkthrough',
  analytics: 'saas_ui_walkthrough',
  revenue: 'saas_ui_walkthrough',
  mrr: 'saas_ui_walkthrough',
  code: 'saas_terminal',
  api: 'saas_terminal',
  deploy: 'saas_terminal',
  terminal: 'saas_terminal',
  developer: 'saas_terminal',
  app: 'saas_mockup',
  mobile: 'saas_mockup',
  tool: 'saas_mockup',
  platform: 'saas_mockup',
  software: 'saas_mockup',

  // Crypto triggers
  chart: 'crypto_candlestick',
  candlestick: 'crypto_candlestick',
  trading: 'crypto_candlestick',
  bull: 'crypto_candlestick',
  pump: 'crypto_candlestick',
  breakout: 'crypto_candlestick',
  blockchain: 'crypto_onchain_flow',
  solana: 'crypto_onchain_flow',
  ethereum: 'crypto_onchain_flow',
  wallet: 'crypto_onchain_flow',
  onchain: 'crypto_onchain_flow',
  token: 'crypto_tokenomics',
  staking: 'crypto_tokenomics',
  airdrop: 'crypto_tokenomics',
  yield: 'crypto_tokenomics',
  apy: 'crypto_tokenomics',

  // Profit / Impact triggers
  profit: 'profit_visual',
  money: 'profit_visual',
  cash: 'profit_visual',
  earn: 'profit_visual',
  growth: 'profit_visual',
  roi: 'profit_visual',
};

const MOTION_ROTATION: BRollMotionStyle[] = [
  'zoom_in',
  'pan_right',
  'pulse',
  'parallax',
  'zoom_out',
  'pan_left',
];

export function matchBRollTimeline(request: BRollMatchRequest): BRollMatchResult {
  const {
    niche,
    totalDurationSeconds,
    scriptText,
    targetCutIntervalSeconds = 2.5,
  } = request;

  const availableAssets = getAssetsByNiche(niche);
  const words = scriptText.toLowerCase().split(/\s+/);
  const totalCuts = Math.max(1, Math.ceil(totalDurationSeconds / targetCutIntervalSeconds));
  const cutDuration = totalDurationSeconds / totalCuts;

  const cues: BRollCue[] = [];

  for (let i = 0; i < totalCuts; i++) {
    const startTime = Number((i * cutDuration).toFixed(2));
    const endTime = Number(Math.min(totalDurationSeconds, (i + 1) * cutDuration).toFixed(2));
    const duration = Number((endTime - startTime).toFixed(2));

    // Sample words in this time slice
    const wordSliceStart = Math.floor((i / totalCuts) * words.length);
    const wordSliceEnd = Math.floor(((i + 1) / totalCuts) * words.length);
    const sliceWords = words.slice(wordSliceStart, Math.max(wordSliceStart + 1, wordSliceEnd));

    // Find category from keyword match or fallback
    let detectedCategory: BRollCategory | null = null;
    for (const w of sliceWords) {
      const clean = w.replace(/[^a-z0-9]/g, '');
      if (KEYWORD_CATEGORY_MAP[clean]) {
        detectedCategory = KEYWORD_CATEGORY_MAP[clean];
        break;
      }
    }

    if (!detectedCategory) {
      detectedCategory =
        niche === 'crypto_global'
          ? (i % 2 === 0 ? 'crypto_candlestick' : 'crypto_tokenomics')
          : (i % 2 === 0 ? 'saas_ui_walkthrough' : 'saas_terminal');
    }

    // Match best asset
    const matchingAsset =
      availableAssets.find((a) => a.category === detectedCategory) ||
      availableAssets[i % availableAssets.length];

    const motionStyle =
      matchingAsset?.recommendedMotion ||
      MOTION_ROTATION[i % MOTION_ROTATION.length];

    const promptFallback = `Cinematic 9:16 vertical 4k render of ${detectedCategory.replace(/_/g, ' ')}, hyper-detailed lighting, sleek cyber aesthetic`;

    cues.push({
      assetId: matchingAsset ? matchingAsset.id : `ai-gen-${detectedCategory}-${i}`,
      category: detectedCategory,
      assetUrl: matchingAsset ? matchingAsset.url : '',
      startTimeSeconds: startTime,
      endTimeSeconds: endTime,
      durationSeconds: duration,
      motionStyle,
      promptFallback,
      overlayOpacity: 0.9,
    });
  }

  const coveredDuration = cues.reduce((sum, c) => sum + c.durationSeconds, 0);
  const coveragePercentage = Number(
    Math.min(100, (coveredDuration / totalDurationSeconds) * 100).toFixed(1)
  );

  return {
    niche,
    cues,
    totalCues: cues.length,
    averageCutDuration: Number(cutDuration.toFixed(2)),
    coveragePercentage,
  };
}
