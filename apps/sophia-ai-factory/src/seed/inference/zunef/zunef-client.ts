import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';
import { ZUNEF_BASE_URL, type ZuneFResponse } from './types';
import { getOrCreateDeviceId, getOrRefreshToken } from './token-manager';
import { sleep } from './circuit-state';

export async function zunefChatCompletion(
  messages: Array<{ role: string; content: string }>,
  options: { model?: string } = {},
): Promise<string> {
  if (!shouldAllowRequest('openrouter')) {
    throw new Error('[ZuneF] Circuit breaker open for openrouter (same backend)');
  }

  const deviceId = await getOrCreateDeviceId();
  const token = await getOrRefreshToken(deviceId);

  const maxRetries = 8;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      const res = await fetch(`${ZUNEF_BASE_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: options.model || 'claude-3.5-sonnet',
          messages,
          max_tokens: 4096,
        }),
      });

      if (res.status === 429) {
        const retryAfter = parseInt(
          res.headers.get('Retry-After') || '5',
          10,
        );
        await sleep((retryAfter + Math.random()) * 1_000);
        attempt++;
        continue;
      }

      if (res.status >= 500) {
        const text = await res.text();

        if (text.includes('cooldown') || text.includes('cooling down')) {
          throw new Error(`ZuneF cooldown: ${text}`);
        }

        throw new Error(`ZuneF error ${res.status}: ${text}`);
      }

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`ZuneF error ${res.status}: ${text}`);
      }

      const data: ZuneFResponse = await res.json();
      recordSuccess('openrouter');
      return data.choices[0]?.message?.content || '';
    } catch (err) {
      attempt++;
      if (attempt >= maxRetries) {
        recordFailure('openrouter', classifyError(err));
        throw err;
      }

      const delay = Math.min(
        1_000 * 2 ** attempt + Math.random() * 1_000,
        30_000,
      );
      await sleep(delay);
    }
  }

  throw new Error('ZuneF: max retries exceeded');
}
