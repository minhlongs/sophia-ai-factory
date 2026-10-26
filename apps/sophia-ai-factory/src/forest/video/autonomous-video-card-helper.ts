/**
 * @module forest/video/autonomous-video-card-helper
 * Helper for generating deterministic card SVGs and scene-graphs in autonomous video orchestrator.
 */

import { generateCexComparisonCardSvg } from '@/tree/video/data-cards/cex-comparison-card-svg';
import { generateSaasRoiCardSvg } from '@/tree/video/data-cards/saas-roi-card-svg';
import { buildHybridSceneGraph } from '@/tree/video/scene-graph/hybrid-scene-graph-builder';
import type { VideoNiche } from '@/seed/config/video-blueprints/blueprint-types';
import type { HybridSceneGraph } from '@/seed/config/video-blueprints/scene-graph-types';

export interface SceneGraphHelperInput {
  campaignId: string;
  niche: VideoNiche;
  productName: string;
  jurisdiction: string;
  hookPrompt: string;
  fullScript: string;
  disclaimerText: string;
  regulatoryRef: string;
  referralCode: string;
  targetDurationSeconds: number;
}

export function buildOrchestratorSceneGraph(input: SceneGraphHelperInput): HybridSceneGraph {
  const cardSvg =
    input.niche === 'crypto_global'
      ? generateCexComparisonCardSvg({
          primaryExchange: input.productName,
          competitorExchange: 'Standard CEX',
          btcPriceUsd: '96,450',
          change24hPct: '+3.45',
          makerFeeDiscount: '0.08% VIP Maker',
          takerFeeDiscount: '20% Fee Rebate',
          kickbackRatePct: '20',
          referralCode: input.referralCode,
        })
      : generateSaasRoiCardSvg({
          productName: input.productName,
          category: 'B2B AI Automation',
          monthlySavingsUsd: '2,400',
          hoursSavedWeekly: '18',
          efficiencyGainPct: '320',
          startingPriceUsd: '49',
          affiliateDealNote: `Code ${input.referralCode}: 20% Off`,
        });

  return buildHybridSceneGraph({
    campaignId: input.campaignId,
    niche: input.niche,
    jurisdiction: input.jurisdiction,
    hookPrompt: input.hookPrompt,
    cardType: input.niche === 'crypto_global' ? 'CEX_COMPARISON_CARD' : 'SAAS_ROI_CARD',
    cardSvg,
    narrationText: input.fullScript,
    voiceId: 'eleven_multilingual_v2',
    disclaimerText: input.disclaimerText,
    regulatoryRef: input.regulatoryRef,
    referralCode: input.referralCode,
    totalDurationSec: input.targetDurationSeconds,
  });
}
