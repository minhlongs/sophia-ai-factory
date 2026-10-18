/**
 * Swarm Capability Handlers Dispatcher
 *
 * @module tree/autonomous/swarm-capability-handlers
 */

import type { AutonomousCapability } from '@/seed/types/autonomous-engine';
import type { PolicyEvaluationVerdict } from '@/seed/types/agent-governance';
import type {
  CAPABILITY_BUDGETS,
  SwarmExecutionContext,
  SwarmExecutionResult,
} from './swarm-types';
import { discoverAffiliateOffers } from './swarm-affiliate-scout';
import { generateViralVideoScript } from './swarm-content-producer';
import { generateMultiPlatformSyndication } from './swarm-auto-publisher';

export function dispatchAllowedCapability(
  cap: AutonomousCapability,
  budget: (typeof CAPABILITY_BUDGETS)[AutonomousCapability],
  context: SwarmExecutionContext,
  verdict?: PolicyEvaluationVerdict,
): SwarmExecutionResult {
  switch (cap) {
    case 'affiliate-scout': {
      const scoutOutput = discoverAffiliateOffers();
      return {
        success: true,
        capability: cap,
        mcuConsumed: budget.mcuRequired,
        tokensUsed: budget.tokensEstimate,
        actionsTaken: [
          `Scanned affiliate programs (${scoutOutput.scannedNetworks.join(', ')})`,
          'Filtered high-EPC offers > $5',
          `Updated active affiliate catalog with ${scoutOutput.qualifiedOffers.length} programs`,
        ],
        details: scoutOutput,
        governanceVerdict: verdict,
        escalationTriggered: verdict?.escalationTriggered ?? false,
      };
    }

    case 'content-producer': {
      const producerOutput = generateViralVideoScript();
      return {
        success: true,
        capability: cap,
        mcuConsumed: budget.mcuRequired,
        tokensUsed: budget.tokensEstimate,
        actionsTaken: [
          `Generated high-hook bilingual script (Hook score: ${producerOutput.qualityMetrics.hookScore})`,
          'Synthesized voice-track via ElevenLabs',
          'Rendered avatar draft & stored in Cloudflare R2',
        ],
        details: producerOutput,
        governanceVerdict: verdict,
        escalationTriggered: verdict?.escalationTriggered ?? false,
      };
    }

    case 'auto-publisher': {
      const targetMarket = context.targetMarket || 'VN';
      const publisherOutput = generateMultiPlatformSyndication({
        targetMarkets: [targetMarket],
      });
      return {
        success: true,
        capability: cap,
        mcuConsumed: budget.mcuRequired,
        tokensUsed: budget.tokensEstimate,
        actionsTaken: [
          'Verified video render status',
          'Generated platform SEO metadata',
          `Dispatched YouTube and TikTok syndication payload (Scheduled for ${targetMarket} APAC peak)`,
        ],
        details: publisherOutput,
        governanceVerdict: verdict,
        escalationTriggered: verdict?.escalationTriggered ?? false,
      };
    }

    default:
      return {
        success: false,
        capability: cap,
        mcuConsumed: 0,
        tokensUsed: 0,
        actionsTaken: [],
        error: `Unknown capability: ${cap}`,
      };
  }
}
