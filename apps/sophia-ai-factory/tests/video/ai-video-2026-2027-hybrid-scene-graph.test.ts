import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCertification } from '@/seed/ai/certification/capability-matrix';
import { ProviderCertificationState } from '@/seed/ai/certification/types';
import { rankModelsForTask, computeModelScore } from '@/tree/video/radar/model-radar-scorer';
import { evaluatePreRenderCompliance } from '@/tree/video/compliance/pre-render-compliance-gate';
import { generateCexComparisonCardSvg } from '@/tree/video/data-cards/cex-comparison-card-svg';
import { generateSaasRoiCardSvg } from '@/tree/video/data-cards/saas-roi-card-svg';
import { buildHybridSceneGraph } from '@/tree/video/scene-graph/hybrid-scene-graph-builder';
import { routeVideoGenerationJob } from '@/tree/video/providers/unified-video-router';
import { runAutonomousVideoPipeline } from '@/forest/video/autonomous-video-orchestrator';

vi.mock('@/tree/byok/user-api-key-store', () => ({ getUserApiKey: vi.fn() }));
import { getUserApiKey } from '@/tree/byok/user-api-key-store';

describe('AI Video 2026-2027 Hybrid Scene-Graph Architecture', () => {
  beforeEach(() => vi.clearAllMocks());

  it('certifies fal_ai, replicate, heygen, and elevenlabs as PRODUCTION_READY', () => {
    expect(getCertification('fal_ai').state).toBe(ProviderCertificationState.PRODUCTION_READY);
    expect(getCertification('replicate').state).toBe(ProviderCertificationState.PRODUCTION_READY);
    expect(getCertification('heygen').state).toBe(ProviderCertificationState.PRODUCTION_READY);
    expect(getCertification('elevenlabs').state).toBe(ProviderCertificationState.PRODUCTION_READY);
  });

  it('correctly ranks 2026-2027 video models with Kling 2.1 and Veo 3 top-ranked for 3s hooks', () => {
    const rankedHooks = rankModelsForTask('HOOK_CINEMATIC_3S');
    expect(rankedHooks.length).toBeGreaterThanOrEqual(3);
    expect(rankedHooks[0].rank).toBe(1);
    expect(rankedHooks[0].compositeScore).toBeGreaterThan(0.85);
    expect(['fal-ai/veo3/fast', 'fal-ai/kling-video/v2.1/master/text-to-video']).toContain(rankedHooks[0].modelId);
    expect(computeModelScore(rankedHooks[0])).toBeGreaterThan(0.85);
  });

  it('enforces pre-render compliance: blocks VN and SG for crypto_global', () => {
    const vn = evaluatePreRenderCompliance({ niche: 'crypto_global', targetJurisdiction: 'VN', scriptText: 'Trade on Binance.' });
    expect(vn.isAllowed).toBe(false);
    expect(vn.blockingReason).toBe('VIETNAM_PROMOTIONAL_BAN');

    const sg = evaluatePreRenderCompliance({ niche: 'crypto_global', targetJurisdiction: 'SG', scriptText: 'Trade on Bybit.' });
    expect(sg.isAllowed).toBe(false);
    expect(sg.blockingReason).toBe('SINGAPORE_MAS_PSN08_RETAIL_BAN');
  });

  it('enforces pre-render compliance: blocks prohibited lexical financial claims before GPU spend', () => {
    const claim = evaluatePreRenderCompliance({
      niche: 'saas_global',
      targetJurisdiction: 'US',
      scriptText: 'Sign up now for a guaranteed profit and risk-free return on trading!',
    });
    expect(claim.isAllowed).toBe(false);
    expect(claim.lexicalViolations.length).toBeGreaterThan(0);
    expect(claim.blockingReason).toContain('PROHIBITED_FINANCIAL_CLAIM');
    expect(claim.suggestedRewritesEn.length).toBeGreaterThan(0);
  });

  it('renders deterministic 1080x1920 SVG data cards with strict XML escaping', () => {
    const cexSvg = generateCexComparisonCardSvg({
      primaryExchange: 'Binance <VIP>',
      competitorExchange: 'Standard & Co',
      btcPriceUsd: '96,450',
      change24hPct: '+3.45',
      makerFeeDiscount: '0.08% Maker',
      takerFeeDiscount: '20% Rebate',
      kickbackRatePct: '20',
      referralCode: 'SOPHIA"VIP"',
    });
    expect(cexSvg).toContain('viewBox="0 0 1080 1920"');
    expect(cexSvg).toContain('Binance &lt;VIP&gt;');
    expect(cexSvg).toContain('Standard &amp; Co');
    expect(cexSvg).not.toContain('Binance <VIP>');

    const saasSvg = generateSaasRoiCardSvg({
      productName: 'ApexCRM AI & Agents',
      category: 'B2B Automation',
      monthlySavingsUsd: '2,400',
      hoursSavedWeekly: '18',
      efficiencyGainPct: '320',
      startingPriceUsd: '49',
      affiliateDealNote: 'Save 20%',
    });
    expect(saasSvg).toContain('ApexCRM AI &amp; Agents');
    expect(saasSvg).toContain('viewBox="0 0 1080 1920"');
  });

  it('constructs complete 4-node Hybrid Scene-Graph', () => {
    const graph = buildHybridSceneGraph({
      campaignId: 'camp-test-01',
      niche: 'crypto_global',
      jurisdiction: 'GLOBAL',
      hookPrompt: 'Cinematic Bitcoin chart breaking all-time high',
      cardType: 'CEX_COMPARISON_CARD',
      cardSvg: '<svg></svg>',
      narrationText: 'Check out the lowest trading fees on OKX.',
      voiceId: 'eleven_turbo_v2',
      disclaimerText: 'Crypto trading involves substantial risk of loss.',
      regulatoryRef: 'FTC 16 C.F.R. § 255',
      referralCode: 'SOPHIA50',
      totalDurationSec: 20.0,
    });
    expect(graph.nodes.length).toBe(4);
    expect(graph.nodes[0].kind).toBe('GENERATIVE_HOOK_BROLL');
    expect(graph.nodes[1].kind).toBe('DETERMINISTIC_DATA_CARD');
    expect(graph.nodes[2].kind).toBe('AVATAR_AUTHORITY_SEGMENT');
    expect(graph.nodes[3].kind).toBe('COMPLIANCE_END_CARD');
  });

  it('routes video jobs via BYOK key and falls back cleanly when missing', async () => {
    vi.mocked(getUserApiKey).mockResolvedValue(null);
    const res = await routeVideoGenerationJob({
      userId: 'usr_no_keys',
      campaignId: 'camp_001',
      sceneTask: 'HOOK_CINEMATIC_3S',
      prompt: 'Neon crypto chart',
      durationSec: 3.0,
      aspectRatio: '9:16',
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('BYOK_KEY_MISSING');
  });

  it('runs autonomous video pipeline end-to-end with sceneGraph embedded in manifest', () => {
    const summary = runAutonomousVideoPipeline({
      campaignId: 'camp-saas-hybrid',
      niche: 'saas_global',
      productName: 'Sophia Agentic Platform',
      productUrl: 'https://sophia.agencyos.network',
      productDescription: 'Autonomous revenue engines for digital agencies.',
      targetDurationSeconds: 15.0,
      affiliateBaseUrl: 'https://sophia.agencyos.network/partner',
    });
    expect(summary.success).toBe(true);
    expect(summary.manifest.sceneGraph?.nodes.length).toBe(4);
  });
});
