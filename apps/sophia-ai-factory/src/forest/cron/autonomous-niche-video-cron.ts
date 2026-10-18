/**
 * Autonomous Niche Video Cron Worker
 *
 * Scans top trending SaaS and Crypto affiliate opportunities and dispatches
 * automated compliant video generation workflows.
 * Layer: forest/cron (Infrastructure orchestrator)
 * @module forest/cron/autonomous-niche-video-cron
 */

import { inngest } from '@/seed/inngest/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { evaluateJurisdictionCompliance } from '@/tree/video/compliance/jurisdiction-compliance-guard';
import {
  AUTONOMOUS_DEAL_CATALOG,
  type AutonomousNicheDeal,
  type AutonomousNicheCronResult,
} from './autonomous-niche-video-catalog';

export {
  AUTONOMOUS_DEAL_CATALOG,
  type AutonomousNicheDeal,
  type AutonomousNicheCronResult,
};

export async function runAutonomousNicheVideoCron(): Promise<AutonomousNicheCronResult> {
  logger.info('runAutonomousNicheVideoCron: starting autonomous cycle', {
    candidates: AUTONOMOUS_DEAL_CATALOG.length,
  });

  let dispatchedCount = 0;
  let rejectedCount = 0;

  try {
    for (const deal of AUTONOMOUS_DEAL_CATALOG) {
      const compliance = evaluateJurisdictionCompliance(deal.niche, deal.jurisdiction);

      if (!compliance.isAllowed) {
        logger.info('runAutonomousNicheVideoCron: candidate rejected by compliance', {
          product: deal.productName,
          jurisdiction: deal.jurisdiction,
          reason: compliance.reason,
        });
        rejectedCount++;
        continue;
      }

      await inngest.send({
        name: 'niche.video.campaign.requested',
        data: {
          userId: 'usr_autonomous_cron',
          niche: deal.niche,
          blueprintId: deal.blueprintId,
          productName: deal.productName,
          productUrl: deal.productUrl,
          targetAudience: deal.targetAudience,
          jurisdiction: deal.jurisdiction,
          affiliateCode: deal.affiliateCode,
          subId: `cron_${Date.now()}`,
          locale: 'en',
        },
      });

      dispatchedCount++;
    }

    logger.info('runAutonomousNicheVideoCron: completed cycle', {
      dispatchedCount,
      rejectedCount,
    });

    return {
      success: true,
      totalCandidates: AUTONOMOUS_DEAL_CATALOG.length,
      dispatchedCount,
      rejectedCount,
    };
  } catch (err: unknown) {
    const error = toError(err);
    logger.error('runAutonomousNicheVideoCron: cron execution failed', error);
    return {
      success: false,
      totalCandidates: AUTONOMOUS_DEAL_CATALOG.length,
      dispatchedCount,
      rejectedCount,
      error: error.message,
    };
  }
}
