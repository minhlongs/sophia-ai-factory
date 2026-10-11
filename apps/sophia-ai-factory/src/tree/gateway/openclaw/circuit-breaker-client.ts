import type { GatewayChannel, CampaignOutput, PublishResult, RetryPolicy } from '@/tree/gateway/gateway-types';
import { getErrorMessage } from '@/seed/utils/to-error';

/** Sleep utility for backoff delays */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Calculate exponential backoff delay with jitter */
export function getBackoffDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number,
): number {
  const exponential = baseDelay * Math.pow(2, attempt);
  const jitter = Math.random() * baseDelay;
  return Math.min(exponential + jitter, maxDelay);
}

/**
 * Publish to a single channel with exponential backoff retry.
 */
export async function publishWithRetry(
  channel: GatewayChannel,
  content: CampaignOutput,
  policy: RetryPolicy,
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
