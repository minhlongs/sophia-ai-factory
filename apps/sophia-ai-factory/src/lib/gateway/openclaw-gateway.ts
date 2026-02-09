/**
 * OpenClaw Gateway - Multi-channel content distribution with self-healing.
 *
 * Manages registered channels, distributes content, runs health checks,
 * and retries failed distributions with exponential backoff.
 */

import type {
  CampaignOutput,
  DistributionResult,
  GatewayChannel,
  HealthReport,
  PublishResult,
  RetryPolicy,
} from "./gateway-types";

export type {
  CampaignOutput,
  ChannelAdapter,
  ChannelStatus,
  DistributionResult,
  GatewayChannel,
  HealthReport,
  PublishResult,
  RetryPolicy,
} from "./gateway-types";

const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
};

/** Sleep utility for backoff delays */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Calculate exponential backoff delay with jitter */
function getBackoffDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number,
): number {
  const exponential = baseDelay * Math.pow(2, attempt);
  const jitter = Math.random() * baseDelay;
  return Math.min(exponential + jitter, maxDelay);
}

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
        this.publishWithRetry(channel, content),
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

  /** Self-heal: retry failed distributions from a previous result */
  async selfHeal(
    content: CampaignOutput,
    previousResult: DistributionResult,
  ): Promise<DistributionResult> {
    const failedChannelIds = previousResult.results
      .filter((r) => !r.success)
      .map((r) => r.channelId);

    const retryResults: PublishResult[] = [];
    const passedResults = previousResult.results.filter((r) => r.success);

    for (const channelId of failedChannelIds) {
      const channel = this.channels.get(channelId);
      if (!channel || !channel.enabled) {
        retryResults.push({
          channelId,
          success: false,
          error: "Channel not found or disabled",
        });
        continue;
      }
      const result = await this.publishWithRetry(channel, content);
      retryResults.push(result);
    }

    const allResults = [...passedResults, ...retryResults];

    return {
      campaignId: content.campaignId,
      results: allResults,
      allSucceeded: allResults.every((r) => r.success),
    };
  }

  /** Publish to a single channel with exponential backoff retry */
  private async publishWithRetry(
    channel: GatewayChannel,
    content: CampaignOutput,
  ): Promise<PublishResult> {
    let lastError: string | undefined;

    for (let attempt = 0; attempt <= this.retryPolicy.maxRetries; attempt++) {
      try {
        const result = await channel.adapter.publish(content);
        if (result.success) return result;
        lastError = result.error;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }

      if (attempt < this.retryPolicy.maxRetries) {
        const delay = getBackoffDelay(
          attempt,
          this.retryPolicy.baseDelayMs,
          this.retryPolicy.maxDelayMs,
        );
        await sleep(delay);
      }
    }

    return {
      channelId: channel.id,
      success: false,
      error: `Failed after ${this.retryPolicy.maxRetries + 1} attempts: ${lastError}`,
    };
  }
}
