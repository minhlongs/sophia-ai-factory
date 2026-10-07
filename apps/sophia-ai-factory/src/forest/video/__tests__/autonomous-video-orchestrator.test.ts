import { describe, expect, it } from 'vitest';
import { runAutonomousVideoPipeline } from '../autonomous-video-orchestrator';

describe('Autonomous Video Pipeline Orchestrator', () => {
  it('executes full pipeline for SaaS Global niche successfully', () => {
    const summary = runAutonomousVideoPipeline({
      campaignId: 'camp-saas-001',
      niche: 'saas_global',
      productName: 'ApexCRM AI',
      productUrl: 'https://apexcrm.io',
      productDescription: 'Autonomous CRM that closes leads via AI voice agents.',
      targetDurationSeconds: 15.0,
      affiliateBaseUrl: 'https://apexcrm.io/partner',
    });

    expect(summary.success).toBe(true);
    expect(summary.campaignId).toBe('camp-saas-001');
    expect(summary.hookVariantsGeneratedCount).toBe(4);
    expect(summary.totalBrollCuts).toBeGreaterThanOrEqual(5);
    expect(summary.totalSfxCues).toBeGreaterThanOrEqual(3);

    // Verify manifest completeness
    const { manifest } = summary;
    expect(manifest.dimensions).toEqual({ width: 1080, height: 1920 });
    expect(manifest.subtitles.chunks.length).toBeGreaterThan(0);
    expect(manifest.audioMix.duckingKeyframes.length).toBeGreaterThan(0);
    expect(manifest.syndication.platforms.youtube_shorts).toBeDefined();
    expect(manifest.syndication.platforms.tiktok).toBeDefined();
    expect(manifest.syndication.platforms.instagram_reels).toBeDefined();
  });

  it('executes full pipeline for Crypto Global niche with compliance and candlestick B-roll', () => {
    const summary = runAutonomousVideoPipeline({
      campaignId: 'camp-crypto-002',
      niche: 'crypto_global',
      productName: 'SolTrade Bot',
      productUrl: 'https://soltrade.xyz',
      productDescription: 'Algorithmic DEX sniper bot on Solana with automated profit taking.',
      targetDurationSeconds: 20.0,
      affiliateBaseUrl: 'https://soltrade.xyz/ref',
    });

    expect(summary.success).toBe(true);
    expect(summary.manifest.niche).toBe('crypto_global');
    expect(summary.manifest.complianceOverlay.disclaimerText).toBeDefined();
    expect(summary.manifest.brollCues.some((c) => c.category === 'crypto_candlestick' || c.category === 'crypto_tokenomics')).toBe(true);
  });
});
