import type {
  CampaignOutput,
  DistributionResult,
  GatewayChannel,
  PublishResult,
} from '@/tree/gateway/gateway-types';
import {
  SELF_HEAL_RETRY_POLICY,
  SELF_HEAL_CONCURRENCY,
} from './types';
import { pLimit } from './signature-signer';
import { publishWithRetry } from './circuit-breaker-client';

/**
 * Self-heal helper: retry failed distributions from a previous result.
 */
export async function selfHealDistribution(
  channels: Map<string, GatewayChannel>,
  content: CampaignOutput,
  previousResult: DistributionResult,
): Promise<DistributionResult & { healed: number; failed: number; errors: string[] }> {
  const failedChannelIds = previousResult.results
    .filter((r) => !r.success)
    .map((r) => r.channelId);

  const passedResults = previousResult.results.filter((r) => r.success);

  const tasks = failedChannelIds.map((channelId) => (): Promise<PublishResult> => {
    const channel = channels.get(channelId);
    if (!channel || !channel.enabled) {
      return Promise.resolve({
        channelId,
        success: false,
        error: 'Channel not found or disabled',
      });
    }
    return publishWithRetry(channel, content, SELF_HEAL_RETRY_POLICY);
  });

  const settled = await pLimit(tasks, SELF_HEAL_CONCURRENCY);

  const retryResults: PublishResult[] = settled.map((outcome, index) => {
    if (outcome.status === 'fulfilled') return outcome.value;
    return {
      channelId: failedChannelIds[index],
      success: false,
      error: outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason),
    };
  });

  const allResults = [...passedResults, ...retryResults];
  const errors = retryResults.filter((r) => !r.success).map((r) => r.error ?? 'unknown');

  return {
    campaignId: content.campaignId,
    results: allResults,
    allSucceeded: allResults.every((r) => r.success),
    healed: retryResults.filter((r) => r.success).length,
    failed: errors.length,
    errors,
  };
}
