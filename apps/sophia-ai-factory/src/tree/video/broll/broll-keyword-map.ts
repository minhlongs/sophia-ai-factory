/**
 * B-Roll Keyword Category Mapping & Motion Rotation Constants
 *
 * Layer: tree/video/broll
 *
 * @module tree/video/broll/broll-keyword-map
 */

import type { BRollCategory, BRollMotionStyle, BRollNiche } from './broll-types';

export const KEYWORD_CATEGORY_MAP: Record<string, BRollCategory> = {
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

export const MOTION_ROTATION: BRollMotionStyle[] = [
  'zoom_in',
  'pan_right',
  'pulse',
  'parallax',
  'zoom_out',
  'pan_left',
];

export function detectSliceCategory(
  sliceWords: string[],
  niche: BRollNiche,
  sliceIndex: number,
): BRollCategory {
  for (const w of sliceWords) {
    const clean = w.replace(/[^a-z0-9]/g, '');
    if (KEYWORD_CATEGORY_MAP[clean]) {
      return KEYWORD_CATEGORY_MAP[clean];
    }
  }

  return niche === 'crypto_global'
    ? (sliceIndex % 2 === 0 ? 'crypto_candlestick' : 'crypto_tokenomics')
    : (sliceIndex % 2 === 0 ? 'saas_ui_walkthrough' : 'saas_terminal');
}
