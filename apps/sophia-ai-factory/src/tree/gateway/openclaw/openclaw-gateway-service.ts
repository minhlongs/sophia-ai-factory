import type {
  CampaignOutput,
  DistributionResult,
  GatewayChannel,
  HealthReport,
  PublishResult,
  RetryPolicy,
} from '@/tree/gateway/gateway-types';
import { track } from '@/tree/signals/track';
import { D1Events } from '@/tree/signals/d1-event-types';
import {
  DEFAULT_RETRY_POLICY,
  SELF_HEAL_RETRY_POLICY,
  SELF_HEAL_CONCURRENCY,
} from './types';
import { pLimit } from './signature-signer';
import { publishWithRetry } from './circuit-breaker-client';

export class OpenClawGateway {
  private channels: Map<string, GatewayChannel> = new Map();
  private retryPolicy: RetryPolicy;

  constructor(retryPolicy?: Partial<RetryPolicy>) {
    this.retryPolicy = { ...DEFAULT_RETRY_POLICY, ...retryPolicy };
  }

  /** Register a new distribution channel */
  registerChannel(channel: GatewayChannel): void {
    this.channels.set(channel.id, channel);
  }

  /** Remove a channel by ID */
  removeChannel(channelId: string): boolean {
    return this.channels.delete(channelId);
  }

  /** Enable or disable a channel */
  setChannelEnabled(channelId: string, enabled: boolean): void {
    const channel = this.channels.get(channelId);
    if (channel) {
      channel.enabled = enabled;
    }
  }

  /** Get list of all registered channel IDs */
  getChannelIds(): string[] {
    return Array.from(this.channels.keys());
  }

  /** Distribute content to all enabled channels with retry on failure */
  async distribute(content: CampaignOutput): Promise<DistributionResult> {
    const enabledChannels = Array.from(this.channels.values()).filter(
      (ch) => ch.enabled,
    );

    const results: PublishResult[] = await Promise.allSettled(
      enabledChannels.map((channel) =>
        publishWithRetry(channel, content, this.retryPolicy),
      ),
    ).then((settled) =>
      settled.map((result, index) => {
        if (result.status === "fulfilled") {
          return result.value;
        }
        return {
          channelId: enabledChannels[index].id,
          success: false,
          error:
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason),
        };
      }),
    );

    track(D1Events.AGENT_DISPATCH, 'system', { campaign_id: content.campaignId, channel_count: enabledChannels.length });
    return {
      campaignId: content.campaignId,
      results,
      allSucceeded: results.every((r) => r.success),
    };
  }

  /** Run health checks on all registered channels */
  async healthCheck(): Promise<HealthReport> {
    const statuses = await Promise.all(
      Array.from(this.channels.values()).map(async (channel) => {
        try {
          return await channel.adapter.getStatus();
        } catch {
          return {
            channelId: channel.id,
            healthy: false,
            queueSize: 0,
          };
        }
      }),
    );

    return {
      timestamp: new Date(),
      channels: statuses,
      overallHealthy: statuses.every((s) => s.healthy),
    };
  }

  /**
   * Self-heal: retry failed distributions from a previous result.
   */
  async selfHeal(
    content: CampaignOutput,
    previousResult: DistributionResult,
  ): Promise<DistributionResult & { healed: number; failed: number; errors: string[] }> {
    const failedChannelIds = previousResult.results
      .filter((r) => !r.success)
      .map((r) => r.channelId);

    const passedResults = previousResult.results.filter((r) => r.success);

    const tasks = failedChannelIds.map((channelId) => (): Promise<PublishResult> => {
      const channel = this.channels.get(channelId);
      if (!channel || !channel.enabled) {
        return Promise.resolve({
          channelId,
          success: false,
          error: "Channel not found or disabled",
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
}
