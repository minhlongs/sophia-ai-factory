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
} from "@/tree/gateway/gateway-types";
import { track } from "@/tree/signals/track";
import { D1Events } from "@/tree/signals/d1-event-types";
import { getErrorMessage } from "@/seed/utils/to-error";

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

/**
 * Bounded retry policy for selfHeal: max 3 attempts, delays [0, 1s, 2s].
 * Caps total per-channel wall-clock at ~3s so CF Worker CPU budget is safe.
 */
const SELF_HEAL_RETRY_POLICY: RetryPolicy = {
  maxRetries: 2,
  baseDelayMs: 1000,
  maxDelayMs: 2000,
};

/** Concurrency cap for selfHeal parallel retries (CF Worker CPU budget). */
const SELF_HEAL_CONCURRENCY = 5;

/**
 * Minimal p-limit: runs async tasks with a max concurrency cap.
 * Returns results in submission order (same as allSettled).
 */
function pLimit<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number,
): Promise<Array<PromiseSettledResult<T>>> {
  return new Promise((resolve) => {
    const results: Array<PromiseSettledResult<T>> = new Array(tasks.length);
    let next = 0;
    let completed = 0;

    function run(index: number): void {
      tasks[index]()
        .then((value) => {
          results[index] = { status: 'fulfilled', value };
        })
        .catch((reason: unknown) => {
          results[index] = { status: 'rejected', reason };
        })
        .finally(() => {
          completed++;
          if (completed === tasks.length) {
            resolve(results);
          } else if (next < tasks.length) {
            run(next++);
          }
        });
    }

    const initial = Math.min(concurrency, tasks.length);
    for (let i = 0; i < initial; i++) {
      run(next++);
    }
  });
}

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
   *
   * Parallel with concurrency cap (SELF_HEAL_CONCURRENCY=5) so N channels
   * take O(⌈N/5⌉ × per-channel-time) not O(N × per-channel-time).
   * Uses bounded retry policy: 3 attempts max, delays [0, 1s, 2s] (≤3s/channel).
   * Never throws — returns aggregate { healed, failed, errors }.
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
      return this.publishWithRetry(channel, content, SELF_HEAL_RETRY_POLICY);
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

  /** Publish to a single channel with exponential backoff retry */
  private async publishWithRetry(
    channel: GatewayChannel,
    content: CampaignOutput,
    policy: RetryPolicy = this.retryPolicy,
  ): Promise<PublishResult> {
    let lastError: string | undefined;

    for (let attempt = 0; attempt <= policy.maxRetries; attempt++) {
      try {
        const result = await channel.adapter.publish(content);
        if (result.success) return result;
        lastError = result.error;
      } catch (err) {
        lastError = getErrorMessage(err);
      }

      if (attempt < policy.maxRetries) {
        const delay = getBackoffDelay(
          attempt,
          policy.baseDelayMs,
          policy.maxDelayMs,
        );
        await sleep(delay);
      }
    }

    return {
      channelId: channel.id,
      success: false,
      error: `Failed after ${policy.maxRetries + 1} attempts: ${lastError}`,
    };
  }
}
