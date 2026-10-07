/**
 * Curated B-Roll Asset Registry for SaaS & Crypto video campaigns.
 * Royalty-free 9:16 vertical motion assets and procedural fallbacks.
 */

import type { BRollAsset, BRollCategory, BRollNiche } from './broll-types';

export const CURATED_BROLL_ASSETS: readonly BRollAsset[] = [
  // --- SAAS ASSETS ---
  {
    id: 'saas-ui-glass-dashboard',
    name: 'Obsidian Glass SaaS Dashboard Metric Stream',
    niche: 'saas_global',
    category: 'saas_ui_walkthrough',
    url: 'https://assets.agencyos.network/broll/saas/dashboard-metrics-9-16.mp4',
    durationSeconds: 5.0,
    aspectRatio: '9:16',
    tags: ['dashboard', 'mrr', 'analytics', 'analytics_graph', 'revenue'],
    recommendedMotion: 'zoom_in',
    isLoopable: true,
  },
  {
    id: 'saas-terminal-code-exec',
    name: 'High-Speed Cloud CLI Deployment Stream',
    niche: 'saas_global',
    category: 'saas_terminal',
    url: 'https://assets.agencyos.network/broll/saas/terminal-cli-9-16.mp4',
    durationSeconds: 4.0,
    aspectRatio: '9:16',
    tags: ['code', 'cli', 'deploy', 'api', 'automation', 'developer'],
    recommendedMotion: 'pan_right',
    isLoopable: true,
  },
  {
    id: 'saas-mockup-mobile-flow',
    name: 'Mobile App Seamless Onboarding Showcase',
    niche: 'saas_global',
    category: 'saas_mockup',
    url: 'https://assets.agencyos.network/broll/saas/mobile-ui-3d-9-16.mp4',
    durationSeconds: 4.5,
    aspectRatio: '9:16',
    tags: ['mobile', 'app', 'workflow', 'product', 'frictionless'],
    recommendedMotion: 'parallax',
    isLoopable: true,
  },

  // --- CRYPTO ASSETS ---
  {
    id: 'crypto-candlestick-green-breakout',
    name: 'Bullish Candlestick Breakout & Order Book Depth',
    niche: 'crypto_global',
    category: 'crypto_candlestick',
    url: 'https://assets.agencyos.network/broll/crypto/candlestick-pump-9-16.mp4',
    durationSeconds: 4.0,
    aspectRatio: '9:16',
    tags: ['candlestick', 'chart', 'breakout', 'trading', 'profit', 'pump'],
    recommendedMotion: 'pulse',
    isLoopable: true,
  },
  {
    id: 'crypto-onchain-nodes-stream',
    name: 'Decentralized On-Chain Validator Network Mesh',
    niche: 'crypto_global',
    category: 'crypto_onchain_flow',
    url: 'https://assets.agencyos.network/broll/crypto/onchain-nodes-9-16.mp4',
    durationSeconds: 5.0,
    aspectRatio: '9:16',
    tags: ['blockchain', 'onchain', 'wallet', 'solana', 'ethereum', 'defi'],
    recommendedMotion: 'pan_left',
    isLoopable: true,
  },
  {
    id: 'crypto-tokenomics-vault-3d',
    name: '3D Gold Holographic Token Staking Vault',
    niche: 'crypto_global',
    category: 'crypto_tokenomics',
    url: 'https://assets.agencyos.network/broll/crypto/token-vault-9-16.mp4',
    durationSeconds: 4.5,
    aspectRatio: '9:16',
    tags: ['tokenomics', 'yield', 'staking', 'airdrop', 'rewards', 'apy'],
    recommendedMotion: 'zoom_in',
    isLoopable: true,
  },

  // --- GENERAL / CROSS-NICHE TECH ASSETS ---
  {
    id: 'tech-abstract-cyber-grid',
    name: 'Neon Cyberpunk Digital Data Highway',
    niche: 'general_tech',
    category: 'abstract_tech',
    url: 'https://assets.agencyos.network/broll/tech/cyber-highway-9-16.mp4',
    durationSeconds: 6.0,
    aspectRatio: '9:16',
    tags: ['cyber', 'speed', 'future', 'ai', 'cloud', 'security'],
    recommendedMotion: 'zoom_out',
    isLoopable: true,
  },
  {
    id: 'tech-profit-celebration-glow',
    name: 'Green Profit Surge Particle Explosion',
    niche: 'general_tech',
    category: 'profit_visual',
    url: 'https://assets.agencyos.network/broll/tech/profit-surge-9-16.mp4',
    durationSeconds: 3.5,
    aspectRatio: '9:16',
    tags: ['money', 'profit', 'cash', 'dollars', 'roi', 'win'],
    recommendedMotion: 'pulse',
    isLoopable: false,
  },
];

export function getAssetsByNiche(niche: BRollNiche): BRollAsset[] {
  return CURATED_BROLL_ASSETS.filter(
    (a) => a.niche === niche || a.niche === 'general_tech'
  );
}

export function getAssetsByCategory(category: BRollCategory): BRollAsset[] {
  return CURATED_BROLL_ASSETS.filter((a) => a.category === category);
}
